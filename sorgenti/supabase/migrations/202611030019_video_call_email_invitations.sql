-- Manual video-call email invitations. Saving an invitation NEVER queues mail.
-- No trigger or scheduler: a verified editor must explicitly request each send.
begin;

create table private.video_call_emails (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references private.video_call_invitations(id) on delete cascade,
  recipient_email text not null,
  expires_at timestamptz not null,
  status text not null check(status in('sending','accepted','retry','uncertain','failed')),
  first_attempt_at timestamptz not null default now(),
  attempts integer not null default 1 check(attempts>0),
  lease_token uuid,
  lease_until timestamptz,
  accepted_at timestamptz,
  last_error_code text
);
alter table private.video_call_emails enable row level security;
revoke all on private.video_call_emails from public,anon,authenticated;

create function public.video_call_email_claim(p_invitation_id uuid,p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation private.video_call_invitations%rowtype;
  notification private.video_call_emails%rowtype;
  current_email text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id or public.is_editor() is not true then
    raise exception 'Accesso Studio cambiato o non autorizzato.' using errcode='42501';
  end if;
  -- Lock the invitation before the first insert, including concurrent clicks.
  select * into invitation from private.video_call_invitations where id=p_invitation_id for update;
  if invitation.id is null or invitation.revoked_at is not null or invitation.expires_at<=now() then
    raise exception 'Invito scaduto o non più disponibile.' using errcode='42501';
  end if;
  select u.email into current_email from auth.users u where u.id=invitation.recipient_id
    and u.email_confirmed_at is not null and u.deleted_at is null;
  if current_email is null or length(btrim(current_email))=0 then
    raise exception 'Account destinatario non disponibile o non confermato.' using errcode='42501';
  end if;

  select * into notification from private.video_call_emails where invitation_id=invitation.id for update;
  if notification.id is null then
    insert into private.video_call_emails(invitation_id,recipient_email,expires_at,status,lease_token,lease_until)
    values(invitation.id,current_email,invitation.expires_at,'sending',gen_random_uuid(),now()+interval '2 minutes')
    returning * into notification;
  elsif notification.status='accepted' then
    return jsonb_build_object('status','accepted','accepted_at',notification.accepted_at);
  elsif notification.recipient_email is distinct from current_email
    or notification.first_attempt_at<=now()-interval '23 hours' or notification.status='failed' then
    -- Resend keeps idempotency keys 24h. Never retry an ambiguous old send
    -- outside that window, or send its frozen payload to a changed address.
    update private.video_call_emails set status='failed',lease_token=null,lease_until=null,
      last_error_code=case when recipient_email is distinct from current_email then 'recipient_changed' else 'retry_window_closed' end
      where id=notification.id;
    return jsonb_build_object('status','failed','accepted_at',null);
  elsif notification.status='sending' and notification.lease_until>now() then
    return jsonb_build_object('status','sending','accepted_at',null);
  else
    update private.video_call_emails set status='sending',lease_token=gen_random_uuid(),
      lease_until=now()+interval '2 minutes',attempts=attempts+1
      where id=notification.id returning * into notification;
  end if;
  return jsonb_build_object('status','sending','job_id',notification.id,'lease_token',notification.lease_token,
    'invitation_id',invitation.id,'recipient_email',notification.recipient_email,'expires_at',notification.expires_at,
    'accepted_at',null);
end;
$$;

create function public.video_call_email_authorized(p_job_id uuid,p_lease_token uuid,p_expected_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id or public.is_editor() is not true then
    return false;
  end if;
  return exists(select 1 from private.video_call_emails n
    join private.video_call_invitations i on i.id=n.invitation_id
    join auth.users u on u.id=i.recipient_id
    where n.id=p_job_id and n.lease_token=p_lease_token and n.status='sending' and n.lease_until>now()
      and n.first_attempt_at>now()-interval '23 hours'
      and i.revoked_at is null and i.expires_at>now()
      and u.email=n.recipient_email and u.email_confirmed_at is not null and u.deleted_at is null);
end;
$$;

create function public.video_call_email_finish(p_job_id uuid,p_lease_token uuid,p_result text,p_error_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed uuid;
begin
  if p_result is null or p_result not in('accepted','retry','uncertain','failed')
    or(p_error_code is not null and p_error_code!~'^[A-Za-z0-9_-]{1,64}$') then
    raise exception 'Invalid email result' using errcode='22023';
  end if;
  update private.video_call_emails n set status=p_result,
    accepted_at=case when p_result='accepted' then now() else null end,
    lease_token=null,lease_until=null,last_error_code=p_error_code
    where n.id=p_job_id and n.lease_token=p_lease_token and n.status='sending'
    returning n.id into changed;
  return changed is not null;
end;
$$;

create function public.list_video_call_email_status(p_invitation_ids uuid[])
returns table(invitation_id uuid,status text,accepted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or public.is_editor() is not true then
    raise exception 'Account Studio richiesto.' using errcode='42501';
  end if;
  if p_invitation_ids is null or cardinality(p_invitation_ids)>50 then
    raise exception 'Invalid invitation list' using errcode='22023';
  end if;
  return query select i.id,
    case when n.id is null then 'not_sent'
      when n.status='accepted' then 'accepted'
      when n.first_attempt_at<=now()-interval '23 hours' then 'failed'
      when n.status='sending' and n.lease_until<=now() then 'uncertain'
      else n.status end,n.accepted_at
    from private.video_call_invitations i left join private.video_call_emails n on n.invitation_id=i.id
    where i.id=any(p_invitation_ids) order by i.created_at desc,i.id;
end;
$$;

revoke all on function public.video_call_email_claim(uuid,uuid),public.video_call_email_authorized(uuid,uuid,uuid),
  public.list_video_call_email_status(uuid[]) from public,anon;
grant execute on function public.video_call_email_claim(uuid,uuid),public.video_call_email_authorized(uuid,uuid,uuid),
  public.list_video_call_email_status(uuid[]) to authenticated;
revoke all on function public.video_call_email_finish(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.video_call_email_finish(uuid,uuid,text,text) to service_role;
commit;
