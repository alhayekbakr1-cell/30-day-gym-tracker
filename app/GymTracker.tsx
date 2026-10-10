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
import CoachPanel from "./CoachPanel";
import ProgramIntelligence from "./ProgramIntelligence";
import FourDaySetup from "./FourDaySetup";
import { FOUR_DAY_KEY_START, initialFourDaySets, isFourDayKey } from "./four-day-data";
import ProgressDashboard from "./ProgressDashboard";
import SmartToday from "./SmartToday";
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
  EXERCISE_LIBRARY,
  EXERCISE_SUBSTITUTIONS,
  WARMUP_ITEMS,
  WORKOUTS,
} from "./workout-data";
import {
  activateFourDayPlan,
  changeFourDaySets,
  rescheduleSession,
  sessionNumberForKey,
  convertLoad,
  defaultSchedule,
  EMPTY_STATE,
  isoDateOffset,
  formatLoad,
  loadRecommendation,
  localIsoDate,
  nextWorkoutDay,
  previousPerformance,
  scheduledDate,
  scheduledDaysInRange,
  workoutForDay,
} from "./tracker-logic";
import {
  EXERCISE_GUIDES,
  WARMUP_GUIDES,
  type ExerciseGuide,
} from "./exercise-guides";

import { useTrackerSync } from "./use-tracker-sync";
import { useCountdown } from "./use-countdown";
import { copyPreviousSets, sessionProgress, validSet, hydratedWorkoutLog, exercisePrescriptionFor, visibleWorkoutPairs, warmupItemsForSession } from "./session-logic";
import { downloadBackup } from "./backup-logic";

type AuthUser = { email: string; name: string } | null;


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

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function monthOffset(date: string, offset: number) {
  const [year, month] = date.split("-").map(Number);
  return localIsoDate(new Date(year, month - 1 + offset, 1, 12));
}

function monthEnd(date: string) {
  return isoDateOffset(monthOffset(date, 1), -1);
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(dateFromIso(date));
}

function monthCalendarDates(date: string) {
  const firstWeekday = dateFromIso(date).getDay();
  const count = Number(monthEnd(date).slice(-2));
  return [
    ...Array<string | null>(firstWeekday).fill(null),
    ...Array.from({ length: count }, (_, index) => isoDateOffset(date, index)),
  ];
}

