-- Apply once after 005 (006 may be installed independently). No roles or files
-- are assigned automatically. Storage reads use the document-file Edge proxy.
begin;
create table private.document_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true,
 require_mfa boolean not null default true
);
alter table private.document_staff enable row level security;
revoke all on private.document_staff from public,anon,authenticated;

create function public.can_manage_documents() returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_editor() and exists(
  select 1 from private.document_staff s where s.user_id=auth.uid() and s.active
  and(not s.require_mfa or auth.jwt()->>'aal'='aal2')
 );
$$;
revoke all on function public.can_manage_documents() from public,anon;
grant execute on function public.can_manage_documents() to authenticated;

-- A staff member cannot bypass their MFA requirement by being assigned as a
-- recipient. Ordinary patients need only their verified account session.
create function public.document_session_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and(coalesce(auth.jwt()->>'aal'='aal2',false)or not exists(
  select 1 from private.document_staff s where s.user_id=auth.uid()and s.active
  and(s.require_mfa or exists(select 1 from private.editor_memberships e where e.user_id=s.user_id and e.active and e.require_mfa))
 ));
$$;
revoke all on function public.document_session_allowed() from public,anon;
grant execute on function public.document_session_allowed() to authenticated;

create function public.document_access_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'membership',exists(select 1 from private.document_staff s join private.editor_memberships e on e.user_id=s.user_id where s.user_id=auth.uid() and s.active and e.active),
  'documents_mfa_required',exists(select 1 from private.document_staff s where s.user_id=auth.uid()and s.active and(s.require_mfa or exists(select 1 from private.editor_memberships e where e.user_id=s.user_id and e.active and e.require_mfa))),
  'can_manage',coalesce(public.can_manage_documents(),false),
  'mfa_satisfied',coalesce(auth.jwt()->>'aal'='aal2',false)
 );
$$;
revoke all on function public.document_access_status() from public,anon;
grant execute on function public.document_access_status() to authenticated;

