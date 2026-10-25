-- Apply once after 008. Nicknames do not identify permissions or replace UUIDs.
-- Shared journeys are a separate, optional snapshot: personal preferences and
-- dates are never read by the member directory or copied to newsletter tools.
begin;

alter table public.profiles
  add column journey_shared boolean not null default false,
  add column shared_journey text,
  add column shared_interests text[] not null default '{}',
  add column journey_consent_at timestamptz,
  add column journey_consent_version text,
  add column sharing_updated_at timestamptz;

create table private.member_profile_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  require_mfa boolean not null default true
);
alter table private.member_profile_staff enable row level security;
revoke all on private.member_profile_staff from public, anon, authenticated;

create table private.member_profile_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shared boolean not null,
  version text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table private.member_profile_consent_events enable row level security;
revoke all on private.member_profile_consent_events from public, anon, authenticated;

create function private.normalized_member_nickname(p_nickname text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  -- Match ECMAScript trim(), then NFC; PostgreSQL char_length counts codepoints.
  value text := pg_catalog.normalize(pg_catalog.btrim(coalesce(p_nickname, ''),
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), 'NFC');
begin
  if value = '' then return ''; end if;
  if pg_catalog.char_length(value) not between 2 and 40
    or value ~ '[[:cntrl:]]'
    or value ~ U&'[\007F-\009F\200B-\200F\202A-\202E\2060-\206F\FEFF<>@]' then
    return null;
  end if;
  return value;
end;
$$;
revoke all on function private.normalized_member_nickname(text) from public, anon, authenticated;

create function private.validate_member_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  next_name text;
  next_interests text[];
  stamp timestamptz := pg_catalog.clock_timestamp();
  changed boolean;
begin
  if tg_op = 'INSERT' or new.display_name is distinct from old.display_name then
    next_name := private.normalized_member_nickname(new.display_name);
    if next_name is null then
      raise exception 'Nickname non valido: usa da 2 a 40 caratteri, senza email o caratteri di controllo.'
        using errcode = '22023';
    end if;
    new.display_name := next_name;
  end if;
  if new.journey_shared is null then
    raise exception 'Scegli se condividere il percorso.' using errcode = '22023';
  end if;

  if new.journey_shared then
    if new.shared_journey is null or new.shared_journey not in
      ('pregnancy', 'postpartum', 'partner', 'exploring') then
      raise exception 'Percorso condiviso non valido.' using errcode = '22023';
    end if;
    next_interests := coalesce(new.shared_interests, '{}'::text[]);
    if pg_catalog.cardinality(next_interests) > 8
      or pg_catalog.array_position(next_interests, null) is not null
      or exists (
        select 1 from pg_catalog.unnest(next_interests) i
        where i not in ('pregnancy', 'birth_preparation', 'birth', 'postpartum',
          'breastfeeding', 'newborn', 'wellbeing', 'partner')
      ) then
      raise exception 'Argomenti condivisi non validi.' using errcode = '22023';
    end if;
    select coalesce(pg_catalog.array_agg(distinct i order by i), '{}'::text[])
      into new.shared_interests from pg_catalog.unnest(next_interests) i;
  else
    new.shared_journey := null;
    new.shared_interests := '{}'::text[];
  end if;

  if tg_op = 'INSERT' then
    new.journey_consent_at := case when new.journey_shared then stamp else null end;
    new.journey_consent_version := case when new.journey_shared then '2026-10-25-v1' else null end;
    new.sharing_updated_at := case when new.journey_shared then stamp else null end;
  else
    changed := row(new.journey_shared, new.shared_journey, new.shared_interests)
      is distinct from row(old.journey_shared, old.shared_journey, old.shared_interests);
    -- Explicit sharing saves request a new version; nickname updates do not.
    if changed or (new.journey_shared and new.sharing_updated_at is distinct from old.sharing_updated_at) then
      stamp := greatest(stamp, old.sharing_updated_at + interval '1 microsecond');
      new.sharing_updated_at := stamp;
      new.journey_consent_at := case when new.journey_shared then stamp else null end;
      new.journey_consent_version := case when new.journey_shared then '2026-10-25-v1' else null end;
    else
      new.sharing_updated_at := old.sharing_updated_at;
      new.journey_consent_at := case when new.journey_shared then old.journey_consent_at else null end;
      new.journey_consent_version := case when new.journey_shared then old.journey_consent_version else null end;
    end if;
  end if;
  new.updated_at := stamp;
  return new;
end;
$$;
revoke all on function private.validate_member_profile() from public, anon, authenticated;
create trigger profiles_member_validation before insert or update on public.profiles
  for each row execute function private.validate_member_profile();

create function private.record_member_profile_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.journey_shared)
    or (tg_op = 'UPDATE' and (
      new.journey_shared is distinct from old.journey_shared
      or (new.journey_shared and new.sharing_updated_at is distinct from old.sharing_updated_at)
    )) then
    insert into private.member_profile_consent_events(user_id, shared, version)
      values(new.user_id, new.journey_shared, '2026-10-25-v1');
  end if;
  return new;
