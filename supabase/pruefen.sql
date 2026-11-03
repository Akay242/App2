-- Zeigt, welche Teile der Datenbank schon eingerichtet sind (true = vorhanden).
select
  to_regclass('public.salon_settings') is not null                as teil1_begonnen,
  to_regprocedure('public.redeem_reward(uuid)') is not null         as teil1_fertig,
  to_regprocedure('public.admin_customer_overview()') is not null   as teil2,
  to_regclass('public.push_campaigns') is not null                  as teil3,
  to_regprocedure('public.delete_my_account()') is not null         as teil4,
  case when to_regclass('supabase_migrations.schema_migrations') is null then 'keine'
       else coalesce((xpath('/row/v/text()', query_to_xml(
         'select string_agg(version, '','' order by version) as v from supabase_migrations.schema_migrations',
         false, true, '')))[1]::text, 'keine') end                  as automatisch_eingespielt;
