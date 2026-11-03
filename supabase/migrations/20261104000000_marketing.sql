-- =====================================================================
-- Phase 4: Push-Nachrichten, Rückholaktion (Gutschein nach 6 Wochen),
--          Push-Aktionen aus dem Dashboard, Bewertungen
-- =====================================================================
-- Push-Nachrichten werden direkt aus der Datenbank über den Expo Push Service
-- verschickt (Erweiterung pg_net). Die Rückholaktion läuft täglich per pg_cron.
-- So braucht das Projekt keinen eigenen Server.
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- Interne Konfiguration (für Kunden und Admins unsichtbar)
-- ---------------------------------------------------------------------
create table public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value) values
  ('push_endpoint', 'https://exp.host/--/api/v2/push/send');

-- ---------------------------------------------------------------------
-- Push-Aktionen und Versandprotokoll
-- ---------------------------------------------------------------------
create table public.push_campaigns (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(title) between 1 and 65),
  body        text not null check (length(body) between 1 and 240),
  recipients  int  not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create type public.push_kind as enum ('winback', 'campaign');

create table public.push_log (
  id           bigint generated always as identity primary key,
  kind         public.push_kind not null,
  customer_id  uuid references public.profiles (id) on delete cascade,
  campaign_id  uuid references public.push_campaigns (id) on delete cascade,
  title        text not null,
  body         text not null,
  request_id   bigint,          -- Verweis auf net._http_response (Antwort von Expo)
  created_at   timestamptz not null default now()
);

create index push_log_created_idx on public.push_log (created_at desc);

alter table public.push_campaigns enable row level security;
alter table public.push_log       enable row level security;

create policy "campaigns_admin_read" on public.push_campaigns for select using (public.is_admin());
create policy "push_log_admin_read"  on public.push_log       for select using (public.is_admin());

revoke all on public.push_campaigns, public.push_log from anon, authenticated;
grant select on public.push_campaigns, public.push_log to authenticated;

-- ---------------------------------------------------------------------
-- Bewertungen: Kunde darf vermerken, dass er zu Google weitergeleitet wurde
-- ---------------------------------------------------------------------
create policy "reviews_update_own" on public.reviews for update
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
grant update (forwarded_to_google) on public.reviews to authenticated;

-- ---------------------------------------------------------------------
-- Interne Versandfunktion: schickt eine Nachricht an viele Expo-Push-Tokens.
-- Expo nimmt bis zu 100 Nachrichten pro Anfrage an. Rückgabe: pg_net-Request-IDs.
-- ---------------------------------------------------------------------
create function public.send_push(p_tokens text[], p_title text, p_body text, p_data jsonb default '{}')
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url       text;
  v_ids       bigint[] := '{}';
  v_messages  jsonb;
  v_i         int := 1;
  v_n         int := coalesce(array_length(p_tokens, 1), 0);
