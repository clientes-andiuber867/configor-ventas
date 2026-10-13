begin;
-- Guard new writes without changing the bank integration or the legacy RPCs.
create function public.configor_reserve_cash_payment(p_id uuid,p_cashier text,p_fingerprint text,p_amount bigint)
returns jsonb language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('cash:'||p_cashier,0));
 if not exists(select 1 from configor_sales where id=p_id) and not exists(select 1 from configor_cash_sessions where cashier=p_cashier and closed is null) then
  return jsonb_build_object('error','Abre tu caja antes de realizar una venta.');
 end if;
 return configor_reserve_payment(p_id,p_cashier,p_fingerprint,p_amount);
end $$;
revoke all on function public.configor_reserve_cash_payment(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.configor_reserve_cash_payment(uuid,text,text,bigint) to service_role;

create function public.configor_insert_cash_sale(p_sale jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(62026006);
 perform pg_advisory_xact_lock(hashtextextended('cash:'||(p_sale->>'cashier'),0));
 select to_jsonb(s) into result from configor_sales s where id=(p_sale->>'id')::uuid;
 if result is not null then return result; end if;
 if not exists(select 1 from configor_cash_sessions where cashier=p_sale->>'cashier' and closed is null) then
  return jsonb_build_object('error','Abre tu caja antes de realizar una venta.');
 end if;
 return configor_insert_numbered_sale(p_sale);
end $$;
revoke all on function public.configor_insert_cash_sale(jsonb) from public,anon,authenticated;
grant execute on function public.configor_insert_cash_sale(jsonb) to service_role;
create or replace function public.configor_cash_register(p_cashier text,p_admin boolean,p_action text,p_id uuid default null,p_amount bigint default null,p_note text default '',p_history boolean default false)
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
   if exists(select 1 from configor_payment_intents p where p.cashier=p_cashier and p.amount>0 and not coalesce(p.cancelled,false) and not exists(select 1 from configor_sales s where s.id=p.id)) then
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


commit;
