-- Run after migration 007 with an administrative connection. All test rows roll back.
begin;
do $$
declare a text := md5(random()::text)||md5(random()::text);
  lease uuid; newer uuid; result jsonb; duration integer; attempt integer; record public.configor_login_attempts;
begin
  if has_function_privilege('anon','public.configor_login_claim(text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.configor_login_complete(text,uuid,text)','EXECUTE') then
    raise exception 'Public role can change login protection';
  end if;
  foreach duration in array array[5,15,30,60,120,240,480,960,1440,1440] loop
    for attempt in 1..3 loop
      lease:=gen_random_uuid();
      result:=public.configor_login_claim(a,lease);
      if result->>'status'<>'allowed' then raise exception 'Claim failed'; end if;
      if public.configor_login_claim(a,gen_random_uuid())->>'status'<>'busy' then raise exception 'Parallel attempt admitted'; end if;
      if public.configor_login_complete(a,gen_random_uuid(),'success')->>'status'<>'expired' then raise exception 'Foreign completion accepted'; end if;
      result:=public.configor_login_complete(a,lease,'failure');
      if attempt<3 and (result->>'attemptsRemaining')::integer<>3-attempt then raise exception 'Wrong remaining attempts'; end if;
    end loop;
    if result->>'status'<>'blocked' then raise exception 'Third failure not blocked'; end if;
    if abs((result->>'blockedUntil')::numeric/1000-extract(epoch from clock_timestamp())-duration*60)>5 then raise exception 'Wrong lock duration: %',duration; end if;
    if public.configor_login_claim(a,gen_random_uuid())->>'status'<>'blocked' then raise exception 'Blocked account admitted'; end if;
    update public.configor_login_attempts set blocked_until='epoch' where account_hash=a;
  end loop;
  lease:=gen_random_uuid(); perform public.configor_login_claim(a,lease);
  perform public.configor_login_complete(a,lease,'success');
  select * into record from public.configor_login_attempts where account_hash=a;
  if record.level<>0 or record.failures<>0 or record.lease_id is not null then raise exception 'Success did not reset'; end if;
  lease:=gen_random_uuid(); perform public.configor_login_claim(a,lease);
  perform public.configor_login_complete(a,lease,'cancel');
  select * into record from public.configor_login_attempts where account_hash=a;
  if record.failures<>0 or record.lease_id is not null then raise exception 'Cancellation not released'; end if;
  lease:=gen_random_uuid(); perform public.configor_login_claim(a,lease);
  update public.configor_login_attempts set lease_until='epoch' where account_hash=a;
  newer:=gen_random_uuid(); perform public.configor_login_claim(a,newer);
  if public.configor_login_complete(a,lease,'success')->>'status'<>'expired' then raise exception 'Stale request reset newer attempt'; end if;
  if public.configor_login_complete(a,newer,'failure')->>'attemptsRemaining'<>'2' then raise exception 'Newer request lost'; end if;
end;
$$;
rollback;
