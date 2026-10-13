do $$
declare c text:='efficient-cash-test-'||gen_random_uuid(); token text:=gen_random_uuid()::text; sid uuid:=gen_random_uuid(); r jsonb; product_code text;
begin
 if configor_cash_workspace('invalid-session','read') is not null then raise exception 'Unauthenticated access'; end if;
 insert into configor_members(email,name,role,active,"passwordHash") values(c,'Test','cashier',1,'test');
 insert into configor_sessions("tokenHash",email,expires) values(token,c,extract(epoch from now()+interval '1 hour')*1000);
 r:=configor_cash_workspace(token,'open',sid,0,'',false);
 if r#>>'{active,cashier}'<>c then raise exception 'Cash ownership failed'; end if;
 r:=configor_cash_workspace(token,'close',sid,0,'',true);
 if r#>>'{history,0,cashier}'<>c then raise exception 'Close failed'; end if;
 delete from configor_sessions where "tokenHash"=token;
 if configor_cash_workspace(token,'read') is not null then raise exception 'Revoked session accepted'; end if;
 r:=configor_sale_context(array[]::text[]);
 if jsonb_array_length(r->'products')<>0 or r#>'{settings,rule}' is null then raise exception 'Invalid empty context'; end if;
 select code into product_code from configor_products limit 1;
 if product_code is not null then
  r:=configor_sale_context(array[product_code,product_code]);
  if jsonb_array_length(r->'products')<>1 or r#>>'{products,0,code}'<>product_code then raise exception 'Unbounded product query'; end if;
 end if;
end $$;
