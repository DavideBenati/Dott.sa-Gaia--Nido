-- Nido: apply using the Supabase SQL migration runner, never from the mobile app.
-- Memberships are provisioned by a trusted database administrator, not user metadata.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.editor_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  professional_name text not null check (length(trim(professional_name)) > 1),
  professional_role text not null,
  qualification_verified boolean not null default false,
  credential_reference text,
  created_at timestamptz not null default now(),
  check (not qualification_verified or length(trim(coalesce(credential_reference, ''))) > 3)
);
alter table private.editor_memberships enable row level security;

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.editor_memberships where user_id = auth.uid() and active);
$$;
create or replace function private.is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.editor_memberships where user_id = auth.uid() and active and qualification_verified);
$$;
create or replace function private.reviewer_name() returns text
language sql stable security definer set search_path = '' as $$
  select professional_name from private.editor_memberships where user_id = auth.uid() and active and qualification_verified;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object'),
  check (payload->>'journey' in ('pregnancy', 'partner', 'postpartum')),
  check (coalesce(payload->>'date', '') = '' or (payload->>'sensitiveConsent')::boolean is true)
);
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false, marketing boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.article_categories (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) > 1), icon text not null default 'leaf',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 1),
  professional_role text not null check (length(trim(professional_role)) > 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(name, professional_role)
);
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id text not null references public.article_categories(id) on delete restrict,
  author_id uuid references public.authors(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','in_review','published','archived')),
  approved boolean not null default false, is_demo boolean not null default false,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status <> 'published' or (approved and not is_demo))
);
create index articles_public_stage_idx on public.articles(status, approved, is_demo, category_id);
create index articles_updated_idx on public.articles(updated_at desc);
create table public.article_references (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  label text not null check (length(trim(label)) > 1),
  url text not null check (url ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now()
);
create index article_references_article_idx on public.article_references(article_id);
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft','in_review','published','archived')),
  approved boolean not null default false, is_demo boolean not null default false,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status <> 'published' or (approved and not is_demo))
);
create index checklists_public_idx on public.checklists(status, approved, is_demo);
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  label text not null check (length(trim(label)) > 1), note text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index checklist_items_checklist_idx on public.checklist_items(checklist_id,position);
create table public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade,
  checklist_id uuid references public.checklists(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewer_name text not null, clinical_review_date date not null,
  approved boolean not null, created_at timestamptz not null default now(),
  check ((article_id is not null)::integer + (checklist_id is not null)::integer = 1)
);
create index editorial_reviews_article_idx on public.editorial_reviews(article_id);
create index editorial_reviews_checklist_idx on public.editorial_reviews(checklist_id);
create table public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,article_id)
);
create index user_favorites_article_idx on public.user_favorites(article_id);
create table public.checklist_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.checklist_items(id) on delete cascade,
  completed boolean not null default false, updated_at timestamptz not null default now(),
  primary key(user_id,item_id)
);
create index checklist_progress_item_idx on public.checklist_progress(item_id);

