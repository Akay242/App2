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
