-- Esegui dopo l’aggiornamento 009, nel SQL Editor del progetto metimaia.
-- Abilita solo la visione dei percorsi volontariamente condivisi con Gaia.
-- Richiede un account confermato e già abilitato a Studio.
-- Non abilita chat, documenti o revisione clinica. Il codice a due fattori è richiesto.
do $$
declare account_ids uuid[];
begin
  select array_agg(u.id) into account_ids
  from auth.users u
  join private.editor_memberships e on e.user_id = u.id and e.active
  where lower(trim(u.email)) = 'ostetricamaia@gmail.com'
    and u.email_confirmed_at is not null and u.deleted_at is null;
  if coalesce(cardinality(account_ids), 0) <> 1 then
    raise exception 'Serve un unico account ostetricamaia@gmail.com confermato e già abilitato a Studio.';
  end if;
  insert into private.member_profile_staff(user_id, active, require_mfa)
    values(account_ids[1], true, true)
    on conflict(user_id) do update set active = true, require_mfa = true;
end;
$$;
select u.email, s.active as schede_abilitate,
  s.require_mfa as codice_sicurezza_richiesto
from private.member_profile_staff s join auth.users u on u.id = s.user_id
where lower(trim(u.email)) = 'ostetricamaia@gmail.com'
  and u.email_confirmed_at is not null and u.deleted_at is null;
