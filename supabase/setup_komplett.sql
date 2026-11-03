-- =====================================================================
-- Salon Bonus – komplette Datenbank-Einrichtung in EINEM Schritt
-- =====================================================================
-- Automatisch zusammengesetzt aus allen Dateien in supabase/migrations/
-- (in dieser Reihenfolge). Nur EINMAL in einem neuen, leeren Supabase-Projekt
-- im SQL Editor ausführen. Beispieldaten stehen separat in supabase/seed.sql.
-- Neu erzeugen: python3 scripts/build-setup-sql.py
-- =====================================================================

-- ===================== 20261102000000_initial_schema.sql =====================
-- =====================================================================
-- Phase 1: Grund-Datenmodell für die Salon-Bonus-App
-- =====================================================================
-- Tabellen:
--   salon_settings  – genau eine Zeile mit Salon-Daten und Bonus-Regeln
--   profiles        – ein Profil pro Nutzer (Kunde oder Admin)
--   visits          – ein Eintrag pro gescanntem Besuch (max. 1 pro Tag)
--   rewards         – verdiente Belohnungen (Extra, Gratis-Schnitt, Rückhol-Rabatt)
--   services        – Preisliste und Leistungen
--   reviews         – Bewertungen nach einem Besuch
--
-- Schreibzugriffe auf Besuche und Belohnungen laufen ausschließlich über
-- die Funktionen record_visit() und redeem_reward(), die prüfen, dass der
-- Aufrufer Admin ist. Kunden können Besuche also nicht selbst eintragen.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Salon-Einstellungen (Single-Row-Tabelle)
-- ---------------------------------------------------------------------
create table public.salon_settings (
  id                        smallint primary key default 1 check (id = 1),
  name                      text        not null default 'Mein Salon',
  address                   text,
  phone                     text,
  opening_hours             jsonb       not null default '[]'::jsonb,
  google_review_url         text,
  timezone                  text        not null default 'Europe/Berlin',
  -- Stempelkarte
  stamps_per_cycle          int         not null default 12 check (stamps_per_cycle > 0),
  small_reward_at           int         not null default 6  check (small_reward_at > 0),
  small_reward_label        text        not null default 'Kleines Extra',
  free_cut_label            text        not null default 'Gratis-Haarschnitt',
  -- Rückholaktion (wird in Phase 4 automatisiert)
  winback_after_days        int         not null default 42 check (winback_after_days > 0),
  winback_discount_percent  int         not null default 10 check (winback_discount_percent between 1 and 100),
  winback_valid_days        int         not null default 14 check (winback_valid_days > 0),
  updated_at                timestamptz not null default now(),
  constraint small_reward_before_cycle_end check (small_reward_at < stamps_per_cycle)
);

insert into public.salon_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------
create type public.user_role as enum ('customer', 'admin');

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           public.user_role not null default 'customer',
  first_name     text,
  last_name      text,
  email          text,
  -- Inhalt des persönlichen QR-Codes. Zufällig und nicht erratbar,
  -- unabhängig von der User-ID, damit er bei Bedarf erneuert werden kann.
  qr_token       uuid        not null unique default gen_random_uuid(),
  push_token     text,
  last_visit_at  timestamptz,
  created_at     timestamptz not null default now()
);

create index profiles_last_visit_at_idx on public.profiles (last_visit_at);

-- Legt bei jeder Registrierung automatisch ein Kundenprofil an.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Hilfsfunktion für RLS-Regeln und Admin-Funktionen.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Besuche
-- ---------------------------------------------------------------------
create table public.visits (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.profiles (id) on delete cascade,
  scanned_by   uuid references public.profiles (id) on delete set null,
  visit_date   date not null,
  created_at   timestamptz not null default now(),
  -- Regel: maximal ein Scan pro Kunde und Tag
  constraint visits_one_per_day unique (customer_id, visit_date)
);

create index visits_customer_idx on public.visits (customer_id, created_at desc);

-- ---------------------------------------------------------------------
-- Belohnungen
-- ---------------------------------------------------------------------
create type public.reward_type   as enum ('small_extra', 'free_cut', 'winback_discount');
create type public.reward_status as enum ('available', 'redeemed', 'expired');