end;
$$;
revoke all on function private.record_member_profile_consent() from public, anon, authenticated;
create trigger profiles_member_consent_audit after insert or update on public.profiles
  for each row execute function private.record_member_profile_consent();

create function private.create_member_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  nickname text := case
    when pg_catalog.jsonb_typeof(new.raw_user_meta_data -> 'nickname') = 'string'
    then private.normalized_member_nickname(new.raw_user_meta_data ->> 'nickname')
    else '' end;
begin
  -- Missing/invalid names keep old signup clients compatible. Metadata never
  -- creates professional memberships or opts a person into journey sharing.
  insert into public.profiles(user_id, display_name)
    values(new.id, coalesce(nickname, '')) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_member_profile() from public, anon, authenticated;
create trigger auth_user_member_profile after insert on auth.users
  for each row execute function private.create_member_profile();

-- Preserve chosen names. Only missing/blank profiles may receive valid nickname
-- metadata; full_name, role flags, dates and personal preferences are ignored.
insert into public.profiles(user_id, display_name)
select u.id, coalesce(case
  when pg_catalog.jsonb_typeof(u.raw_user_meta_data -> 'nickname') = 'string'
  then private.normalized_member_nickname(u.raw_user_meta_data ->> 'nickname')
  else '' end, '')
from auth.users u
on conflict(user_id) do update set display_name = excluded.display_name
where private.normalized_member_nickname(profiles.display_name) = ''
  and excluded.display_name <> '';

create function public.my_member_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Accedi per leggere il tuo profilo.' using errcode = '42501';
  end if;
  select pg_catalog.jsonb_build_object(
    'nickname', coalesce(private.normalized_member_nickname(p.display_name), ''),
    'journey_shared', p.journey_shared,
    'shared_journey', case when p.journey_shared then p.shared_journey else null end,
    'shared_interests', case when p.journey_shared then p.shared_interests else '{}'::text[] end,
    'journey_consent_at', case when p.journey_shared then p.journey_consent_at else null end,
    'journey_consent_version', case when p.journey_shared then p.journey_consent_version else null end,
    'sharing_updated_at', p.sharing_updated_at
  ) into result from public.profiles p where p.user_id = auth.uid();
  return coalesce(result, pg_catalog.jsonb_build_object(
    'nickname', '', 'journey_shared', false, 'shared_journey', null,
    'shared_interests', '[]'::jsonb, 'journey_consent_at', null,
    'journey_consent_version', null, 'sharing_updated_at', null
  ));
end;
$$;