-- Keep server-owned state consistent even when a client calls the tables directly.
create or replace function private.validate_editorial() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed boolean := false; review_date date;
begin
  if not public.is_editor() then raise exception 'Editor authorization required' using errcode='42501'; end if;
  if tg_op = 'UPDATE' then
    changed := (old.payload - array['status','approved','publishedAt','reviewedAt','reviewerName'])
      is distinct from (new.payload - array['status','approved','publishedAt','reviewedAt','reviewerName']);
    if tg_table_name='articles' then changed := changed or old.slug is distinct from new.slug or old.author_id is distinct from new.author_id or old.category_id is distinct from new.category_id; end if;
    if changed then
      new.approved := false;
      if old.status = 'published' or new.status = 'published' then new.status := 'in_review'; end if;
      if tg_table_name = 'articles' then
        new.payload := new.payload || jsonb_build_object('reviewedAt',null,'reviewerName',null);
      end if;
    end if;
  end if;
  if new.status = 'published' and (not new.approved or new.is_demo) then
    raise exception 'Publication requires clinically approved, non-demo content' using errcode='23514';
  end if;
  if new.approved then
    if not private.is_reviewer() then raise exception 'A verified clinical reviewer must approve content' using errcode='42501'; end if;
    if new.is_demo then raise exception 'Demo content cannot receive clinical approval' using errcode='23514'; end if;
    if tg_table_name = 'articles' then
      if new.author_id is null then raise exception 'Author information is required for publication' using errcode='23514'; end if;
      if new.payload->>'reviewerName' is distinct from private.reviewer_name() then raise exception 'Clinical reviewer identity must match the verified account' using errcode='23514'; end if;
      review_date := nullif(new.payload->>'reviewedAt','')::date;
      if review_date is null or review_date > current_date then raise exception 'A valid, non-future clinical review date is required' using errcode='23514'; end if;
      if jsonb_array_length(coalesce(new.payload->'references','[]')) = 0 then raise exception 'Sources are required for publication' using errcode='23514'; end if;
      if jsonb_array_length(coalesce(new.payload->'sections','[]')) = 0 then raise exception 'Article content is required' using errcode='23514'; end if;
    end if;
  end if;
  if tg_table_name = 'articles' then
    if length(trim(coalesce(new.payload->>'title',''))) < 3 then raise exception 'Article title is required' using errcode='23514'; end if;
    if coalesce(new.payload->>'stage','') not in ('pregnancy','postpartum','all') then raise exception 'Invalid journey stage' using errcode='23514'; end if;
    if jsonb_typeof(new.payload->'sections') is distinct from 'array' or jsonb_typeof(new.payload->'references') is distinct from 'array' then raise exception 'Sections and references must be arrays' using errcode='23514'; end if;
    if new.approved and coalesce(new.payload->>'imageUrl','') !~ '^(https://|storage://editorial-images/)' then raise exception 'A valid HTTPS or editorial storage image is required for publication' using errcode='23514'; end if;
    if coalesce(new.payload->>'imageUrl','')<>'' and coalesce(new.payload->>'imageUrl','') !~ '^(https://|storage://editorial-images/)' then raise exception 'Use HTTPS or editorial storage for images' using errcode='23514'; end if;
    if (new.payload->>'readingMinutes')::integer not between 1 and 120 then raise exception 'Invalid reading time' using errcode='23514'; end if;
    new.payload := new.payload || jsonb_build_object('id',new.id,'slug',new.slug,'categoryId',new.category_id);
  else
    if length(trim(coalesce(new.payload->>'title',''))) < 3 then raise exception 'Checklist title is required' using errcode='23514'; end if;
    if coalesce(new.payload->>'stage','') not in ('pregnancy','postpartum','all') then raise exception 'Invalid journey stage' using errcode='23514'; end if;
    if jsonb_typeof(new.payload->'items') is distinct from 'array' then raise exception 'Checklist items must be an array' using errcode='23514'; end if;
    if new.approved and jsonb_array_length(new.payload->'items')=0 then raise exception 'Published checklists require items' using errcode='23514'; end if;
    new.payload := new.payload || jsonb_build_object('id',new.id);
  end if;
  new.payload := new.payload || jsonb_build_object('status',new.status,'approved',new.approved,'isDemo',new.is_demo);
  if tg_table_name = 'articles' then
    if new.status = 'published' then new.payload := new.payload || jsonb_build_object('publishedAt',coalesce(nullif(new.payload->>'publishedAt',''),current_date::text)); end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger articles_validate before insert or update on public.articles for each row execute function private.validate_editorial();
create trigger checklists_validate before insert or update on public.checklists for each row execute function private.validate_editorial();

create or replace function private.record_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.approved and (tg_op='INSERT' or not old.approved or old.payload is distinct from new.payload) then
    insert into public.editorial_reviews(article_id,checklist_id,reviewer_user_id,reviewer_name,clinical_review_date,approved)
    values(case when tg_table_name='articles' then new.id end,case when tg_table_name='checklists' then new.id end,auth.uid(),private.reviewer_name(),case when tg_table_name='articles' then (new.payload->>'reviewedAt')::date else current_date end,true);
  end if;
  return new;
end;
$$;
create trigger articles_review after insert or update on public.articles for each row execute function private.record_review();
create trigger checklists_review after insert or update on public.checklists for each row execute function private.record_review();

-- All exposed tables use RLS; an editor has no access to any parent's private rows.
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_favorites enable row level security;
alter table public.checklist_progress enable row level security;
alter table public.article_categories enable row level security;
alter table public.authors enable row level security;
alter table public.articles enable row level security;
alter table public.article_references enable row level security;
alter table public.editorial_reviews enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;

