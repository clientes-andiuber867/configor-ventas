begin;
create table if not exists public.configor_products (
 code text primary key check (code ~ '^[0-9]{4,16}$'), plu text not null,
 name text not null, price integer not null check(price>0), mode text not null check(mode='weight')
);
create table if not exists public.configor_members (
 email text primary key, name text not null, role text not null check(role in ('admin','cashier')),
 active integer not null check(active in (0,1)), "passwordHash" text not null
);
create table if not exists public.configor_settings (id text primary key, value jsonb not null);
create table if not exists public.configor_sessions (
 "tokenHash" text primary key, email text not null references public.configor_members(email), expires bigint not null
);
create index if not exists configor_sessions_expiry on public.configor_sessions(expires);
create index if not exists configor_sessions_member on public.configor_sessions(email);
create table if not exists public.configor_sales (
 id uuid primary key, created timestamptz not null default now(), cashier text not null,
 total integer not null check(total>0), cash integer not null check(cash>=0), qr integer not null check(qr>=0),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 status text not null check(status in ('completed','void')), void_reason text, qr_recipient text,
 check(total=cash+qr)
);
create index if not exists configor_sales_created on public.configor_sales(created desc,id);
create index if not exists configor_sales_cashier_created on public.configor_sales(cashier,created desc);
alter table public.configor_products enable row level security;
alter table public.configor_members enable row level security;
alter table public.configor_settings enable row level security;
alter table public.configor_sessions enable row level security;
alter table public.configor_sales enable row level security;
revoke all on public.configor_products,public.configor_members,public.configor_settings,public.configor_sessions,public.configor_sales from anon,authenticated;
grant select,insert,update,delete on public.configor_products,public.configor_members,public.configor_settings,public.configor_sessions,public.configor_sales to service_role;

-- Only the authenticated Next.js server can execute these transactions.
create or replace function public.configor_save_member(p_member jsonb,p_revoke boolean)
returns void language plpgsql set search_path=public as $$
begin
 if p_member->>'email'=(select value#>>'{}' from configor_settings where id='owner')
 and (p_member->>'role'<>'admin' or (p_member->>'active')::int<>1) then
  raise exception 'El administrador principal debe permanecer activo.';
 end if;
 insert into configor_members select * from jsonb_populate_record(null::configor_members,p_member)
 on conflict(email) do update set name=excluded.name,role=excluded.role,active=excluded.active,"passwordHash"=excluded."passwordHash";
 if p_revoke then delete from configor_sessions where email=p_member->>'email'; end if;
end $$;
revoke all on function public.configor_save_member(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.configor_save_member(jsonb,boolean) to service_role;

create or replace function public.configor_validate_sale() returns trigger language plpgsql set search_path=public as $$
declare line jsonb; sum_total bigint:=0;
begin
 for line in select * from jsonb_array_elements(new.items) loop
  if (line->>'amount')::bigint<=0 or (line->>'grams')::bigint<=0 then raise exception 'Artículo inválido'; end if;
  sum_total:=sum_total+(line->>'amount')::bigint;
 end loop;
 if sum_total is distinct from new.total then raise exception 'El total no coincide con los artículos'; end if;
 return new;
end $$;
drop trigger if exists configor_sale_totals on public.configor_sales;
create trigger configor_sale_totals before insert or update on public.configor_sales for each row execute function public.configor_validate_sale();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('configor-payments','configor-payments',false,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
commit;
