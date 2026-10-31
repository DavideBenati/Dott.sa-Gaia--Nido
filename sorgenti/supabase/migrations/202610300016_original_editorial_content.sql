-- Original articles may identify their author as the source instead of linking
-- to an external publication. The declaration is explicit and is NOT approval.
-- No existing article, author identity, review or account permission is changed.
-- All professional-review, MFA, publication and review-invalidation checks stay.
begin;

create or replace function private.validate_editorial() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed boolean := false; review_date date;
begin
  if not public.is_editor() then raise exception 'Editor authorization required' using errcode='42501'; end if;
  if tg_table_name = 'articles' and new.payload ? 'originalContent'
    and jsonb_typeof(new.payload->'originalContent') is distinct from 'boolean' then
    raise exception 'Original-content declaration must be a boolean' using errcode='23514';
  end if;
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
      if jsonb_array_length(coalesce(new.payload->'references','[]')) = 0
        and new.payload->'originalContent' is distinct from 'true'::jsonb then
        raise exception 'Sources or an explicit original-content declaration are required for publication' using errcode='23514';
      end if;
      if jsonb_array_length(coalesce(new.payload->'sections','[]')) = 0 then raise exception 'Article content is required' using errcode='23514'; end if;
    end if;
  end if;
  if tg_table_name = 'articles' then
    if length(trim(coalesce(new.payload->>'title',''))) < 3 then raise exception 'Article title is required' using errcode='23514'; end if;
    if coalesce(new.payload->>'stage','') not in ('pregnancy','postpartum','all') then raise exception 'Invalid journey stage' using errcode='23514'; end if;
    if jsonb_typeof(new.payload->'sections') is distinct from 'array' or jsonb_typeof(new.payload->'references') is distinct from 'array' then raise exception 'Sections and references must be arrays' using errcode='23514'; end if;
    if exists (
      select 1 from jsonb_array_elements(new.payload->'references') as source(value)
      where jsonb_typeof(source.value) is distinct from 'object'
        or jsonb_typeof(source.value->'label') is distinct from 'string'
        or length(trim(coalesce(source.value->>'label',''))) = 0
        or jsonb_typeof(source.value->'url') is distinct from 'string'
        or coalesce(source.value->>'url','') !~ '^https://[^[:space:]]+$'
    ) then
      raise exception 'Each source needs a title and a valid HTTPS URL' using errcode='23514';
    end if;
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

commit;
