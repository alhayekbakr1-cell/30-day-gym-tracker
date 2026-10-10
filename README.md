# Gym Tracker

An ongoing, shift-friendly strength training app built with React, Next.js, Vinext/Vite, and Cloudflare D1. The schedule continues beyond 30 days. New plans use a four-day Upper A / Lower A / Upper B / Lower B rotation; existing three-day plans remain intact until the athlete chooses a transition. Completed and unfinished history, dates, units, and prior performance carry forward.

For publishing the source and running automated checks on GitHub, see [GITHUB_DEPLOYMENT.md](GITHUB_DEPLOYMENT.md). The supplied workflow verifies the app; moving its server, sign-in, and workout database to another host requires a separate hosting integration.

## Workout experience

- Full sessions and a shorter first-four-exercise option, optional readiness prompts, exercise substitutions, and visual form guides.
- Focus view with set progress, a next-set shortcut, and an accessible workout skip link.
- Previous-performance reference cards and **Use last values**, which fills untouched rows, converts units, and leaves completion unchecked.
- Whole-number reps or seconds are required before checking Done; bodyweight sets may leave load empty.
- Completed sessions stay read-only until explicitly reopened.
- Warm-up and automatic rest timers use elapsed wall time and recover from local storage by account, plan, and session. The compact rest control includes +30 seconds.
- Continue resumes the most recently edited unfinished past session with logged activity. The four-day rotation keeps the first uncompleted session next even after a missed visit; rescheduling shifts it and later sessions together.

## Four-day transition

Open **Move to four days per week**, select the first upper session, then use **Save backup & switch to four days**. The app flushes current edits, exports the old state, and schedules the new program prospectively. Existing records remain in the same plan. New sessions have separate stable identifiers, and their sets/reps/rest/effort prescriptions freeze on first entry.

The conservative starting dose is 43 working sets across four sessions, with about 3 RIR and one calf set per visit. The eventual prescription contains 58 sets. Set counts never rise automatically: **Adjust future volume** changes only unstarted sessions, within the routine's targets. Increase gradually according to performance and recovery. The precise routine and two-exposure load-progression rule are practical choices, not uniquely superior protocols proven as a whole.

See `docs/four-day-upgrade.md` for the data model, release steps, and limitations, and `docs/four-day-evidence.md` for the research review and workout tables.

## Saving and recovery

Signed-in edits are copied to browser storage immediately and uploaded through one serialized queue after a short debounce. A visibility refresh cannot replace edits made while its request was running. Requests time out, reconnects retry, and repeated version conflicts stop after three attempts per sync operation.

The last acknowledged server state is retained as a merge baseline. Independent fields and set rows merge across devices. Simultaneous edits to the same field use the workout/metric timestamp, with the server winning a tie. If exercise identity, substitutions, lifting units, or frozen prescriptions differ, the whole newer workout record wins to keep values attached to the correct exercise and unit. This is not a collaborative editing CRDT.

A changed plan or conflicting program configuration on the server pauses pending uploads. The interface lets the user export the retained device draft before loading that plan. Corrupt local recovery data is preserved instead of overwritten. Storage failures are visible. Development preview records save on the device and are never described as synced across devices.

Browser storage can be cleared or exhausted. It is a recovery aid, not a replacement for exports. Account-scoped keys prevent the app from loading one account's cache as another's, but the data remains in that browser until its site data is cleared. The app does not cache its application shell for cold offline launches, and concurrent offline tabs share one recovery key; use one tab for offline logging.

## Backups and restart

**App and data tools** exports JSON and CSV. JSON restoration accepts the raw schema-5 and schema-6 exports and the versioned backup envelope. Valid schema-5 records migrate to schema 6 without activating a different program. A file is validated and summarized before restoration; the user must save and acknowledge a copy of current records. Restoration replaces the current plan, then attempts account sync. Unsupported or invalid records are rejected instead of silently dropped. CSV fields escape spreadsheet formula prefixes.

Archive and restart waits for pending saves and uses the existing server version check. Daily metrics and goals carry into the new plan. Server archives remain available through the existing challenges API. JSON backups are the portable recovery path; archive browsing/restoration is not added in this change.

## Development and checks

Requires Node.js 22.13 or newer. Keep the supplied dependency lockfile.

```bash
npm ci
npm run dev
```

Development mode uses a local preview athlete if no trusted ChatGPT identity is available. Production identity headers must come from the trusted Sites proxy; see `MIGRATION.md` before moving to another host.

```bash
npm run test:unit
npm run typecheck
npm run lint
npm test
```

`test:unit` compiles the pure state modules with the project's TypeScript dependency and runs Node's test runner. It requires no browser, credentials, hosted database, or new test dependency. One test runs the actual SQL write guard in Node’s built-in in-memory SQLite. `typecheck` generates Cloudflare runtime types in ignored `work/` and checks the full project. Its temporary Wrangler config is for types only; production hosting remains configured in `vite.config.ts`. `npm test` also runs the existing production build and Worker HTML smoke test.

The new tests cover interruption/recovery, in-flight edits, version conflicts, plan replacement, first-load failures, storage errors, unit-aware reuse of previous sets, completion rules, elapsed-time timers, ongoing dates, and backup validation.

## Source map

- `app/GymTracker.tsx`: workout page and event handlers.
- `app/use-tracker-sync.ts`, `lib/tracker-sync.ts`: React subscription and persistent sync queue.
- `app/tracker-logic.ts`: scheduling, history, unit conversions, and state merging.
- `app/session-logic.ts`: frozen prescriptions, set validation, progress, and previous-value reuse.
- `app/four-day-data.ts`, `app/FourDaySetup.tsx`: four-day templates, transition, and gradual volume controls.
- `app/countdown-logic.ts`, `app/use-countdown.ts`: deadline timers and browser recovery.
- `app/backup-logic.ts`, `app/AppTools.tsx`: exports, validation, and restoration.
- `lib/tracker-validation.ts`, `app/api/`: server validation and versioned persistence endpoints.
- `app/globals.css`, `public/exercises/`: established visual system and exercise artwork.

See `REVIEW.md` for the source audit, changes, verified checks, and remaining release checks. See `docs/research.md` for the GitHub skill sources used as review references.