create table public.rewards (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles (id) on delete cascade,
  type              public.reward_type   not null,
  status            public.reward_status not null default 'available',
  label             text not null,
  discount_percent  int check (discount_percent between 1 and 100),
  earned_visit_id   uuid references public.visits (id) on delete set null,
  earned_at         timestamptz not null default now(),
  valid_until       timestamptz,
  redeemed_at       timestamptz,
  redeemed_by       uuid references public.profiles (id) on delete set null
);

create index rewards_customer_status_idx on public.rewards (customer_id, status);

-- ---------------------------------------------------------------------
-- Leistungen / Preisliste
-- ---------------------------------------------------------------------
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  category      text not null default 'Haare',
  name          text not null,
  description   text,
  price_cents   int  not null check (price_cents >= 0),
  price_is_from boolean not null default false,  -- "ab 25 €"
  duration_min  int check (duration_min > 0),
  sort_order    int  not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Bewertungen (nur nach einem echten, gescannten Besuch möglich)
-- ---------------------------------------------------------------------
create table public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.profiles (id) on delete cascade,
  visit_id             uuid not null unique references public.visits (id) on delete cascade,
  rating               int  not null check (rating between 1 and 5),
  comment              text,
  forwarded_to_google  boolean not null default false,
  created_at           timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.salon_settings enable row level security;
alter table public.profiles       enable row level security;
alter table public.visits         enable row level security;
alter table public.rewards        enable row level security;
alter table public.services       enable row level security;
alter table public.reviews        enable row level security;

-- Salon-Einstellungen: alle dürfen lesen, nur Admin ändern
create policy "settings_read_all"     on public.salon_settings for select using (true);
create policy "settings_admin_update" on public.salon_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- Profile: eigenes Profil lesen/ändern, Admin sieht alle
create policy "profiles_read_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Besuche & Belohnungen: nur lesen (Schreiben nur über Funktionen)
create policy "visits_read_own_or_admin" on public.visits for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "rewards_read_own_or_admin" on public.rewards for select
  using (customer_id = auth.uid() or public.is_admin());

-- Leistungen: aktive Leistungen öffentlich, Admin verwaltet alles
create policy "services_read_active" on public.services for select
  using (active or public.is_admin());
create policy "services_admin_insert" on public.services for insert
  with check (public.is_admin());
create policy "services_admin_update" on public.services for update
  using (public.is_admin()) with check (public.is_admin());
create policy "services_admin_delete" on public.services for delete
  using (public.is_admin());

-- Bewertungen: Kunde bewertet nur eigene Besuche, Admin liest alle
create policy "reviews_read_own_or_admin" on public.reviews for select
  using (customer_id = auth.uid() or public.is_admin());
create policy "reviews_insert_own_visit" on public.reviews for insert
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.visits v
      where v.id = visit_id and v.customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Tabellenrechte (explizit, siehe Supabase "Data API hardening")
-- ---------------------------------------------------------------------
revoke all on public.salon_settings, public.profiles, public.visits,
              public.rewards, public.services, public.reviews
  from anon, authenticated;

grant select          on public.salon_settings to anon, authenticated;
grant update          on public.salon_settings to authenticated;
grant select          on public.services       to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant select          on public.profiles       to authenticated;
-- Kunden dürfen nur diese Spalten ihres Profils ändern (nicht role, qr_token, ...)
grant update (first_name, last_name, push_token) on public.profiles to authenticated;
grant select          on public.visits         to authenticated;
grant select          on public.rewards        to authenticated;
grant select, insert  on public.reviews        to authenticated;

-- =====================================================================
-- Funktionen (RPC)
-- =====================================================================

