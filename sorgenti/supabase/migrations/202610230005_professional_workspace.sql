-- Apply after newsletter + shop migrations. Additive; no existing content is deleted.
alter table private.editor_memberships add column if not exists require_mfa boolean not null default false;
alter table private.chat_staff add column if not exists require_mfa boolean not null default false;
create or replace function public.is_editor() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.editor_memberships where user_id=auth.uid() and active and (not require_mfa or auth.jwt()->>'aal'='aal2'));
$$;
create or replace function public.is_chat_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.chat_staff where user_id=auth.uid() and active and (not require_mfa or auth.jwt()->>'aal'='aal2'));
$$;
create function public.professional_access_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('editor',exists(select 1 from private.editor_memberships where user_id=auth.uid() and active),
 'chat',exists(select 1 from private.chat_staff where user_id=auth.uid() and active),
 'mfa_required',exists(select 1 from private.editor_memberships where user_id=auth.uid() and active and require_mfa) or exists(select 1 from private.chat_staff where user_id=auth.uid() and active and require_mfa),
 'mfa_satisfied',coalesce(auth.jwt()->>'aal'='aal2',false));
$$;
create function public.require_professional_mfa() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Verified MFA session required' using errcode='42501'; end if;
 if not exists(select 1 from private.editor_memberships where user_id=auth.uid() and active) and not exists(select 1 from private.chat_staff where user_id=auth.uid() and active) then raise exception 'Professional membership required' using errcode='42501'; end if;
 update private.editor_memberships set require_mfa=true where user_id=auth.uid();
 update private.chat_staff set require_mfa=true where user_id=auth.uid();
end; $$;
revoke all on function public.professional_access_status(),public.require_professional_mfa() from public,anon;
grant execute on function public.professional_access_status(),public.require_professional_mfa() to authenticated;

create table public.site_profile (
 id integer primary key default 1 check(id=1),
 bio text not null default 'Come ostetrica desidero accompagnarvi con ascolto, rispetto e competenza. Ogni famiglia ha la propria storia, i propri tempi e il proprio modo di crescere insieme.',
 portrait_url text not null default '' check(portrait_url='' or portrait_url ~ '^https://'),
 qualifications text not null default '',
 service_area text not null default 'Modalità, luoghi e disponibilità da concordare direttamente.',
 services jsonb not null default '[]' check(jsonb_typeof(services)='array'),
 contact_email text not null default 'ostetricamaia@gmail.com' check(contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 privacy_providers text not null default 'Cloudflare ospita il sito. Supabase gestisce autenticazione e database del progetto in Irlanda. Resend gestisce l’invio email; Stripe gestisce i pagamenti quando lo Shop è attivo. I collegamenti Amazon aprono un servizio esterno.',
 privacy_retention text not null default '',
 privacy_transfers text not null default '',
 privacy_reviewed boolean not null default false,
 check(not privacy_reviewed or (length(trim(privacy_retention))>30 and length(trim(privacy_transfers))>30)),
 updated_at timestamptz not null default now()
);
insert into public.site_profile(id) values(1);
alter table public.site_profile enable row level security;
grant select on public.site_profile to anon,authenticated;
grant insert,update on public.site_profile to authenticated;
create policy site_profile_read on public.site_profile for select to anon,authenticated using(true);
create policy site_profile_editor on public.site_profile for all to authenticated using(public.is_editor()) with check(public.is_editor());

create table public.booking_requests (
 id uuid primary key,
 name text not null check(length(name) between 1 and 100),
 email text not null check(length(email)<=254),
 topic text not null,
 preferred_date date,
 preferred_time text not null,
 preferred_mode text not null,
 status text not null default 'new' check(status in ('new','contacted','closed')),
 mail_sent boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.booking_requests enable row level security;
revoke all on public.booking_requests from public,anon,authenticated;
grant select,update(status) on public.booking_requests to authenticated;
grant all on public.booking_requests to service_role;
create policy bookings_editor on public.booking_requests for select to authenticated using(public.is_editor());
create policy bookings_update on public.booking_requests for update to authenticated using(public.is_editor()) with check(public.is_editor());

create table private.consent_events (
 id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,
 purpose text not null,granted boolean not null,version text not null,created_at timestamptz not null default now()
);
alter table private.consent_events enable row level security;
revoke all on private.consent_events from public,anon,authenticated;
create function private.record_personalization_consent() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or (new.payload->'sensitiveConsent') is distinct from (old.payload->'sensitiveConsent') or (new.payload->'personalized') is distinct from (old.payload->'personalized') then
 insert into private.consent_events(user_id,purpose,granted,version) values(new.user_id,'health_personalization',coalesce((new.payload->>'sensitiveConsent')::boolean,false) and coalesce((new.payload->>'personalized')::boolean,false),'2026-10-23-v3');
 end if; return new;
end; $$;
create trigger preferences_consent_audit after insert or update on public.user_preferences for each row execute function private.record_personalization_consent();


revoke all on function private.record_personalization_consent() from public,anon,authenticated;
