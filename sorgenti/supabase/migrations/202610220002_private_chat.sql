-- Apply after 202610210001_nido.sql. Chat access is distinct from editorial access.
create table private.chat_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true
);
alter table private.chat_staff enable row level security;
revoke all on private.chat_staff from public, anon, authenticated;
create function public.is_chat_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.chat_staff where user_id = auth.uid() and active);
$$;
revoke all on function public.is_chat_staff() from public,anon,authenticated;
grant execute on function public.is_chat_staff() to authenticated;

create function public.care_chat_available() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.chat_staff where active);
$$;
revoke all on function public.care_chat_available() from public,anon,authenticated;
grant execute on function public.care_chat_available() to authenticated;

create table public.care_conversations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.care_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.care_conversations(user_id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index care_messages_conversation_time on public.care_messages(conversation_id,created_at,id);
alter table public.care_conversations enable row level security;
alter table public.care_messages enable row level security;
revoke all on public.care_conversations,public.care_messages from public,anon,authenticated;
grant select on public.care_conversations,public.care_messages to authenticated;
grant insert(user_id) on public.care_conversations to authenticated;
grant insert(conversation_id,body) on public.care_messages to authenticated;
create policy care_conversations_read on public.care_conversations for select to authenticated
using (user_id=auth.uid() or public.is_chat_staff());
create policy care_conversations_create on public.care_conversations for insert to authenticated
with check (user_id=auth.uid() and not public.is_chat_staff());
create policy care_messages_read on public.care_messages for select to authenticated
using (conversation_id=auth.uid() or public.is_chat_staff());
create policy care_messages_send on public.care_messages for insert to authenticated
with check (sender_id=auth.uid() and public.care_chat_available() and (conversation_id=auth.uid() or public.is_chat_staff()));
-- No client can edit/delete messages, impersonate the sender or forge timestamps.
-- Account deletion cascades to its conversation and messages.
create or replace function public.export_my_data() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('exportedAt',now(),'profile',(select to_jsonb(p) from public.profiles p where user_id=auth.uid()),
    'preferences',(select payload from public.user_preferences where user_id=auth.uid()),
    'notificationPreferences',(select to_jsonb(n) from public.notification_preferences n where user_id=auth.uid()),
    'favorites',coalesce((select jsonb_agg(article_id) from public.user_favorites where user_id=auth.uid()),'[]'),
    'checklistProgress',coalesce((select jsonb_agg(jsonb_build_object('itemId',item_id,'completed',completed)) from public.checklist_progress where user_id=auth.uid()),'[]'),
    'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id) from public.care_messages m where conversation_id=auth.uid()),'[]'));
$$;

revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
