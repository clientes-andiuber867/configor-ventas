-- Reserve an immutable payment reference before calling the bank.
create sequence if not exists public.configor_payment_number;
create or replace function public.configor_next_reference()
returns text language plpgsql set search_path=public as $$
declare n text;
begin
 n := nextval('public.configor_payment_number')::text;
 return 'C' || lpad(n, greatest(6, length(n)), '0');
end $$;
revoke all on function public.configor_next_reference() from public,anon,authenticated;
grant execute on function public.configor_next_reference() to service_role;
create table if not exists public.configor_payment_intents (
  id uuid primary key,
  reference text not null unique default public.configor_next_reference(),
  cashier text not null,
  fingerprint text not null,
  amount bigint not null check(amount >= 0),
  state text not null default 'new' check(state in ('new','generating','ready','error')),
  "qrId" text unique,
  "qrImage" text,
  "dueDate" text,
  paid boolean not null default false
);
alter table public.configor_payment_intents enable row level security;
revoke all on public.configor_payment_intents from anon, authenticated;
grant all on public.configor_payment_intents to service_role;
grant usage, select on sequence public.configor_payment_number to service_role;
alter table public.configor_sales add column if not exists reference text unique;
alter table public.configor_sales add column if not exists qr_id text unique;
create or replace function public.configor_reserve_payment(p_id uuid, p_cashier text, p_fingerprint text, p_amount bigint)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 insert into configor_payment_intents(id,cashier,fingerprint,amount)
 values(p_id,p_cashier,p_fingerprint,p_amount) on conflict(id) do nothing;
 select to_jsonb(p) into result from configor_payment_intents p where id=p_id;
 return result;
end $$;
revoke all on function public.configor_reserve_payment(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.configor_reserve_payment(uuid,text,text,bigint) to service_role;
