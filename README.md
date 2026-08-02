# 30-Day Gym Tracker

A warm, shift-friendly workout tracker built around a 30-day challenge with 13 automatically spaced, full-body gym sessions.

[Open the live app](https://thirty-day-gym-tracker.alhayek-bakr1.chatgpt.site)

## Features

- 30-day calendar with 13 scheduled A/B/C workouts
- Automatic every-other-day spacing with recovery breaks
- Required five-minute warm-up checklist and timer
- Set-by-set load, reps, RIR, and completion logging
- Progressive volume: two working sets at first, then three
- 20-minute short-sleep/post-call mode
- Exercise cues and equipment alternatives
- Completion checks so unfinished workouts are not marked done
- Optional ChatGPT sign-in with cross-device progress sync
- Responsive, keyboard-accessible interface

## Training plan

The challenge rotates three full-body workouts designed for an apartment gym with an adjustable bench, dumbbells up to about 45–55 lb each, press and pull machines, lower-body machines, and cardio equipment. Workouts are scheduled on challenge days 1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, and 29.

The plan prioritizes visible muscle gain while supporting strength, body-fat loss, energy, health, and mobility. Each session is designed to fit a 30–40 minute window.

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

## Useful commands

```bash
npm run lint
npm run build
npm test
npm run db:generate
```

## Progress storage

Anonymous progress is kept in the browser. Signed-in progress is stored per user in Cloudflare D1 through the `DB` binding and syncs across devices.

The hosted application uses OpenAI Sites for ChatGPT sign-in and server-side D1 access. GitHub Pages alone is static hosting, so it cannot provide the authenticated sync backend used by this version.

## Deployment

1. Create a Sites project.
2. Replace `YOUR_SITES_PROJECT_ID` in `.openai/hosting.json`.
3. Configure the D1 binding named `DB`.
4. Apply the migration in `drizzle/0000_lame_havok.sql`.
5. Build and deploy through the Sites workflow.

## Safety

This app provides a general exercise plan, not medical advice. Stop exercising and seek appropriate care for chest pain, fainting, severe shortness of breath, or other concerning symptoms.
