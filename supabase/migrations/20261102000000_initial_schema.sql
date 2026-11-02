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