-- Fortschritt auf der Stempelkarte für einen Kunden.
create function public.stamp_progress(p_customer_id uuid)
returns table (total_visits int, stamps_in_cycle int, stamps_per_cycle int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(v.id)::int                                   as total_visits,
    (count(v.id) % s.stamps_per_cycle)::int            as stamps_in_cycle,
    s.stamps_per_cycle                                 as stamps_per_cycle
  from public.salon_settings s
  left join public.visits v on v.customer_id = p_customer_id
  where s.id = 1
    and (p_customer_id = auth.uid() or public.is_admin())
  group by s.stamps_per_cycle;
$$;

-- Admin scannt den QR-Code eines Kunden und trägt einen Besuch ein.
-- Vergibt automatisch Belohnungen beim 6. und 12. Stempel (konfigurierbar).
create function public.record_visit(p_qr_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings     public.salon_settings;
  v_customer     public.profiles;
  v_visit_id     uuid;
  v_total        int;
  v_position     int;
  v_new_rewards  jsonb := '[]'::jsonb;
  v_reward       public.rewards;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_settings from public.salon_settings where id = 1;

  select * into v_customer from public.profiles where qr_token = p_qr_token;
  if not found then
    raise exception 'unknown_qr_code' using errcode = 'P0002';
  end if;

  begin
    insert into public.visits (customer_id, scanned_by, visit_date)
    values (
      v_customer.id,
      auth.uid(),
      (now() at time zone v_settings.timezone)::date
    )
    returning id into v_visit_id;
  exception when unique_violation then
    raise exception 'already_scanned_today' using errcode = 'P0001';
  end;

  update public.profiles set last_visit_at = now() where id = v_customer.id;

  select count(*) into v_total from public.visits where customer_id = v_customer.id;
  -- Position auf der aktuellen Karte: 1 .. stamps_per_cycle
  v_position := ((v_total - 1) % v_settings.stamps_per_cycle) + 1;

  if v_position = v_settings.small_reward_at then
    insert into public.rewards (customer_id, type, label, earned_visit_id)
    values (v_customer.id, 'small_extra', v_settings.small_reward_label, v_visit_id)
    returning * into v_reward;
    v_new_rewards := v_new_rewards || jsonb_build_object(
      'id', v_reward.id, 'type', v_reward.type, 'label', v_reward.label);
  end if;

  if v_position = v_settings.stamps_per_cycle then
    insert into public.rewards (customer_id, type, label, earned_visit_id)
    values (v_customer.id, 'free_cut', v_settings.free_cut_label, v_visit_id)
    returning * into v_reward;
    v_new_rewards := v_new_rewards || jsonb_build_object(
      'id', v_reward.id, 'type', v_reward.type, 'label', v_reward.label);
  end if;

  return jsonb_build_object(
    'visit_id',          v_visit_id,
    'customer_id',       v_customer.id,
    'customer_name',     trim(coalesce(v_customer.first_name, '') || ' ' || coalesce(v_customer.last_name, '')),
    'total_visits',      v_total,
    -- Position des heutigen Stempels (1..12); bei 12 ist die Karte voll
    -- und der nächste Besuch beginnt eine neue Karte.
    'stamp_position',    v_position,
    'stamps_in_cycle',   v_position % v_settings.stamps_per_cycle,
    'stamps_per_cycle',  v_settings.stamps_per_cycle,
    'new_rewards',       v_new_rewards,
    'available_rewards', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id, 'type', r.type, 'label', r.label,
               'discount_percent', r.discount_percent, 'valid_until', r.valid_until)
             order by r.earned_at), '[]'::jsonb)
      from public.rewards r
      where r.customer_id = v_customer.id
        and r.status = 'available'
        and (r.valid_until is null or r.valid_until > now())
    )
  );
end;
$$;

-- Admin löst eine Belohnung ein.
create function public.redeem_reward(p_reward_id uuid)
returns public.rewards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward public.rewards;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found then
    raise exception 'unknown_reward' using errcode = 'P0002';
  end if;
  if v_reward.status <> 'available' then
    raise exception 'reward_not_available' using errcode = 'P0001';
  end if;
  if v_reward.valid_until is not null and v_reward.valid_until <= now() then
    raise exception 'reward_expired' using errcode = 'P0001';
  end if;

  update public.rewards
     set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid()
   where id = p_reward_id
  returning * into v_reward;

  return v_reward;
end;
$$;

-- Funktionsrechte: nicht für anonyme Nutzer
revoke execute on function public.is_admin()            from public;
revoke execute on function public.stamp_progress(uuid)  from public, anon;
revoke execute on function public.record_visit(uuid)    from public, anon;
revoke execute on function public.redeem_reward(uuid)   from public, anon;
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
-- anon braucht is_admin() für die RLS-Regel der Preisliste (liefert dort immer false)
grant  execute on function public.is_admin()            to anon, authenticated;
grant  execute on function public.stamp_progress(uuid)  to authenticated;
grant  execute on function public.record_visit(uuid)    to authenticated;
grant  execute on function public.redeem_reward(uuid)   to authenticated;

