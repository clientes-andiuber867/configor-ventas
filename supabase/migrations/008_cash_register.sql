-- Additive: existing payment endpoints and bank functions remain unchanged.
begin;
create table public.configor_cash_sessions (
 id uuid primary key, cashier text not null references public.configor_members(email),
 opened timestamptz not null default now(), closed timestamptz,
 opening bigint not null check(opening between 0 and 100000000),
 counted bigint check(counted between 0 and 100000000), expected bigint, difference bigint,
 cash_sales bigint not null default 0, qr_sales bigint not null default 0, sale_count integer not null default 0,
 opening_note text not null default '' check(length(opening_note)<=1000),
 closing_note text not null default '' check(length(closing_note)<=1000)
);
create unique index configor_one_open_cash_session on public.configor_cash_sessions(cashier) where closed is null;
create index configor_cash_session_closed on public.configor_cash_sessions(closed desc);
alter table public.configor_cash_sessions enable row level security;
revoke all on public.configor_cash_sessions from anon,authenticated;
grant select,insert,update on public.configor_cash_sessions to service_role;
alter table public.configor_sales add column cash_session_id uuid references public.configor_cash_sessions(id);
create index configor_sales_cash_session on public.configor_sales(cash_session_id) where cash_session_id is not null;

-- Serialize session opening/closing with sale attribution. Legacy sales remain intact.
create function public.configor_attach_cash_session() returns trigger language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('cash:'||new.cashier,0));
 if TG_OP='INSERT' then
  select id into new.cash_session_id from configor_cash_sessions where cashier=new.cashier and closed is null;
 end if;
 return new;
end $$;
create trigger configor_cash_sale before insert or update on public.configor_sales for each row execute function public.configor_attach_cash_session();
revoke all on function public.configor_attach_cash_session() from public,anon,authenticated;

create function public.configor_cash_register(p_cashier text,p_admin boolean,p_action text,p_id uuid default null,p_amount bigint default null,p_note text default '',p_history boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare active configor_cash_sessions; target configor_cash_sessions; cash_sum bigint; qr_sum bigint; n integer; history jsonb:='[]';
begin
 if p_action not in ('read','open','close') then raise exception 'Invalid action'; end if;
 if p_action<>'read' then
  if p_id is null or p_amount is null or p_amount<0 or p_amount>100000000 or length(p_note)>1000 then raise exception 'Invalid cash input'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash:'||p_cashier,0));
 end if;
 select * into active from configor_cash_sessions where cashier=p_cashier and closed is null;
 if p_action='open' then
  select * into target from configor_cash_sessions where id=p_id;
  if found then
   if target.cashier<>p_cashier then return jsonb_build_object('error','Identificador de caja no disponible.'); end if;
  else
   if active.id is not null then return jsonb_build_object('error','Ya tienes una caja abierta.'); end if;
   insert into configor_cash_sessions(id,cashier,opening,opening_note) values(p_id,p_cashier,p_amount,p_note) returning * into active;
  end if;
 end if;
 if p_action='close' then
  select * into target from configor_cash_sessions where id=p_id and cashier=p_cashier;
  if not found then return jsonb_build_object('error','Caja no encontrada.'); end if;
  if target.closed is null then
   if exists(select 1 from configor_payment_intents p where p.cashier=p_cashier and p.amount>0 and not coalesce(p.cancelled,false) and p.state<>'new' and not exists(select 1 from configor_sales s where s.id=p.id)) then
    return jsonb_build_object('error','Finaliza o cancela los cobros QR pendientes antes de cerrar caja.');
   end if;
   select coalesce(sum(cash),0),coalesce(sum(qr),0),count(*) into cash_sum,qr_sum,n from configor_sales where cash_session_id=target.id and status='completed';
   if p_amount<>target.opening+cash_sum and btrim(p_note)='' then return jsonb_build_object('error','Añade una observación para explicar el faltante o sobrante.'); end if;
   update configor_cash_sessions set closed=clock_timestamp(), counted=p_amount, expected=opening+cash_sum, difference=p_amount-opening-cash_sum,cash_sales=cash_sum,qr_sales=qr_sum,sale_count=n,closing_note=p_note where id=target.id;
  end if;
  select * into active from configor_cash_sessions where cashier=p_cashier and closed is null;
 end if;
 if active.id is not null then
  select coalesce(sum(cash),0),coalesce(sum(qr),0),count(*) into active.cash_sales,active.qr_sales,active.sale_count from configor_sales where cash_session_id=active.id and status='completed';
  active.expected:=active.opening+active.cash_sales;
 end if;
 if p_history then
  select coalesce(jsonb_agg(to_jsonb(c) order by closed desc),'[]') into history from (
   select * from configor_cash_sessions where closed is not null and (p_admin or (cashier=p_cashier and closed >= (date_trunc('day',now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'))) order by closed desc limit 50
  ) c;
 end if;
 return jsonb_build_object('active',case when active.id is not null then to_jsonb(active) else null end,'history',history);
end $$;
revoke all on function public.configor_cash_register(text,boolean,text,uuid,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.configor_cash_register(text,boolean,text,uuid,bigint,text,boolean) to service_role;

-- Clamp the range after server-side authentication, including sales-only requests.
create or replace function public.configor_workspace(p_token text,p_from timestamptz,p_to timestamptz,p_sales_only boolean default false)
returns jsonb language plpgsql stable set search_path=public as $$
declare usr jsonb; sales_data jsonb; payment jsonb;
begin
 usr:=configor_auth_user(p_token);
 if usr is null then return null; end if;
 if usr->>'role'<>'admin' then
  p_from:=date_trunc('day',now() at time zone 'America/La_Paz') at time zone 'America/La_Paz';
  p_to:=p_from+interval '1 day'-interval '1 microsecond';
 end if;
 if p_from>p_to then raise exception 'Período inválido'; end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by created desc,id),'[]') into sales_data from configor_sales s where created>=p_from and created<=p_to;
 if p_sales_only then return jsonb_build_object('sales',sales_data); end if;
 select value into payment from configor_settings where id='payments';
 return jsonb_build_object(
  'user',usr,'sales',sales_data,
  'products',(select coalesce(jsonb_agg(to_jsonb(p) order by length(plu),plu),'[]') from configor_products p),
  'members',case when usr->>'role'='admin' then (select coalesce(jsonb_agg(to_jsonb(m)-'passwordHash' order by name),'[]') from configor_members m) else '[]'::jsonb end,
  'rule',(select value from configor_settings where id='rule'),
  'payments',jsonb_build_object('recipient',payment->>'recipient','hasQr',coalesce(payment->>'qrKey','')<>'','qrVersion',payment->>'qrKey')
 );
end $$;
commit;
