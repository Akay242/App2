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
