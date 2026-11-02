-- Lokaler Schema-Test (siehe supabase/README.md). NICHT in Supabase ausführen.
\set ON_ERROR_STOP 1
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@x.de','{"first_name":"Chef"}'),
 ('00000000-0000-0000-0000-00000000000c','kunde@x.de','{"first_name":"Max","last_name":"Muster"}'),
 ('00000000-0000-0000-0000-00000000000d','k2@x.de','{}');
update public.profiles set role='admin' where email='admin@x.de';
update public.profiles set qr_token='11111111-1111-1111-1111-111111111111' where email='kunde@x.de';

-- Kunde: darf keine Besuche eintragen
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
\set ON_ERROR_STOP 0
select public.record_visit('11111111-1111-1111-1111-111111111111');
insert into public.visits(customer_id,visit_date) values ('00000000-0000-0000-0000-00000000000c',current_date);
update public.profiles set role='admin' where id=auth.uid();
\set ON_ERROR_STOP 1
update public.profiles set first_name='Maximilian' where id=auth.uid();
select count(*) as sichtbare_profile_kunde from public.profiles;
reset role;

-- Admin scannt
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
select public.record_visit('11111111-1111-1111-1111-111111111111')->>'stamp_position' as pos1;
\set ON_ERROR_STOP 0
select public.record_visit('11111111-1111-1111-1111-111111111111');  -- zweiter Scan heute
select public.record_visit('99999999-1111-1111-1111-111111111111');  -- unbekannt
\set ON_ERROR_STOP 1
reset role;
-- 11 weitere Besuche an Vortagen simulieren via direktem Insert + Scan-Logik: Daten zurückdatieren
update public.visits set visit_date = visit_date - 100;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
do $$ declare i int; r jsonb; begin
  for i in 2..13 loop
    r := public.record_visit('11111111-1111-1111-1111-111111111111');
    raise notice 'besuch % pos % neu %', i, r->>'stamp_position', r->'new_rewards';
    reset role; update public.visits set visit_date = visit_date - 1; set role authenticated;
  end loop; end $$;
select type, status, label from public.rewards order by earned_at;
select public.redeem_reward((select id from public.rewards where type='free_cut')) is not null as eingeloest;
\set ON_ERROR_STOP 0
select public.redeem_reward((select id from public.rewards where type='free_cut'));
\set ON_ERROR_STOP 1
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
select * from public.stamp_progress('00000000-0000-0000-0000-00000000000c');
select count(*) as fremd_progress from public.stamp_progress('00000000-0000-0000-0000-00000000000d');
insert into public.reviews(customer_id, visit_id, rating) select auth.uid(), id, 5 from public.visits limit 1;
select first_name, role from public.profiles;
reset role;
set role anon; reset request.jwt.claim.sub;
select count(*) as services_anon from public.services;
select name from public.salon_settings;
