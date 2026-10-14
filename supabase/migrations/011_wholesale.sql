begin;
create table public.configor_wholesale_customers (
 id uuid primary key,
 name text not null check (length(btrim(name)) between 2 and 100),
 phone text not null default '' check (length(phone)<=40),
 created timestamptz not null default now()
);
alter table public.configor_wholesale_customers enable row level security;
revoke all on public.configor_wholesale_customers from anon, authenticated;
grant select, insert on public.configor_wholesale_customers to service_role;
create index configor_wholesale_customer_order on public.configor_wholesale_customers(created desc,id desc);
alter table public.configor_sales
 add column wholesale_customer_id uuid references public.configor_wholesale_customers(id) on delete restrict,
 add column wholesale_customer_name text;
create index configor_wholesale_history on public.configor_sales(wholesale_customer_id,created desc,id desc) where wholesale_customer_id is not null;

-- Preserve register locks, numbering and retry behavior. Resolve the customer
-- name on the server, inside the same transaction as the sale.
create or replace function public.configor_insert_cash_sale(p_sale jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb; customer_name text;
begin
 perform pg_advisory_xact_lock(62026006);
 perform pg_advisory_xact_lock(hashtextextended('cash:'||(p_sale->>'cashier'),0));
 select to_jsonb(s) into result from configor_sales s where id=(p_sale->>'id')::uuid;
 if result is not null then return result; end if;
 if not exists(select 1 from configor_cash_sessions where cashier=p_sale->>'cashier' and closed is null) then
  return jsonb_build_object('error','Abre tu caja antes de realizar una venta.');
 end if;
 if p_sale->>'wholesale_customer_id' is not null then
  select name into customer_name from configor_wholesale_customers where id=(p_sale->>'wholesale_customer_id')::uuid for key share;
  if not found then return jsonb_build_object('error','Cliente mayorista no encontrado.'); end if;
 end if;
 return configor_insert_numbered_sale(p_sale || jsonb_build_object('wholesale_customer_name',customer_name));
end $$;
revoke all on function public.configor_insert_cash_sale(jsonb) from public,anon,authenticated;
grant execute on function public.configor_insert_cash_sale(jsonb) to service_role;
commit;