-- ===================== 20261103000000_admin_overview.sql =====================
-- =====================================================================
-- Phase 3: Kundenübersicht für das Web-Dashboard und Öffnungszeiten
-- =====================================================================

-- Öffnungszeiten: Liste aus Zeilen { "label": "Mo–Fr", "hours": "09:00–18:00" }.
-- Bewusst als freier Text, damit der Inhaber auch "nach Vereinbarung" o. Ä. eintragen kann.
comment on column public.salon_settings.opening_hours is
  'JSON-Array: [{"label": "Mo–Fr", "hours": "09:00–18:00"}, ...]';

alter table public.salon_settings
  add constraint opening_hours_is_array check (jsonb_typeof(opening_hours) = 'array');

-- Kundenliste mit Kennzahlen. Nur für Admins.
create function public.admin_customer_overview()
returns table (
  id                 uuid,
  first_name         text,
  last_name          text,
  email              text,
  role               public.user_role,
  created_at         timestamptz,
  last_visit_at      timestamptz,
  total_visits       int,
  stamps_in_cycle    int,
  available_rewards  int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
  select
    p.id, p.first_name, p.last_name, p.email, p.role, p.created_at, p.last_visit_at,
    coalesce(v.cnt, 0)::int,
    (coalesce(v.cnt, 0) % s.stamps_per_cycle)::int,
    coalesce(r.cnt, 0)::int
  from public.profiles p
  cross join public.salon_settings s
  left join lateral (
    select count(*) as cnt from public.visits where customer_id = p.id
  ) v on true
  left join lateral (
    select count(*) as cnt from public.rewards
    where customer_id = p.id and status = 'available'
      and (valid_until is null or valid_until > now())
  ) r on true
  where s.id = 1
  order by p.last_visit_at desc nulls last, p.created_at desc;
end;
$$;

revoke execute on function public.admin_customer_overview() from public, anon;
grant  execute on function public.admin_customer_overview() to authenticated;

-- Kennzahlen für die Startseite des Dashboards. Nur für Admins.
create function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select timezone into v_tz from public.salon_settings where id = 1;

  return jsonb_build_object(
    'customers_total',
      (select count(*) from public.profiles where role = 'customer'),
    'customers_new_30d',
      (select count(*) from public.profiles where role = 'customer' and created_at > now() - interval '30 days'),
    'customers_active_42d',
      (select count(*) from public.profiles where role = 'customer' and last_visit_at > now() - interval '42 days'),
    'visits_today',
      (select count(*) from public.visits where visit_date = (now() at time zone v_tz)::date),
    'visits_30d',
      (select count(*) from public.visits where created_at > now() - interval '30 days'),
    'rewards_redeemed_30d',
      (select count(*) from public.rewards where status = 'redeemed' and redeemed_at > now() - interval '30 days')
  );
end;
$$;

revoke execute on function public.admin_stats() from public, anon;
grant  execute on function public.admin_stats() to authenticated;

-- ===================== 20261104000000_marketing.sql =====================
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

-- ===================== 20261105000000_legal_account_deletion.sql =====================
-- =====================================================================
-- Phase 5: Angaben für Impressum/Datenschutz und Konto-Löschung (DSGVO)
-- =====================================================================

alter table public.salon_settings
  add column imprint_owner  text,   -- Inhaber/in (vollständiger Name) bzw. Firma mit Rechtsform
  add column imprint_email  text,   -- Kontakt-E-Mail (Pflicht im Impressum)
  add column imprint_vat_id text,   -- USt-IdNr., falls vorhanden
  add column imprint_extra  text;   -- z. B. Handwerkskammer, Meistertitel, Aufsichtsbehörde

-- Kunden löschen ihr Konto selbst. Durch "on delete cascade" verschwinden auch
-- Profil, Besuche, Belohnungen und Bewertungen.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  -- Schutz: der letzte Admin kann sich nicht versehentlich selbst aussperren.
  if public.is_admin() and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
