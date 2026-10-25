-- Apply after 011. Family links never extend profile, chat or document access.
-- A nickname is a label; the random private code and owner approval create access.
begin;

create table private.family_share_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code_hash bytea not null unique,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  revoked_at timestamptz
);
create index family_share_invites_owner_idx on private.family_share_invites(owner_id);
create table private.family_share_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reader_id uuid not null references auth.users(id) on delete cascade,
  invitation_id uuid not null references private.family_share_invites(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined','revoked')),
  created_at timestamptz not null default clock_timestamp(),
  approved_at timestamptz,
  check (owner_id <> reader_id)
);
create unique index family_share_active_pair_idx
  on private.family_share_grants(owner_id,reader_id) where status in ('pending','approved');
create index family_share_grants_reader_idx on private.family_share_grants(reader_id);
alter table private.family_share_invites enable row level security;
alter table private.family_share_grants enable row level security;
revoke all on private.family_share_invites, private.family_share_grants from public, anon, authenticated;

create function private.require_family_account(p_expected_user_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id
    or not exists(select 1 from auth.users u where u.id=auth.uid()
      and u.email_confirmed_at is not null and u.deleted_at is null) then
    raise exception 'Accedi con un account confermato e riapri le condivisioni.' using errcode='42501';
  end if;
end; $$;
revoke all on function private.require_family_account(uuid) from public, anon, authenticated;

create function public.create_family_invite(p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  secret text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  expires timestamptz;
begin
  perform private.require_family_account(p_expected_user_id);
  -- Serialize rotations and requests for this owner, including concurrent tabs.
  perform 1 from auth.users u where u.id=auth.uid() for update;
  if not exists(select 1 from public.profiles p where p.user_id=auth.uid()
    and coalesce(private.normalized_member_nickname(p.display_name),'') <> '') then
    raise exception 'Scegli prima il tuo nickname nel Profilo.' using errcode='22023';
  end if;
  update private.family_share_invites set revoked_at=clock_timestamp()
    where owner_id=auth.uid() and revoked_at is null;
  update private.family_share_grants set status='revoked'
    where owner_id=auth.uid() and status='pending';
  insert into private.family_share_invites(owner_id,code_hash)
    values(auth.uid(),pg_catalog.sha256(pg_catalog.convert_to(secret,'UTF8')))
    returning expires_at into expires;
  return pg_catalog.jsonb_build_object('code',secret,'expires_at',expires);
end; $$;

create function public.request_family_share(p_nickname text,p_code text,p_expected_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation private.family_share_invites; result uuid;
begin
  perform private.require_family_account(p_expected_user_id);
  if p_code is null or p_code !~ '^[a-f0-9]{64}$'
    or coalesce(private.normalized_member_nickname(p_nickname),'')='' then
    raise exception 'Nickname e codice non validi o invito scaduto.' using errcode='22023';
  end if;
  select i.* into invitation from private.family_share_invites i
    join public.profiles p on p.user_id=i.owner_id
    join auth.users u on u.id=i.owner_id
    where i.code_hash=pg_catalog.sha256(pg_catalog.convert_to(p_code,'UTF8'))
      and private.normalized_member_nickname(p.display_name)=private.normalized_member_nickname(p_nickname)
      and i.revoked_at is null and i.expires_at>clock_timestamp()
      and u.deleted_at is null and u.email_confirmed_at is not null and u.id<>auth.uid()
    for update of i;
  if invitation.id is null then
    raise exception 'Nickname e codice non validi o invito scaduto.' using errcode='22023';
  end if;
  -- Expired requests do not block a fresh invitation to the same person.
  update private.family_share_grants g set status='revoked'
    where (g.owner_id=invitation.owner_id or g.reader_id=auth.uid()) and g.status='pending'
      and not exists(select 1 from private.family_share_invites i where i.id=g.invitation_id
        and i.revoked_at is null and i.expires_at>clock_timestamp());
  select g.id into result from private.family_share_grants g
    where g.owner_id=invitation.owner_id and g.reader_id=auth.uid() and g.status in ('pending','approved');
  if result is not null then return result; end if;
  if (select count(*) from private.family_share_grants g where g.owner_id=invitation.owner_id
      and g.status in ('pending','approved')) >= 50
    or (select count(*) from private.family_share_grants g where g.reader_id=auth.uid()
      and g.status in ('pending','approved')) >= 50 then
    raise exception 'Limite di collegamenti raggiunto. Rimuovi una richiesta prima di riprovare.' using errcode='22023';
  end if;
  insert into private.family_share_grants(owner_id,reader_id,invitation_id)
    values(invitation.owner_id,auth.uid(),invitation.id) returning id into result;
  return result;
end; $$;

create function public.list_family_sharing(p_expected_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_family_account(p_expected_user_id);
  return pg_catalog.jsonb_build_object(
    'incoming',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',g.id,'nickname',coalesce(p.display_name,''),'status',g.status) order by g.created_at,g.id)
      from private.family_share_grants g join auth.users u on u.id=g.reader_id
      left join public.profiles p on p.user_id=g.reader_id
      where g.owner_id=auth.uid() and u.deleted_at is null and u.email_confirmed_at is not null
        and (g.status='approved' or (g.status='pending' and exists(
          select 1 from private.family_share_invites i where i.id=g.invitation_id
            and i.revoked_at is null and i.expires_at>now())))), '[]'::jsonb),
    'outgoing',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',g.id,'nickname',coalesce(p.display_name,''),
      'status',case when g.status='pending' and not exists(
        select 1 from private.family_share_invites i where i.id=g.invitation_id
          and i.revoked_at is null and i.expires_at>now()) then 'expired' else g.status end)
      order by g.created_at desc,g.id)
      from private.family_share_grants g join auth.users u on u.id=g.owner_id
      left join public.profiles p on p.user_id=g.owner_id
      where g.reader_id=auth.uid() and u.deleted_at is null and u.email_confirmed_at is not null), '[]'::jsonb)
  );
