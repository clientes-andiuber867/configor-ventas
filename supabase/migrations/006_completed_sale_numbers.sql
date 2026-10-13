-- Bank attempts have unique IDs; only committed sales consume C numbers.
alter table public.configor_payment_intents add column if not exists "saleReference" text;
create or replace function public.configor_pending_sale_reference()
returns text language sql stable set search_path=public as $$
 select 'C' || lpad(n, greatest(6,length(n)), '0') from (
 select (coalesce(max(substring(reference from 2)::bigint),0)+1)::text n
 from configor_sales where reference ~ '^C[0-9]+$') t;
$$;
revoke all on function public.configor_pending_sale_reference() from public,anon,authenticated;
grant execute on function public.configor_pending_sale_reference() to service_role;

create or replace function public.configor_reserve_payment(p_id uuid,p_cashier text,p_fingerprint text,p_amount bigint)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 insert into configor_payment_intents(id,reference,"saleReference",cashier,fingerprint,amount)
 values(p_id,'Q'||replace(p_id::text,'-',''),configor_pending_sale_reference(),p_cashier,p_fingerprint,p_amount)
 on conflict(id) do nothing;
 select to_jsonb(p) into result from configor_payment_intents p where id=p_id;
 return result;
end $$;
revoke all on function public.configor_reserve_payment(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.configor_reserve_payment(uuid,text,text,bigint) to service_role;

create or replace function public.configor_insert_numbered_sale(p_sale jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb; new_reference text;
begin
 -- The lock and insert belong to one transaction. Failures and duplicate retries
 -- do not consume a number; concurrent cashiers get different final numbers.
 perform pg_advisory_xact_lock(62026006);
 select to_jsonb(s) into result from configor_sales s where id=(p_sale->>'id')::uuid;
 if result is not null then return result; end if;
 new_reference := configor_pending_sale_reference();
 insert into configor_sales select * from jsonb_populate_record(null::configor_sales,
 p_sale || jsonb_build_object('reference',new_reference));
 select to_jsonb(s) into result from configor_sales s where id=(p_sale->>'id')::uuid;
 return result;
end $$;
revoke all on function public.configor_insert_numbered_sale(jsonb) from public,anon,authenticated;
grant execute on function public.configor_insert_numbered_sale(jsonb) to service_role;
