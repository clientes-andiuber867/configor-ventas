begin;
alter table public.configor_products drop constraint configor_products_mode_check;
alter table public.configor_products add constraint configor_products_mode_check check(mode in ('weight','unit'));
-- A code cannot silently switch between scale and packaged products, including
-- imports from older clients. The trigger also protects concurrent writes.
create function public.configor_preserve_product_mode() returns trigger language plpgsql set search_path=public as $$
begin
 if new.mode<>old.mode then raise exception 'El código pertenece a otro tipo de producto'; end if;
 return new;
end $$;
create trigger configor_product_mode before update on public.configor_products for each row execute function public.configor_preserve_product_mode();
create function public.configor_save_products(p_products jsonb) returns jsonb language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(62026012);
 if exists(select 1 from jsonb_to_recordset(p_products) as p(code text,mode text) join configor_products old using(code) where old.mode<>p.mode) then
  return jsonb_build_object('error','El código ya pertenece a otro tipo de producto. Usa un código diferente.');
 end if;
 insert into configor_products select * from jsonb_populate_recordset(null::configor_products,p_products)
 on conflict(code) do update set name=excluded.name,price=excluded.price,plu=excluded.plu,mode=excluded.mode;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.configor_save_products(jsonb) from public,anon,authenticated;
grant execute on function public.configor_save_products(jsonb) to service_role;
commit;
