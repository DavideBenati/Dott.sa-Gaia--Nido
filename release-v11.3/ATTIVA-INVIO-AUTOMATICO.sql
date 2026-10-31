-- MetiMaia: coda email documenti elaborata anche a browser chiuso.
-- Eseguire nel SQL Editor amministrativo del progetto metimaia.
-- Prerequisiti: migrazione 017 e funzione Edge document-notify pubblicata.
-- Nessun token viene scritto nel comando cron o restituito da questo script.
begin;

-- Estensioni gestite da Supabase. Se non disponibili, il blocco si interrompe:
-- abilitarle dal pannello Database/Extensions prima di riprovare.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set local search_path = pg_catalog, extensions, public;

-- Serializza soltanto le esecuzioni di questa configurazione.
select pg_catalog.pg_advisory_xact_lock(701031017);

do $maia_document_notify_setup$
declare
  secret_name constant text := 'document_notify_job_token';
  job_name constant text := 'metimaia-document-notify';
  matching_secrets integer;
  existing_secret text;
  scheduled_job bigint;
  job_command constant text := $maia_document_notify_command$
select net.http_post(
  url := 'https://gwepsvlxwjptbchhlldm.supabase.co/functions/v1/document-notify',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Document-Notify-Token', secret.decrypted_secret
  ),
  body := '{"action":"retry"}'::jsonb,
  timeout_milliseconds := 90000
)
from vault.decrypted_secrets as secret
where secret.name = 'document_notify_job_token'
  and length(secret.decrypted_secret) between 32 and 256
  and secret.decrypted_secret ~ '^[A-Za-z0-9_-]+$'
  and (select count(*) from vault.secrets where name = 'document_notify_job_token') = 1;
$maia_document_notify_command$;
begin
  select count(*) into matching_secrets
  from vault.secrets where name = secret_name;

  if matching_secrets > 1 then
    raise exception 'Piu segreti Vault chiamati document_notify_job_token: correggere il conflitto prima di attivare il job.';
  end if;

  if matching_secrets = 0 then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      secret_name,
      'Token privato per invio automatico delle email documenti MetiMaia'
    );
  end if;

  select decrypted_secret into existing_secret
  from vault.decrypted_secrets where name = secret_name;
  if existing_secret is null
    or length(existing_secret) not between 32 and 256
    or existing_secret !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Il segreto Vault document_notify_job_token non ha un formato valido. Usare un token casuale di almeno 32 caratteri, senza spazi.';
  end if;

  -- Non cancellare altri job e non creare un secondo job omonimo.
  if (select count(*) from cron.job where jobname = job_name) > 1
    or exists (
      select 1 from cron.job where jobname = job_name
        and (database <> current_database() or username <> current_user)
    ) then
    raise exception 'Conflitto sul job metimaia-document-notify: verificarne proprietario e duplicati prima di continuare.';
  end if;

  -- La forma con nome aggiorna il medesimo job in caso di riesecuzione.
  scheduled_job := cron.schedule(job_name, '* * * * *', job_command);
  perform cron.alter_job(scheduled_job, active := true);
end;
$maia_document_notify_setup$;

commit;

select jobname, schedule, active
from cron.job
where jobname = 'metimaia-document-notify';

-- Ultimo passaggio necessario: copiare privatamente il valore da Vault nel
-- segreto Edge DOCUMENT_NOTIFY_JOB_TOKEN. Seguire CONFIGURA-INVIO-AUTOMATICO.md.
