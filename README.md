# sidneyb.uk

Sidney Brown's personal site: Next.js (App Router), React, TypeScript and Postgres, with an admin area for everything that changes.

## Run it

You need Docker, nothing else.

```bash
./setup.sh dev          # work on it: everything in Docker, live reload at http://localhost:3000
./setup.sh docker       # everything built into Docker, as it runs on the server
./setup.sh stop         # stop the containers
./setup.sh reset        # stop them and DELETE the database and uploads
```

The first run writes a `.env` with fresh secrets and prints the admin password (`ADMIN_PASSWORD` in `.env`). Keep your `.env` when you copy in a new version of the code.

To open it from a phone on the same network use `http://<this machine>:3000`. For any other address, add its host name to `DEV_ORIGINS` in `.env`.

A new database starts with the pieces of music, the notebook and reading examples (deletable), the travel log and Tokyo on the wish list. Nothing else is made up.

## Deploy

**Dokploy:** create a Compose service from the repository with Compose Path `./docker-compose.dokploy.yml`. Set the environment:

```
ADMIN_PASSWORD=<eight characters or more>
APP_SECRET=<openssl rand -hex 32>      # never change it afterwards: it unlocks the saved API keys
POSTGRES_PASSWORD=<letters and numbers only>
SITE_URL=https://sidneyb.uk
```

Add the domain (service `app`, port `3000`, HTTPS on) and deploy. The database updates itself when a new version starts. Back up the `pgdata` and `uploads` volumes on a schedule; keep `APP_SECRET` with the backup.

**Any other server:** `cp .env.example .env`, fill in the same three secrets, then `docker compose up -d --build`. Put a reverse proxy in front for HTTPS; it must pass `Host` (or `X-Forwarded-Host`) and `X-Forwarded-Proto`, and allow bodies up to 200 MB for uploads.

**Backups by hand:**

```bash
docker compose exec -T db pg_dump -U sidneyb sidneyb | gzip > backup-$(date +%F).sql.gz
docker compose cp app:/data/uploads ./uploads-backup
```

## The admin area

`/admin`, one password. Saving puts a thing on the site straight away. When signed in, a pencil beside the menu on any page goes to where that page is edited.

- **Content:** posts, books, pieces, doses, projects, places, wishes, subjects, notes, cards, changelog entries. Lists are reordered with the arrows; dates use the calendar.
- **Scores:** a piece's editor has **Write the score**, a small notation editor. The piece's page draws and plays the result.
- **Cards:** Admin → Cards adds flashcards to a topic one at a time or from a pasted list, in groups.
- **Training:** activities arrive from Strava (Connections) and are written up with notes, gym lifts, padel sets or ride details. Runs, rides, gym and padel each have a page.
- **Settings:** where I am (with a map), an away note, the yearly goal, and what the sport pages show.
- **Connections:** API keys for Strava, Last.fm or Spotify, Apple Music, and the token your phone uses. Keys are stored encrypted with `APP_SECRET`.

## The CV

`/cv` shows the CV and offers it as a PDF in light and dark (`/cv/pdf?theme=dark`), both made on the server from what is written under Admin → CV and stamped with the date it was last edited. The typefaces for the PDF are in `lib/cv/fonts`.

## Your phone

Set `LOCATION_TOKEN` under Connections, then Shortcuts can `POST` to the site with the header `Authorization: Bearer <token>`:

- `/api/location` with `{ "name", "lat", "lon", "timeZone" }` updates where I am. Add `"manual": true` and a `"message"` to hold a place; `"away": true` with a `"message"` (and `"back": "2026-10-14"`) says I am away; `false` ends either.
- `/api/health?metric=steps` with lines of `date,value` (or JSON) stores health numbers: `vo2max`, `restingHr`, `hrv`, `walkingHr`, `respiratoryRate`, `bloodOxygen`, `sleepHours`, `steps`, `exerciseMinutes`, `activeEnergy`, `weight`, `bodyFat`. Years of history can go in one request; they are only shown to me, signed in.

The Connections page has the step-by-step for each.

## Where things live

- `app/` routes and API; `views/` the pages; `components/` what they are built from; `lib/` content, sport and music logic; `lib/server/` the database, Strava and secrets.
- `public/sw.js` makes the site installable and lets visited pages open offline. Change its `VERSION` to clear visitors' caches.
- `preview/` builds a single-file copy of the site for previewing without a server.
- `app/globals.css` holds all styling, in passes: later rules win.

## Before going live

- Set `SITE_URL`, the admin password and `APP_SECRET`.
- Connect Strava and a music source under Connections, and set up the phone shortcuts.
- Read `/privacy` against what you deploy.
- Set up backups.

## Keeping it up

The site limits each address to 300 API calls a minute (10 sign-in attempts, 30 phone updates), and six wrong passwords in a row shut the door for ten minutes. That stops scripts and brute force; a real flood has to be stopped before it reaches the server. The usual way is to put the domain behind Cloudflare (free plan, proxy on): it absorbs floods, caches the static files near visitors and hides the server's address. Keep "Full (strict)" TLS mode and leave Dokploy's own certificate in place.

Ad blockers sometimes stop the admin area's requests; it says so when that happens. Allow the site in the blocker.

**Passkeys.** Under Connections, add a passkey (Face ID, Touch ID, a password manager or a security key) and sign in with it instead of the password. Tick "Ask for a passkey after the password too" to make the password alone insufficient. Locked out with every passkey gone? `delete from settings where key = 'security'` on the database, and the password is enough again.
