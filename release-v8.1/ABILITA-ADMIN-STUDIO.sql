-- Da eseguire nel SQL Editor del progetto Supabase metimaia.
-- Richiede un account già creato e confermato. Non crea account.
-- Conserva qualifiche, permessi separati e obbligo MFA già presenti.
do $$
declare
  account_ids uuid[];
begin
  select array_agg(id) into account_ids
  from auth.users
  where lower(trim(email)) = 'ostetricamaia@gmail.com'
    and email_confirmed_at is not null
    and deleted_at is null;

  if coalesce(cardinality(account_ids), 0) <> 1 then
    raise exception 'Account non trovato o non univoco: crea e conferma prima l''account ostetricamaia@gmail.com sul sito.';
  end if;

  insert into private.editor_memberships
    (user_id, professional_name, professional_role, active)
  values
    (account_ids[1], 'Dott.sa Gaia', 'Amministrazione Studio', true)
  on conflict (user_id) do update set active = true;
end;
$$;

select
  u.email,
  u.email_confirmed_at is not null as email_confermata,
  e.active as studio_abilitato,
  e.require_mfa as codice_sicurezza_richiesto
from auth.users u
join private.editor_memberships e on e.user_id = u.id
where lower(trim(u.email)) = 'ostetricamaia@gmail.com'
  and u.deleted_at is null;
