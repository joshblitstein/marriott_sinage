# Sheraton Charlotte — Conference Room Signage

Web digital signage for ballroom/conference rooms. Tablets at `/display/{slug}` show the current booking. Staff manage rooms, CITY imports, and logos at `/admin`.

## Stack

- React + TypeScript (Vite)
- Firebase: Firestore, Storage, Hosting
- Admin login: Firestore `users` collection (username/password), not Firebase Auth

## Quick start

```bash
npm install
cp .env.example .env.local   # already filled for marriot-project
npm run dev
```

- Admin: http://localhost:5173/admin (user `admin` / password from `create-admin`)
- Display: http://localhost:5173/display/symphony-4

## Firestore rules (required)

Publish open rules so seed/import can write (Console → Firestore → Rules), or paste `firestore.rules` and Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Then:

```bash
npm run seed-rooms      # 37 rooms + combination aliases
npm run create-admin    # admin / P98#slvfG5%
npm run import-sample   # sample CITY xlsx
```

## Daily CITY import

1. Sign in to Admin → **Import**
2. Upload `CI Output for Readerboard Data.xlsx` (or `.csv` with the same columns)
3. Review unmatched spaces and orgs without logos

Parser lives in `src/lib/city/` so an API source can replace the file upload later.

## Tablet setup

1. Open `/display/{slug}` for that room (copy from Admin → Rooms or Screens)
2. Add to home screen / lock in kiosk mode (landscape 16:9)
3. Heartbeat writes to `status/{slug}` every ~3 minutes

## Scripts

| Command | Purpose |
|---|---|
| `npm run seed-rooms` | Seed rooms + bookingAliases |
| `npm run import-sample` | Import `sample-data/CI_Output_for_Readerboard_Data.xlsx` |
| `npm run create-admin` | Upsert Firestore admin user |
| `npm run deploy` | Build + Firebase deploy |
| `npm run deploy:hosting` | Hosting only |

## Data model

- `rooms` — slug id, displayName, bookingAliases, active
- `events` — one doc per room mapped from a booking (CITY or manual)
- `organizations` — logos + display names
- `displays/{slug}` — denormalized day schedule (**one listener per tablet**)
- `status/{slug}` — heartbeat
- `users` — admin accounts

## Design

Door-sign UI follows `designs/Ballroom_Digital_Display_Templates.pdf` (ballroom door sign / template 02 landscape).
# marriott_sinage
# marriott_sinage