create policy own_profile on public.profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_preferences on public.user_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_notifications on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_favorites on public.user_favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.articles a where a.id=article_id and a.status='published' and a.approved and not a.is_demo));
create policy own_progress on public.checklist_progress for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.checklist_items i join public.checklists c on c.id=i.checklist_id where i.id=item_id and c.status='published' and c.approved and not c.is_demo));
create policy categories_read on public.article_categories for select to anon,authenticated using(true);
create policy categories_editor on public.article_categories for all to authenticated using(public.is_editor()) with check(public.is_editor());
create policy articles_read on public.articles for select to anon,authenticated using(status='published' and approved and not is_demo);
create policy articles_editor on public.articles for all to authenticated using(public.is_editor()) with check(public.is_editor());
create policy authors_read on public.authors for select to anon,authenticated using(exists(select 1 from public.articles a where a.author_id=authors.id and a.status='published' and a.approved and not a.is_demo));
create policy authors_editor on public.authors for all to authenticated using(public.is_editor()) with check(public.is_editor());
create policy references_read on public.article_references for select to anon,authenticated using(exists(select 1 from public.articles a where a.id=article_id and a.status='published' and a.approved and not a.is_demo));
create policy references_editor on public.article_references for all to authenticated using(public.is_editor()) with check(public.is_editor());
create policy checklists_read on public.checklists for select to anon,authenticated using(status='published' and approved and not is_demo);
create policy checklists_editor on public.checklists for all to authenticated using(public.is_editor()) with check(public.is_editor());
create policy items_read on public.checklist_items for select to anon,authenticated using(exists(select 1 from public.checklists c where c.id=checklist_id and c.status='published' and c.approved and not c.is_demo));
create policy items_editor on public.checklist_items for all to authenticated using(public.is_editor()) with check(public.is_editor());
create policy reviews_read on public.editorial_reviews for select to anon,authenticated using(
  exists(select 1 from public.articles a where a.id=article_id and a.status='published' and a.approved and not a.is_demo)
  or exists(select 1 from public.checklists c where c.id=checklist_id and c.status='published' and c.approved and not c.is_demo));
create policy reviews_editor_read on public.editorial_reviews for select to authenticated using(public.is_editor());
-- There is intentionally no client write policy for the audit trail.

grant select,insert,update,delete on public.profiles,public.user_preferences,public.notification_preferences,public.user_favorites,public.checklist_progress to authenticated;
grant select on public.article_categories,public.authors,public.articles,public.article_references,public.checklists,public.checklist_items,public.editorial_reviews to anon,authenticated;
grant insert,update,delete on public.article_categories,public.authors,public.articles,public.article_references,public.checklists,public.checklist_items to authenticated;