function blankSet(): SetLog {
  return { done: false, load: "", reps: "", rir: "" };
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
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
        <Image
          alt=""
          aria-hidden="true"
          className="form-guide-thumb"
          height={90}
          src={guide.image}
          unoptimized
          width={160}
        />
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
  const sync = useTrackerSync(user?.email ?? null);
  const { state: tracker, status: syncStatus, loaded: progressLoaded, version: syncVersion, updatedAt: lastSyncedAt, controller } = sync;
  const [selectedKey, setSelectedDay] = useState(1);
  const selectedDay = tracker.startDate ? selectedKey : FOUR_DAY_KEY_START;
  const workoutState = useMemo<TrackerState>(() => tracker.startDate ? tracker : {
    ...tracker, fourDayPlan: { id: "preview", version: 1, startsOn: localIsoDate(), modifiedAt: new Date(0).toISOString(), sets: initialFourDaySets(), rir: 3, shifts: {} },
  }, [tracker]);
  const [calendarMonth, setCalendarMonth] = useState(monthStart(localIsoDate()));
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [blockMessage, setBlockMessage] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const selectedBlock = useRef<string | null>(null);
  const timerKey = `gym-tracker:timer:${encodeURIComponent(user?.email ?? "guest")}:${tracker.blockId ?? "preview"}:${selectedDay}`;
  const warmupTimer = useCountdown(`${timerKey}:warmup`, 300);
  const restTimer = useCountdown(`${timerKey}:rest`, 120);
  const { remaining: warmupSeconds, running: warmupRunning } = warmupTimer;
  const { remaining: restSeconds, duration: restDuration, running: restRunning, finished: restFinished } = restTimer;
  const mutateTracker = useCallback((transform: (current: TrackerState) => TrackerState) => controller.mutate(transform), [controller]);

  useEffect(() => {
    const selectionId = `${tracker.blockId}:${tracker.fourDayPlan?.id ?? "legacy"}`;
    if (!progressLoaded || !tracker.blockId || selectedBlock.current === selectionId) return;
    const day = nextWorkoutDay(tracker);
    const date = scheduledDate(tracker, day);
    const timeout = window.setTimeout(() => {
      selectedBlock.current = selectionId;
      setSelectedDay(day);
      if (date) setCalendarMonth(monthStart(date));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [progressLoaded, tracker]);

  const started = Boolean(tracker.startDate) && progressLoaded && !restarting;
  const completedCount = Object.values(tracker.workouts).filter(
    (log) => log.completed,
  ).length;
  const monthSessionDays = useMemo(
    () => scheduledDaysInRange(tracker, calendarMonth, monthEnd(calendarMonth)),
    [calendarMonth, tracker],
  );
  const completedThisMonth = monthSessionDays.filter(
    (day) => tracker.workouts[String(day)]?.completed,
  ).length;
  const progressPercent = Math.round(
    monthSessionDays.length ? (completedThisMonth / monthSessionDays.length) * 100 : 0,
  );
  const nextIncomplete = nextWorkoutDay(tracker);
  const sessionNumber = tracker.startDate ? sessionNumberForKey(tracker, selectedDay) : 1;
  const calendarWorkouts = useMemo(() => {
    const mapped = new Map<string, number>();
    for (const day of monthSessionDays) {
      const date = scheduledDate(tracker, day);
      if (!date) continue;
      mapped.set(date, day);
    }
    return mapped;
  }, [monthSessionDays, tracker]);
  const calendarDates = useMemo(() => monthCalendarDates(calendarMonth), [calendarMonth]);

  const workout = workoutForDay(workoutState, selectedDay);
  const workoutId = workout.id;
  const activeScheduledDate = scheduledDate(tracker, selectedDay);
  const activeLog = useMemo(() => hydratedWorkoutLog(workoutState, selectedDay), [selectedDay, workoutState]);
  const visiblePairs = visibleWorkoutPairs(workoutState, selectedDay, activeLog);
  const isFourDaySession = isFourDayKey(selectedDay);
  const warmupItems = warmupItemsForSession(selectedDay);
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

  const session = sessionProgress(workoutState, selectedDay, activeLog);
  const readyToComplete = session.ready;
  const editable = started && !activeLog.completed && !sync.conflict;

  const updateWorkout = useCallback(
    (day: number, transform: (log: WorkoutLog) => WorkoutLog) => {
      if (!controller.getSnapshot().state.startDate) return;
      mutateTracker((current) => {
        const date = scheduledDate(current, day);
        if (!date || !scheduledDaysInRange(current, date, date).includes(day)) return current;
        const key = String(day);
        const currentLog = hydratedWorkoutLog(current, day);
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
    [controller, mutateTracker],
  );

  const chooseDay = (day: number, scroll = true) => {
    setScheduleMessage("");
    setSessionMessage("");
    setSelectedDay(day);
    const date = scheduledDate(controller.getSnapshot().state, day);
    if (date) setCalendarMonth(monthStart(date));
    if (scroll) {
      window.setTimeout(() => {
        document
          .getElementById("workout-detail")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
    }
  };

  const startChallenge = () => {
    if (!progressLoaded || restarting || sync.conflict) return;
    if (!user) {
      window.location.assign(signInPath);
      return;
    }

    if (started) {
      chooseDay(nextIncomplete);
      return;
    }

    const startDate = localIsoDate();
    const baseline: TrackerState = {
      ...EMPTY_STATE,
      blockId: crypto.randomUUID(),
      dailyMetrics: controller.getSnapshot().state.dailyMetrics,
      programVersion: 3,
      profile: controller.getSnapshot().state.profile,
      schedule: defaultSchedule(),
      scheduleModifiedAt: nowIso(),
      startDate,
      workouts: {},
    };
    const next = activateFourDayPlan(baseline, startDate, crypto.randomUUID());
    setSelectedDay(FOUR_DAY_KEY_START);
    setCalendarMonth(monthStart(startDate));
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
      const nextSet = { ...currentSets[setIndex], ...patch };
      currentSets[setIndex] = { ...nextSet, done: nextSet.done && validSet(nextSet) };
      return {
        ...log,
        completed: false,
        completedAt: null,
        sets: { ...log.sets, [exerciseId]: currentSets },
      };
    });
    if (patch.done === true) restTimer.start(suggestedRest);
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

  const openSmartWorkout = (shortMode: boolean) => {
    if (!started) {
      startChallenge();
      return;
    }
    const day = nextWorkoutDay(controller.getSnapshot().state);
    chooseDay(day);
    if (shortMode) {
      updateWorkout(day, (log) => ({
        ...log,
        completed: false,
        completedAt: null,
        lowSleep: true,
      }));
    }
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
    try {
      const next = rescheduleSession(controller.getSnapshot().state, selectedDay, date);
      mutateTracker(() => next);
      setCalendarMonth(monthStart(date));
      setScheduleMessage(isFourDaySession ? "This session and following sessions moved together. The rotation stays in order." : `Moved to ${longDate(date)}.`);
    } catch (error) { setScheduleMessage(error instanceof Error ? error.message : "Choose another date."); }
  };

  const activateFourDays = async (date: string) => {
    if (!await controller.sync() || controller.getSnapshot().pending) throw new Error("Sync your current records before switching plans.");
    const current = controller.getSnapshot().state;
    const next = activateFourDayPlan(current, date, crypto.randomUUID());
    downloadBackup(current, "gym-tracker-before-four-days");
    mutateTracker(() => next);
    chooseDay(nextWorkoutDay(next));
    if (!await controller.sync(false)) setBlockMessage("Your four-day transition is saved on this device and waiting to sync. Check save status before closing.");
    else setBlockMessage("Four-day plan saved. Your earlier workouts and unfinished sessions are preserved.");
  };

  const updateDailyMetric = (date: string, patch: Partial<DailyMetric>) => {
    mutateTracker((current) => ({
      ...current,
      dailyMetrics: {
        ...current.dailyMetrics,
        [date]: {
          ...(current.dailyMetrics[date] ?? {
            modifiedAt: new Date(0).toISOString(), protein: "", sleepHours: "", steps: "", waist: "", weight: "",
          }),
          ...patch,
          modifiedAt: nowIso(),
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

  const resetChallenge = async () => {
    if (!user || isPreviewUser || !controller.getSnapshot().state.startDate) return false;
    setRestarting(true);
    setBlockMessage("");
    try {
      if (!await controller.sync() || controller.getSnapshot().pending) throw new Error("Sync first");
      const response = await fetch("/api/challenges", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseVersion: controller.getSnapshot().version, startDate: localIsoDate() }),
        signal: AbortSignal.timeout(15000),
      });
      const progress = await response.json() as SyncedProgress;
      if (!response.ok || !progress.state) throw new Error("New plan failed");
      controller.acceptAcknowledged(progress);
      setSelectedDay(nextWorkoutDay(progress.state));
      setCalendarMonth(monthStart(localIsoDate()));
      setBlockMessage("Previous plan archived. Your new ongoing calendar is ready.");
      return true;
    } catch {
      setBlockMessage("Restart could not be confirmed. Run a sync check before trying again; your device copy is preserved.");
      return false;
    } finally { setRestarting(false); }
  };

  const restoreBackup = async (state: TrackerState) => {
    if (!progressLoaded || restarting || sync.conflict) return false;
    setRestarting(true);
    try {
      if (!await controller.sync()) return false;
      downloadBackup(controller.getSnapshot().state, "gym-tracker-before-restore");
      controller.replace(state);
      setBlockMessage("Backup restored on this device. Check sync status before closing the app.");
      await controller.sync(false);
      return true;
    } finally { setRestarting(false); }
  };

  const jumpToNextSet = () => {
    if (!session.next) return;
    const row = document.getElementById(`set-${session.next.slot}-${session.next.setIndex}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => row?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }), 250);
  };

  const completeWorkout = () => {
    if (!readyToComplete || activeLog.completed) return;
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: true,
      completedAt: nowIso(),
    }));
    restTimer.pause();
    warmupTimer.pause();
  };

  const reopenWorkout = () => {
    updateWorkout(selectedDay, (log) => ({
      ...log,
      completed: false,
      completedAt: null,
    }));
  };

  const syncLabel = sync.localOnly
    ? sync.localSaved ? "Saved on this device" : "Device preview"
    : syncStatus === "loading" ? "Checking saved progress…"
      : syncStatus === "syncing" ? "Syncing changes…"
        : syncStatus === "queued" ? sync.localSaved ? "Saved here · waiting to sync" : "Changes waiting to sync"
          : syncStatus === "error" ? "Sync needs attention"
            : "Saved across devices";

  return (
    <main className={`site-shell ${focusMode ? "is-focused" : ""}`}>
      <a className="skip-link" href="#workout-detail">Skip to workout</a>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Gym Tracker home">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-bar" />
            <span className="brand-leaf">⌁</span>
          </span>
          <span>Gym Tracker</span>
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
                  void controller.sync();
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
        <div className={`save-status ${syncStatus === "error" || sync.storageError ? "needs-attention" : ""}`} role="status">
          <span><strong>{syncLabel}</strong>{sync.storageError ? ` · ${sync.storageError}` : sync.message ? ` · ${sync.message}` : sync.localOnly && user ? " · Preview data stays in this browser." : ""}</span>
          {(syncStatus === "error" || sync.storageError) && <button type="button" onClick={() => void controller.sync()}>Retry save</button>}
          {sync.conflict && <button type="button" onClick={() => { downloadBackup(controller.getSnapshot().state, "gym-tracker-device-draft"); controller.acceptServerPlan(); }}>Export draft & load server plan</button>}
        </div>
        <section className={`status-grid ${started ? "has-started" : ""}`} aria-labelledby="hero-title">
          <article className="card hero-card">
            <div>
              <p className="eyebrow">Your ongoing training plan</p>
              <h1 id="hero-title">Build momentum, one session at a time.</h1>
              <p className="hero-copy">
                {tracker.fourDayPlan || !started ? "Four focused workouts each week, with upper and lower sessions and room for recovery." : "Your ongoing training, with a four-day upper/lower plan ready when you are."}
              </p>
            </div>
            <div className="hero-action-row">
              <button className="primary-button" disabled={!progressLoaded || restarting} type="button" onClick={startChallenge}>
                {restarting ? "Starting new plan…" : started ? "Continue next workout" : progressLoaded ? "Start four-day plan" : "Loading your progress…"}
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
                {completedThisMonth} of {monthSessionDays.length} this month
              </strong>
              <span>
                {monthSessionDays.length > 0 && completedThisMonth === monthSessionDays.length
                  ? "Month complete"
                  : started
                    ? `${completedCount} sessions completed all time`
                    : "Ready when you are"}
              </span>
              <small>{syncLabel}</small>
            </div>
          </article>
        </section>

        <nav className="quick-nav" aria-label="Tracker sections">
          <a href="#today">Today</a>
          <a href="#workout-detail">Workout</a>
          <a href="#calendar">Calendar</a>
          <a href="#coach">Coach</a>
          <a href="#progress-dashboard">Progress</a>
          <a href="#program">Evidence</a>
          <a href="#wellness">Recovery</a>
        </nav>

        <SmartToday
          ready={progressLoaded && !restarting && !sync.conflict}
          onOpen={openSmartWorkout}
          onStart={startChallenge}
          started={started}
          tracker={tracker}
        />

        {started && <FourDaySetup tracker={tracker} disabled={restarting || sync.conflict}
          onActivate={activateFourDays}
          onSets={(template, slot, count) => mutateTracker(current => changeFourDaySets(current, template, slot, count))}
          onEffort={rir => mutateTracker(current => current.fourDayPlan ? { ...current, fourDayPlan: { ...current.fourDayPlan, rir, modifiedAt: nowIso() } } : current)} />}

        <section className="card calendar-card" id="calendar" aria-labelledby="calendar-title">
          <div className="section-heading calendar-heading">
            <div>
              <p className="eyebrow">Live schedule</p>
              <h2 id="calendar-title">{monthLabel(calendarMonth)}</h2>
            </div>
            <div className="calendar-toolbar">
              <div className="calendar-navigation" aria-label="Calendar navigation">
                <button aria-label="Previous month" type="button" onClick={() => setCalendarMonth(monthOffset(calendarMonth, -1))}>‹</button>
                <button type="button" onClick={() => setCalendarMonth(monthStart(localIsoDate()))}>Today</button>
                <button aria-label="Next month" type="button" onClick={() => setCalendarMonth(monthOffset(calendarMonth, 1))}>›</button>
              </div>
              <div className="legend" aria-label="Calendar legend">
                <span><i className="legend-workout" /> Workout</span>
                <span><i className="legend-recovery" /> Recovery</span>
              </div>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid">
            {calendarDates.map((date, index) => {
              if (!date) return <span className="day-cell calendar-spacer" aria-hidden="true" key={`spacer-${index}`} />;
              const day = Number(date.slice(-2));
              const sessionDay = calendarWorkouts.get(date);
              const isWorkout = Boolean(sessionDay);
              const log = sessionDay
                ? tracker.workouts[String(sessionDay)]
                : undefined;
              const isDone = Boolean(log?.completed);
              const isToday = date === localIsoDate();
              const beforeStart = Boolean(tracker.startDate && date < tracker.startDate);

              if (!isWorkout) {
                return (
                  <div className={`day-cell recovery-day ${isToday ? "is-today" : ""} ${beforeStart ? "is-before-start" : ""}`} key={date} aria-label={`${longDate(date)}, ${beforeStart ? "before plan start" : "recovery"}`}>
                    <span className="day-number">{day}</span>
                    <small>{isToday ? "Today" : beforeStart ? "—" : "Recovery"}</small>
                  </div>
                );
              }

              const id = workoutForDay(tracker, sessionDay!).id;
              const sessionIndex = sessionNumberForKey(tracker, sessionDay!);
              return (
                <button
                  className={`day-cell workout-day ${selectedDay === sessionDay ? "is-selected" : ""} ${isDone ? "is-done" : ""} ${isToday ? "is-today" : ""}`}
                  key={date}
                  type="button"
                  aria-pressed={selectedDay === sessionDay}
                  aria-label={`${longDate(date)}, session ${sessionIndex}, ${WORKOUTS[id].focus}${isDone ? ", completed" : ""}`}
                  onClick={() => chooseDay(sessionDay!)}
                >
                  <span className="day-number">{day}</span>
                  <span className="day-check" aria-hidden="true">{isDone ? "✓" : ""}</span>
                  <strong>{WORKOUTS[id].subtitle.split(" · ")[0]}</strong>
                  <small>{isToday ? "Today" : `Session ${sessionIndex}`}</small>
                </button>
              );
            })}
          </div>
        </section>

        <ProgressDashboard tracker={tracker} />

        <section className="workout-layout" id="workout-detail" aria-labelledby="workout-title">
          <article className="card workout-card">
            <div className="session-toolbar">
              <div><p className="eyebrow">Session {sessionNumber} · {activeLog.lowSleep ? "Short" : "Full"} workout</p><strong>{activeLog.completed ? "Session complete" : `${session.done} / ${session.total} sets logged`}</strong>{session.next && !activeLog.completed && <span className="session-next">Next: {session.next.name} · set {session.next.setIndex + 1}</span>}</div>
              <div className="session-tools">
                <button type="button" aria-pressed={focusMode} onClick={() => setFocusMode(value => !value)}>{focusMode ? "Exit focus" : "Focus view"}</button>
                {started && !activeLog.completed && session.next && <button type="button" onClick={jumpToNextSet}>Next set ↓</button>}
              </div>
              <progress aria-label="Working sets completed" max={session.total} value={session.done} />
              {(restRunning || restFinished) && <div className="session-rest"><span>{restFinished ? "Rest complete" : `Rest ${formatTimer(restSeconds)}`}</span>{restRunning && <><button type="button" onClick={() => restTimer.addTime(30)}>+30 sec</button><button type="button" onClick={() => restTimer.pause()}>Pause rest</button></>}</div>}
            </div>
            <div className="workout-header">
              <div>
                <p className="eyebrow">Session {sessionNumber}</p>
                <h2 id="workout-title">{workout.focus}</h2>
                <p>
                  {activeScheduledDate
                    ? longDate(activeScheduledDate)
                    : workout.subtitle}
                </p>
              </div>
              <div className="workout-meta">
                <span>Workout {workoutId}</span>
                <span>{isFourDaySession ? "45–60 min · allow extra time if needed" : "30–40 min"}</span>
                <span>{workout.subtitle}</span>
                <label className="load-unit-control">
                  <span>Load unit</span>
                  <select
                    aria-label="Load unit for this workout"
                    disabled={!editable || Object.values(activeLog.sets).flat().some((set) => set.done || set.load || set.reps || set.rir)}
                    value={activeLog.loadUnit}
                    onChange={(event) => updateWorkout(selectedDay, (log) => ({ ...log, loadUnit: event.target.value === "kg" ? "kg" : "lb" }))}
                  >
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </label>
              </div>
            </div>

            {activeLog.completed && <div className="session-notice"><span>This session is saved. Reopen it to make changes.</span><button className="secondary-button" disabled={!started || sync.conflict} type="button" onClick={reopenWorkout}>Edit completed session</button></div>}
            {sessionMessage && <p className="session-notice" role="status">{sessionMessage}</p>}

            {started && tracker.startDate && activeScheduledDate && (
              <div className="schedule-editor">
                <div>
                  <strong>Shift changed?</strong>
                  <span>{isFourDaySession ? "Move this and following sessions together. Upper and lower days may be adjacent." : "Move this session while keeping a full recovery day on both sides."}</span>
                </div>
                <div className="schedule-controls">
                  <button
                    aria-label="Move workout one day earlier"
                    disabled={!editable}
                    type="button"
                    onClick={() => rescheduleWorkout(isoDateOffset(activeScheduledDate, -1))}
                  >
                    −1 day
                  </button>
                  <label>
                    <span className="sr-only">Workout date</span>
                    <input
                      disabled={!editable}
                      min={tracker.startDate}
                      type="date"
                      value={activeScheduledDate}
                      onChange={(event) => rescheduleWorkout(event.target.value)}
                    />
                  </label>
                  <button
                    aria-label="Move workout one day later"
                    disabled={!editable}
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
                <span>Start your plan to check off your warm-up and log sets.</span>
              </div>
            )}

            <section className="readiness-panel" aria-labelledby="readiness-title">
              <div className="readiness-copy">
                <p className="eyebrow">60-second check-in</p>
                <h3 id="readiness-title">How ready are you today?</h3>
                <span>Optional planning prompts based on simple cutoffs, not a validated readiness score.</span>
              </div>
              <div className="readiness-fields">
                <label>
                  <span>Sleep</span>
                  <div><input disabled={!editable} inputMode="decimal" max="12" min="0" placeholder="—" type="number" value={activeLog.readiness.sleepHours} onChange={(event) => updateReadiness("sleepHours", event.target.value)} /><b>hours</b></div>
                </label>
                <label>
                  <span>Energy</span>
                  <select disabled={!editable} value={activeLog.readiness.energy} onChange={(event) => updateReadiness("energy", event.target.value)}>
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
                  <select disabled={!editable} value={activeLog.readiness.soreness} onChange={(event) => updateReadiness("soreness", event.target.value)}>
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
                      ? "Consider more recovery today"
                      : shouldUseShortMode
                        ? "Consider a shorter session"
                        : sleepHours || energy || soreness
                          ? "Full session looks reasonable"
                          : "Complete the check-in for a recommendation"}
                  </strong>
                  <span>
                    {shouldPostpone
                      ? "Recovery is the productive choice. Move this session to the next valid day above."
                      : shouldUseShortMode
                        ? "Use the first four exercises, up to two sets each, and about 3 reps in reserve."
                        : "Use the full plan if your warm-up feels normal and pain-free."}
                  </span>
                </div>
                {shouldUseShortMode && !activeLog.lowSleep && (
                  <button disabled={!editable} type="button" onClick={() => setLowSleep(true)}>Apply short mode</button>
                )}
              </div>
            </section>

            <section className="warmup-panel" aria-labelledby="warmup-title">
              <div className="warmup-topline">
                <div>
                  <p className="eyebrow warm">Before every session</p>
                  <h3 id="warmup-title">{isFourDaySession ? "Warm-up · allow 5–8 minutes" : "Warm-up · 5 minutes"}</h3>
                </div>
                <div className="timer" aria-label="Warm-up timer">
                  <strong>{formatTimer(warmupSeconds)}</strong>
                  <button
                    type="button"
                    disabled={!started || warmupSeconds === 0}
                    onClick={() => warmupRunning ? warmupTimer.pause() : warmupTimer.start()}
                  >
                    {warmupRunning ? "Pause" : warmupSeconds === 300 ? "Start timer" : "Resume"}
                  </button>
                  <button
                    type="button"
                    disabled={!started || warmupSeconds === 300}
                    onClick={() => warmupTimer.reset()}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="warmup-list">
                {warmupItems.map((item) => (
                  <label className="warmup-item" key={item.id}>
                    <input
                      type="checkbox"
                      checked={Boolean(activeLog.warmup[item.id])}
                      disabled={!editable}
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
                {(!isFourDaySession ? WARMUP_ITEMS : []).map((item) => {
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
                  Use the first four exercises with up to two sets each,
                  keeping about 3 reps in reserve. Keep normal rest periods.
                </span>
              </div>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={activeLog.lowSleep}
                  disabled={!editable}
                  onChange={toggleLowSleep}
                />
                <span aria-hidden="true" />
                <b>{activeLog.lowSleep ? "Short mode on" : "Full session"}</b>
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
                <span>It starts when you finish a set, using the exercise’s rest target. Add time when you need it.</span>
              </div>
              <div className="rest-timer-actions">
                <div className="rest-presets" aria-label="Rest duration">
                  {[90, 120, 180].map((duration) => (
                    <button
                      aria-pressed={restDuration === duration}
                      className={restDuration === duration ? "is-active" : ""}
                      key={duration}
                      type="button"
                      onClick={() => restTimer.reset(duration)}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
                <div>
                  <button
                    disabled={!editable}
                    type="button"
                    onClick={() => restRunning ? restTimer.pause() : restTimer.start()}
                  >
                    {restRunning ? "Pause" : "Start"}
                  </button>
                  <button
                    disabled={!started || (restSeconds === restDuration && !restRunning)}
                    type="button"
                    onClick={() => restTimer.reset()}
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
                      {isFourDaySession ? "Straight sets · complete each exercise in order" : "Alternate exercises · keep your rest periods"}
                    </small>
                  </div>

                  <div className="exercise-stack">
                    {pair.exercises.map((exercise, itemIndex) => {
                      const exerciseIndex = visiblePairs.slice(0, pairIndex).reduce((sum, group) => sum + group.exercises.length, 0) + itemIndex;
                      const prescription = exercisePrescriptionFor(workoutState, selectedDay, exercise.id, activeLog);
                      const setCount = prescription.sets;
                      const exerciseSets = activeLog.sets[exercise.id] ?? [];
                      const effectiveId =
                        activeLog.substitutions[exercise.id] ?? exercise.id;
                      const displayedExercise =
                        effectiveId === exercise.id ? exercise : EXERCISE_LIBRARY[effectiveId] ?? exercise;
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
                        activeLog.loadUnit,
                        prescription,
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
                                <strong>{prescription.reps} · {setCount} sets{!/sec/i.test(prescription.reps) && ` · about ${prescription.rir} RIR`}</strong>
                              </div>
                            </div>
                            <p>{displayedExercise.cue} Rest {prescription.restSeconds / 60} min between sets.</p>
                            {substitutionOptions.length > 0 ? (
                              <label className="substitution-control">
                                <span>Equipment occupied?</span>
                                <select
                                  aria-label={`Choose an alternative for ${exercise.name}`}
                                  disabled={!editable || hasLoggedSet}
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
                                      {set.load ? `${formatLoad(convertLoad(Number(set.load), previous.loadUnit, activeLog.loadUnit))} ${activeLog.loadUnit} · ` : ""}{set.reps} {/(sec)/i.test(displayedExercise.reps) ? "sec" : "reps"}{set.rir ? ` · ${set.rir} RIR` : ""}
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
                            <div className="set-log-help"><span>Enter { /sec/i.test(displayedExercise.reps) ? "seconds" : "reps" } before checking Done. Load is optional for bodyweight sets.</span>{previous && <button type="button" disabled={!editable} onClick={() => { updateWorkout(selectedDay, log => copyPreviousSets(tracker, selectedDay, log, exercise.id, setCount)); setSessionMessage(`Previous values added to empty rows for ${displayedExercise.name}. Log today’s effort before checking Done.`); }}>Use last values</button>}</div>
                            <div className="set-head" aria-hidden="true">
                              <span>Set</span><span>{activeLog.loadUnit}</span><span>{/sec/i.test(displayedExercise.reps) ? "Sec" : "Reps"}</span><span>RIR</span><span>Done</span>
                            </div>
                            {Array.from({ length: setCount }, (_, setIndex) => {
                              const set = exerciseSets[setIndex] ?? blankSet();
                              const label = `${displayedExercise.name}, set ${setIndex + 1}`;
                              return (
                                <div className={`set-row ${set.done ? "is-done" : ""}`} id={`set-${exercise.id}-${setIndex}`} key={setIndex}>
                                  <strong>{setIndex + 1}</strong>
                                  <label>
                                    <span className="sr-only">{label}, weight</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      maxLength={12}
                                      placeholder={activeLog.loadUnit}
                                      aria-invalid={Boolean(set.load && !validSet({ ...set, reps: "1" }))}
                                      value={set.load}
                                      disabled={!editable}
                                      onChange={(event) => updateSet(exercise.id, setIndex, { load: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    <span className="sr-only">{label}, repetitions or seconds</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={12}
                                      placeholder={/sec/i.test(displayedExercise.reps) ? "sec" : "reps"}
                                      aria-invalid={Boolean(set.reps && !validSet({ ...set, load: "" }))}
                                      value={set.reps}
                                      disabled={!editable}
                                      onChange={(event) => updateSet(exercise.id, setIndex, { reps: event.target.value })}
                                    />
                                  </label>
                                  <label>
                                    <span className="sr-only">{label}, repetitions in reserve</span>
                                    <select
                                      value={set.rir}
                                      disabled={!editable}
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
                                      disabled={!editable || (!set.done && !validSet(set))}
                                      onChange={() =>
                                        updateSet(
                                          exercise.id,
                                          setIndex,
                                          { done: !set.done },
                                          prescription.restSeconds,
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
                disabled={!editable}
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
                <span>{activeLog.completed ? "Your log is ready for the next session." : `${session.warmupDone} of ${WARMUP_ITEMS.length} warm-up steps · ${session.done} of ${session.total} working sets`}</span>
              </div>
              {activeLog.completed ? (
                <button className="secondary-button" disabled={!started || sync.conflict} type="button" onClick={reopenWorkout}>
                  Reopen workout
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={!started || !readyToComplete || sync.conflict}
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
                  After a short-sleep shift, consider a shorter session and
                  keep about three repetitions in reserve. Postpone if you feel
                  unwell or unusually exhausted.
                </p>
              </div>
            </article>

            <article className="card progression-card">
              <p className="eyebrow">Progression rule</p>
              <h2>Earn the next weight.</h2>
              <ol>
                <li>Reach the top of the rep range on every prescribed set.</li>
                <li>Keep clean technique and the prescribed reps in reserve.</li>
                <li>Repeat this in two comparable sessions, then try the smallest practical increase.</li>
              </ol>
              <p>
                {isFourDaySession ? "Volume stays at your chosen dose. Adjust future sets only when technique, performance, and recovery support it." : "Legacy sessions keep their original set counts. Your four-day transition preserves these records."}
              </p>
            </article>
          </aside>
        </section>

        <CoachPanel ready={progressLoaded} signedIn={Boolean(user)} tracker={tracker} />

        <ProgramIntelligence tracker={tracker} />

        <WellnessPanel
          onMetricChange={updateDailyMetric}
          onProfileChange={updateProfile}
          started={started}
          tracker={tracker}
        />

        <AppTools
          blockMessage={blockMessage}
          lastSyncedAt={lastSyncedAt}
          onReset={resetChallenge}
          onSyncCheck={() => controller.sync()}
          onRestore={restoreBackup}
          localOnly={sync.localOnly}
          canRestore={progressLoaded && Boolean(user) && !sync.conflict}
          restarting={restarting}
          started={started}
          syncStatus={syncStatus}
          syncVersion={syncVersion}
          tracker={tracker}
          user={user}
        />
      </div>

      <div className="sr-only" aria-live="polite">
        {completedCount} workouts completed all time. {completedThisMonth} of {monthSessionDays.length} completed in {monthLabel(calendarMonth)}. {syncLabel}
      </div>
    </main>
  );
}
