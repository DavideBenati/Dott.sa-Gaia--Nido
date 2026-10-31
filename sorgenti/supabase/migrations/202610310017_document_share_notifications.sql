-- Transactional document-sharing notifications. Only NEW access grants enqueue
-- an email; existing files and recipients receive no retrospective messages.
-- This migration never changes document permissions or professional roles.
begin;

create table private.document_share_notifications (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.session_documents(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  grant_at timestamptz not null,
  status text not null default 'pending'
    check(status in('pending','sending','accepted','failed','cancelled')),
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0 check(attempts>=0),
  lease_token uuid,
  lease_until timestamptz,
  -- Freeze provider payload fields at the first claim, so an ambiguous retry
  -- uses exactly the same title/email and the same Resend idempotency key.
  document_title text,
  recipient_email text,
  last_error_code text,
  accepted_at timestamptz,
  check((document_title is null)=(recipient_email is null))
);
alter table private.document_share_notifications enable row level security;
revoke all on private.document_share_notifications from public,anon,authenticated;
create index document_share_notifications_queue
  on private.document_share_notifications(status,next_attempt_at,created_at);
create index document_share_notifications_document
  on private.document_share_notifications(document_id,recipient_id);

create function private.queue_document_share_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    -- The existing recipient RPC only grants active, ready documents. Repeat
    -- that condition here to keep direct trusted maintenance from mailing
    -- unfinished uploads or archived material.
    if exists(select 1 from public.session_documents d
      where d.id=new.document_id and d.active and d.state='ready') then
      insert into private.document_share_notifications(document_id,recipient_id,grant_at)
      values(new.document_id,new.user_id,new.granted_at);
    end if;
    return new;
  end if;
  update private.document_share_notifications n
  set status='cancelled',lease_token=null,lease_until=null,last_error_code='ACCESS_REVOKED'
  where n.document_id=old.document_id and n.recipient_id=old.user_id
    and n.status in('pending','sending','failed');
  return old;
end;
$$;
revoke all on function private.queue_document_share_notification() from public,anon,authenticated;
create trigger document_share_notification_grant
  after insert or delete on public.session_document_access
  for each row execute function private.queue_document_share_notification();

create function private.cancel_inactive_document_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.active or new.state<>'ready' then
    update private.document_share_notifications n
    set status='cancelled',lease_token=null,lease_until=null,last_error_code='DOCUMENT_UNAVAILABLE'
    where n.document_id=new.id and n.status in('pending','sending','failed');
  end if;
  return new;
end;
$$;
revoke all on function private.cancel_inactive_document_notifications() from public,anon,authenticated;
create trigger document_share_notification_archive
  after update of active,state on public.session_documents
  for each row execute function private.cancel_inactive_document_notifications();

create function public.document_notification_claim(
  p_document_id uuid default null,p_limit integer default 20
) returns table(
  job_id uuid,lease_token uuid,document_id uuid,recipient_id uuid,
  document_title text,recipient_email text,attempts integer
)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_limit<1 or p_limit>20 then
    raise exception 'Invalid notification batch size' using errcode='22023';
  end if;

  -- Never send after a revoke/archive/account removal. A changed email also
  -- cancels a frozen retry: an old address must not receive a later message.
  update private.document_share_notifications n
  set status='cancelled',lease_token=null,lease_until=null,last_error_code='ACCESS_UNAVAILABLE'
  where (p_document_id is null or n.document_id=p_document_id)
    and n.status in('pending','sending')
    and not exists(
      select 1 from public.session_documents d
      join public.session_document_access a on a.document_id=d.id
      join auth.users u on u.id=a.user_id
      where d.id=n.document_id and a.user_id=n.recipient_id
        and a.granted_at=n.grant_at and d.active and d.state='ready'
        and u.email_confirmed_at is not null and u.deleted_at is null
        and u.email is not null and length(trim(u.email))>0
        and(n.recipient_email is null or u.email=n.recipient_email)
    );

  -- Resend retains idempotency keys for 24 hours. Stop uncertain old jobs
  -- before that window ends instead of risking a duplicate notification.
  update private.document_share_notifications n
  set status='failed',lease_token=null,lease_until=null,
      last_error_code='IDEMPOTENCY_WINDOW_EXPIRED'
  where(p_document_id is null or n.document_id=p_document_id)
    and n.status in('pending','sending')
    and n.first_attempt_at<=now()-interval '23 hours';

  return query
  with candidates as (
    select n.id,u.email,d.title
    from private.document_share_notifications n
    join public.session_documents d on d.id=n.document_id
    join public.session_document_access a
      on a.document_id=n.document_id and a.user_id=n.recipient_id and a.granted_at=n.grant_at
    join auth.users u on u.id=n.recipient_id
    where(p_document_id is null or n.document_id=p_document_id)
      and d.active and d.state='ready'
      and u.email_confirmed_at is not null and u.deleted_at is null
      and u.email is not null and length(trim(u.email))>0
      and(n.recipient_email is null or u.email=n.recipient_email)
      and(n.first_attempt_at is null or n.first_attempt_at>now()-interval '23 hours')
      and((n.status='pending' and n.next_attempt_at<=now())
        or(n.status='sending' and n.lease_until<=now()))
    order by n.created_at,n.id
    limit p_limit for update of n skip locked
  ), claimed as (
    update private.document_share_notifications n
    set status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
        first_attempt_at=coalesce(n.first_attempt_at,now()),last_attempt_at=now(),
        attempts=n.attempts+1,
        document_title=coalesce(n.document_title,c.title),
        recipient_email=coalesce(n.recipient_email,c.email)
    from candidates c where n.id=c.id
    returning n.*
  )
  select c.id,c.lease_token,c.document_id,c.recipient_id,
         c.document_title,c.recipient_email,c.attempts
  from claimed c;
end;
$$;

create function public.document_notification_authorized(p_job_id uuid,p_lease_token uuid)
returns table(
  job_id uuid,lease_token uuid,document_id uuid,recipient_id uuid,
  document_title text,recipient_email text,attempts integer
)
language plpgsql security definer set search_path='' as $$
begin
  update private.document_share_notifications n
  set status='cancelled',lease_token=null,lease_until=null,last_error_code='ACCESS_UNAVAILABLE'
  where n.id=p_job_id and n.lease_token=p_lease_token and n.status='sending'
    and not exists(
      select 1 from public.session_documents d
      join public.session_document_access a on a.document_id=d.id
      join auth.users u on u.id=a.user_id
      where d.id=n.document_id and a.user_id=n.recipient_id
        and a.granted_at=n.grant_at and d.active and d.state='ready'
        and u.email_confirmed_at is not null and u.deleted_at is null
        and u.email=n.recipient_email
    );
  return query select n.id,n.lease_token,n.document_id,n.recipient_id,
    n.document_title,n.recipient_email,n.attempts
  from private.document_share_notifications n
  where n.id=p_job_id and n.lease_token=p_lease_token and n.status='sending'
    and n.lease_until>now() and n.first_attempt_at>now()-interval '23 hours';
end;
$$;

create function public.document_notification_finish(
  p_job_id uuid,p_lease_token uuid,p_result text,p_error_code text default null
) returns boolean
language plpgsql security definer set search_path='' as $$
declare updated_job uuid;
begin
  if p_result is null or p_result not in('accepted','retry','cancelled','uncertain')
    or(p_error_code is not null and p_error_code !~ '^[A-Za-z0-9_-]{1,64}$') then
    raise exception 'Invalid notification result' using errcode='22023';
  end if;
  update private.document_share_notifications n
  set status=case
        when p_result='accepted' then 'accepted'
        when p_result='cancelled' then 'cancelled'
        when n.first_attempt_at<=now()-interval '23 hours' then 'failed'
        else 'pending' end,
      accepted_at=case when p_result='accepted' then now() else null end,
      lease_token=null,lease_until=null,
      next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,least(n.attempts-1,6)))::integer),
      last_error_code=case
        when p_result='accepted' then null
        when n.first_attempt_at<=now()-interval '23 hours' then 'IDEMPOTENCY_WINDOW_EXPIRED'
        when p_result='uncertain' then coalesce(p_error_code,'DELIVERY_UNCERTAIN')
        else p_error_code end
  where n.id=p_job_id and n.lease_token=p_lease_token and n.status='sending'
  returning n.id into updated_job;
  return updated_job is not null;
end;
$$;

revoke all on function public.document_notification_claim(uuid,integer),
  public.document_notification_authorized(uuid,uuid),
  public.document_notification_finish(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.document_notification_claim(uuid,integer),
  public.document_notification_authorized(uuid,uuid),
  public.document_notification_finish(uuid,uuid,text,text)
  to service_role;

create function public.document_notification_status(p_document_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if public.can_manage_documents() is not true then
    raise exception 'Document manager authorization and MFA required' using errcode='42501';
  end if;
  return(
    select jsonb_build_object(
      'pending',count(*) filter(where status='pending'),
      'sending',count(*) filter(where status='sending'),
      'accepted',count(*) filter(where status='accepted'),
      'failed',count(*) filter(where status='failed'),
      'cancelled',count(*) filter(where status='cancelled'),
      'uncertain',count(*) filter(where status='failed' and last_error_code='IDEMPOTENCY_WINDOW_EXPIRED')
    ) from private.document_share_notifications where document_id=p_document_id
  );
end;
$$;
revoke all on function public.document_notification_status(uuid) from public,anon;
grant execute on function public.document_notification_status(uuid) to authenticated;

commit;
