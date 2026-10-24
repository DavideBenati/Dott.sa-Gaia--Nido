-- Eseguire dopo 202610240007_private_documents.sql.
-- Sostituire SOLO il testo EMAIL_ESATTA_ACCOUNT_GAIA mantenendo gli apici.
-- Abilita la gestione di TUTTI i materiali riservati: usare solo Gaia o personale
-- espressamente autorizzato. Non condivide file con i normali pazienti.
do $$
declare task_email text:='EMAIL_ESATTA_ACCOUNT_GAIA'; task_user uuid;
begin
 select u.id into task_user from auth.users u join private.editor_memberships e on e.user_id=u.id and e.active
 where lower(u.email)=lower(trim(task_email))and u.email_confirmed_at is not null;
 if task_user is null then raise exception 'Inserisci l’email esatta di un account confermato con ruolo editoriale attivo.';end if;
 insert into private.document_staff(user_id,active,require_mfa)values(task_user,true,true)
 on conflict(user_id)do update set active=true,require_mfa=true;
end;$$;
select u.email,s.active,s.require_mfa from private.document_staff s join auth.users u on u.id=s.user_id order by u.email;
