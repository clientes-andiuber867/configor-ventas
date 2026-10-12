create or replace function public.configor_patch_payments(p_patch jsonb)
returns void language sql set search_path=public as $$
 update configor_settings set value=value || p_patch where id='payments';
$$;
revoke all on function public.configor_patch_payments(jsonb) from public,anon,authenticated;
grant execute on function public.configor_patch_payments(jsonb) to service_role;
