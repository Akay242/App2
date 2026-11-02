# Supabase (Backend)

- `migrations/` – Datenbankschema, wird der Reihe nach ausgeführt
- `seed.sql` – Beispieldaten (Preisliste)
- `tests/` – lokaler Test mit einem normalen PostgreSQL (nur für Entwickler)

Einrichtung im Supabase-Projekt: siehe [docs/SETUP.md](../docs/SETUP.md).

## Lokaler Test

Er braucht ein PostgreSQL ab Version 15. `auth_stub.sql` bildet die Teile von Supabase-Auth
nach, die das Schema benutzt.

```sh
createdb salontest
cat supabase/tests/auth_stub.sql supabase/migrations/*.sql supabase/seed.sql \
  | psql -d salontest -v ON_ERROR_STOP=1
psql -d salontest < supabase/tests/schema_test.sql
```

Erwartet werden diese Fehlermeldungen: `not_admin`, `permission denied` (Kunde
versucht selbst zu schreiben), `already_scanned_today`, `unknown_qr_code` und
`reward_not_available`. Außerdem muss beim 6. und beim 12. Besuch je eine Belohnung entstehen.
