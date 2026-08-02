"use client";

import Image from "next/image";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  SetLog,
  SyncedProgress,
  TrackerState,
  WorkoutLog,
} from "./tracker-types";
import {
  SCHEDULED_DAYS,
  WARMUP_ITEMS,
  WORKOUTS,
  workoutIdForDay,
  workoutIndexForDay,
} from "./workout-data";
import {
  EXERCISE_GUIDES,
  WARMUP_GUIDES,
  type ExerciseGuide,
} from "./exercise-guides";

type AuthUser = { email: string; name: string } | null;
type SyncStatus = "error" | "loading" | "saved" | "syncing";

type GymTrackerProps = {
  signInPath: string;
  signOutPath: string;
  user: AuthUser;
};

const EMPTY_STATE: TrackerState = { startDate: null, workouts: {} };
const scheduledDaySet = new Set<number>(SCHEDULED_DAYS);

function nowIso() {
  return new Date().toISOString();
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateForChallengeDay(startDate: string, day: number) {
  const [year, month, date] = startDate.split("-").map(Number);
  return new Date(year, month - 1, date + day - 1, 12);
}

function shortDate(startDate: string, day: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(dateForChallengeDay(startDate, day));
}

function longDate(startDate: string, day: number) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(dateForChallengeDay(startDate, day));
}

function blankSet(): SetLog {
  return { done: false, load: "", reps: "", rir: "" };
}

function createWorkoutLog(day: number): WorkoutLog {
  const workout = WORKOUTS[workoutIdForDay(day)];
  const sets: Record<string, SetLog[]> = {};
  for (const pair of workout.pairs) {
    for (const exercise of pair.exercises) {
      sets[exercise.id] = [blankSet(), blankSet(), blankSet()];
    }
  }

  return {
    completed: false,
    completedAt: null,
    lowSleep: false,
    modifiedAt: new Date(0).toISOString(),
    note: "",
    sets,
    warmup: Object.fromEntries(WARMUP_ITEMS.map((item) => [item.id, false])),
  };
}

function hydratedWorkoutLog(day: number, saved?: WorkoutLog): WorkoutLog {
  const base = createWorkoutLog(day);
  if (!saved) return base;

  const sets = { ...base.sets };
  for (const [exerciseId, defaultSets] of Object.entries(base.sets)) {
    sets[exerciseId] = defaultSets.map(
      (set, index) => saved.sets?.[exerciseId]?.[index] ?? set,
    );
  }

  return {
    ...base,
    ...saved,
    sets,
    warmup: { ...base.warmup, ...saved.warmup },
  };
}