create or replace function public.save_article(document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare article_uuid uuid := (document->>'id')::uuid; author_uuid uuid; saved jsonb; ref jsonb;
begin
  if not public.is_editor() then raise exception 'Editor authorization required' using errcode='42501'; end if;
  if length(trim(coalesce(document->>'authorName',''))) > 1 and length(trim(coalesce(document->>'authorRole',''))) > 1 then
    insert into public.authors(name,professional_role) values(document->>'authorName',document->>'authorRole')
      on conflict(name,professional_role) do update set updated_at=now() returning id into author_uuid;
  end if;
  insert into public.articles(id,slug,category_id,author_id,status,approved,is_demo,payload)
    values(article_uuid,document->>'slug',document->>'categoryId',author_uuid,document->>'status',coalesce((document->>'approved')::boolean,false),coalesce((document->>'isDemo')::boolean,false),document)
    on conflict(id) do update set slug=excluded.slug,category_id=excluded.category_id,author_id=excluded.author_id,status=excluded.status,approved=excluded.approved,is_demo=excluded.is_demo,payload=excluded.payload
    returning payload into saved;
  delete from public.article_references where article_id=article_uuid;
  for ref in select * from jsonb_array_elements(coalesce(document->'references','[]')) loop
    insert into public.article_references(article_id,label,url) values(article_uuid,ref->>'label',ref->>'url');
  end loop;
  return saved;
end;
$$;
create or replace function public.save_checklist(document jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare checklist_uuid uuid := (document->>'id')::uuid; saved jsonb; item jsonb; item_ids uuid[] := '{}'; pos integer := 0;
begin
  if not public.is_editor() then raise exception 'Editor authorization required' using errcode='42501'; end if;
  insert into public.checklists(id,status,approved,is_demo,payload)
    values(checklist_uuid,document->>'status',coalesce((document->>'approved')::boolean,false),coalesce((document->>'isDemo')::boolean,false),document)
    on conflict(id) do update set status=excluded.status,approved=excluded.approved,is_demo=excluded.is_demo,payload=excluded.payload returning payload into saved;
  for item in select * from jsonb_array_elements(coalesce(document->'items','[]')) loop
    if exists(select 1 from public.checklist_items where id=(item->>'id')::uuid and checklist_id<>checklist_uuid) then
      raise exception 'Checklist item belongs to another checklist' using errcode='23514';
    end if;
    if (item->>'id')::uuid=any(item_ids) then raise exception 'Duplicate checklist item ID' using errcode='23514'; end if;
    item_ids := array_append(item_ids,(item->>'id')::uuid);
    insert into public.checklist_items(id,checklist_id,label,note,position) values((item->>'id')::uuid,checklist_uuid,item->>'label',item->>'note',pos)
      on conflict(id) do update set label=excluded.label,note=excluded.note,position=excluded.position,updated_at=now()
      where checklist_items.checklist_id=checklist_uuid;
    if not found then raise exception 'Checklist item belongs to another checklist' using errcode='23514'; end if;
    pos := pos+1;
  end loop;
  delete from public.checklist_items where checklist_id=checklist_uuid and not (id=any(item_ids));
  return saved;
end;
$$;
create or replace function public.save_preferences(preferences jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not coalesce((preferences->>'sensitiveConsent')::boolean,false) then preferences:=preferences || jsonb_build_object('date',null); end if;
  insert into public.user_preferences(user_id,payload) values(auth.uid(),preferences)
    on conflict(user_id) do update set payload=excluded.payload,updated_at=now();
  insert into public.notification_preferences(user_id,enabled,marketing) values(auth.uid(),coalesce((preferences->>'notifications')::boolean,false),coalesce((preferences->>'marketing')::boolean,false))
    on conflict(user_id) do update set enabled=excluded.enabled,marketing=excluded.marketing,updated_at=now();
end;
$$;
create or replace function public.export_my_data() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('exportedAt',now(),'profile',(select to_jsonb(p) from public.profiles p where user_id=auth.uid()),
    'preferences',(select payload from public.user_preferences where user_id=auth.uid()),
    'notificationPreferences',(select to_jsonb(n) from public.notification_preferences n where user_id=auth.uid()),
    'favorites',coalesce((select jsonb_agg(article_id) from public.user_favorites where user_id=auth.uid()),'[]'),
    'checklistProgress',coalesce((select jsonb_agg(jsonb_build_object('itemId',item_id,'completed',completed)) from public.checklist_progress where user_id=auth.uid()),'[]'));
$$;
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from auth.users where id=auth.uid();
end;
$$;

-- Explicit grants: RPC callers cannot invoke the internal reviewer helpers or audit triggers.
revoke all on function public.is_editor(),public.save_article(jsonb),public.save_checklist(jsonb),public.save_preferences(jsonb),public.export_my_data(),public.delete_my_account() from public;
revoke all on function private.is_reviewer(),private.reviewer_name(),private.validate_editorial(),private.record_review() from public;
grant execute on function public.is_editor() to anon,authenticated;
grant execute on function public.save_article(jsonb),public.save_checklist(jsonb),public.save_preferences(jsonb),public.export_my_data(),public.delete_my_account() to authenticated;
-- Editorial writes are atomic RPCs. Direct edits of normalized child rows cannot
-- bypass review invalidation or desynchronize the payload exposed to the apps.
revoke insert,update,delete on public.authors,public.articles,public.article_references,public.checklists,public.checklist_items from authenticated;

-- The bucket is private. Draft images cannot be read by anonymous users.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('editorial-images','editorial-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy editorial_images_public_read on storage.objects for select to anon,authenticated using(
  bucket_id='editorial-images' and exists(select 1 from public.articles a where a.status='published' and a.approved and not a.is_demo and a.payload->>'imageUrl'='storage://editorial-images/' || name));
create policy editorial_images_editor_read on storage.objects for select to authenticated using(bucket_id='editorial-images' and public.is_editor());
create policy editorial_images_editor_insert on storage.objects for insert to authenticated with check(bucket_id='editorial-images' and public.is_editor() and (storage.foldername(name))[1]=auth.uid()::text);
create policy editorial_images_editor_update on storage.objects for update to authenticated using(bucket_id='editorial-images' and public.is_editor()) with check(bucket_id='editorial-images' and public.is_editor());
create policy editorial_images_editor_delete on storage.objects for delete to authenticated using(bucket_id='editorial-images' and public.is_editor());
