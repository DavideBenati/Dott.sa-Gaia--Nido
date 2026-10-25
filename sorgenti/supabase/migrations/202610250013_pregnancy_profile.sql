-- Optional clinical data stays outside public profiles, directory snapshots,
-- account metadata and family sharing. Apply after 009 (and the v10 migrations).
begin;

create table private.pregnancy_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_menstrual_date date,
  ultrasound_matches boolean,
  ultrasound_weeks integer,
  ultrasound_days integer,
  ultrasound_reference_date date,
  previous_pregnancies boolean,
  previous_outcomes text[] not null default '{}',
  storage_consent boolean not null default false,
  gaia_share_consent boolean not null default false,
  personalization_consent boolean not null default false,
  consent_at timestamptz,
  consent_version text,
  updated_at timestamptz not null default clock_timestamp(),
  check (ultrasound_weeks is null or ultrasound_weeks between 0 and 43),
  check (ultrasound_days is null or ultrasound_days between 0 and 6),
  check (ultrasound_weeks is null or ultrasound_days is null
    or ultrasound_weeks * 7 + ultrasound_days <= 301),
  check (storage_consent or (
    last_menstrual_date is null and ultrasound_matches is null
    and ultrasound_weeks is null and ultrasound_days is null
    and ultrasound_reference_date is null and previous_pregnancies is null
    and previous_outcomes = '{}'::text[] and not gaia_share_consent
    and not personalization_consent))
);
alter table private.pregnancy_profiles enable row level security;
revoke all on private.pregnancy_profiles from public, anon, authenticated;

-- Consent audit records no clinical values, dates, gestational age or outcomes.
create table private.pregnancy_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_consent boolean not null,
  gaia_share_consent boolean not null,
  personalization_consent boolean not null,
  version text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table private.pregnancy_consent_events enable row level security;
revoke all on private.pregnancy_consent_events from public, anon, authenticated;

create function private.pregnancy_profile_json(p_profile private.pregnancy_profiles)
returns jsonb language sql stable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'last_menstrual_date', p_profile.last_menstrual_date,
    'ultrasound_matches', p_profile.ultrasound_matches,
    'ultrasound_weeks', p_profile.ultrasound_weeks,
    'ultrasound_days', p_profile.ultrasound_days,
    'ultrasound_reference_date', p_profile.ultrasound_reference_date,
    'previous_pregnancies', p_profile.previous_pregnancies,
    'previous_outcomes', p_profile.previous_outcomes,
    'storage_consent', p_profile.storage_consent,
    'gaia_share_consent', p_profile.gaia_share_consent,
    'personalization_consent', p_profile.personalization_consent,
    'consent_at', p_profile.consent_at,
    'consent_version', p_profile.consent_version,
    'updated_at', p_profile.updated_at
  );
$$;
revoke all on function private.pregnancy_profile_json(private.pregnancy_profiles)
  from public, anon, authenticated;

create function public.my_pregnancy_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Accedi per leggere la tua scheda gravidanza.' using errcode = '42501';
  end if;
  select private.pregnancy_profile_json(p) into result
    from private.pregnancy_profiles p where p.user_id = auth.uid();
  -- A revoked profile is an empty tombstone with an exact version, so a stale
  -- initial draft cannot resurrect data after withdrawal of consent.
  return result;
end;
$$;

