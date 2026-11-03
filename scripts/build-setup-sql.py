"""Fügt alle Migrationen zu supabase/setup_komplett.sql zusammen (Einrichtung in einem Schritt)."""
import glob
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')
HEADER = """-- =====================================================================
-- Salon Bonus – komplette Datenbank-Einrichtung in EINEM Schritt
-- =====================================================================
-- Automatisch zusammengesetzt aus allen Dateien in supabase/migrations/
-- (in dieser Reihenfolge). Nur EINMAL in einem neuen, leeren Supabase-Projekt
-- im SQL Editor ausführen. Beispieldaten stehen separat in supabase/seed.sql.
-- Neu erzeugen: python3 scripts/build-setup-sql.py
-- =====================================================================

"""

parts = []
for f in sorted(glob.glob(os.path.join(ROOT, 'supabase', 'migrations', '*.sql'))):
    with open(f, encoding='utf-8') as fh:
        parts.append(f"-- ===================== {os.path.basename(f)} =====================\n{fh.read().strip()}\n")

with open(os.path.join(ROOT, 'supabase', 'setup_komplett.sql'), 'w', encoding='utf-8') as out:
    out.write(HEADER + "\n".join(parts))
print('supabase/setup_komplett.sql geschrieben')
