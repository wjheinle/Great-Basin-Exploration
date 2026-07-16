# The Great Basin Exploration

Trip app for the September 2026 ABQ/Farmington business trip (Bill Heinlein, Andrew Tjernagel, Tom Schreier).

## Tabs
- **Countdown** — live countdown to DL730 landing in ABQ, 7:54 PM, 9/15/26
- **Customer Visits** — add prospects/visits; toggle "Lock in schedule" to set date/time once confirmed
- **Golf** — GHIN scorecard (editable) + course reference (Twin Warriors, Black Mesa, Piñon Hills, San Juan CC) with drive times from ABQ and Farmington

## Stack
Node.js/Express, static frontend (HTML/CSS/JS), JSON file storage on a Railway volume (`RAILWAY_VOLUME_MOUNT_PATH`), falls back to `./data` locally.

## Deploy (Railway)
1. Push this repo to GitHub
2. New Railway project → deploy from repo
3. Add a volume, mount it, and set `RAILWAY_VOLUME_MOUNT_PATH` to that mount path (e.g. `/data`)
4. Railway auto-detects `npm start`

## Local dev
```
npm install
npm start
```
Visits/golfers persist to `./data/trip-data.json`.
