-- Run in a transaction and roll back.
do $$
declare c text:='9876543210123456'; r jsonb;
begin
 if exists(select 1 from configor_products where code=c) then raise exception 'Fixture code already exists'; end if;
 r:=configor_save_products(jsonb_build_array(jsonb_build_object('code',c,'plu','','name','Unit fixture','price',750,'mode','unit')));
 if r->>'ok'<>'true' then raise exception 'Unit creation failed'; end if;
 r:=configor_save_products(jsonb_build_array(jsonb_build_object('code',c,'plu','1','name','Weight fixture','price',800,'mode','weight')));
 if r->>'error' is null then raise exception 'Import overwrote unit'; end if;
 if (select mode from configor_products where code=c)<>'unit' then raise exception 'Mode changed'; end if;
 if has_function_privilege('anon','configor_save_products(jsonb)','EXECUTE') then raise exception 'Public write access'; end if;
end $$;
