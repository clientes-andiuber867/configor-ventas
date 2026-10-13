-- Shared, durable login protection for Vercel and multiple Node processes.
-- Additive: does not modify existing users, passwords, sessions or sales.
begin;
create table if not exists public.configor_login_attempts (
  account_hash text primary key check (account_hash ~ '^[a-f0-9]{64}$'),
  failures smallint not null default 0 check (failures between 0 and 2),
  level smallint not null default 0 check (level between 0 and 9),
  blocked_until timestamptz not null default 'epoch',
  lease_id uuid,
  lease_until timestamptz not null default 'epoch',
  updated_at timestamptz not null default now()
);
alter table public.configor_login_attempts enable row level security;
revoke all on public.configor_login_attempts from anon, authenticated;
grant all on public.configor_login_attempts to service_role;

create or replace function public.configor_login_claim(p_account text, p_lease uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.configor_login_attempts; t timestamptz := clock_timestamp();
begin
  if p_account is null or p_account !~ '^[a-f0-9]{64}$' or p_lease is null then
    raise exception 'Invalid login claim';
  end if;
  insert into public.configor_login_attempts(account_hash) values(p_account)
    on conflict(account_hash) do nothing;
  select * into r from public.configor_login_attempts where account_hash=p_account for update;
  if r.blocked_until > t then
    return jsonb_build_object('status','blocked','blockedUntil',floor(extract(epoch from r.blocked_until)*1000));
  end if;
  if r.lease_id is not null and r.lease_until > t then
    return jsonb_build_object('status','busy');
  end if;
  update public.configor_login_attempts set lease_id=p_lease, lease_until=t+interval '60 seconds', updated_at=t
    where account_hash=p_account;
  return jsonb_build_object('status','allowed');
end;
$$;

create or replace function public.configor_login_complete(p_account text, p_lease uuid, p_outcome text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.configor_login_attempts; t timestamptz := clock_timestamp(); minutes integer;
begin
  if p_outcome is null or p_outcome not in ('success','failure','cancel') then
    raise exception 'Invalid login outcome';
  end if;
  select * into r from public.configor_login_attempts where account_hash=p_account for update;
  if not found or p_lease is null or r.lease_id is distinct from p_lease or r.lease_until <= t then
    return jsonb_build_object('status','expired');
  end if;
  if p_outcome='success' then
    r.failures:=0; r.level:=0; r.blocked_until:='epoch';
  elsif p_outcome='failure' then
    r.failures:=r.failures+1;
    if r.failures >= 3 then
      minutes:=case when r.level=0 then 5 else least(1440,15*power(2,least(r.level-1,7))::integer) end;
      r.level:=least(9,r.level+1); r.failures:=0;
      r.blocked_until:=t+make_interval(mins=>minutes);
    end if;
  end if;
  update public.configor_login_attempts set failures=r.failures, level=r.level,
    blocked_until=r.blocked_until, lease_id=null, lease_until='epoch', updated_at=t
    where account_hash=p_account;
  return jsonb_build_object(
    'status',case when r.blocked_until>t then 'blocked' else 'allowed' end,
    'blockedUntil',floor(extract(epoch from r.blocked_until)*1000),
    'attemptsRemaining',3-r.failures);
end;
$$;
revoke all on function public.configor_login_claim(text,uuid) from public,anon,authenticated;
revoke all on function public.configor_login_complete(text,uuid,text) from public,anon,authenticated;
grant execute on function public.configor_login_claim(text,uuid) to service_role;
grant execute on function public.configor_login_complete(text,uuid,text) to service_role;
commit;
