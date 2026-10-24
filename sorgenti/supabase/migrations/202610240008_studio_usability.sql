-- Apply after private documents (007), which also requires workspace (005).
-- Contact labels are available only to the existing chat role, including its
-- MFA requirement. This does not expose an account directory to other roles.
begin;

create or replace function public.professional_conversation_contacts(
  search_term text default '',
  page_offset integer default 0,
  page_limit integer default 50
)
returns table (
  user_id uuid,
  email text,
  last_message_at timestamptz,
  last_message_preview text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  term text := pg_catalog.lower(pg_catalog.btrim(coalesce(search_term, '')));
begin
  if auth.uid() is null or public.is_chat_staff() is not true then
    raise exception 'Chat authorization and required MFA are needed'
      using errcode = '42501';
  end if;
  if pg_catalog.length(term) > 254
    or page_offset is null or page_offset < 0
    or page_limit is null or page_limit < 1 or page_limit > 50 then
    raise exception 'Invalid conversation search or page'
      using errcode = '22023';
  end if;

  return query
  select
    c.user_id,
    coalesce(u.email, '')::text,
    latest.created_at,
    coalesce(pg_catalog.left(latest.body, 120), '')::text
  from public.care_conversations c
  join auth.users u on u.id = c.user_id
  left join lateral (
    select m.created_at, m.body
    from public.care_messages m
    where m.conversation_id = c.user_id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  -- position() is a literal substring search: %, _ and backslashes are not
  -- treated as patterns supplied by the caller.
  where term = '' or pg_catalog.strpos(pg_catalog.lower(coalesce(u.email, '')), term) > 0
  order by coalesce(latest.created_at, c.created_at) desc, c.user_id
  offset page_offset limit page_limit;
end;
$$;

revoke all on function public.professional_conversation_contacts(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.professional_conversation_contacts(text, integer, integer)
  to authenticated;

-- Editing a label must never reactivate an archived document or restore access.
-- The expected version also prevents overwriting a concurrent archive, change
-- to recipients or metadata edit performed in another professional session.
create or replace function public.update_document_details(
  document_id uuid,
  document_title text,
  document_description text,
  expected_updated_at timestamptz
)
returns public.session_documents
language plpgsql security definer set search_path = '' as $$
declare
  target_document uuid := document_id;
  doc public.session_documents;
  next_title text := pg_catalog.btrim(coalesce(document_title, ''));
  next_description text := coalesce(document_description, '');
begin
  if public.can_manage_documents() is not true then
    raise exception 'Document manager authorization and MFA required'
      using errcode = '42501';
  end if;
  if pg_catalog.length(next_title) not between 1 and 180
    or pg_catalog.length(next_description) > 2000 then
    raise exception 'Invalid document title or description'
      using errcode = '22023';
  end if;
  select d.* into doc
  from public.session_documents d
  where d.id = target_document
  for update;
  if not found or doc.state <> 'ready' then
    raise exception 'Ready document unavailable' using errcode = '22023';
  end if;
  if doc.updated_at is distinct from expected_updated_at then
    raise exception 'Document changed; reload before saving'
      using errcode = '40001';
  end if;
  update public.session_documents d
  set title = next_title,
      description = next_description,
      updated_at = greatest(pg_catalog.clock_timestamp(), doc.updated_at + interval '1 microsecond')
  where d.id = target_document
  returning d.* into doc;
  return doc;
end;
$$;

revoke all on function public.update_document_details(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.update_document_details(uuid, text, text, timestamptz)
  to authenticated;

-- Archiving must not overwrite labels edited by another professional session.
create or replace function public.update_document_state(
  document_id uuid,
  document_active boolean,
  expected_updated_at timestamptz
)
returns public.session_documents
language plpgsql security definer set search_path = '' as $$
declare
  target_document uuid := document_id;
  doc public.session_documents;
begin
  if public.can_manage_documents() is not true then
    raise exception 'Document manager authorization and MFA required'
      using errcode = '42501';
  end if;
  if document_active is null then
    raise exception 'Document state required' using errcode = '22023';
  end if;
  select d.* into doc from public.session_documents d
    where d.id = target_document for update;
  if not found or doc.state <> 'ready' then
    raise exception 'Ready document unavailable' using errcode = '22023';
  end if;
  if doc.updated_at is distinct from expected_updated_at then
    raise exception 'Document changed; reload before saving'
      using errcode = '40001';
  end if;
  update public.session_documents d
    set active = document_active,
        updated_at = greatest(pg_catalog.clock_timestamp(), doc.updated_at + interval '1 microsecond')
    where d.id = target_document returning d.* into doc;
  if not document_active then
    insert into private.document_access_events(document_id, actor_id, recipient_id, action)
      select target_document, auth.uid(), a.user_id, 'revoke'
      from public.session_document_access a where a.document_id = target_document;
    delete from public.session_document_access a where a.document_id = target_document;
  end if;
  return doc;
end;
$$;
revoke all on function public.update_document_state(uuid, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.update_document_state(uuid, boolean, timestamptz)
  to authenticated;

commit;
