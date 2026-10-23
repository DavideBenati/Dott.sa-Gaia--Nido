-- Newsletter consent is separate from account preferences. No health data.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check(length(email) <= 254),
  status text not null check(status in ('pending','confirmed','unsubscribed')),
  consent_version text not null,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  confirmation_hash text,
  confirmation_expires_at timestamptz,
  unsubscribe_hash text
);
alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from public, anon, authenticated;
grant all on public.newsletter_subscribers to service_role;
create table if not exists public.newsletter_request_limits (
  bucket text primary key,
  attempts integer not null,
  expires_at timestamptz not null
);
alter table public.newsletter_request_limits enable row level security;
revoke all on public.newsletter_request_limits from public, anon, authenticated;
grant all on public.newsletter_request_limits to service_role;

-- Atomic rate limiting: email + network + daily global sending ceiling.
create or replace function public.newsletter_take_slot(bucket_key text, max_attempts integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare accepted boolean;
begin
  delete from public.newsletter_request_limits where expires_at < now();
  insert into public.newsletter_request_limits(bucket,attempts,expires_at)
  values(bucket_key,1,now()+make_interval(secs=>window_seconds))
  on conflict(bucket) do update set attempts = public.newsletter_request_limits.attempts+1
  where public.newsletter_request_limits.attempts < max_attempts
  returning true into accepted;
  return coalesce(accepted,false);
end;
$$;
revoke all on function public.newsletter_take_slot(text,integer,integer) from public, anon, authenticated;
grant execute on function public.newsletter_take_slot(text,integer,integer) to service_role;

-- Only an explicitly authorized editor can export confirmed subscribers.
create or replace function public.newsletter_editor_list()
returns table(email text, confirmed_at timestamptz, consent_version text)
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_editor() is not true then raise exception 'Editor authorization required' using errcode='42501'; end if;
  return query select n.email,n.confirmed_at,n.consent_version
    from public.newsletter_subscribers n where n.status='confirmed' order by n.confirmed_at desc;
end;
$$;
revoke all on function public.newsletter_editor_list() from public, anon;
grant execute on function public.newsletter_editor_list() to authenticated;
