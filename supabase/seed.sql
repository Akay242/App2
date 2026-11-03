-- Beispieldaten für die Entwicklung. Preise und Leistungen sind Platzhalter
-- und werden später im Web-Dashboard gepflegt.

update public.salon_settings
   set name = 'Mein Salon',
       small_reward_label = 'Kleines Extra (z. B. Bartkontur oder Kopfmassage)'
 where id = 1;

insert into public.services (category, name, description, price_cents, price_is_from, duration_min, sort_order) values
  ('Haare', 'Herrenhaarschnitt',          'Waschen, Schneiden, Styling',    2500, false, 30, 10),
  ('Haare', 'Maschinenschnitt',           'Komplett mit der Maschine',      1500, false, 15, 20),
  ('Haare', 'Kinderhaarschnitt',          'Bis 12 Jahre',                   1800, false, 20, 30),
  ('Bart',  'Bart trimmen & Kontur',      null,                             1200, false, 15, 40),
  ('Bart',  'Nassrasur mit heißem Tuch',  null,                             2000, false, 25, 50),
  ('Kombi', 'Haarschnitt + Bart',         null,                             3500, false, 45, 60);

update public.salon_settings
   set address = 'Musterstraße 1, 12345 Musterstadt',
       phone = '+49 123 456789',
       opening_hours = '[{"label": "Mo–Fr", "hours": "09:00–19:00"}, {"label": "Sa", "hours": "09:00–15:00"}, {"label": "So", "hours": "geschlossen"}]'
 where id = 1;
