# Four-day program upgrade

Prepared 10 October 2026. This is an implementation in the supplied source export, not a deployment to the live site.

## What the athlete can do

1. Keep using the current three-day plan until a transition is chosen.
2. Open **Move to four days per week**, choose the first upper-body date, and click **Save backup & switch to four days**. The app syncs existing work and downloads a JSON backup before applying the transition. Check the browser's downloaded file and save status.
3. Follow Upper A / Lower A / rest / Upper B / Lower B / rest / rest relative to the chosen start. Starting Monday gives Monday, Tuesday, Thursday, Friday. A missed visit stays next in sequence. Moving a four-day session moves the unstarted future sequence too.
4. Start with 43 working sets per cycle, about 3 RIR, and one calf set per lower session. **Adjust future volume** lets the athlete add or remove one set for an exercise, within the routine's eventual target. No automatic weekly volume increase occurs.
5. Keep prior loads and units as references. **Use last values** converts units and leaves sets uncompleted. A load-increase suggestion requires two completed comparable exposures at the top of the current range, with sufficient reserve and consistent loads.

The eventual four-session total is 58 working sets: 17 / 11 / 17 / 13. The conservative initial total is 14 / 7 / 14 / 8. Upper sessions have seven exercises; lower sessions have five or six. Full workouts use straight sets with per-exercise rest defaults of 90, 120, or 180 seconds. Short mode retains the first four exercises and caps each at two sets without increasing a one-set prescription.

These are practical defaults for combined strength and muscle goals under the assumptions in `four-day-evidence.md`. No actual athlete logs, injury history, or equipment confirmation were available for selecting personalized starting weights.

## Data and history

- The data schema is **6**. Legacy raw schema-5 exports and existing version-1 backup envelopes remain readable. Loading them does not activate the new training plan.
- Original numeric legacy keys, block identity, start date, recorded workout ID, completion state, dates, units, substitutions, notes, set values, and unfinished work stay in place. The existing top-level `programVersion` continues to describe the legacy rotation.
- `fourDayPlan` contains the prospective start, a unique ID, version 1 of the four-day templates, chosen per-exercise set counts, target RIR, and schedule shifts.
- New session keys use a distinct numeric namespace starting at 1,000,001. A key identifies a session in the four-template sequence; it is not a calendar-day number. Its identity survives rescheduling. Template versions must not be repurposed for future exercise edits; add a new version if the prescription changes.
- On first entry, each new log stores an explicit session ID (`planId:key`) and a prescription snapshot containing set count, rep or duration range, rest, and RIR. Later changes to future volume do not modify started sessions. Dates are computed from the versioned rotation and saved shifts/overrides.
- The app does not materialize thousands of empty logs. Future sessions are deterministic descriptors and become persisted records when edited. The new key space permits up to 20,000 sessions; existing storage/payload caps are lower and remain practical limits.
- Unsaved legacy appointments stop early enough to leave a full recovery day before the new plan. All saved legacy sessions remain available. Activation must occur at least two calendar days after the latest saved session, and no earlier than today.
- Consecutive upper/lower days are allowed. Rescheduling maintains order and at least a full calendar day between repeat regions. Completed sessions cannot move; a later session with entries blocks shifting dates underneath it. This is intentionally conservative.
- Weekly counts separate chest, back, quads, hamstrings, lateral delts, biceps, triceps, calves, core, and direct glute work. Compound contributions overlap and are described separately; these are workload counts, not precise stimulus estimates. Glute involvement from leg presses, split squats, and hinges is not presented as additional full sets.

## Sync and compatibility

The existing durable queue and three-way merge remain in use. Simultaneous program/schedule/prescription changes trigger a preserved-draft conflict instead of silently overwriting the other device. Different frozen workout prescriptions do not merge their set arrays together.

The SQL update guard prevents a cached schema-5 client from erasing a stored four-day program, even if its numeric server version matches. Such a client needs a reload. Current clients may still explicitly restore an older backup through the protected restore flow, so retain a pre-transition export.

This release requires the new client and server validation/write guard to deploy together. No new D1 table or column is needed: the existing JSON state stores the added fields. A rollback to an older server is unsafe after four-day records exist because the old validator cannot understand the new keys. Export schema-6 records first and use a compatible migration or restore plan.

## Verification

- **42 regression tests passed** on the available cached runtime, including legacy history, schema-5 migration, schema-6 backup round trips, date changes across daylight saving/leap days, all weekday transition alignments, missing-session order, seven-exercise completion, actual weekly set totals, frozen prescriptions, unit-aware reuse, two-exposure progression, offline migration/reload, conflicting program edits, and the real SQL guard using in-memory SQLite.
- Full TypeScript and ESLint checks passed. Final render checks cover the actual GymTracker server render and the transition/volume-control components with synthetic state; they do not establish browser interaction or layout quality.
- The original dependency lockfile is unchanged. No production package versions were changed.

The cached validation toolchain uses React 19.2.6, TypeScript 5.9.3, and Vite 8.0.13, but Next 16.3.4 rather than the locked 16.2.6 and Vinext 1.0.0-beta.5 rather than 0.0.50. The locked install previously failed on registry access to `zod@4.4.3`. Browser downloads were also blocked. The exact production build, built-Worker route test, phone/desktop visuals and interaction, trusted sign-in, and hosted D1 remain unverified. No GitHub push or live deployment was made.

## Release sequence

1. Import this source into the existing project/repository without overwriting secrets or production environment settings. Keep the original D1 binding and trusted identity-proxy configuration described in `MIGRATION.md`.
2. In the production-capable environment, run `npm ci`, `npm run test:unit`, `npm run typecheck`, `npm run lint`, and `npm test` with the included lockfile.
3. On a test account, import a synthetic schema-5 backup with completed and partial sessions. Verify their unchanged dates, loads, units, and templates. Activate four days, reload, and verify the new plan on a second device. Test offline recovery and a stale browser tab.
4. On phone and desktop, check the transition date, seven upper exercises, short mode, warm-up, next set, rest timer, focus view, complete/reopen, volume changes, overdue-session move, and JSON export/restore. Confirm keyboard/touch behavior and enlarged text.
5. Publish the client and server together after those checks. Reload old tabs before activating the real transition. Keep the real pre-transition backup and confirm the first new session's dose before training.

## Remaining limits

The app still uses local storage for its recovery queue and lacks a cold-start offline application cache. Concurrent disconnected tabs share a recovery key. Same-field conflicts use timestamps, not collaborative editing. Conflicting plan changes preserve an exportable draft but do not offer a field-by-field conflict picker. The main component and inherited CSS still merit a separate visual refactor after browser baselines are available. The explicit session model is implemented for the four-day program; legacy records retain their original immutable template IDs and calendar-day mapping.