function mergeTrackerStates(
  remote: TrackerState | null,
  local: TrackerState,
): TrackerState {
  if (!remote) return local;
  if (!local.startDate) return remote;
  if (!remote.startDate) return local;

  const workouts: Record<string, WorkoutLog> = {};
  for (const day of SCHEDULED_DAYS) {
    const key = String(day);
    const remoteLog = remote.workouts[key];
    const localLog = local.workouts[key];
    if (!remoteLog) workouts[key] = localLog;
    else if (!localLog) workouts[key] = remoteLog;
    else {
      workouts[key] =
        Date.parse(localLog.modifiedAt) >= Date.parse(remoteLog.modifiedAt)
          ? localLog
          : remoteLog;
    }
  }

  return {
    startDate: remote.startDate || local.startDate,
    workouts,
  };
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function sleepModeExerciseLimit(lowSleep: boolean) {
  return lowSleep ? 4 : 6;
}

function workingSetCount(day: number, exerciseIndex: number, lowSleep: boolean) {
  if (lowSleep) return 2;
  return workoutIndexForDay(day) < 6 || exerciseIndex >= 4 ? 2 : 3;
}

function FormGuide({
  className = "",
  guide,
  label = "Visual form guide",
}: {
  className?: string;
  guide: ExerciseGuide;
  label?: string;
}) {
  return (
    <details className={`form-guide ${className}`.trim()}>
      <summary>
        <span className="form-guide-symbol" aria-hidden="true">
          ▶
        </span>
        <span>
          <strong>{label}</strong>
          <small>Start → finish · steps · self-check</small>
        </span>
        <b>Open</b>
      </summary>

      <div className="form-guide-body">
        <figure className="form-figure">
          <Image
            alt={guide.imageAlt}
            height={900}
            loading="lazy"
            sizes="(max-width: 960px) 100vw, 720px"
            src={guide.image}
            unoptimized
            width={1600}
          />
          <figcaption>
            <span>Start position</span>
            <i aria-hidden="true">→</i>
            <span>Finish position</span>
          </figcaption>
        </figure>

        <div className="form-instructions">
          <div className="setup-note">
            <span>Set up</span>
            <p>{guide.setup}</p>
          </div>

          <ol>
            {guide.steps.map((step, stepIndex) => (
              <li key={step}>
                <span>{stepIndex + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>

          <div className="self-check">
            <strong>Quick self-check</strong>
            <ul>
              {guide.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </div>

          <div className="guide-footer">
            <span>Stop for sharp pain, dizziness, or loss of control.</span>
            <a href={guide.reference.url} rel="noreferrer" target="_blank">
              {guide.reference.label} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </details>
  );
}

export default function GymTracker({
  signInPath,
  signOutPath,
  user,
}: GymTrackerProps) {
  const [tracker, setTracker] = useState<TrackerState>(EMPTY_STATE);
  const [selectedDay, setSelectedDay] = useState<number>(SCHEDULED_DAYS[0]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    user ? "loading" : "saved",
  );
  const [warmupSeconds, setWarmupSeconds] = useState(300);
  const [warmupRunning, setWarmupRunning] = useState(false);
  const trackerRef = useRef(tracker);
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const pendingRef = useRef<TrackerState | null>(null);

  useEffect(() => {
    trackerRef.current = tracker;
  }, [tracker]);

  const loadProgress = useCallback(async () => {
    if (!user) return;
    setSyncStatus("loading");

    try {
      const response = await fetch("/api/progress", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const progress = (await response.json()) as SyncedProgress;
      versionRef.current = progress.version;
      const next = progress.state ?? EMPTY_STATE;
      trackerRef.current = next;
      setTracker(next);
      const firstIncomplete = SCHEDULED_DAYS.find(
        (day) => !next.workouts[String(day)]?.completed,
      );
      if (firstIncomplete) setSelectedDay(firstIncomplete);
      setSyncStatus("saved");
    } catch {
      setSyncStatus("error");
    }
  }, [user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadProgress(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadProgress]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !savingRef.current) {
        void loadProgress();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadProgress]);

  const flushQueue = useCallback(async () => {
    if (!user || savingRef.current) return;
    savingRef.current = true;

    while (pendingRef.current) {
      let stateToSave = pendingRef.current;
      pendingRef.current = null;
      setSyncStatus("syncing");

      try {
        const response = await fetch("/api/progress", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            baseVersion: versionRef.current,
            state: stateToSave,
          }),
        });
        const progress = (await response.json()) as SyncedProgress;

        if (response.status === 409) {
          versionRef.current = progress.version;
          stateToSave = mergeTrackerStates(progress.state, stateToSave);
          trackerRef.current = stateToSave;
          setTracker(stateToSave);
          pendingRef.current = stateToSave;
          continue;
        }
        if (!response.ok) throw new Error("save failed");

        versionRef.current = progress.version;
        setSyncStatus("saved");
      } catch {
        pendingRef.current = stateToSave;
        setSyncStatus("error");
        break;
      }
    }

    savingRef.current = false;
  }, [user]);

  const mutateTracker = useCallback(
    (transform: (current: TrackerState) => TrackerState) => {
      setTracker((current) => {
        const next = transform(current);
        trackerRef.current = next;
        pendingRef.current = next;
        queueMicrotask(() => void flushQueue());
        return next;
      });
    },
    [flushQueue],
  );

  useEffect(() => {
    if (!warmupRunning) return;
    const interval = window.setInterval(() => {
      setWarmupSeconds((seconds) => {
        if (seconds <= 1) {
          setWarmupRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [warmupRunning]);

  const started = Boolean(tracker.startDate);
  const completedCount = SCHEDULED_DAYS.filter(
    (day) => tracker.workouts[String(day)]?.completed,
  ).length;
  const progressPercent = Math.round(
    (completedCount / SCHEDULED_DAYS.length) * 100,
  );
  const nextIncomplete =
    SCHEDULED_DAYS.find((day) => !tracker.workouts[String(day)]?.completed) ??
    SCHEDULED_DAYS[SCHEDULED_DAYS.length - 1];

  const workoutId = workoutIdForDay(selectedDay);
  const workout = WORKOUTS[workoutId];
  const activeLog = useMemo(
    () => hydratedWorkoutLog(selectedDay, tracker.workouts[String(selectedDay)]),
    [selectedDay, tracker.workouts],
  );
  const visibleExerciseLimit = sleepModeExerciseLimit(activeLog.lowSleep);
  const visiblePairs = activeLog.lowSleep
    ? workout.pairs.slice(0, 2)
    : workout.pairs;

  const readyToComplete = useMemo(() => {
    const warmupReady = WARMUP_ITEMS.every(
      (item) => activeLog.warmup[item.id],
    );
    const exercises = workout.pairs
      .flatMap((pair) => pair.exercises)
      .slice(0, visibleExerciseLimit);
    const setsReady = exercises.every((exercise, exerciseIndex) => {
      const required = workingSetCount(
        selectedDay,
        exerciseIndex,
        activeLog.lowSleep,
      );
      return (activeLog.sets[exercise.id] ?? [])
        .slice(0, required)
        .every((set) => set.done);
    });
    return warmupReady && setsReady;
  }, [activeLog, selectedDay, visibleExerciseLimit, workout.pairs]);

  const updateWorkout = useCallback(
    (day: number, transform: (log: WorkoutLog) => WorkoutLog) => {
      if (!trackerRef.current.startDate) return;
      mutateTracker((current) => {
        const key = String(day);
        const currentLog = hydratedWorkoutLog(day, current.workouts[key]);
        const nextLog = transform(currentLog);
        return {
          ...current,
          workouts: {
            ...current.workouts,
            [key]: { ...nextLog, modifiedAt: nowIso() },
          },
        };
      });
    },
    [mutateTracker],
  );

  const chooseDay = (day: number, scroll = true) => {
    setWarmupRunning(false);
    setWarmupSeconds(300);
    setSelectedDay(day);
    if (scroll) {
      window.setTimeout(() => {
        document
          .getElementById("workout-detail")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
    }
  };

  const startChallenge = () => {
    if (!user) {
      window.location.assign(signInPath);
      return;
    }

    if (started) {
      chooseDay(nextIncomplete);
      return;
    }

    const next: TrackerState = {
      startDate: localIsoDate(),
      workouts: {},
    };
    setWarmupRunning(false);
    setWarmupSeconds(300);
    setSelectedDay(SCHEDULED_DAYS[0]);
    mutateTracker(() => next);
    window.setTimeout(() => {
      document
        .getElementById("calendar")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const toggleWarmup = (itemId: string) => {
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: false,
      completedAt: null,
      warmup: { ...log.warmup, [itemId]: !log.warmup[itemId] },
    }));
  };

  const updateSet = (
    exerciseId: string,
    setIndex: number,
    patch: Partial<SetLog>,
  ) => {
    updateWorkout(selectedDay, (log) => {
      const currentSets = [...(log.sets[exerciseId] ?? [])];
      while (currentSets.length < 3) currentSets.push(blankSet());
      currentSets[setIndex] = { ...currentSets[setIndex], ...patch };
      return {
        ...log,
        completed: false,
        completedAt: null,
        sets: { ...log.sets, [exerciseId]: currentSets },
      };
    });
  };

  const toggleLowSleep = () => {
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: false,
      completedAt: null,
      lowSleep: !log.lowSleep,
    }));
  };

  const completeWorkout = () => {
    if (!readyToComplete || activeLog.completed) return;
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: true,
      completedAt: nowIso(),
    }));
  };

  const reopenWorkout = () => {
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: false,
      completedAt: null,
    }));
  };

  const syncLabel = !user
    ? "Sign in to sync"
    : syncStatus === "loading"
      ? "Loading progress…"
      : syncStatus === "syncing"
        ? "Syncing…"
        : syncStatus === "error"
          ? "Not synced — retry"
          : "Saved across devices";

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="30-Day Gym Tracker home">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-bar" />
            <span className="brand-leaf">⌁</span>
          </span>
          <span>30-Day Gym Tracker</span>
        </a>

        {user ? (
          <details className="account-menu">
            <summary aria-label="Open account menu">
              <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <span>{user.name}</span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="account-popover">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <button
                className={`sync-line ${syncStatus === "error" ? "has-error" : ""}`}
                type="button"
                onClick={() => {
                  if (syncStatus === "error") void flushQueue();
                }}
              >
                <span className="sync-dot" aria-hidden="true" />
                {syncLabel}
              </button>
              <a href={signOutPath}>Sign out</a>
            </div>
          </details>
        ) : (
          <a className="signin-link" href={signInPath}>
            Sign in with ChatGPT
          </a>
        )}
      </header>

      <div className="content" id="top">
        <section className="status-grid" aria-labelledby="hero-title">
          <article className="card hero-card">
            <div>
              <p className="eyebrow">Your 30-day reset</p>
              <h1 id="hero-title">Build momentum, one session at a time.</h1>
              <p className="hero-copy">
                Three focused workouts a week, automatically spaced around
                recovery—built for a demanding shift schedule.
              </p>
            </div>
            <div className="hero-action-row">
              <button className="primary-button" type="button" onClick={startChallenge}>
                {started ? "Continue next workout" : "Start 30-day challenge"}
              </button>
              {!user && <span>Sign in once to keep every log synced.</span>}
              {started && tracker.startDate && (
                <span>Started {shortDate(tracker.startDate, 1)}</span>
              )}
            </div>
          </article>

          <article className="card progress-card" aria-live="polite">
            <div
              className="progress-ring"
              style={{ "--progress": `${progressPercent * 3.6}deg` } as CSSProperties}
              aria-hidden="true"
            >
              <div>
                <strong>{progressPercent}</strong>
                <span>%</span>
              </div>
            </div>
            <div className="progress-copy">
              <strong>
                {completedCount} of {SCHEDULED_DAYS.length} workouts
              </strong>
              <span>
                {completedCount === SCHEDULED_DAYS.length
                  ? "Challenge complete"
                  : started
                    ? `${SCHEDULED_DAYS.length - completedCount} sessions to go`
                    : "Ready when you are"}
              </span>
              <small>{syncLabel}</small>
            </div>
          </article>
        </section>

        <section className="card calendar-card" id="calendar" aria-labelledby="calendar-title">
          <div className="section-heading calendar-heading">
            <div>
              <p className="eyebrow">The plan</p>
              <h2 id="calendar-title">Your 30 days</h2>
            </div>
            <div className="legend" aria-label="Calendar legend">
              <span><i className="legend-workout" /> Workout</span>
              <span><i className="legend-recovery" /> Recovery</span>
            </div>
          </div>

          <div className="calendar-grid">
            {Array.from({ length: 30 }, (_, index) => index + 1).map((day) => {
              const isWorkout = scheduledDaySet.has(day);
              const log = tracker.workouts[String(day)];
              const isDone = Boolean(log?.completed);
              const actualDate = tracker.startDate
                ? shortDate(tracker.startDate, day)
                : null;

              if (!isWorkout) {
                return (
                  <div className="day-cell recovery-day" key={day} aria-label={`Day ${day}, recovery`}>
                    <span className="day-number">{day}</span>
                    <small>{actualDate ?? "Recovery"}</small>
                  </div>
                );
              }

              const id = workoutIdForDay(day);
              return (
                <button
                  className={`day-cell workout-day ${selectedDay === day ? "is-selected" : ""} ${isDone ? "is-done" : ""}`}
                  key={day}
                  type="button"
                  aria-pressed={selectedDay === day}
                  aria-label={`Day ${day}, workout ${id}${isDone ? ", completed" : ""}`}
                  onClick={() => chooseDay(day)}
                >
                  <span className="day-number">{day}</span>
                  <span className="day-check" aria-hidden="true">{isDone ? "✓" : ""}</span>
                  <strong>{id}</strong>
                  <small>{actualDate ?? `Workout ${id}`}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="workout-layout" id="workout-detail" aria-labelledby="workout-title">
          <article className="card workout-card">
            <div className="workout-header">
              <div>
                <p className="eyebrow">Day {selectedDay}</p>
                <h2 id="workout-title">Workout {workoutId}</h2>
                <p>
                  {tracker.startDate
                    ? longDate(tracker.startDate, selectedDay)
                    : workout.subtitle}
                </p>
              </div>
              <div className="workout-meta">
                <span>30–40 min</span>
                <span>{workout.subtitle}</span>
              </div>
            </div>

            {!started && (
              <div className="start-notice">
                <strong>Preview mode</strong>
                <span>Start the challenge to check off your warm-up and log sets.</span>
              </div>
            )}

            <section className="warmup-panel" aria-labelledby="warmup-title">
              <div className="warmup-topline">
                <div>
                  <p className="eyebrow warm">Before every session</p>
                  <h3 id="warmup-title">Warm-up · 5 minutes</h3>
                </div>
                <div className="timer" aria-label="Warm-up timer">
                  <strong>{formatTimer(warmupSeconds)}</strong>
                  <button
                    type="button"
                    disabled={!started || warmupSeconds === 0}
                    onClick={() => setWarmupRunning((running) => !running)}
                  >
                    {warmupRunning ? "Pause" : warmupSeconds === 300 ? "Start timer" : "Resume"}
                  </button>
                  <button
                    type="button"
                    disabled={!started || warmupSeconds === 300}
                    onClick={() => {
                      setWarmupRunning(false);
                      setWarmupSeconds(300);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="warmup-list">
                {WARMUP_ITEMS.map((item) => (
                  <label className="warmup-item" key={item.id}>
                    <input
                      type="checkbox"
                      checked={Boolean(activeLog.warmup[item.id])}
                      disabled={!started}
                      onChange={() => toggleWarmup(item.id)}
                    />
                    <span className="control-check" aria-hidden="true" />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </label>
                ))}
              </div>

              <div className="warmup-form-grid" aria-label="Warm-up movement guides">
                {WARMUP_ITEMS.map((item) => {
                  const guide = WARMUP_GUIDES[item.id];
                  if (!guide) return null;
                  return (
                    <FormGuide
                      className="warmup-form-guide"
                      guide={guide}
                      key={item.id}
                      label={`Visual: ${item.label}`}
                    />
                  );
                })}
              </div>
            </section>

            <div className="session-mode">
              <div>
                <strong>Short-sleep shift?</strong>
                <span>
                  Use the 20-minute version: pairs 1 and 2, two sets each,
                  keeping 3 reps in reserve.
                </span>
              </div>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={activeLog.lowSleep}
                  disabled={!started}
                  onChange={toggleLowSleep}
                />
                <span aria-hidden="true" />
                <b>{activeLog.lowSleep ? "20-min mode on" : "Full session"}</b>
              </label>
            </div>

            <div className="form-guide-intro">
              <span aria-hidden="true">◎</span>
              <div>
                <strong>Visual form guides are built in.</strong>
                <span>
                  Open the guide under any exercise before your first set. Use
                  a light practice set—an illustration cannot certify technique
                  as precisely as an in-person trainer watching you move.
                </span>
              </div>
            </div>

            <div className="pairs-stack">
              {visiblePairs.map((pair, pairIndex) => (
                <section className="pair-panel" key={pair.id}>
                  <div className="pair-heading">
                    <div>
                      <span>{pairIndex + 1}</span>
                      <h3>{pair.title}</h3>
                    </div>
                    <small>
                      {workingSetCount(selectedDay, pairIndex * 2, activeLog.lowSleep)} rounds · rest 60–90 sec
                    </small>
                  </div>

                  <div className="exercise-stack">
                    {pair.exercises.map((exercise, itemIndex) => {
                      const exerciseIndex = pairIndex * 2 + itemIndex;
                      const setCount = workingSetCount(
                        selectedDay,
                        exerciseIndex,
                        activeLog.lowSleep,
                      );
                      const exerciseSets = activeLog.sets[exercise.id] ?? [];
                      const guide = EXERCISE_GUIDES[exercise.id];

                      return (
                        <article className="exercise-card" key={exercise.id}>
                          <div className="exercise-info">
                            <div>
                              <span className="exercise-number">{exerciseIndex + 1}</span>
                              <div>
                                <h4>{exercise.name}</h4>
                                <strong>{exercise.reps}</strong>
                              </div>
                            </div>
                            <p>{exercise.cue}</p>
                            {exercise.alternative && (
                              <small>Alternative: {exercise.alternative}</small>
                            )}
                          </div>

                          <div className="set-table" role="group" aria-label={`${exercise.name} set log`}>
                            <div className="set-head" aria-hidden="true">
                              <span>Set</span><span>Load</span><span>Reps</span><span>RIR</span><span>Done</span>
                            </div>
                            {Array.from({ length: setCount }, (_, setIndex) => {
                              const set = exerciseSets[setIndex] ?? blankSet();
                              const label = `${exercise.name}, set ${setIndex + 1}`;
                              return (
                                <div className="set-row" key={setIndex}>
                                  <strong>{setIndex + 1}</strong>
                                  <label>
                                    <span className="sr-only">{label}, weight</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      maxLength={12}
                                      placeholder="lb"
                                      value={set.load}
                                      disabled={!started}
                                      onChange={(event) => updateSet(exercise.id, setIndex, { load: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    <span className="sr-only">{label}, repetitions or seconds</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={12}
                                      placeholder="reps"
                                      value={set.reps}
                                      disabled={!started}
                                      onChange={(event) => updateSet(exercise.id, setIndex, { reps: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    <span className="sr-only">{label}, repetitions in reserve</span>
                                    <select
                                      value={set.rir}
                                      disabled={!started}
                                      onChange={(event) => updateSet(exercise.id, setIndex, { rir: event.target.value })}
                                    >
                                      <option value="">—</option>
                                      <option value="0">0</option>
                                      <option value="1">1</option>
                                      <option value="2">2</option>
                                      <option value="3">3</option>
                                      <option value="4+">4+</option>
                                    </select>
                                  </label>
                                  <label className="set-check">
                                    <span className="sr-only">{label}, completed</span>
                                    <input
                                      type="checkbox"
                                      checked={set.done}
                                      disabled={!started}
                                      onChange={() => updateSet(exercise.id, setIndex, { done: !set.done })}
                                    />
                                    <span className="control-check" aria-hidden="true" />
                                  </label>
                                </div>
                              );
                            })}
                          </div>

                          {guide && <FormGuide guide={guide} />}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <label className="notes-field">
              <span>Session notes</span>
              <textarea
                rows={3}
                maxLength={500}
                value={activeLog.note}
                disabled={!started}
                placeholder="Energy, technique, pain-free adjustments, or what to progress next time…"
                onChange={(event) =>
                  updateWorkout(selectedDay, (log) => ({
                    ...log,
                    note: event.target.value,
                  }))
                }
              />
            </label>

            <div className="completion-bar">
              <div>
                <strong>
                  {activeLog.completed
                    ? "Workout complete"
                    : readyToComplete
                      ? "Everything is checked—nice work."
                      : "Complete the warm-up and working sets first."}
                </strong>
                <span>Clean repetitions matter more than rushing the checkbox.</span>
              </div>
              {activeLog.completed ? (
                <button className="secondary-button" type="button" onClick={reopenWorkout}>
                  Reopen workout
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={!started || !readyToComplete}
                  onClick={completeWorkout}
                >
                  Complete workout
                </button>
              )}
            </div>
          </article>

          <aside className="side-column">
            <article className="card recovery-card">
              <span className="moon-mark" aria-hidden="true">☾</span>
              <div>
                <p className="eyebrow">Recovery matters</p>
                <h2>Protect the habit.</h2>
                <p>
                  After a short-sleep shift, choose the 20-minute version and
                  keep three repetitions in reserve. Postpone if you feel
                  unwell or unusually exhausted.
                </p>
              </div>
            </article>

            <article className="card progression-card">
              <p className="eyebrow">Progression rule</p>
              <h2>Earn the next weight.</h2>
              <ol>
                <li>Reach the top of the rep range on every set.</li>
                <li>Keep clean technique and 1–2 reps in reserve.</li>
                <li>Then add the smallest available weight.</li>
              </ol>
              <p>
                During the first six workouts, use two working sets. From
                workout seven onward, the first four exercises automatically
                expand to three sets.
              </p>
            </article>
          </aside>
        </section>
      </div>

      <div className="sr-only" aria-live="polite">
        {completedCount} of {SCHEDULED_DAYS.length} workouts completed. {syncLabel}
      </div>
    </main>
  );
}