create table public.session_documents (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references auth.users(id) on delete set null,
 title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=2000),
 file_name text not null check(length(file_name) between 1 and 255 and position('/' in file_name)=0 and position(chr(92) in file_name)=0 and file_name !~ '[[:cntrl:]]'),
 mime_type text not null check(mime_type in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation')),
 size_bytes integer not null check(size_bytes between 1 and 20971520),
 storage_path text not null unique check(storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx|pptx)$' and split_part(storage_path,'/',1)=id::text),
 state text not null default 'uploading' check(state in('uploading','ready','failed')),
 active boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 ready_at timestamptz,
 check(not active or(state='ready' and ready_at is not null)),
 check((mime_type='application/pdf' and lower(file_name) like '%.pdf' and storage_path like '%.pdf')or(mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document' and lower(file_name) like '%.docx' and storage_path like '%.docx')or(mime_type='application/vnd.openxmlformats-officedocument.presentationml.presentation' and lower(file_name) like '%.pptx' and storage_path like '%.pptx'))
);
create table public.session_document_access (
 document_id uuid not null references public.session_documents(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 granted_by uuid references auth.users(id) on delete set null,
 granted_at timestamptz not null default now(),
 primary key(document_id,user_id)
);
create index session_document_access_user on public.session_document_access(user_id,document_id);
create table private.document_access_events (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.session_documents(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 action text not null check(action in('grant','revoke')),
 created_at timestamptz not null default now()
);
alter table public.session_documents enable row level security;
alter table public.session_document_access enable row level security;
alter table private.document_access_events enable row level security;
revoke all on public.session_documents,public.session_document_access,private.document_access_events from public,anon,authenticated;
grant select on public.session_documents,public.session_document_access to authenticated;
create policy document_access_read on public.session_document_access for select to authenticated
 using(public.document_session_allowed() and(user_id=auth.uid() or public.can_manage_documents()));
create policy session_documents_read on public.session_documents for select to authenticated
 using(public.document_session_allowed()and(public.can_manage_documents() or(state='ready' and active and exists(select 1 from public.session_document_access a where a.document_id=session_documents.id and a.user_id=auth.uid()))));

create function public.prepare_document(document_title text,document_description text,document_name text,document_mime text,document_size integer) returns public.session_documents
language plpgsql security definer set search_path='' as $$
declare doc public.session_documents; doc_id uuid:=gen_random_uuid(); suffix text;
begin
 if public.can_manage_documents() is not true then raise exception 'Document manager authorization and MFA required' using errcode='42501';end if;
 suffix:=case document_mime when 'application/pdf' then 'pdf' when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx' when 'application/vnd.openxmlformats-officedocument.presentationml.presentation' then 'pptx' else null end;
 if suffix is null then raise exception 'Unsupported document type' using errcode='22023';end if;
 insert into public.session_documents(id,owner_id,title,description,file_name,mime_type,size_bytes,storage_path)
 values(doc_id,auth.uid(),trim(document_title),coalesce(document_description,''),document_name,document_mime,document_size,doc_id::text||'/'||gen_random_uuid()::text||'.'||suffix) returning * into doc;
 return doc;
end;$$;
create function public.complete_document(document_id uuid) returns public.session_documents
language plpgsql security definer set search_path='' as $$
declare doc public.session_documents;
begin
 if public.can_manage_documents() is not true then raise exception 'Document manager authorization and MFA required' using errcode='42501';end if;
 select * into doc from public.session_documents d where d.id=document_id and d.owner_id=auth.uid() and d.state='uploading' for update;
 if not found then raise exception 'Pending upload unavailable' using errcode='22023';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='session-documents' and o.name=doc.storage_path and o.metadata->>'mimetype'=doc.mime_type and case when o.metadata->>'size' ~ '^[0-9]+$' then(o.metadata->>'size')::numeric=doc.size_bytes else false end)then
  raise exception 'Stored file does not match its metadata' using errcode='23514';
 end if;
 update public.session_documents set state='ready',active=true,ready_at=now(),updated_at=now() where id=document_id returning * into doc;
 return doc;
end;$$;
create function public.abort_document(document_id uuid) returns public.session_documents
language plpgsql security definer set search_path='' as $$
declare doc public.session_documents;
begin
 if public.can_manage_documents() is not true then raise exception 'Document manager authorization and MFA required' using errcode='42501';end if;
 update public.session_documents set state='failed',active=false,updated_at=now() where id=document_id and owner_id=auth.uid() and state in('uploading','failed') returning * into doc;
 if not found then raise exception 'Pending upload unavailable' using errcode='22023';end if;
 return doc;
end;$$;
create function public.update_document(document_id uuid,document_title text,document_description text,document_active boolean) returns public.session_documents
language plpgsql security definer set search_path='' as $$
declare doc public.session_documents; target_document uuid:=document_id;
begin
 if public.can_manage_documents() is not true then raise exception 'Document manager authorization and MFA required' using errcode='42501';end if;
 update public.session_documents set title=trim(document_title),description=coalesce(document_description,''),active=document_active,updated_at=now() where id=target_document and state='ready' returning * into doc;
 if not found then raise exception 'Document unavailable' using errcode='22023';end if;
 if not document_active then
  insert into private.document_access_events(document_id,actor_id,recipient_id,action)
   select target_document,auth.uid(),a.user_id,'revoke' from public.session_document_access a where a.document_id=target_document;
  delete from public.session_document_access a where a.document_id=target_document;
 end if;
 return doc;
end;$$;

create function public.search_document_users(search_term text) returns table(user_id uuid,email text)
language plpgsql security definer set search_path='' as $$
begin
 if public.can_manage_documents() is not true then raise exception 'Document manager authorization and MFA required' using errcode='42501';end if;
 if length(trim(search_term))not between 3 and 254 then raise exception 'Enter at least three characters' using errcode='22023';end if;
 return query select u.id,u.email::text from auth.users u where u.email_confirmed_at is not null and u.email is not null and strpos(lower(u.email),lower(trim(search_term)))>0 order by lower(u.email),u.id limit 20;
end;$$;
create function public.document_recipients(document_id uuid) returns table(user_id uuid,email text,granted_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare target_document uuid:=document_id;
begin
 if public.can_manage_documents() is not true then raise exception 'Document manager authorization and MFA required' using errcode='42501';end if;
 return query select a.user_id,u.email::text,a.granted_at from public.session_document_access a join auth.users u on u.id=a.user_id where a.document_id=target_document order by lower(u.email),u.id;
end;$$;
create function public.set_document_recipients(document_id uuid,user_ids uuid[],expected_user_ids uuid[] default null) returns void
language plpgsql security definer set search_path='' as $$
declare targets uuid[]; doc public.session_documents; target_document uuid:=document_id;
begin
 if public.can_manage_documents() is not true then raise exception 'Document manager authorization and MFA required' using errcode='42501';end if;
 if user_ids is null or cardinality(user_ids)>200 or array_position(user_ids,null)is not null then raise exception 'Invalid recipient selection' using errcode='22023';end if;
 select coalesce(array_agg(distinct x),'{}'::uuid[])into targets from unnest(user_ids)x;
 select * into doc from public.session_documents d where d.id=target_document for update;
 if not found or doc.state<>'ready' or(cardinality(targets)>0 and not doc.active)then raise exception 'Active ready document required' using errcode='22023';end if;
 if expected_user_ids is not null and(select coalesce(array_agg(a.user_id order by a.user_id),'{}'::uuid[])from public.session_document_access a where a.document_id=target_document)is distinct from(select coalesce(array_agg(distinct x order by x),'{}'::uuid[])from unnest(expected_user_ids)x)then raise exception 'Recipients changed; reload before saving' using errcode='40001';end if;
 if exists(select 1 from unnest(targets)t where not exists(select 1 from auth.users u where u.id=t and u.email_confirmed_at is not null and u.email is not null))then raise exception 'Recipient unavailable or unconfirmed' using errcode='22023';end if;
 insert into private.document_access_events(document_id,actor_id,recipient_id,action)
 select target_document,auth.uid(),a.user_id,'revoke' from public.session_document_access a where a.document_id=target_document and not(a.user_id=any(targets));
 insert into private.document_access_events(document_id,actor_id,recipient_id,action)
 select target_document,auth.uid(),t,'grant' from unnest(targets)t where not exists(select 1 from public.session_document_access a where a.document_id=target_document and a.user_id=t);
 delete from public.session_document_access a where a.document_id=target_document and not(a.user_id=any(targets));
 insert into public.session_document_access(document_id,user_id,granted_by)select target_document,t,auth.uid() from unnest(targets)t on conflict do nothing;
 update public.session_documents set updated_at=now() where id=target_document;
end;$$;

create function public.authorized_document_file(p_document_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',d.id,'storage_path',d.storage_path,'file_name',d.file_name,'mime_type',d.mime_type,'size_bytes',d.size_bytes,'title',d.title)
 from public.session_documents d where auth.uid() is not null and public.document_session_allowed() and d.id=p_document_id and d.state='ready'
 and(public.can_manage_documents() or(d.active and exists(select 1 from public.session_document_access a where a.document_id=d.id and a.user_id=auth.uid())));
$$;
revoke all on function public.prepare_document(text,text,text,text,integer),public.complete_document(uuid),public.abort_document(uuid),public.update_document(uuid,text,text,boolean),public.search_document_users(text),public.document_recipients(uuid),public.set_document_recipients(uuid,uuid[],uuid[]),public.authorized_document_file(uuid) from public,anon;
grant execute on function public.prepare_document(text,text,text,text,integer),public.complete_document(uuid),public.abort_document(uuid),public.update_document(uuid,text,text,boolean),public.search_document_users(text),public.document_recipients(uuid),public.set_document_recipients(uuid,uuid[],uuid[]),public.authorized_document_file(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('session-documents','session-documents',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- RESTRICTIVE policies prevent broad policies on other buckets from accidentally
-- exposing documents. No client SELECT means no client can mint a signed URL.
create policy session_documents_no_direct_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'session-documents');
create policy session_documents_no_direct_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'session-documents')with check(bucket_id<>'session-documents');
create policy session_documents_no_direct_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'session-documents');
create policy session_documents_anonymous_no_upload on storage.objects as restrictive for insert to anon with check(bucket_id<>'session-documents');
create policy session_documents_upload_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'session-documents' or(public.can_manage_documents() and exists(select 1 from public.session_documents d where d.storage_path=name and d.owner_id=auth.uid() and d.state='uploading')));
create policy session_documents_manager_upload on storage.objects for insert to authenticated with check(bucket_id='session-documents' and public.can_manage_documents() and exists(select 1 from public.session_documents d where d.storage_path=name and d.owner_id=auth.uid() and d.state='uploading'));
commit;