create function public.save_my_pregnancy_profile(
  p_profile jsonb,
  p_expected_updated_at timestamptz default null,
  p_expected_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  old_profile private.pregnancy_profiles;
  next_profile private.pregnancy_profiles;
  profile_exists boolean;
  today date := (pg_catalog.clock_timestamp() at time zone 'Europe/Rome')::date;
  stamp timestamptz := pg_catalog.clock_timestamp();
  key text;
  item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Accedi per salvare la tua scheda gravidanza.' using errcode = '42501';
  end if;
  if p_expected_user_id is distinct from auth.uid() then
    raise exception 'L’account è cambiato. Riapri la scheda prima di salvare.' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_profile) is distinct from 'object' then
    raise exception 'Scheda gravidanza non valida.' using errcode = '22023';
  end if;
  for key in select pg_catalog.jsonb_object_keys(p_profile) loop
    if key not in ('last_menstrual_date', 'ultrasound_matches', 'ultrasound_weeks',
      'ultrasound_days', 'ultrasound_reference_date', 'previous_pregnancies',
      'previous_outcomes', 'storage_consent', 'gaia_share_consent', 'personalization_consent') then
      raise exception 'Campo della scheda gravidanza non valido.' using errcode = '22023';
    end if;
  end loop;
  if p_profile -> 'storage_consent' is distinct from 'true'::jsonb
    or pg_catalog.jsonb_typeof(p_profile -> 'gaia_share_consent') is distinct from 'boolean'
    or pg_catalog.jsonb_typeof(p_profile -> 'personalization_consent') is distinct from 'boolean' then
    raise exception 'Scegli esplicitamente i consensi della scheda gravidanza.' using errcode = '22023';
  end if;

  -- Serialize first writes as well as updates, with no clinical value in locks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 13013));
  select p.* into old_profile from private.pregnancy_profiles p
    where p.user_id = auth.uid() for update;
  profile_exists := found;
  if (case when profile_exists then old_profile.updated_at else null end)
    is distinct from p_expected_updated_at then
    raise exception 'La scheda è cambiata. Ricaricala prima di salvare.' using errcode = '40001';
  end if;

  next_profile.user_id := auth.uid();
  next_profile.storage_consent := true;
  next_profile.gaia_share_consent := (p_profile ->> 'gaia_share_consent')::boolean;
  next_profile.personalization_consent := (p_profile ->> 'personalization_consent')::boolean;
  for key in select pg_catalog.unnest(array['last_menstrual_date', 'ultrasound_reference_date']) loop
    item := p_profile -> key;
    if item is not null and item <> 'null'::jsonb then
      if pg_catalog.jsonb_typeof(item) <> 'string'
        or (p_profile ->> key) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'Usa una data valida nel formato AAAA-MM-GG.' using errcode = '22023';
      end if;
      begin
        if key = 'last_menstrual_date' then
          next_profile.last_menstrual_date := (p_profile ->> key)::date;
        else
          next_profile.ultrasound_reference_date := (p_profile ->> key)::date;
        end if;
      exception when datetime_field_overflow or invalid_datetime_format then
        raise exception 'La data indicata non è valida.' using errcode = '22023';
      end;
    end if;
  end loop;
  for key in select pg_catalog.unnest(array['ultrasound_matches', 'previous_pregnancies']) loop
    item := p_profile -> key;
    if item is not null and item <> 'null'::jsonb
      and pg_catalog.jsonb_typeof(item) <> 'boolean' then
      raise exception 'Scegli sì, no oppure lascia il dato non indicato.' using errcode = '22023';
    end if;
  end loop;
  next_profile.ultrasound_matches := (p_profile ->> 'ultrasound_matches')::boolean;
  next_profile.previous_pregnancies := (p_profile ->> 'previous_pregnancies')::boolean;
  for key in select pg_catalog.unnest(array['ultrasound_weeks', 'ultrasound_days']) loop
    item := p_profile -> key;
    if item is not null and item <> 'null'::jsonb then
      if pg_catalog.jsonb_typeof(item) <> 'number'
        or (p_profile ->> key) !~ '^[0-9]{1,2}$' then
        raise exception 'Settimane e giorni devono essere numeri interi validi.' using errcode = '22023';
      end if;
      if key = 'ultrasound_weeks' then
        next_profile.ultrasound_weeks := (p_profile ->> key)::integer;
      else
        next_profile.ultrasound_days := (p_profile ->> key)::integer;
      end if;
    end if;
  end loop;
  if next_profile.last_menstrual_date is not null
    and today - next_profile.last_menstrual_date not between 0 and 301 then
    raise exception 'La data dell’ultima mestruazione deve essere passata e compresa entro 43 settimane.' using errcode = '22023';
  end if;
  if next_profile.ultrasound_matches is true and next_profile.last_menstrual_date is null then
    raise exception 'Indica l’ultima mestruazione per confermare la corrispondenza con l’ecografia.' using errcode = '22023';
  end if;
  if next_profile.ultrasound_matches is false then
    if next_profile.ultrasound_weeks is null or next_profile.ultrasound_days is null
      or next_profile.ultrasound_reference_date is null
      or next_profile.ultrasound_weeks not between 0 and 43
      or next_profile.ultrasound_days not between 0 and 6
      or next_profile.ultrasound_weeks * 7 + next_profile.ultrasound_days > 301
      or next_profile.ultrasound_reference_date > today
      or next_profile.ultrasound_weeks * 7 + next_profile.ultrasound_days
        + (today - next_profile.ultrasound_reference_date) > 301 then
      raise exception 'Indica un’età ecografica valida entro 43 settimane e 0 giorni.' using errcode = '22023';
    end if;
    -- New/changed manual values are explicitly the age measured today. The
    -- stored reference date advances unchanged values correctly on later days.
    if row(next_profile.ultrasound_weeks, next_profile.ultrasound_days, next_profile.ultrasound_reference_date)
      is distinct from row(old_profile.ultrasound_weeks, old_profile.ultrasound_days, old_profile.ultrasound_reference_date)
      and next_profile.ultrasound_reference_date <> today then
      raise exception 'Indica le settimane e i giorni ecografici riferiti a oggi.' using errcode = '22023';
    end if;
  elsif next_profile.ultrasound_weeks is not null or next_profile.ultrasound_days is not null
    or next_profile.ultrasound_reference_date is not null then
    raise exception 'I valori ecografici manuali richiedono la scelta “no”.' using errcode = '22023';
  end if;

  item := p_profile -> 'previous_outcomes';
  if item is null or item = 'null'::jsonb then
    next_profile.previous_outcomes := '{}'::text[];
  else
    if pg_catalog.jsonb_typeof(item) <> 'array' or pg_catalog.jsonb_array_length(item) > 4 then
      raise exception 'Esiti delle precedenti gravidanze non validi.' using errcode = '22023';
    end if;
    for item in select value from pg_catalog.jsonb_array_elements(p_profile -> 'previous_outcomes') loop
      if pg_catalog.jsonb_typeof(item) <> 'string'
        or (item #>> '{}') not in ('spontaneous', 'cesarean', 'other', 'not_indicated') then
        raise exception 'Esiti delle precedenti gravidanze non validi.' using errcode = '22023';
      end if;
    end loop;
    select coalesce(pg_catalog.array_agg(distinct value order by value), '{}'::text[])
      into next_profile.previous_outcomes
      from pg_catalog.jsonb_array_elements_text(p_profile -> 'previous_outcomes');
  end if;
  if (next_profile.previous_pregnancies is distinct from true and pg_catalog.cardinality(next_profile.previous_outcomes) > 0)
    or ('not_indicated' = any(next_profile.previous_outcomes)
      and pg_catalog.cardinality(next_profile.previous_outcomes) > 1) then
    raise exception 'Controlla gli esiti delle precedenti gravidanze.' using errcode = '22023';
  end if;

  stamp := greatest(stamp, old_profile.updated_at + interval '1 microsecond');
  next_profile.updated_at := stamp;
  next_profile.consent_at := stamp;
  next_profile.consent_version := '2026-10-25-pregnancy-v1';
  insert into private.pregnancy_profiles values (next_profile.*)
    on conflict (user_id) do update set
      last_menstrual_date = excluded.last_menstrual_date,
      ultrasound_matches = excluded.ultrasound_matches,
      ultrasound_weeks = excluded.ultrasound_weeks,
      ultrasound_days = excluded.ultrasound_days,
      ultrasound_reference_date = excluded.ultrasound_reference_date,
      previous_pregnancies = excluded.previous_pregnancies,
      previous_outcomes = excluded.previous_outcomes,
      storage_consent = excluded.storage_consent,
      gaia_share_consent = excluded.gaia_share_consent,
      personalization_consent = excluded.personalization_consent,
      consent_at = excluded.consent_at,
      consent_version = excluded.consent_version,
      updated_at = excluded.updated_at;
  insert into private.pregnancy_consent_events
    (user_id, storage_consent, gaia_share_consent, personalization_consent, version)
    values (auth.uid(), true, next_profile.gaia_share_consent,
      next_profile.personalization_consent, next_profile.consent_version);
  return private.pregnancy_profile_json(next_profile);
end;
$$;

create function public.revoke_my_pregnancy_profile(p_expected_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  old_profile private.pregnancy_profiles;
  next_profile private.pregnancy_profiles;
  stamp timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.uid() is null or p_expected_user_id is distinct from auth.uid() then
    raise exception 'Accedi nuovamente prima di ritirare il consenso.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 13013));
  select p.* into old_profile from private.pregnancy_profiles p
    where p.user_id = auth.uid() for update;
  stamp := greatest(stamp, old_profile.updated_at + interval '1 microsecond');
  insert into private.pregnancy_profiles(user_id, updated_at)
    values (auth.uid(), stamp)
    on conflict(user_id) do update set
      last_menstrual_date = null, ultrasound_matches = null,
      ultrasound_weeks = null, ultrasound_days = null, ultrasound_reference_date = null,
      previous_pregnancies = null, previous_outcomes = '{}',
      storage_consent = false, gaia_share_consent = false, personalization_consent = false,
      consent_at = null, consent_version = null, updated_at = excluded.updated_at
    returning * into next_profile;
  insert into private.pregnancy_consent_events
    (user_id, storage_consent, gaia_share_consent, personalization_consent, version)
    values (auth.uid(), false, false, false, '2026-10-25-pregnancy-v1');
  return private.pregnancy_profile_json(next_profile);
end;
$$;

create function public.can_view_member_pregnancy_profile()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.can_view_member_journeys(), false)
    and coalesce(auth.jwt() ->> 'aal' = 'aal2', false);
$$;

-- Consent withdrawal must remain possible even when a previously entered age
-- has advanced beyond the dating form's 43-week limit. It never validates or
-- resubmits clinical values and invalidates every older editing snapshot.
create function private.revoke_pregnancy_consent(p_kind text, p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  old_profile private.pregnancy_profiles;
  next_profile private.pregnancy_profiles;
  stamp timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.uid() is null or p_expected_user_id is distinct from auth.uid() then
    raise exception 'Accedi nuovamente prima di ritirare il consenso.' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('gaia', 'personalization') then
    raise exception 'Consenso non valido.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 13013));
  select p.* into old_profile from private.pregnancy_profiles p
    where p.user_id = auth.uid() for update;
  stamp := greatest(stamp, old_profile.updated_at + interval '1 microsecond');
  insert into private.pregnancy_profiles(user_id, updated_at)
    values (auth.uid(), stamp)
    on conflict(user_id) do update set
      gaia_share_consent = case when p_kind = 'gaia' then false
        else pregnancy_profiles.gaia_share_consent end,
      personalization_consent = case when p_kind = 'personalization' then false
        else pregnancy_profiles.personalization_consent end,
      updated_at = excluded.updated_at
    returning * into next_profile;
  insert into private.pregnancy_consent_events
    (user_id, storage_consent, gaia_share_consent, personalization_consent, version)
    values (auth.uid(), next_profile.storage_consent, next_profile.gaia_share_consent,
      next_profile.personalization_consent, '2026-10-25-pregnancy-v1');
  return private.pregnancy_profile_json(next_profile);
end;
$$;
revoke all on function private.revoke_pregnancy_consent(text, uuid)
  from public, anon, authenticated;

create function public.revoke_my_pregnancy_sharing(p_expected_user_id uuid default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.revoke_pregnancy_consent('gaia', p_expected_user_id);
$$;

create function public.revoke_my_pregnancy_personalization(p_expected_user_id uuid default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.revoke_pregnancy_consent('personalization', p_expected_user_id);
$$;

create function public.read_member_pregnancy_profile(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if public.can_view_member_pregnancy_profile() is not true then
    raise exception 'Serve l’abilitazione dedicata e la verifica MFA per leggere la scheda gravidanza.' using errcode = '42501';
  end if;
  select private.pregnancy_profile_json(p) into result
    from private.pregnancy_profiles p
    where p.user_id = p_user_id and p.storage_consent and p.gaia_share_consent;
  return result;
end;
$$;

revoke all on function public.my_pregnancy_profile(),
  public.save_my_pregnancy_profile(jsonb, timestamptz, uuid),
  public.revoke_my_pregnancy_profile(uuid), public.revoke_my_pregnancy_sharing(uuid),
  public.revoke_my_pregnancy_personalization(uuid), public.can_view_member_pregnancy_profile(),
  public.read_member_pregnancy_profile(uuid) from public, anon, authenticated;
grant execute on function public.my_pregnancy_profile(),
  public.save_my_pregnancy_profile(jsonb, timestamptz, uuid),
  public.revoke_my_pregnancy_profile(uuid), public.revoke_my_pregnancy_sharing(uuid),
  public.revoke_my_pregnancy_personalization(uuid), public.can_view_member_pregnancy_profile(),
  public.read_member_pregnancy_profile(uuid) to authenticated;

commit;
