> **Four-day update, 10 October 2026:** This report describes the earlier engineering review. The subsequent four-day implementation, current checks, data migration, and release steps are documented in `docs/four-day-upgrade.md`. Its source is included in this package. The live site has not been deployed from this workspace.

# Gym Tracker — source review and improvement delivery

**Prepared 10 October 2026 for Bakr Alhayek.** Reviewed the supplied `gym-tracker.zip`, identified in its migration notes as site version 9, commit `2f1aa602c1d55b9aa4d99bc1cf5ba27340fc6b67`. This delivery is an edited source package, not a deployment or a claim that the current live site has been visually audited.

## Main conclusion

The app already has substantial functionality: an ongoing calendar, six current workouts, historical program support, exercise guides, readiness inputs, coaching, progress charts, wellness tracking, and account sync. Its highest-priority weaknesses were in persistence and workout execution. A cosmetic rewrite would not resolve those failures.

The improvements preserve the existing training data model and forest/cream design while adding a reliable device recovery path, controlled synchronization, deadline timers, a focused workout view, and backup restoration. No application dependency or database migration was added. The original dependency lockfile is byte-for-byte unchanged.

## Source findings and changes

These findings come from tracing the supplied code, not observing failures on the live site.

| Priority | Original finding | Implemented change and evidence |
| --- | --- | --- |
| High | Unsynced edits existed only in `pendingRef`; a reload discarded them. The preview discarded pending work while reporting a cross-device save. | `lib/tracker-sync.ts` persists an account-scoped recovery envelope synchronously. Local preview reports device-only saving. Tests recreate the controller after a failed upload and recover the draft. |
| High | `loadProgress` replaced state after GET, even when edits were made while that request ran. Save effects also ran inside React state updater callbacks. | `useSyncExternalStore` subscribes to one controller. GET and PUT responses reconcile with the current draft and its acknowledged baseline. Regression tests cover edits during both requests. |
| High | Whole-workout conflict resolution could erase changes to separate fields; 409 retries had no limit. | Three-way merging retains independent fields/set rows, including concurrently created sessions. Same-field conflicts use timestamps. Retries stop after three conflicts per operation. Different plans preserve the local draft and require an explicit resolution. |
| High | Sync-check/restart calls could continue before an already-running save completed. A diagnostic GET could report success while edits remained unsaved. | All callers await the same sync promise. Restart requires a successful flush and the server's existing version check. Diagnostics report the queue's actual result. |
| Medium | Timers decremented ticks and reset when switching sessions. Background throttling distorted elapsed rest. | `countdown-logic.ts` uses absolute deadlines; the hook saves timer state by account/plan/session and reconciles after visibility changes or reload. Pure tests simulate long background gaps. |
| Medium | Done accepted invalid reps, while server sanitation could clear the flag without updating the UI. Completed sessions could be altered implicitly. | Shared validation requires positive whole reps/seconds and valid optional load. Acknowledged sanitized state is adopted. Completed sessions require an explicit reopen. |
| Medium | Exports had no corresponding restoration path. | Versioned JSON exports, strict parsing of current and original schema-5 backups, record-count review, explicit backup acknowledgment, and version-checked replacement. CSV formula prefixes are escaped. |
| Medium | Workout controls were spread over a long page; Continue could overlook a partially logged past session. | Focus view, persistent session toolbar, working-set progress, pair-aware next-set navigation, previous-value reuse, and resume of unfinished logged sessions. |
| Low | Invalid JSON became a server error, dates received only superficial client validation, and legacy metric units could be relabeled. | Malformed bodies return 400, version inputs are strict integers, real calendar dates are checked, and missing metric units inherit the saved profile. |

## Verification completed

- **25 regression tests passed** using `npm run test:unit`. They cover data recovery, in-flight edits, concurrent session creation, version conflicts, cross-plan changes, blank first-load failures, storage errors, completion, elapsed timers, pair order, unit conversion, ongoing scheduling, backups, and CSV escaping.
- **Full TypeScript check passed.** `npm run typecheck` generates local Cloudflare runtime declarations and checks the project.
- **ESLint passed with no errors or warnings** over the source, excluding generated output.
- **Isolated server-render smoke check passed** for the actual `GymTracker` component with the real Next image component through an import-interoperability adapter. This verifies rendering of the new controls, not browser interaction or the production Worker route.
- Confirmed the original `package-lock.json` is unchanged. The source ZIP excludes dependencies, caches, generated tests, temporary type declarations, and local smoke-check files.

### Toolchain and access limits

The exact locked install failed because the registry blocked retrieval of a required `zod@4.4.3` package. Validation used an available cached toolchain: React 19.2.6, TypeScript 5.9.3, and Vite 8.0.13 match the project, but Next was 16.3.4 rather than 16.2.6 and Vinext was 1.0.0-beta.5 rather than 0.0.50. ESLint configuration also followed the cached Next version. These checks do not substitute for the locked production build.

The live URL returned 403 to the available retrieval path, which does not prove it is broken for normal users. There was no usable browser binary, and its download was blocked with 403. Consequently, visual/mobile/accessibility testing, actual background/resume behavior, production sign-in, D1 integration, and the existing built-Worker HTML test remain unverified. No Lighthouse score or screenshot audit is claimed. GitHub repository tools and deployment tools were unavailable; edits were made to the supplied source export.

## Remaining release checks

In an environment with the original dependencies and browser access:

1. Run `npm ci`, `npm run test:unit`, `npm run typecheck`, `npm run lint`, and `npm test` using the unchanged lockfile.
2. On phone and desktop, start a synthetic workout, log and undo sets, use Focus view and Next set, copy earlier values, complete/reopen, and verify keyboard focus, enlarged text, touch targets, and the on-screen keyboard layout.
3. In a signed-in test account, interrupt a save, reload, reconnect, and check the exact records on a second device. Exercise a same-session conflict and a different-plan conflict. Background/reopen a running timer.
4. Export a real-format synthetic backup, test invalid-file rejection, restore with the review confirmation, and verify server history and units. Test archive/restart after a queued save and after a request timeout.

The identity headers still require the trusted Sites proxy documented in `MIGRATION.md`; deployment to an arbitrary host needs a separate authentication integration.

## Practical limits and next improvements

Recovery uses browser local storage, not a full offline application cache. It can be exhausted or cleared, and concurrent offline tabs share a recovery key. Use one tab for disconnected logging and keep JSON exports. Same-field conflicts use timestamps; changes to exercise identity or units retain a whole winning record to avoid mixing measurements. A future revision could offer a field-by-field conflict review, IndexedDB for larger histories, a resumable archive browser, and multi-session schedule editing.

The CSS still contains earlier repeated mobile overrides and the main workout component remains large. Consolidating those safely should follow captured phone/desktop baselines. The GitHub skill research and the specific practices applied are documented in `docs/research.md`; external skills were reviewed as references, not permanently installed.
