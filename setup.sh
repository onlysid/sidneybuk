#!/usr/bin/env bash
# Gets the site running on this machine. Everything runs in Docker; nothing else needs installing.
#
#   ./setup.sh dev      for working on it: the database and the site in containers, with the project folder
#                       shared into the site's, so a saved file shows up in the browser within a second
#                       (Fast Refresh keeps the page's state). Plain ./setup.sh does the same.
#   ./setup.sh docker   everything built into an image, exactly as it runs on the server
#   ./setup.sh stop     stop the containers (nothing is deleted)
#   ./setup.sh reset    stop them AND delete the database and uploads, to start again from nothing
#
# Safe to run again: it never overwrites .env and never touches the data.
set -euo pipefail
cd "$(dirname "$0")"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "$2"; }
rand() { if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$1"; else head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi; }

need docker "Docker is needed for the database. Install Docker Desktop (or Docker Engine), start it, and run this again."
docker compose version >/dev/null 2>&1 || fail "This needs 'docker compose' (Compose v2). Update Docker and run this again."
docker info >/dev/null 2>&1 || fail "Docker is installed but not running. Start it and run this again."

DEV_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
if [ "${1:-}" = "stop" ]; then
  docker compose $DEV_FILES down --remove-orphans
  say "Stopped. The database and uploads are kept."
  exit 0
fi
if [ "${1:-}" = "reset" ]; then
  printf "This deletes the database and every uploaded file on this machine. Type yes to go on: "
  read -r sure
  [ "$sure" = "yes" ] || fail "Nothing was deleted."
  docker compose $DEV_FILES down --volumes --remove-orphans
  rm -rf ./data/uploads
  say "Deleted. The next start begins with an empty database."
  exit 0
fi
case "${1:-dev}" in dev|docker) ;; *) fail "Unknown: $1. Use: ./setup.sh dev | docker | stop | reset" ;; esac

# ---- .env, with secrets made up for you ---------------------------------------------------------------
if [ ! -f .env ]; then
  admin="$(rand 9)"; secret="$(rand 32)"; dbpass="$(rand 16)"
  sed -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${admin}|" \
      -e "s|^APP_SECRET=.*|APP_SECRET=${secret}|" \
      -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${dbpass}|" \
      -e "s|CHANGE_ME|${dbpass}|" .env.example > .env
  chmod 600 .env
  say "Made .env with fresh secrets."
  echo "  The admin password is: ${admin}"
  echo "  (It is ADMIN_PASSWORD in .env. Change it there to something you will remember.)"
else
  say "Using the .env that is already here."
fi
set -a; . ./.env; set +a
[ "${#ADMIN_PASSWORD}" -ge 8 ] || fail "ADMIN_PASSWORD in .env must be at least 8 characters."
[ "${#APP_SECRET}" -ge 16 ]    || fail "APP_SECRET in .env must be at least 16 characters. Try: openssl rand -hex 32"
[ -n "${POSTGRES_PASSWORD}" ]  || fail "POSTGRES_PASSWORD in .env is empty."

# ---- Everything in Docker --------------------------------------------------------------------------------
if [ "${1:-}" = "docker" ]; then
  say "Building and starting the site and its database…"
  docker compose $DEV_FILES stop dev >/dev/null 2>&1 || true
  docker compose up -d --build
  say "Running at http://localhost:${PORT:-3000}   (admin: http://localhost:${PORT:-3000}/admin)"
  echo "  Logs: docker compose logs -f app      Stop: ./setup.sh stop"
  exit 0
fi

# ---- For working on it: live reload ------------------------------------------------------------------------
# Only one thing can serve the port: stop the built copy if ./setup.sh docker left it running.
docker compose stop app >/dev/null 2>&1 || true
mkdir -p "${UPLOAD_DIR:-./data/uploads}"

say "Starting the database…"
docker compose up -d db
printf "  waiting for it"
for _ in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U "${POSTGRES_USER:-sidneyb}" -d "${POSTGRES_DB:-sidneyb}" >/dev/null 2>&1; then ready=1; break; fi
  printf "."; sleep 1
done
echo
[ "${ready:-}" = 1 ] || fail "The database did not come up. See: docker compose logs db"

# The database keeps the password it was first made with. If .env has since been made afresh (the project
# folder was replaced, say), the two no longer match and the site cannot sign in to its own database.
# The database is this machine's own, so its password is simply set to the one in .env.
if ! docker compose exec -T -e PGPASSWORD="${POSTGRES_PASSWORD}" db psql -h db -U "${POSTGRES_USER:-sidneyb}" -d "${POSTGRES_DB:-sidneyb}" -c "select 1" >/dev/null 2>&1; then
  say "The database has a different password from the one in .env; setting it to match."
  docker compose exec -T db psql -U "${POSTGRES_USER:-sidneyb}" -d "${POSTGRES_DB:-sidneyb}" -v ON_ERROR_STOP=1 -c "alter user \"${POSTGRES_USER:-sidneyb}\" password '${POSTGRES_PASSWORD}'" >/dev/null \
    || fail "Could not set it. Either put the old POSTGRES_PASSWORD back in .env, or start again with: ./setup.sh reset"
  echo "  Done. If APP_SECRET in .env is new as well, the API keys saved under Connections can no longer be"
  echo "  read and need pasting in again. Keep the .env when replacing the project folder to avoid this."
fi

say "Starting the site at http://localhost:${PORT:-3000}   (admin: http://localhost:${PORT:-3000}/admin)"
echo "  This folder is shared into the container: save a file and the page updates by itself, keeping its state."
echo "  The first start installs the packages, which takes a minute or two. Ctrl+C stops the site;"
echo "  the database keeps running until: ./setup.sh stop"
exec docker compose $DEV_FILES up dev
