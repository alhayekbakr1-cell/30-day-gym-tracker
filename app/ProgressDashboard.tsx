import { cardioSummary } from "./cardio-logic";
import { isSessionKey, sessionNumberForKey } from "./tracker-logic";
import type { TrackerState } from "./tracker-types";
import {
  convertLoad,
  effectiveExerciseId,
  isoDateOffset,
  localIsoDate,
  scheduledDaysInRange,
  workoutVolume,
} from "./tracker-logic";
import { canonicalExerciseId } from "./workout-data";
import { weeklyMuscleBalance } from "./training-insights";

function numberValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1_000 ? 0 : 1,
    notation: value >= 100_000 ? "compact" : "standard",
  }).format(value);
}

function compactDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    .format(new Date(year, month - 1, day, 12));
}

function Sparkline({
  label,
  points,
}: {
  label: string;
  points: number[];
}) {
  if (points.length < 2) {
    return <div className="chart-empty">Log at least two entries to see the trend.</div>;
  }
  const minimum = Math.min(...points);
  const maximum = Math.max(...points);
  const spread = maximum - minimum || 1;
  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 42 - ((point - minimum) / spread) * 34;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      aria-label={label}
      className="sparkline"
      preserveAspectRatio="none"
      role="img"
      viewBox="0 0 100 48"
    >
      <polyline fill="none" points={coordinates} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function ProgressDashboard({ tracker }: { tracker: TrackerState }) {
  const workoutDays = Object.keys(tracker.workouts).map(Number).filter(day => isSessionKey(tracker, day)).sort((a, b) => a - b);
  const completed = workoutDays.filter((day) => tracker.workouts[String(day)]?.completed);
  const today = localIsoDate();
  const cardio = cardioSummary(tracker.cardio,today);
  const due = tracker.startDate
    ? scheduledDaysInRange(tracker, isoDateOffset(today, -29), today)
    : [];
  const completedDue = due.filter(
    (day) => tracker.workouts[String(day)]?.completed,
  ).length;
  const consistency = due.length
    ? Math.round((completedDue / due.length) * 100)
    : 0;
  const volumeDays = completed.slice(-12);
  const volumes = volumeDays.map((day) =>
    workoutVolume(tracker.workouts[String(day)], tracker.profile.loadUnit),
  );
  const totalVolume = completed.reduce((sum, day) => sum + workoutVolume(tracker.workouts[String(day)], tracker.profile.loadUnit), 0);
  const recentVolume = volumes.reduce((sum, value) => sum + value, 0);
  const maxVolume = Math.max(...volumes, 1);

  const loadHistory = new Map<string, number[]>();
  for (const day of completed) {
    const log = tracker.workouts[String(day)];
    if (!log?.completed) continue;
    for (const [slotId, sets] of Object.entries(log.sets)) {
      const effectiveId = effectiveExerciseId(log, slotId);
      const best = Math.max(
        ...sets
          .filter((set) => set.done)
          .map((set) => {
            const load = numberValue(set.load);
            return load === null ? 0 : convertLoad(load, log.loadUnit, tracker.profile.loadUnit);
          }),
      );
      if (best > 0) {
        const canonicalId = canonicalExerciseId(effectiveId);
        loadHistory.set(canonicalId, [...(loadHistory.get(canonicalId) ?? []), best]);
      }
    }
  }
  const bestGain = [...loadHistory.entries()]
    .map(([id, values]) => ({ gain: values.at(-1)! - values[0], id }))
    .sort((first, second) => second.gain - first.gain)[0];

  const metrics = Object.entries(tracker.dailyMetrics)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, metric]) => metric);
  const weightPoints = metrics
    .map((metric) => {
      const weight = numberValue(metric.weight);
      return weight === null ? null : convertLoad(weight, metric.weightUnit ?? tracker.profile.weightUnit, tracker.profile.weightUnit);
    })
    .filter((value): value is number => value !== null);
  const recentMetrics = metrics.slice(-7);
  const proteinValues = recentMetrics
    .map((metric) => numberValue(metric.protein))
    .filter((value): value is number => value !== null);
  const stepValues = recentMetrics
    .map((metric) => numberValue(metric.steps))
    .filter((value): value is number => value !== null);
  const averageProtein = proteinValues.length
    ? proteinValues.reduce((sum, value) => sum + value, 0) / proteinValues.length
    : 0;
  const averageSteps = stepValues.length
    ? stepValues.reduce((sum, value) => sum + value, 0) / stepValues.length
    : 0;
  const muscleBalance = weeklyMuscleBalance(tracker, today);

  return (
    <section className="card dashboard-card" id="progress-dashboard" aria-labelledby="progress-title">
      {tracker.cardio && <p className="cardio-dashboard"><strong>Logged cardio · week {cardio.week} – {cardio.end}</strong><br/>{cardio.completed} recorded sessions · {cardio.minutes} actual minutes · {cardio.planned} planned/flexible visits · {cardio.plannedMinutes} target minutes. Only app-recorded cardio; separate from strength volume.{!Object.keys(tracker.cardio.sessions).length && " No cardio history yet."}</p>}
      <div className="section-heading dashboard-heading">
        <div>
          <p className="eyebrow">Your trends</p>
          <h2 id="progress-title">Progress dashboard</h2>
        </div>
        <span className="dashboard-range">Rolling 30 days + lifetime totals</span>
      </div>

      <div className="metric-grid">
        <article>
          <span>Sessions</span>
          <strong>{completed.length}</strong>
          <small>completed all time</small>
        </article>
        <article>
          <span>Consistency</span>
          <strong>{consistency}%</strong>
          <small>of sessions due</small>
        </article>
        <article>
          <span>Training volume</span>
          <strong>{compactNumber(totalVolume)}</strong>
          <small>logged {tracker.profile.loadUnit} · reps</small>
        </article>
        <article>
          <span>Best load gain</span>
          <strong>{bestGain?.gain > 0 ? `+${compactNumber(bestGain.gain)}` : "—"}</strong>
          <small>{bestGain?.gain > 0 ? "on one movement" : "keep logging"}</small>
        </article>
      </div>

      <section className="muscle-dashboard" aria-labelledby="muscle-dashboard-title">
        <div className="muscle-dashboard-heading">
          <div>
            <strong id="muscle-dashboard-title">Muscle groups this week</strong>
            <span>Direct working sets versus the scheduled dose. Compound contributions overlap; they are not added as full extra sets.</span>
          </div>
          <small>{compactDate(muscleBalance.weekStart)}–{compactDate(muscleBalance.weekEnd)}</small>
        </div>
        <div className="muscle-dashboard-grid">
          {muscleBalance.items.map((item) => (
            <article key={item.group}>
              <div>
                <strong>{item.group}</strong>
                <span>{item.completed}/{item.target || "—"} sets</span>
              </div>
              <i aria-hidden="true"><b style={{ width: `${item.percent}%` }} /></i>
              <small>{item.target ? `${item.percent}% complete` : "No direct sets scheduled"}</small>
            </article>
          ))}
        </div>
      </section>

      <div className="analytics-grid">
        <article className="volume-chart-card">
          <div className="chart-title">
            <div>
              <strong>Session volume</strong>
              <span>Load × completed reps</span>
            </div>
            <small>{compactNumber(recentVolume)} recent</small>
          </div>
          <div className="volume-bars" aria-label="Training volume by workout">
            {volumes.map((volume, index) => (
              <div className="volume-bar-column" key={volumeDays[index]}>
                <span
                  aria-label={`Session ${index + 1}: ${compactNumber(volume)} volume`}
                  style={{ height: `${Math.max((volume / maxVolume) * 100, volume ? 8 : 2)}%` }}
                  title={`${compactNumber(volume)} ${tracker.profile.loadUnit} · reps`}
                />
                <small>{sessionNumberForKey(tracker, volumeDays[index])}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="body-trend-card">
          <div className="chart-title">
            <div>
              <strong>Body-weight trend</strong>
              <span>{tracker.profile.weightUnit}</span>
            </div>
            {weightPoints.length > 1 && (
              <small>
                {weightPoints[0]} → {weightPoints.at(-1)}
              </small>
            )}
          </div>
          <Sparkline label="Body-weight trend" points={weightPoints} />
          <div className="wellness-averages">
            <span><strong>{averageProtein ? Math.round(averageProtein) : "—"}</strong> g avg protein</span>
            <span><strong>{averageSteps ? compactNumber(averageSteps) : "—"}</strong> avg steps</span>
          </div>
        </article>
      </div>
    </section>
  );
}
