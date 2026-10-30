-- Apply after 014. This milestone records a selection, never a purchase.
-- Keep it separate from preferences: concurrent preference saves cannot reset it.
begin;

create table private.member_milestones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_recommendation_selected boolean not null default false
);
alter table private.member_milestones enable row level security;
revoke all on private.member_milestones from public, anon, authenticated;

create function public.my_member_milestones()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or not exists (
    select 1 from auth.users u where u.id = caller
      and u.email_confirmed_at is not null and u.deleted_at is null
  ) then
    raise exception 'Accedi con un account confermato per leggere i tuoi traguardi.' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object('first_recommendation_selected', coalesce(
    (select m.first_recommendation_selected from private.member_milestones m
      where m.user_id = caller), false));
end;
$$;

create function public.record_first_recommendation_selection(p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or p_expected_user_id is distinct from caller then
    raise exception 'L’account è cambiato. Riapri i consigli prima di salvare.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.users u where u.id = caller
      and u.email_confirmed_at is not null and u.deleted_at is null
  ) then
    raise exception 'Accedi con un account confermato per salvare i tuoi traguardi.' using errcode = '42501';
  end if;
  insert into private.member_milestones(user_id, first_recommendation_selected)
    values (caller, true)
    on conflict (user_id) do update set first_recommendation_selected = true;
  return pg_catalog.jsonb_build_object('first_recommendation_selected', true);
end;
$$;

revoke all on function public.my_member_milestones(),
  public.record_first_recommendation_selection(uuid) from public, anon, authenticated;
grant execute on function public.my_member_milestones(),
  public.record_first_recommendation_selection(uuid) to authenticated;

commit;
