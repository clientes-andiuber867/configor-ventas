-- Run inside a transaction and roll back: no real users/sales are touched.
do $$
declare c text:='cash-register-test-'||gen_random_uuid(); sid uuid:=gen_random_uuid(); saleid uuid:=gen_random_uuid(); r jsonb; token text:=gen_random_uuid()::text;
begin
 insert into configor_members(email,name,role,active,"passwordHash") values(c,'Cash test','cashier',1,'not-a-real-password');
 r:=configor_cash_register(c,false,'open',sid,10000,'test',false);
 if (r#>>'{active,opening}')::bigint<>10000 then raise exception 'Opening failed'; end if;
 r:=configor_cash_register(c,false,'open',gen_random_uuid(),0,'',false);
 if r->>'error' is null then raise exception 'Duplicate opening allowed'; end if;
 insert into configor_sales(id,cashier,total,cash,qr,items,status,created) values(saleid,c,1500,1000,500,'[{"amount":1500,"grams":100}]','completed',now());
 if (select cash_session_id from configor_sales where id=saleid) is distinct from sid then raise exception 'Sale attribution failed'; end if;
 r:=configor_cash_register(c,false,'read');
 if (r#>>'{active,expected}')::bigint<>11000 or (r#>>'{active,qr_sales}')::bigint<>500 then raise exception 'Totals failed: %',r; end if;
 r:=configor_cash_register(c,false,'close',sid,10900,'',false);
 if r->>'error' is null then raise exception 'Missing discrepancy note allowed'; end if;
 r:=configor_cash_register(c,false,'close',sid,10900,'Falta un boliviano',true);
 if (r#>>'{history,0,difference}')::bigint<>-100 or r->'active'<>'null'::jsonb then raise exception 'Closing failed: %',r; end if;
 r:=configor_cash_register(c,false,'close',sid,99999,'repeat',true);
 if (r#>>'{history,0,counted}')::bigint<>10900 then raise exception 'Closed record changed'; end if;
 insert into configor_sessions("tokenHash",email,expires) values(token,c,extract(epoch from now()+interval '1 hour')*1000);
 insert into configor_sales(id,cashier,total,cash,qr,items,status,created) values(gen_random_uuid(),c,100,100,0,'[{"amount":100,"grams":100}]','completed','2001-01-01');
 r:=configor_workspace(token,'2000-01-01','2002-01-01',true);
 if exists(select 1 from jsonb_array_elements(r->'sales') s where (s->>'created')::timestamptz < (date_trunc('day',now() at time zone 'America/La_Paz') at time zone 'America/La_Paz')) then raise exception 'Cashier history leaked'; end if;
end $$;
