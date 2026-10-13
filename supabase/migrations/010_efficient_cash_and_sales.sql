begin;
-- Authorization and register state/mutation in one database round trip.
create function public.configor_cash_workspace(p_token text,p_action text,p_id uuid default null,p_amount bigint default null,p_note text default '',p_history boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare usr jsonb;
begin
 usr:=configor_auth_user(p_token);
 if usr is null then return null; end if;
 return configor_cash_register(usr->>'email',usr->>'role'='admin',p_action,p_id,p_amount,p_note,p_history);
end $$;
revoke all on function public.configor_cash_workspace(text,text,uuid,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.configor_cash_workspace(text,text,uuid,bigint,text,boolean) to service_role;

-- One small response instead of all catalog pages plus a settings request.
create function public.configor_sale_context(p_codes text[])
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object(
  'products',(select coalesce(jsonb_agg(to_jsonb(p) order by code),'[]') from configor_products p where code=any(p_codes)),
  'settings',(select jsonb_object_agg(id,value) from configor_settings where id in ('owner','rule','payments'))
 );
$$;
revoke all on function public.configor_sale_context(text[]) from public,anon,authenticated;
grant execute on function public.configor_sale_context(text[]) to service_role;
create index if not exists configor_pending_cashier_lookup on public.configor_payment_intents(cashier,id) where amount>0 and not coalesce(cancelled,false);
create index if not exists configor_cashier_closed_lookup on public.configor_cash_sessions(cashier,closed desc) where closed is not null;
commit;
