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
import AppTools from "./AppTools";
import ProgressDashboard from "./ProgressDashboard";
import WellnessPanel from "./WellnessPanel";
import type {
  DailyMetric,
  ProfileSettings,
  SetLog,
  SyncedProgress,
  TrackerState,
  WorkoutLog,
} from "./tracker-types";
import {
  CHALLENGE_LENGTH_DAYS,
  EXERCISE_LIBRARY,
  EXERCISE_SUBSTITUTIONS,
  SCHEDULED_DAYS,
  WARMUP_ITEMS,
  WORKOUTS,
  workoutIdForDay,
  workoutIndexForDay,
} from "./workout-data";
import {
  challengeDayForDate,
  dayDifference,
  defaultSchedule,
  EMPTY_STATE,
  isoDateOffset,
  loadRecommendation,
  localIsoDate,
  mergeTrackerStates,
  normalizeTrackerState,
  previousPerformance,
  scheduledDate,
} from "./tracker-logic";
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

function nowIso() {
  return new Date().toISOString();
}

function dateFromIso(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(dateFromIso(date));
}

function longDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(dateFromIso(date));
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
    readiness: { energy: "", sleepHours: "", soreness: "" },
    sets,
    substitutions: {},
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
    readiness: { ...base.readiness, ...saved.readiness },
    sets,
    substitutions: { ...base.substitutions, ...saved.substitutions },
    warmup: { ...base.warmup, ...saved.warmup },
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
  const isPreviewUser = user?.email === "preview@gym.local";
  const [tracker, setTracker] = useState<TrackerState>(EMPTY_STATE);
  const [selectedDay, setSelectedDay] = useState<number>(SCHEDULED_DAYS[0]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    user ? "loading" : "saved",
  );
  const [warmupSeconds, setWarmupSeconds] = useState(300);
  const [warmupRunning, setWarmupRunning] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const [restSeconds, setRestSeconds] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const [restFinished, setRestFinished] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);
  const trackerRef = useRef(tracker);
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const pendingRef = useRef<TrackerState | null>(null);

  useEffect(() => {
    trackerRef.current = tracker;
  }, [tracker]);

  const loadProgress = useCallback(async () => {
    if (!user) return;
    if (isPreviewUser) {
      setSyncStatus("saved");
      return;
    }
    setSyncStatus("loading");

    try {
      const response = await fetch("/api/progress", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const progress = (await response.json()) as SyncedProgress;
      versionRef.current = progress.version;
      setSyncVersion(progress.version);
      setLastSyncedAt(progress.updatedAt);
      const next = normalizeTrackerState(progress.state);
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
  }, [isPreviewUser, user]);

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
    if (isPreviewUser) {
      pendingRef.current = null;
      setSyncStatus("saved");
      return;
    }
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
          setSyncVersion(progress.version);
          setLastSyncedAt(progress.updatedAt);
          stateToSave = mergeTrackerStates(progress.state, stateToSave);
          trackerRef.current = stateToSave;
          setTracker(stateToSave);
          pendingRef.current = stateToSave;
          continue;
        }
        if (!response.ok) throw new Error("save failed");

        versionRef.current = progress.version;
        setSyncVersion(progress.version);
        setLastSyncedAt(progress.updatedAt);
        setSyncStatus("saved");
      } catch {
        pendingRef.current = stateToSave;
        setSyncStatus("error");
        break;
      }
    }

    savingRef.current = false;
  }, [isPreviewUser, user]);

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

  useEffect(() => {
    if (!restRunning) return;
    const interval = window.setInterval(() => {
      setRestSeconds((seconds) => {
        if (seconds <= 1) {
          setRestRunning(false);
          setRestFinished(true);
          if ("vibrate" in navigator) navigator.vibrate([180, 100, 180]);
          return 0;
        }
        return seconds - 1;
      });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [restRunning]);

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
  const sessionNumber =
    SCHEDULED_DAYS.indexOf(
      selectedDay as (typeof SCHEDULED_DAYS)[number],
    ) + 1;
  const calendarWorkouts = useMemo(() => {
    const mapped = new Map<number, number>();
    for (const day of SCHEDULED_DAYS) {
      if (!tracker.startDate) {
        mapped.set(day, day);
        continue;
      }
      const date = scheduledDate(tracker, day);
      if (!date) continue;
      const challengeDay = challengeDayForDate(tracker.startDate, date);
      if (challengeDay >= 1 && challengeDay <= CHALLENGE_LENGTH_DAYS) {
        mapped.set(challengeDay, day);
      }
    }
    return mapped;
  }, [tracker]);

  const workoutId = workoutIdForDay(selectedDay);
  const workout = WORKOUTS[workoutId];
  const activeScheduledDate = scheduledDate(tracker, selectedDay);
  const activeLog = useMemo(
    () => hydratedWorkoutLog(selectedDay, tracker.workouts[String(selectedDay)]),
    [selectedDay, tracker.workouts],
  );
  const visibleExerciseLimit = sleepModeExerciseLimit(activeLog.lowSleep);
  const visiblePairs = activeLog.lowSleep
    ? workout.pairs.slice(0, 2)
    : workout.pairs;
  const sleepHours = Number(activeLog.readiness.sleepHours);
  const energy = Number(activeLog.readiness.energy);
  const soreness = Number(activeLog.readiness.soreness);
  const shouldPostpone =
    (sleepHours > 0 && sleepHours < 4) || energy === 1 || soreness === 5;
  const shouldUseShortMode =
    !shouldPostpone &&
    ((sleepHours > 0 && sleepHours < 6) ||
      (energy > 0 && energy <= 2) ||
      soreness >= 4);
  const restPercent = restDuration
    ? Math.round((restSeconds / restDuration) * 100)
    : 0;

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
    setScheduleMessage("");
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

    const startDate = localIsoDate();
    const next: TrackerState = {
      ...EMPTY_STATE,
      dailyMetrics: trackerRef.current.dailyMetrics,
      profile: trackerRef.current.profile,
      schedule: defaultSchedule(startDate),
      scheduleModifiedAt: nowIso(),
      startDate,
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
    suggestedRest = 90,
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
    if (patch.done === true) {
      setRestDuration(suggestedRest);
      setRestSeconds(suggestedRest);
      setRestFinished(false);
      setRestRunning(true);
    }
  };

  const toggleLowSleep = () => {
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: false,
      completedAt: null,
      lowSleep: !log.lowSleep,
    }));
  };

  const setLowSleep = (lowSleep: boolean) => {
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: false,
      completedAt: null,
      lowSleep,
    }));
  };

  const updateReadiness = (
    field: "energy" | "sleepHours" | "soreness",
    value: string,
  ) => {
    updateWorkout(selectedDay, (log) => ({
      ...log,
      readiness: { ...log.readiness, [field]: value },
    }));
  };

  const setSubstitution = (slotId: string, effectiveId: string) => {
    updateWorkout(selectedDay, (log) => {
      const substitutions = { ...log.substitutions };
      if (effectiveId === slotId) delete substitutions[slotId];
      else substitutions[slotId] = effectiveId;
      return {
        ...log,
        completed: false,
        completedAt: null,
        sets: {
          ...log.sets,
          [slotId]: [blankSet(), blankSet(), blankSet()],
        },
        substitutions,
      };
    });
  };

  const rescheduleWorkout = (date: string) => {
    if (!tracker.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (activeLog.completed) {
      setScheduleMessage("Completed sessions keep their original date.");
      return;
    }
    const challengeDay = challengeDayForDate(tracker.startDate, date);
    if (challengeDay < 1 || challengeDay > CHALLENGE_LENGTH_DAYS) {
      setScheduleMessage("Choose a date inside this 30-day challenge.");
      return;
    }
    const index = SCHEDULED_DAYS.indexOf(
      selectedDay as (typeof SCHEDULED_DAYS)[number],
    );
    const previousDay = SCHEDULED_DAYS[index - 1];
    const nextDay = SCHEDULED_DAYS[index + 1];
    const previousDate = previousDay
      ? scheduledDate(tracker, previousDay)
      : null;
    const nextDate = nextDay ? scheduledDate(tracker, nextDay) : null;
    if (previousDate && dayDifference(previousDate, date) < 2) {
      setScheduleMessage("Keep at least one full recovery day after the prior session.");
      return;
    }
    if (nextDate && dayDifference(date, nextDate) < 2) {
      setScheduleMessage("Keep at least one full recovery day before the next session.");
      return;
    }
    mutateTracker((current) => ({
      ...current,
      schedule: { ...current.schedule, [String(selectedDay)]: date },
      scheduleModifiedAt: nowIso(),
    }));
    setScheduleMessage(`Moved to ${longDate(date)}.`);
  };

  const updateDailyMetric = (date: string, patch: Partial<DailyMetric>) => {
    mutateTracker((current) => ({
      ...current,
      dailyMetrics: {
        ...current.dailyMetrics,
        [date]: {
          modifiedAt: nowIso(),
          protein: "",
          sleepHours: "",
          steps: "",
          waist: "",
          weight: "",
          ...current.dailyMetrics[date],
          ...patch,
        },
      },
    }));
  };

  const updateProfile = (patch: Partial<ProfileSettings>) => {
    mutateTracker((current) => ({
      ...current,
      profile: { ...current.profile, ...patch, modifiedAt: nowIso() },
    }));
  };

  const resetChallenge = () => {
    const current = trackerRef.current;
    const next: TrackerState = {
      ...EMPTY_STATE,
      dailyMetrics: current.dailyMetrics,
      profile: current.profile,
    };
    setSelectedDay(SCHEDULED_DAYS[0]);
    setWarmupRunning(false);
    setWarmupSeconds(300);
    setRestRunning(false);
    setRestSeconds(restDuration);
    mutateTracker(() => next);
  };

  const runSyncCheck = async () => {
    if (!user) return false;
    if (isPreviewUser) return true;
    if (pendingRef.current) await flushQueue();
    try {
      const response = await fetch("/api/progress", { cache: "no-store" });
      if (!response.ok) throw new Error("sync check failed");
      const progress = (await response.json()) as SyncedProgress;
      versionRef.current = progress.version;
      setSyncVersion(progress.version);
      setLastSyncedAt(progress.updatedAt);
      setSyncStatus("saved");
      return true;
    } catch {
      setSyncStatus("error");
      return false;
    }
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
                <span>Started {shortDate(tracker.startDate)}</span>
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
            {Array.from({ length: CHALLENGE_LENGTH_DAYS }, (_, index) => index + 1).map((day) => {
              const sessionDay = calendarWorkouts.get(day);
              const isWorkout = Boolean(sessionDay);
              const log = sessionDay
                ? tracker.workouts[String(sessionDay)]
                : undefined;
              const isDone = Boolean(log?.completed);
              const actualDate = tracker.startDate
                ? shortDate(isoDateOffset(tracker.startDate, day - 1))
                : null;

              if (!isWorkout) {
                return (
                  <div className="day-cell recovery-day" key={day} aria-label={`Day ${day}, recovery`}>
                    <span className="day-number">{day}</span>
                    <small>{actualDate ?? "Recovery"}</small>
                  </div>
                );
              }

              const id = workoutIdForDay(sessionDay!);
              const sessionIndex =
                SCHEDULED_DAYS.indexOf(
                  sessionDay as (typeof SCHEDULED_DAYS)[number],
                ) + 1;
              return (
                <button
                  className={`day-cell workout-day ${selectedDay === sessionDay ? "is-selected" : ""} ${isDone ? "is-done" : ""}`}
                  key={day}
                  type="button"
                  aria-pressed={selectedDay === sessionDay}
                  aria-label={`Day ${day}, session ${sessionIndex}, workout ${id}${isDone ? ", completed" : ""}`}
                  onClick={() => chooseDay(sessionDay!)}
                >
                  <span className="day-number">{day}</span>
                  <span className="day-check" aria-hidden="true">{isDone ? "✓" : ""}</span>
                  <strong>{id}</strong>
                  <small>{actualDate ?? `Session ${sessionIndex}`}</small>
                </button>
              );
            })}
          </div>
        </section>

        <ProgressDashboard tracker={tracker} />

        <section className="workout-layout" id="workout-detail" aria-labelledby="workout-title">
          <article className="card workout-card">
            <div className="workout-header">
              <div>
                <p className="eyebrow">Session {sessionNumber} of {SCHEDULED_DAYS.length}</p>
                <h2 id="workout-title">Workout {workoutId}</h2>
                <p>
                  {activeScheduledDate
                    ? longDate(activeScheduledDate)
                    : workout.subtitle}
                </p>
              </div>
              <div className="workout-meta">
                <span>30–40 min</span>
                <span>{workout.subtitle}</span>
              </div>
            </div>

            {started && tracker.startDate && activeScheduledDate && (
              <div className="schedule-editor">
                <div>
                  <strong>Shift changed?</strong>
                  <span>Move this session while keeping a full recovery day on both sides.</span>
                </div>
                <div className="schedule-controls">
                  <button
                    aria-label="Move workout one day earlier"
                    disabled={activeLog.completed}
                    type="button"
                    onClick={() => rescheduleWorkout(isoDateOffset(activeScheduledDate, -1))}
                  >
                    −1 day
                  </button>
                  <label>
                    <span className="sr-only">Workout date</span>
                    <input
                      disabled={activeLog.completed}
                      max={isoDateOffset(tracker.startDate, CHALLENGE_LENGTH_DAYS - 1)}
                      min={tracker.startDate}
                      type="date"
                      value={activeScheduledDate}
                      onChange={(event) => rescheduleWorkout(event.target.value)}
                    />
                  </label>
                  <button
                    aria-label="Move workout one day later"
                    disabled={activeLog.completed}
                    type="button"
                    onClick={() => rescheduleWorkout(isoDateOffset(activeScheduledDate, 1))}
                  >
                    +1 day
                  </button>
                </div>
                {scheduleMessage && <small role="status">{scheduleMessage}</small>}
              </div>
            )}

            {!started && (
              <div className="start-notice">
                <strong>Preview mode</strong>
                <span>Start the challenge to check off your warm-up and log sets.</span>
              </div>
            )}

            <section className="readiness-panel" aria-labelledby="readiness-title">
              <div className="readiness-copy">
                <p className="eyebrow">60-second check-in</p>
                <h3 id="readiness-title">How ready are you today?</h3>
                <span>Your answers guide the full, short, or postpone recommendation.</span>
              </div>
              <div className="readiness-fields">
                <label>
                  <span>Sleep</span>
                  <div><input disabled={!started} inputMode="decimal" max="12" min="0" placeholder="—" type="number" value={activeLog.readiness.sleepHours} onChange={(event) => updateReadiness("sleepHours", event.target.value)} /><b>hours</b></div>
                </label>
                <label>
                  <span>Energy</span>
                  <select disabled={!started} value={activeLog.readiness.energy} onChange={(event) => updateReadiness("energy", event.target.value)}>
                    <option value="">Choose</option>
                    <option value="1">1 · drained</option>
                    <option value="2">2 · low</option>
                    <option value="3">3 · okay</option>
                    <option value="4">4 · good</option>
                    <option value="5">5 · excellent</option>
                  </select>
                </label>
                <label>
                  <span>Soreness</span>
                  <select disabled={!started} value={activeLog.readiness.soreness} onChange={(event) => updateReadiness("soreness", event.target.value)}>
                    <option value="">Choose</option>
                    <option value="1">1 · none</option>
                    <option value="2">2 · mild</option>
                    <option value="3">3 · moderate</option>
                    <option value="4">4 · high</option>
                    <option value="5">5 · severe</option>
                  </select>
                </label>
              </div>
              <div className={`readiness-result ${shouldPostpone ? "postpone" : shouldUseShortMode ? "short" : "ready"}`} aria-live="polite">
                <div>
                  <strong>
                    {shouldPostpone
                      ? "Best call: postpone today"
                      : shouldUseShortMode
                        ? "Recommended: 20-minute mode"
                        : sleepHours || energy || soreness
                          ? "Full session looks reasonable"
                          : "Complete the check-in for a recommendation"}
                  </strong>
                  <span>
                    {shouldPostpone
                      ? "Recovery is the productive choice. Move this session to the next valid day above."
                      : shouldUseShortMode
                        ? "Use two pairs, two sets each, and keep about 3 reps in reserve."
                        : "Use the full plan if your warm-up feels normal and pain-free."}
                  </span>
                </div>
                {shouldUseShortMode && !activeLog.lowSleep && (
                  <button disabled={!started} type="button" onClick={() => setLowSleep(true)}>Apply short mode</button>
                )}
              </div>
            </section>

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

            <section className={`rest-timer-panel ${restFinished ? "is-finished" : ""}`} aria-labelledby="rest-timer-title">
              <div
                className="rest-timer-ring"
                style={{ "--rest-progress": `${restPercent * 3.6}deg` } as CSSProperties}
                aria-hidden="true"
              >
                <strong>{formatTimer(restSeconds)}</strong>
              </div>
              <div className="rest-timer-copy">
                <p className="eyebrow">Automatic between sets</p>
                <h3 id="rest-timer-title">{restFinished ? "Rest complete—next clean set." : "Rest timer"}</h3>
                <span>It starts when you check off a set: 90 seconds for the first two pairs, 60 seconds for accessories.</span>
              </div>
              <div className="rest-timer-actions">
                <div className="rest-presets" aria-label="Rest duration">
                  {[60, 75, 90].map((duration) => (
                    <button
                      aria-pressed={restDuration === duration}
                      className={restDuration === duration ? "is-active" : ""}
                      key={duration}
                      type="button"
                      onClick={() => {
                        setRestDuration(duration);
                        setRestSeconds(duration);
                        setRestFinished(false);
                        setRestRunning(false);
                      }}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
                <div>
                  <button
                    disabled={!started}
                    type="button"
                    onClick={() => {
                      if (restSeconds === 0) setRestSeconds(restDuration);
                      setRestFinished(false);
                      setRestRunning((running) => !running);
                    }}
                  >
                    {restRunning ? "Pause" : "Start"}
                  </button>
                  <button
                    disabled={!started || (restSeconds === restDuration && !restRunning)}
                    type="button"
                    onClick={() => {
                      setRestRunning(false);
                      setRestFinished(false);
                      setRestSeconds(restDuration);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </section>

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
                      const effectiveId =
                        activeLog.substitutions[exercise.id] ?? exercise.id;
                      const displayedExercise =
                        EXERCISE_LIBRARY[effectiveId] ?? exercise;
                      const guide = EXERCISE_GUIDES[effectiveId];
                      const previous = previousPerformance(
                        tracker,
                        selectedDay,
                        exercise.id,
                        effectiveId,
                      );
                      const recommendation = loadRecommendation(
                        effectiveId,
                        previous,
                      );
                      const substitutionOptions =
                        EXERCISE_SUBSTITUTIONS[exercise.id] ?? [];
                      const hasLoggedSet = exerciseSets.some(
                        (set) => set.done || set.load || set.reps || set.rir,
                      );

                      return (
                        <article className="exercise-card" key={exercise.id}>
                          <div className="exercise-info">
                            <div>
                              <span className="exercise-number">{exerciseIndex + 1}</span>
                              <div>
                                <h4>{displayedExercise.name}</h4>
                                <strong>{displayedExercise.reps}</strong>
                              </div>
                            </div>
                            <p>{displayedExercise.cue}</p>
                            {substitutionOptions.length > 0 ? (
                              <label className="substitution-control">
                                <span>Equipment occupied?</span>
                                <select
                                  aria-label={`Choose an alternative for ${exercise.name}`}
                                  disabled={!started || hasLoggedSet}
                                  value={effectiveId}
                                  onChange={(event) => setSubstitution(exercise.id, event.target.value)}
                                >
                                  <option value={exercise.id}>Original · {exercise.name}</option>
                                  {substitutionOptions.map((optionId) => (
                                    <option key={optionId} value={optionId}>
                                      Swap · {EXERCISE_LIBRARY[optionId]?.name ?? optionId}
                                    </option>
                                  ))}
                                </select>
                                {hasLoggedSet && <small>Clear this session&apos;s set entries before swapping.</small>}
                              </label>
                            ) : exercise.alternative ? (
                              <small>Alternative: {exercise.alternative}</small>
                            ) : null}
                          </div>

                          <div className={`performance-card ${recommendation.kind}`}>
                            <div>
                              <span>Last time</span>
                              {previous ? (
                                <div className="previous-sets">
                                  {previous.sets.map((set, index) => (
                                    <b key={`${set.load}-${set.reps}-${index}`}>
                                      {set.load ? `${set.load} lb · ` : ""}{set.reps} {/(sec)/i.test(displayedExercise.reps) ? "sec" : "reps"}{set.rir ? ` · ${set.rir} RIR` : ""}
                                    </b>
                                  ))}
                                </div>
                              ) : (
                                <strong>No prior set logged</strong>
                              )}
                            </div>
                            <div>
                              <span>Today&apos;s suggestion</span>
                              <strong>{recommendation.text}</strong>
                            </div>
                          </div>

                          <div className="set-table" role="group" aria-label={`${displayedExercise.name} set log`}>
                            <div className="set-head" aria-hidden="true">
                              <span>Set</span><span>Load</span><span>Reps</span><span>RIR</span><span>Done</span>
                            </div>
                            {Array.from({ length: setCount }, (_, setIndex) => {
                              const set = exerciseSets[setIndex] ?? blankSet();
                              const label = `${displayedExercise.name}, set ${setIndex + 1}`;
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
                                      onChange={() =>
                                        updateSet(
                                          exercise.id,
                                          setIndex,
                                          { done: !set.done },
                                          pairIndex < 2 ? 90 : 60,
                                        )
                                      }
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

        <WellnessPanel
          onMetricChange={updateDailyMetric}
          onProfileChange={updateProfile}
          started={started}
          tracker={tracker}
        />

        <AppTools
          lastSyncedAt={lastSyncedAt}
          onReset={resetChallenge}
          onSyncCheck={runSyncCheck}
          started={started}
          syncStatus={syncStatus}
          syncVersion={syncVersion}
          tracker={tracker}
          user={user}
        />
      </div>

      <div className="sr-only" aria-live="polite">
        {completedCount} of {SCHEDULED_DAYS.length} workouts completed. {syncLabel}
      </div>
    </main>
  );
}
