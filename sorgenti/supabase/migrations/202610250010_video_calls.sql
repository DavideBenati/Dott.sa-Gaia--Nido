-- Apply after 009. Private, expiring invitations; no public meeting directory.
begin;
create table private.video_call_invitations (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  room_url text not null check (room_url ~ '^https://meet[.]hostpoint[.]ch/[A-Za-z0-9_-]{8,200}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  revoked_at timestamptz,
  unique(room_url)
);
alter table private.video_call_invitations enable row level security;
revoke all on private.video_call_invitations from public, anon, authenticated;

create function public.search_video_call_users(search_term text)
returns table(user_id uuid, email text, nickname text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_editor() then raise exception 'Account Studio richiesto.' using errcode='42501'; end if;
  if char_length(btrim(coalesce(search_term,''))) < 2 then return; end if;
  return query select u.id,u.email::text,coalesce(p.display_name,'')
    from auth.users u left join public.profiles p on p.user_id=u.id
    where u.email_confirmed_at is not null and
      (strpos(lower(coalesce(u.email,'')),lower(btrim(left(search_term,120))))>0
       or strpos(lower(coalesce(p.display_name,'')),lower(btrim(left(search_term,120))))>0)
    order by lower(coalesce(p.display_name,'')),lower(u.email),u.id limit 20;
end; $$;

create function public.list_video_call_invitations(manage boolean default false)
returns table(id uuid,recipient_id uuid,nickname text,email text,expires_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or (manage and not public.is_editor()) then
    raise exception 'Accesso non autorizzato.' using errcode='42501';
  end if;
  return query select i.id,i.recipient_id,coalesce(p.display_name,''),u.email::text,i.expires_at
    from private.video_call_invitations i join auth.users u on u.id=i.recipient_id
    left join public.profiles p on p.user_id=u.id
    where (manage or i.recipient_id=auth.uid()) and i.revoked_at is null and i.expires_at>now()
    order by i.created_at desc,i.id limit 50;
end; $$;

create function public.create_video_call_invitation(p_recipient_id uuid,p_room_url text,p_expected_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id or not public.is_editor() then
    raise exception 'Accesso Studio cambiato o non autorizzato.' using errcode='42501';
  end if;
  if p_room_url is null or p_room_url !~ '^https://meet[.]hostpoint[.]ch/[A-Za-z0-9_-]{8,200}$' then
    raise exception 'Usa un link completo meet.hostpoint.ch con un nome stanza di almeno 8 caratteri, senza parametri.' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users where auth.users.id=p_recipient_id and email_confirmed_at is not null) then
    raise exception 'Account destinatario non disponibile o non confermato.' using errcode='22023';
  end if;
  insert into private.video_call_invitations(recipient_id,created_by,room_url)
    values(p_recipient_id,auth.uid(),p_room_url) returning private.video_call_invitations.id into result;
  return result;
exception when unique_violation then
  raise exception 'Questa stanza è già stata usata: crea un link diverso per ogni incontro.' using errcode='22023';
end; $$;

create function public.revoke_video_call_invitation(p_invitation_id uuid,p_expected_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id or not public.is_editor() then
    raise exception 'Accesso Studio cambiato o non autorizzato.' using errcode='42501';
  end if;
  update private.video_call_invitations set revoked_at=clock_timestamp() where id=p_invitation_id and revoked_at is null;
end; $$;

create function public.open_video_call_invitation(p_invitation_id uuid,p_expected_user_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare result text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
    raise exception 'Ripeti l’accesso.' using errcode='42501';
  end if;
  select room_url into result from private.video_call_invitations
    where id=p_invitation_id and revoked_at is null and expires_at>now()
      and (recipient_id=auth.uid() or public.is_editor());
  if result is null then raise exception 'Invito scaduto o non più disponibile.' using errcode='42501'; end if;
  return result;
end; $$;

revoke all on function public.search_video_call_users(text) from public,anon;
revoke all on function public.list_video_call_invitations(boolean) from public,anon;
revoke all on function public.create_video_call_invitation(uuid,text,uuid) from public,anon;
revoke all on function public.revoke_video_call_invitation(uuid,uuid) from public,anon;
revoke all on function public.open_video_call_invitation(uuid,uuid) from public,anon;
grant execute on function public.search_video_call_users(text) to authenticated;
grant execute on function public.list_video_call_invitations(boolean) to authenticated;
grant execute on function public.create_video_call_invitation(uuid,text,uuid) to authenticated;
grant execute on function public.revoke_video_call_invitation(uuid,uuid) to authenticated;
grant execute on function public.open_video_call_invitation(uuid,uuid) to authenticated;
commit;