create function public.set_my_nickname(nickname text, p_expected_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare next_name text := private.normalized_member_nickname(nickname);
begin
  if auth.uid() is null then
    raise exception 'Accedi per scegliere il nickname.' using errcode = '42501';
  end if;
  if p_expected_user_id is distinct from auth.uid() then
    raise exception 'L’account è cambiato. Riapri il profilo prima di salvare.'
      using errcode = '42501';
  end if;
  if next_name is null or next_name = '' then
    raise exception 'Nickname non valido: usa da 2 a 40 caratteri, senza email o caratteri di controllo.'
      using errcode = '22023';
  end if;
  insert into public.profiles(user_id, display_name) values(auth.uid(), next_name)
    on conflict(user_id) do update set display_name = excluded.display_name;
  return public.my_member_profile();
end;
$$;

create function public.save_my_shared_journey(
  p_journey text,
  p_interests text[],
  p_share boolean,
  p_expected_updated_at timestamptz default null,
  p_expected_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Accedi per condividere il tuo percorso.' using errcode = '42501';
  end if;
  if p_expected_user_id is distinct from auth.uid() then
    raise exception 'L’account è cambiato. Riapri il profilo prima di salvare.'
      using errcode = '42501';
  end if;
  if p_share is null then
    raise exception 'Scegli se condividere il percorso.' using errcode = '22023';
  end if;
  insert into public.profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select p.* into current_profile from public.profiles p
    where p.user_id = auth.uid() for update;
  if p_share and current_profile.sharing_updated_at is distinct from p_expected_updated_at then
    raise exception 'Il percorso è cambiato. Ricarica prima di condividere nuovamente.'
      using errcode = '40001';
  end if;
  update public.profiles
    set journey_shared = p_share,
        shared_journey = case when p_share then p_journey else null end,
        shared_interests = case when p_share then coalesce(p_interests, '{}'::text[]) else '{}'::text[] end,
        sharing_updated_at = case when p_share then pg_catalog.clock_timestamp() else sharing_updated_at end
    where user_id = auth.uid();
  return public.my_member_profile();
end;
$$;
revoke all on function public.my_member_profile(), public.set_my_nickname(text, uuid),
  public.save_my_shared_journey(text, text[], boolean, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.my_member_profile(), public.set_my_nickname(text, uuid),
  public.save_my_shared_journey(text, text[], boolean, timestamptz, uuid) to authenticated;

create function public.can_view_member_journeys()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.is_editor() and exists (
    select 1 from private.member_profile_staff s
    where s.user_id = auth.uid() and s.active
      and (not s.require_mfa or auth.jwt() ->> 'aal' = 'aal2')
  );
$$;
revoke all on function public.can_view_member_journeys() from public, anon, authenticated;
grant execute on function public.can_view_member_journeys() to authenticated;

create function public.member_directory(
  search_term text default '',
  journey_filter text default 'all',
  page_offset integer default 0,
  page_limit integer default 20
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  term text := pg_catalog.lower(pg_catalog.btrim(coalesce(search_term, '')));
  may_view boolean;
  membership boolean;
  mfa_required boolean;
  result jsonb;
begin
  if auth.uid() is null or public.is_editor() is not true then
    raise exception 'Accesso riservato agli amministratori di Studio.'
      using errcode = '42501';
  end if;
  if pg_catalog.char_length(term) > 254 or page_offset is null or page_offset < 0
    or page_limit is null or page_limit not between 1 and 50
    or journey_filter is null or journey_filter not in
      ('all', 'pregnancy', 'postpartum', 'partner', 'exploring') then
    raise exception 'Ricerca o pagina iscritti non valida.' using errcode = '22023';
  end if;
  may_view := coalesce(public.can_view_member_journeys(), false);
  if journey_filter <> 'all' and not may_view then
    raise exception 'Per filtrare i percorsi serve l’abilitazione e la verifica di sicurezza.'
      using errcode = '42501';
  end if;
  select exists (
    select 1 from private.member_profile_staff s
    join private.editor_memberships e on e.user_id = s.user_id
    where s.user_id = auth.uid() and s.active and e.active
  ) into membership;
  select exists (
    select 1 from private.member_profile_staff s
    join private.editor_memberships e on e.user_id = s.user_id
    where s.user_id = auth.uid() and s.active and e.active
      and (s.require_mfa or e.require_mfa)
  ) into mfa_required;

  with matched as materialized (
    select u.id, u.email, u.created_at, u.email_confirmed_at,
      coalesce(private.normalized_member_nickname(p.display_name), '') as nickname,
      coalesce(p.journey_shared, false) as journey_shared,
      p.shared_journey, p.shared_interests, p.sharing_updated_at
    from auth.users u left join public.profiles p on p.user_id = u.id
    where u.deleted_at is null and u.email is not null and u.email <> ''
      and (term = ''
        or pg_catalog.strpos(pg_catalog.lower(u.email), term) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(
          private.normalized_member_nickname(p.display_name), '')), term) > 0)
      and (journey_filter = 'all'
        or (p.journey_shared and p.shared_journey = journey_filter))
  ), page as (
    select * from matched order by created_at desc nulls last, id
      offset page_offset limit page_limit
  )
  select pg_catalog.jsonb_build_object(
    'members', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'user_id', p.id, 'nickname', p.nickname, 'email', p.email,
      'created_at', p.created_at, 'email_confirmed', p.email_confirmed_at is not null,
      'journey_shared', may_view and p.journey_shared,
      'shared_journey', case when may_view and p.journey_shared then p.shared_journey else null end,
      'shared_interests', case when may_view and p.journey_shared then coalesce(p.shared_interests, '{}'::text[]) else '{}'::text[] end,
      'sharing_updated_at', case when may_view then p.sharing_updated_at else null end
    ) order by p.created_at desc nulls last, p.id) from page p), '[]'::jsonb),
    'total', (select pg_catalog.count(*) from matched),
    'can_view_journeys', may_view, 'journey_membership', membership,
    'journey_mfa_required', mfa_required,
    'mfa_satisfied', coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
  ) into result;
  return result;
