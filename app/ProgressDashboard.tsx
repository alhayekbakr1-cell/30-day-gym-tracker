import type { TrackerState } from "./tracker-types";
import {
  effectiveExerciseId,
  localIsoDate,
  scheduledDate,
  workoutVolume,
} from "./tracker-logic";
import { SCHEDULED_DAYS } from "./workout-data";

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1_000 ? 0 : 1,
    notation: value >= 100_000 ? "compact" : "standard",
  }).format(value);
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
  const completed = SCHEDULED_DAYS.filter(
    (day) => tracker.workouts[String(day)]?.completed,
  );
  const today = localIsoDate();
  const due = tracker.startDate
    ? SCHEDULED_DAYS.filter((day) => {
        const date = scheduledDate(tracker, day);
        return date ? date <= today : false;
      })
    : [];
  const completedDue = due.filter(
    (day) => tracker.workouts[String(day)]?.completed,
  ).length;
  const consistency = due.length
    ? Math.round((completedDue / due.length) * 100)
    : 0;
  const volumes = SCHEDULED_DAYS.map((day) =>
    workoutVolume(tracker.workouts[String(day)]),
  );
  const totalVolume = volumes.reduce((sum, value) => sum + value, 0);
  const maxVolume = Math.max(...volumes, 1);

  const loadHistory = new Map<string, number[]>();
  for (const day of SCHEDULED_DAYS) {
    const log = tracker.workouts[String(day)];
    if (!log) continue;
    for (const [slotId, sets] of Object.entries(log.sets)) {
      const effectiveId = effectiveExerciseId(log, slotId);
      const best = Math.max(
        ...sets
          .filter((set) => set.done)
          .map((set) => numberValue(set.load) ?? 0),
      );
      if (best > 0) {
        loadHistory.set(effectiveId, [...(loadHistory.get(effectiveId) ?? []), best]);
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
    .map((metric) => numberValue(metric.weight))
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

  return (
    <section className="card dashboard-card" id="progress" aria-labelledby="progress-title">
      <div className="section-heading dashboard-heading">
        <div>
          <p className="eyebrow">Your trends</p>
          <h2 id="progress-title">Progress dashboard</h2>
        </div>
        <span className="dashboard-range">Current 30-day challenge</span>
      </div>

      <div className="metric-grid">
        <article>
          <span>Sessions</span>
          <strong>{completed.length}/{SCHEDULED_DAYS.length}</strong>
          <small>completed</small>
        </article>
        <article>
          <span>Consistency</span>
          <strong>{consistency}%</strong>
          <small>of sessions due</small>
        </article>
        <article>
          <span>Training volume</span>
          <strong>{compactNumber(totalVolume)}</strong>
          <small>logged lb × reps</small>
        </article>
        <article>
          <span>Best load gain</span>
          <strong>{bestGain?.gain > 0 ? `+${compactNumber(bestGain.gain)}` : "—"}</strong>
          <small>{bestGain?.gain > 0 ? "on one movement" : "keep logging"}</small>
        </article>
      </div>

      <div className="analytics-grid">
        <article className="volume-chart-card">
          <div className="chart-title">
            <div>
              <strong>Session volume</strong>
              <span>Load × completed reps</span>
            </div>
            <small>{compactNumber(totalVolume)} total</small>
          </div>
          <div className="volume-bars" aria-label="Training volume by workout">
            {volumes.map((volume, index) => (
              <div className="volume-bar-column" key={SCHEDULED_DAYS[index]}>
                <span
                  aria-label={`Session ${index + 1}: ${compactNumber(volume)} volume`}
                  style={{ height: `${Math.max((volume / maxVolume) * 100, volume ? 8 : 2)}%` }}
                  title={`${compactNumber(volume)} lb × reps`}
                />
                <small>{index + 1}</small>
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