begin
  select value into v_url from public.app_config where key = 'push_endpoint';

  while v_i <= v_n loop
    select jsonb_agg(jsonb_build_object(
             'to', t, 'title', p_title, 'body', p_body, 'data', p_data, 'sound', 'default'))
      into v_messages
      from unnest(p_tokens[v_i : v_i + 99]) as t;

    v_ids := v_ids || net.http_post(
      url     := v_url,
      body    := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    v_i := v_i + 100;
  end loop;
  return v_ids;
end;
$$;

revoke execute on function public.send_push(text[], text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Rückholaktion: läuft täglich. Kunden, die seit winback_after_days Tagen
-- nicht da waren, bekommen einmal pro Abwesenheit einen Rabatt-Gutschein
-- und (falls Push erlaubt) eine Nachricht.
-- ---------------------------------------------------------------------
create function public.run_winback()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s      public.salon_settings;
  v_c      record;
  v_label  text;
  v_until  timestamptz;
  v_title  text;
  v_body   text;
  v_req    bigint[];
  v_count  int := 0;
begin
  select * into v_s from public.salon_settings where id = 1;
  v_label := v_s.winback_discount_percent || ' % Rabatt auf deinen nächsten Besuch';
  v_until := now() + make_interval(days => v_s.winback_valid_days);

  for v_c in
    select p.id, p.first_name, p.push_token
      from public.profiles p
     where p.role = 'customer'
       and p.last_visit_at is not null
       and p.last_visit_at < now() - make_interval(days => v_s.winback_after_days)
       and not exists (
         select 1 from public.rewards r
          where r.customer_id = p.id
            and r.type = 'winback_discount'
            and r.earned_at > p.last_visit_at
       )
  loop
    insert into public.rewards (customer_id, type, label, discount_percent, valid_until)
    values (v_c.id, 'winback_discount', v_label, v_s.winback_discount_percent, v_until);

    if v_c.push_token is not null then
      v_title := 'Wir vermissen dich' || coalesce(', ' || v_c.first_name, '') || '!';
      v_body  := 'Zeit für einen frischen Schnitt? Du bekommst ' || v_s.winback_discount_percent
                 || ' % Rabatt, gültig bis ' || to_char(v_until at time zone v_s.timezone, 'DD.MM.YYYY') || '.';
      v_req := public.send_push(array[v_c.push_token], v_title, v_body, '{"screen": "karte"}'::jsonb);
      insert into public.push_log (kind, customer_id, title, body, request_id)
      values ('winback', v_c.id, v_title, v_body, v_req[1]);
    end if;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.run_winback() from public, anon, authenticated;

-- Täglich um 09:00 UTC (10:00 Uhr Winterzeit, 11:00 Uhr Sommerzeit in Deutschland).
select cron.schedule('winback-daily', '0 9 * * *', 'select public.run_winback()');

-- ---------------------------------------------------------------------
-- Push-Aktion aus dem Dashboard an alle Kunden mit Push-Erlaubnis
-- ---------------------------------------------------------------------
create function public.admin_send_push(p_title text, p_body text)
returns public.push_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tokens    text[];
  v_campaign  public.push_campaigns;
  v_req       bigint[];
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  p_title := trim(p_title);
  p_body  := trim(p_body);
  if coalesce(p_title, '') = '' or coalesce(p_body, '') = '' then
    raise exception 'push_text_missing' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(push_token), '{}') into v_tokens
    from public.profiles
   where role = 'customer' and push_token is not null;

  insert into public.push_campaigns (title, body, recipients, created_by)
  values (p_title, p_body, coalesce(array_length(v_tokens, 1), 0), auth.uid())
  returning * into v_campaign;

  if array_length(v_tokens, 1) > 0 then
    v_req := public.send_push(v_tokens, p_title, p_body, '{"screen": "karte"}'::jsonb);
    insert into public.push_log (kind, campaign_id, title, body, request_id)
    values ('campaign', v_campaign.id, p_title, p_body, v_req[1]);
  end if;

  return v_campaign;
end;
$$;

revoke execute on function public.admin_send_push(text, text) from public, anon;
grant  execute on function public.admin_send_push(text, text) to authenticated;

-- Anzahl Kunden mit Push-Erlaubnis (für das Dashboard)
create function public.admin_push_audience()
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return (select count(*) from public.profiles where role = 'customer' and push_token is not null);
end;
$$;

revoke execute on function public.admin_push_audience() from public, anon;
grant  execute on function public.admin_push_audience() to authenticated;

-- ---------------------------------------------------------------------
-- Kennzahlen erweitert um Rückholaktion und Bewertungen
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.salon_settings;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select * into v_s from public.salon_settings where id = 1;

  return jsonb_build_object(
    'customers_total',
      (select count(*) from public.profiles where role = 'customer'),
    'customers_new_30d',
      (select count(*) from public.profiles where role = 'customer' and created_at > now() - interval '30 days'),
    'customers_active_42d',
      (select count(*) from public.profiles where role = 'customer'
        and last_visit_at > now() - make_interval(days => v_s.winback_after_days)),
    'customers_with_push',
      (select count(*) from public.profiles where role = 'customer' and push_token is not null),
    'visits_today',
      (select count(*) from public.visits where visit_date = (now() at time zone v_s.timezone)::date),
    'visits_30d',
      (select count(*) from public.visits where created_at > now() - interval '30 days'),
    'rewards_redeemed_30d',
      (select count(*) from public.rewards where status = 'redeemed' and redeemed_at > now() - interval '30 days'),
    'winback_sent_30d',
      (select count(*) from public.rewards where type = 'winback_discount' and earned_at > now() - interval '30 days'),
    'winback_redeemed_30d',
      (select count(*) from public.rewards where type = 'winback_discount' and status = 'redeemed'
        and redeemed_at > now() - interval '30 days'),
    'reviews_30d',
      (select count(*) from public.reviews where created_at > now() - interval '30 days'),
    'rating_avg_30d',
      (select round(avg(rating), 1) from public.reviews where created_at > now() - interval '30 days')
  );
end;
$$;