end; $$;

create function public.decide_family_share_request(p_grant_id uuid,p_approve boolean,p_expected_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_family_account(p_expected_user_id);
  if p_approve is null then raise exception 'Scegli se approvare la richiesta.' using errcode='22023'; end if;
  update private.family_share_grants g set status=case when p_approve then 'approved' else 'declined' end,
    approved_at=case when p_approve then clock_timestamp() else null end
    where g.id=p_grant_id and g.owner_id=auth.uid() and g.status='pending'
      and exists(select 1 from private.family_share_invites i where i.id=g.invitation_id
        and i.revoked_at is null and i.expires_at>clock_timestamp())
      and exists(select 1 from auth.users u where u.id=g.reader_id
        and u.deleted_at is null and u.email_confirmed_at is not null);
  if not found then raise exception 'Richiesta non disponibile. Aggiorna l’elenco.' using errcode='42501'; end if;
end; $$;

create function public.revoke_family_share(p_grant_id uuid,p_expected_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_family_account(p_expected_user_id);
  update private.family_share_grants set status='revoked'
    where id=p_grant_id and (owner_id=auth.uid() or reader_id=auth.uid()) and status in ('pending','approved');
  if not found then raise exception 'Collegamento non disponibile. Aggiorna l’elenco.' using errcode='42501'; end if;
end; $$;

create function public.family_shared_snapshot(p_grant_id uuid,p_expected_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare owner uuid; nickname text;
begin
  perform private.require_family_account(p_expected_user_id);
  select g.owner_id,coalesce(p.display_name,'') into owner,nickname
    from private.family_share_grants g join auth.users u on u.id=g.owner_id
    left join public.profiles p on p.user_id=g.owner_id
    where g.id=p_grant_id and g.reader_id=auth.uid() and g.status='approved'
      and u.deleted_at is null and u.email_confirmed_at is not null;
  if owner is null then raise exception 'Condivisione non approvata o revocata.' using errcode='42501'; end if;
  -- Explicit allowlist. Never serialize profiles, payloads, dates or preferences.
  return pg_catalog.jsonb_build_object('nickname',nickname,
    'checklists',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',c.id,'title',coalesce(c.payload->>'title','Checklist'),
      'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',i.id,'label',i.label,'completed',coalesce(p.completed,false)) order by i.position,i.id)
        from public.checklist_items i left join public.checklist_progress p
          on p.item_id=i.id and p.user_id=owner where i.checklist_id=c.id),'[]'::jsonb)) order by c.id)
      from public.checklists c where c.status='published' and c.approved and not c.is_demo),'[]'::jsonb),
    'articles',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',a.id,'title',coalesce(a.payload->>'title','Articolo')) order by a.id)
      from public.user_favorites f join public.articles a on a.id=f.article_id
      where f.user_id=owner and a.status='published' and a.approved and not a.is_demo),'[]'::jsonb));
end; $$;

revoke all on function public.create_family_invite(uuid),
  public.request_family_share(text,text,uuid), public.list_family_sharing(uuid),
  public.decide_family_share_request(uuid,boolean,uuid), public.revoke_family_share(uuid,uuid),
  public.family_shared_snapshot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_family_invite(uuid),
  public.request_family_share(text,text,uuid), public.list_family_sharing(uuid),
  public.decide_family_share_request(uuid,boolean,uuid), public.revoke_family_share(uuid,uuid),
  public.family_shared_snapshot(uuid,uuid) to authenticated;
commit;
