#!/usr/bin/env bash
# ============================================================================
# scripts/backup-db.sh — verschlüsseltes, off-host pg_dump (Phase-0 #20, Minimum)
# ----------------------------------------------------------------------------
# Erzeugt einen mit **age** (Public-Key) verschlüsselten Custom-Format-Dump
# (`pg_restore`-fähig, inkl. Schema + Daten + RLS-Policies + Trigger + GRANTs).
# Ergänzt peaknetworks' tägliche Backups (kein PITR) um eine eigene, off-host
# übertragbare, länger aufbewahrbare, host-kompromittierungssichere Sicherung.
#
# WICHTIG:
#  - **Owner-/Tooling-DSN** verwenden (RLS-Bypass) — sonst filtert RLS Zeilen aus
#    dem Dump = UNVOLLSTÄNDIGE Sicherung.
#  - **Public-Key**-Verschlüsselung: der Backup-Host kennt NUR den Public Key und
#    kann selbst NICHT entschlüsseln. Der private age-Key bleibt **offline** (nur
#    für Restore). KEINE Secrets in Logs/Repo.
#  - Restore + Pflicht-Restore-Test: docs/infra/backup-restore-runbook.md
#
# ENV:
#   BACKUP_DATABASE_URL   Owner/Tooling-DSN (remote: ?sslmode=require anhängen)
#   BACKUP_AGE_RECIPIENT  age Public Key ("age1…")
#   BACKUP_OUT_DIR        Zielverzeichnis (off-host gemountet/danach gesynct; Default ./backups)
# Abhängigkeiten: pg_dump (postgresql-client, passend zur Server-Major), age.
# ============================================================================
set -euo pipefail
umask 077   # Backup-Dateien nur für den Eigentümer les-/schreibbar.

: "${BACKUP_DATABASE_URL:?fehlt — Owner/Tooling-DSN (RLS-Bypass, damit ALLE Zeilen im Dump landen)}"
: "${BACKUP_AGE_RECIPIENT:?fehlt — age Public Key (age1…); privater Key NUR offline für Restore}"
OUT_DIR="${BACKUP_OUT_DIR:-./backups}"

command -v pg_dump >/dev/null 2>&1 || { echo "FEHLER: pg_dump fehlt (postgresql-client installieren)."; exit 1; }
command -v age     >/dev/null 2>&1 || { echo "FEHLER: age fehlt (https://github.com/FiloSottile/age)."; exit 1; }

# pg_dump-Major MUSS >= Server-Major sein (sonst unvollständiger/inkompatibler Dump).
SERVER_MAJOR="${BACKUP_SERVER_MAJOR:-17}"
CLIENT_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
if [ "${CLIENT_MAJOR:-0}" -lt "$SERVER_MAJOR" ]; then
  echo "FEHLER: pg_dump-Major $CLIENT_MAJOR < Server-Major $SERVER_MAJOR — postgresql-client-$SERVER_MAJOR installieren."
  exit 1
fi

mkdir -p "$OUT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/onelane-db-$TS.dump.age"
TMP="$OUT.partial"

# Bei Fehler/Abbruch die unfertige Datei entfernen (kein trügerisch "vorhandenes" Teil-Backup).
cleanup() { [ -f "$TMP" ] && rm -f "$TMP"; }
trap cleanup EXIT

# -Fc = Custom-Format (komprimiert, selektiv restaurierbar). --no-password: nicht
# interaktiv nachfragen (in cron lieber hart fehlschlagen). pipefail fängt pg_dump-Fehler.
# Erst in TMP schreiben, nur bei Erfolg atomar nach OUT umbenennen.
pg_dump -Fc --no-password "$BACKUP_DATABASE_URL" | age -r "$BACKUP_AGE_RECIPIENT" -o "$TMP"
mv "$TMP" "$OUT"
trap - EXIT

# Integritäts-Hash (kein Secret).
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$OUT" | tee "$OUT.sha256";
else shasum -a 256 "$OUT" | tee "$OUT.sha256"; fi

echo "OK: $OUT"
echo "OPS-NÄCHSTE-SCHRITTE: off-host übertragen (rsync/Objektspeicher, EU), privaten age-Key OFFLINE halten,"
echo "Retention pflegen, Restore-Test gemäß docs/infra/backup-restore-runbook.md durchführen."
