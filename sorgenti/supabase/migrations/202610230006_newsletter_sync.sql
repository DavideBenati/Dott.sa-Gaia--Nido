-- Apply after 005. Does not enroll anyone or modify existing consents.
create table public.newsletter_sync_jobs(
 subscriber_id uuid primary key references public.newsletter_subscribers(id) on delete cascade,
 revision uuid not null default gen_random_uuid(),
 provider_seen boolean not null default false,
 state text not null default 'pending' check(state in ('pending','synced','error')),
 claim_token uuid,leased_until timestamptz,
 last_code text,updated_at timestamptz not null default now()
);
alter table public.newsletter_sync_jobs enable row level security;
revoke all on public.newsletter_sync_jobs from public,anon,authenticated;
grant all on public.newsletter_sync_jobs to service_role;
create table private.newsletter_provider_events(id text primary key,received_at timestamptz not null default now());
revoke all on private.newsletter_provider_events from public,anon,authenticated;
create function private.queue_newsletter_sync() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('confirmed','unsubscribed') then
 insert into public.newsletter_sync_jobs(subscriber_id)values(new.id)
 on conflict(subscriber_id)do update set revision=gen_random_uuid(),state='pending',claim_token=null,leased_until=null,last_code=null,updated_at=now();
 end if;return new;
end;$$;
revoke all on function private.queue_newsletter_sync() from public,anon,authenticated;
create trigger newsletter_sync_queue after insert or update of status on public.newsletter_subscribers for each row execute function private.queue_newsletter_sync();
insert into public.newsletter_sync_jobs(subscriber_id)select id from public.newsletter_subscribers where status in ('confirmed','unsubscribed');
create function public.newsletter_claim_jobs(only_subscriber uuid default null) returns setof public.newsletter_sync_jobs language sql security definer set search_path='' as $$
 update public.newsletter_sync_jobs j set claim_token=gen_random_uuid(),leased_until=now()+interval '2 minutes'
 where j.subscriber_id in(select q.subscriber_id from public.newsletter_sync_jobs q where q.state<>'synced' and(q.leased_until is null or q.leased_until<now())and(only_subscriber is null or q.subscriber_id=only_subscriber) order by q.updated_at limit 5 for update skip locked)
 returning j.*;
$$;
create function public.newsletter_queue_reconcile() returns void language sql security definer set search_path='' as $$
 insert into public.newsletter_sync_jobs(subscriber_id)select id from public.newsletter_subscribers where status in ('confirmed','unsubscribed')
 on conflict(subscriber_id)do update set revision=gen_random_uuid(),state='pending',claim_token=null,leased_until=null,last_code=null,updated_at=now();
$$;
create function public.newsletter_provider_optout(event_id text,event_email text,event_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if length(event_id)>200 or length(event_email)>254 or event_at>now()+interval '5 minutes' then raise exception 'Invalid event';end if;
 insert into private.newsletter_provider_events(id)values(event_id)on conflict do nothing;
 if not found then return;end if;
 update public.newsletter_subscribers set status='unsubscribed',unsubscribed_at=greatest(coalesce(unsubscribed_at,event_at),event_at),confirmation_hash=null,confirmation_expires_at=null
 where email=lower(trim(event_email))and(status<>'unsubscribed')and(confirmed_at is null or confirmed_at<=event_at)and requested_at<=event_at;
 delete from private.newsletter_provider_events where received_at<now()-interval '30 days';
end;$$;
revoke all on function public.newsletter_claim_jobs(uuid),public.newsletter_queue_reconcile(),public.newsletter_provider_optout(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.newsletter_claim_jobs(uuid),public.newsletter_queue_reconcile(),public.newsletter_provider_optout(text,text,timestamptz) to service_role;
create function public.newsletter_sync_status() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if public.is_editor() is not true then raise exception 'Editor authorization required' using errcode='42501';end if;
 return jsonb_build_object('pending',(select count(*)from public.newsletter_sync_jobs where state='pending'),'errors',(select count(*)from public.newsletter_sync_jobs where state='error'),'synced',(select count(*)from public.newsletter_sync_jobs where state='synced'),'confirmed',(select count(*)from public.newsletter_subscribers where status='confirmed'),'last_update',(select max(updated_at)from public.newsletter_sync_jobs),'last_webhook',(select max(received_at)from private.newsletter_provider_events));
end;$$;
revoke all on function public.newsletter_sync_status() from public,anon;
grant execute on function public.newsletter_sync_status() to authenticated;
create or replace function public.newsletter_editor_list() returns table(email text,confirmed_at timestamptz,consent_version text) language plpgsql security definer set search_path='' as $$
begin
 if public.is_editor() is not true then raise exception 'Editor authorization required' using errcode='42501';end if;
 if exists(select 1 from public.newsletter_sync_jobs where state<>'synced')then raise exception 'Newsletter synchronization required before export' using errcode='23514';end if;
 return query select n.email,n.confirmed_at,n.consent_version from public.newsletter_subscribers n where n.status='confirmed' order by n.confirmed_at desc;
end;$$;
