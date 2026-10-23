-- OPTIONAL scheduled retry. Enable pg_cron and pg_net from Database > Extensions.
-- Create a Vault secret named maia_newsletter_sync_token first. Its value must
-- match the Edge Function secret NEWSLETTER_SYNC_JOB_TOKEN. Never put it here.
-- Run only once; inspect existing jobs before creating another with this name.
select cron.schedule(
 'maia-newsletter-sync',
 '*/5 * * * *',
 $job$select net.http_post(
  url:='https://gwepsvlxwjptbchhlldm.supabase.co/functions/v1/newsletter-sync',
  headers:=jsonb_build_object('Content-Type','application/json','x-newsletter-sync-token',
   (select decrypted_secret from vault.decrypted_secrets where name='maia_newsletter_sync_token' limit 1)),
  body:='{"action":"retry"}'::jsonb,
  timeout_milliseconds:=55000
 );$job$
);