end;
$$;
revoke all on function public.member_directory(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.member_directory(text, text, integer, integer) to authenticated;

-- New versions preserve the old return types for cached v8 clients. UUIDs,
-- document assignments and the established role/MFA checks remain authoritative.
create function public.professional_conversation_contacts_v2(
  search_term text default '', page_offset integer default 0, page_limit integer default 50
)
returns table(user_id uuid, email text, nickname text, last_message_at timestamptz, last_message_preview text)
language plpgsql stable security definer set search_path = '' as $$
declare term text := pg_catalog.lower(pg_catalog.btrim(coalesce(search_term, '')));
begin
  if auth.uid() is null or public.is_chat_staff() is not true then
    raise exception 'Chat authorization and required MFA are needed' using errcode = '42501';
  end if;
  if pg_catalog.char_length(term) > 254 or page_offset is null or page_offset < 0
    or page_limit is null or page_limit not between 1 and 50 then
    raise exception 'Invalid conversation search or page' using errcode = '22023';
  end if;
  return query
  select c.user_id, coalesce(u.email, '')::text,
    coalesce(private.normalized_member_nickname(p.display_name), '')::text,
    latest.created_at, coalesce(pg_catalog.left(latest.body, 120), '')::text
  from public.care_conversations c join auth.users u on u.id = c.user_id
  left join public.profiles p on p.user_id = c.user_id
  left join lateral (
    select m.created_at, m.body from public.care_messages m
    where m.conversation_id = c.user_id order by m.created_at desc, m.id desc limit 1
  ) latest on true
  where u.deleted_at is null and (term = ''
    or pg_catalog.strpos(pg_catalog.lower(coalesce(u.email, '')), term) > 0
    or pg_catalog.strpos(pg_catalog.lower(coalesce(
      private.normalized_member_nickname(p.display_name), '')), term) > 0)
  order by coalesce(latest.created_at, c.created_at) desc, c.user_id
  offset page_offset limit page_limit;
end;
$$;

create function public.search_document_users_v2(search_term text)
returns table(user_id uuid, email text, nickname text)
language plpgsql stable security definer set search_path = '' as $$
declare term text := pg_catalog.lower(pg_catalog.btrim(coalesce(search_term, '')));
begin
  if public.can_manage_documents() is not true then
    raise exception 'Document manager authorization and MFA required' using errcode = '42501';
  end if;
  if pg_catalog.char_length(term) not between 2 and 254 then
    raise exception 'Enter at least two characters' using errcode = '22023';
  end if;
  return query
  select u.id, u.email::text,
    coalesce(private.normalized_member_nickname(p.display_name), '')::text
  from auth.users u left join public.profiles p on p.user_id = u.id
  where u.deleted_at is null and u.email_confirmed_at is not null and u.email is not null
    and (pg_catalog.strpos(pg_catalog.lower(u.email), term) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(
        private.normalized_member_nickname(p.display_name), '')), term) > 0)
  order by pg_catalog.lower(coalesce(
    private.normalized_member_nickname(p.display_name), '')), pg_catalog.lower(u.email), u.id
  limit 20;
end;
$$;

create function public.document_recipients_v2(document_id uuid)
returns table(user_id uuid, email text, nickname text, granted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare target_document uuid := document_id;
begin
  if public.can_manage_documents() is not true then
    raise exception 'Document manager authorization and MFA required' using errcode = '42501';
  end if;
  return query
  select a.user_id, coalesce(u.email, '')::text,
    coalesce(private.normalized_member_nickname(p.display_name), '')::text, a.granted_at
  from public.session_document_access a join auth.users u on u.id = a.user_id
  left join public.profiles p on p.user_id = a.user_id
  where a.document_id = target_document and u.deleted_at is null
  order by pg_catalog.lower(coalesce(
    private.normalized_member_nickname(p.display_name), '')), pg_catalog.lower(u.email), a.user_id;
end;
$$;
revoke all on function public.professional_conversation_contacts_v2(text, integer, integer),
  public.search_document_users_v2(text), public.document_recipients_v2(uuid) from public, anon, authenticated;
grant execute on function public.professional_conversation_contacts_v2(text, integer, integer),
  public.search_document_users_v2(text), public.document_recipients_v2(uuid) to authenticated;

commit;
