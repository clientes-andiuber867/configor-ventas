-- Execute inside a transaction and ROLLBACK; never leave test sales behind.
do $$
declare c text:='wholesale-test-'||gen_random_uuid(); sid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); saleid uuid:=gen_random_uuid(); r jsonb; payload jsonb;
begin
 if has_table_privilege('anon','configor_wholesale_customers','SELECT') or has_table_privilege('authenticated','configor_wholesale_customers','INSERT') then raise exception 'Customer table exposed'; end if;
 if not (select relrowsecurity from pg_class where oid='configor_wholesale_customers'::regclass) then raise exception 'Missing RLS'; end if;
 insert into configor_members(email,name,role,active,"passwordHash") values(c,'Wholesale test','cashier',1,'test');
 insert into configor_wholesale_customers(id,name) values(cid,'Cliente de prueba');
 payload:=jsonb_build_object('id',saleid,'cashier',c,'created',now(),'total',100,'cash',100,'qr',0,'items','[{"amount":100,"grams":100}]'::jsonb,'status','completed','wholesale_customer_id',cid,'wholesale_customer_name','Forged');
 r:=configor_insert_cash_sale(payload);
 if r->>'error' is null then raise exception 'Closed cash allowed sale'; end if;
 perform configor_cash_register(c,false,'open',sid,0,'',false);
 r:=configor_insert_cash_sale(payload||jsonb_build_object('wholesale_customer_id',gen_random_uuid()));
 if r->>'error' is null then raise exception 'Unknown customer accepted'; end if;
 r:=configor_insert_cash_sale(payload);
 if r->>'wholesale_customer_name'<>'Cliente de prueba' or r->>'wholesale_customer_id'<>cid::text or r->>'cash_session_id'<>sid::text then raise exception 'Incorrect association'; end if;
 if configor_insert_cash_sale(payload)<>r then raise exception 'Retry changed sale'; end if;
 if (select count(*) from configor_sales where id=saleid)<>1 then raise exception 'Duplicate sale'; end if;
 r:=configor_cash_register(c,false,'read');
 if r->'active'->>'cash_sales'<>'100' then raise exception 'Sale missing from register'; end if;
 update configor_sales set status='void',void_reason='Test void' where id=saleid;
 r:=configor_cash_register(c,false,'read');
 if r->'active'->>'cash_sales'<>'0' then raise exception 'Void still counted'; end if;
 r:=configor_insert_cash_sale((payload-'wholesale_customer_id')||jsonb_build_object('id',gen_random_uuid()));
 if r->>'wholesale_customer_id' is not null or r->>'wholesale_customer_name' is not null then raise exception 'Retail inherited customer'; end if;
end $$;
