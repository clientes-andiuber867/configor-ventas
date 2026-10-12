-- One database round trip, one consistent snapshot for each page refresh.
create or replace function public.configor_auth_user(p_token text)
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('email',m.email,'name',m.name,'role',m.role,'active',m.active)
 from configor_sessions s join configor_members m on m.email=s.email
 where s."tokenHash"=p_token and s.expires>extract(epoch from now())*1000 and m.active=1;
$$;
revoke all on function public.configor_auth_user(text) from public,anon,authenticated;
grant execute on function public.configor_auth_user(text) to service_role;

create or replace function public.configor_workspace(p_token text,p_from timestamptz,p_to timestamptz,p_sales_only boolean default false)
returns jsonb language plpgsql stable set search_path=public as $$
declare usr jsonb; sales_data jsonb; payment jsonb;
begin
 usr:=configor_auth_user(p_token);
 if usr is null then return null; end if;
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
revoke all on function public.configor_workspace(text,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.configor_workspace(text,timestamptz,timestamptz,boolean) to service_role;
