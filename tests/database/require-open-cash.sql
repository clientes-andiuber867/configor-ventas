do $$
declare c text:='required-cash-test-'||gen_random_uuid(); sid uuid:=gen_random_uuid(); saleid uuid:=gen_random_uuid(); r jsonb; payload jsonb; pid uuid:=gen_random_uuid();
begin
 insert into configor_members(email,name,role,active,"passwordHash") values(c,'Cash test','cashier',1,'test');
 payload:=jsonb_build_object('id',saleid,'cashier',c,'created',now(),'total',100,'cash',100,'qr',0,'items','[{"amount":100,"grams":100}]'::jsonb,'status','completed');
 r:=configor_insert_cash_sale(payload);
 if r->>'error' is null then raise exception 'Closed cash allowed sale'; end if;
 r:=configor_reserve_cash_payment(pid,c,'test',100);
 if r->>'error' is null then raise exception 'Closed cash allowed QR'; end if;
 r:=configor_cash_register(c,false,'open',sid,0,'',false);
 r:=configor_reserve_cash_payment(pid,c,'test',100);
 if r->>'error' is not null then raise exception 'Open cash blocked QR'; end if;
 r:=configor_cash_register(c,false,'close',sid,0,'',false);
 if r->>'error' is null then raise exception 'Close raced pending QR reservation'; end if;
 update configor_payment_intents set cancelled=true where id=pid;
 r:=configor_insert_cash_sale(payload);
 if r->>'cash_session_id'<>sid::text then raise exception 'Sale not linked'; end if;
 r:=configor_cash_register(c,false,'close',sid,100,'',false);
 if r->>'error' is not null then raise exception 'Close failed'; end if;
 r:=configor_insert_cash_sale(payload);
 if r->>'id'<>saleid::text then raise exception 'Closed retry not idempotent'; end if;
 r:=configor_insert_cash_sale(payload||jsonb_build_object('id',gen_random_uuid()));
 if r->>'error' is null then raise exception 'Post-close sale allowed'; end if;
end $$;
