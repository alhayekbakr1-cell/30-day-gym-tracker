"use client";

import { useMemo, useState } from "react";
import type { DailyMetric, ProfileSettings, TrackerState } from "./tracker-types";
import { blankMetric, localIsoDate } from "./tracker-logic";

type WellnessPanelProps = {
  onMetricChange: (date: string, patch: Partial<DailyMetric>) => void;
  onProfileChange: (patch: Partial<ProfileSettings>) => void;
  started: boolean;
  tracker: TrackerState;
};

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function WellnessPanel({
  onMetricChange,
  onProfileChange,
  started,
  tracker,
}: WellnessPanelProps) {
  const [metricDate, setMetricDate] = useState(localIsoDate());
  const metric = { ...blankMetric(), ...tracker.dailyMetrics[metricDate] };
  const metricWeightUnit = metric.weightUnit ?? tracker.profile.weightUnit;
  const suggestedProtein = useMemo(() => {
    const currentWeight = numberValue(metric.weight);
    if (!currentWeight) return null;
    const kilograms =
      metricWeightUnit === "kg" ? currentWeight : currentWeight / 2.20462;
    return Math.round((kilograms * 1.6) / 5) * 5;
  }, [metric.weight, metricWeightUnit]);
  const proteinGoal = numberValue(tracker.profile.proteinGoal);
  const stepGoal = numberValue(tracker.profile.stepGoal);
  const protein = numberValue(metric.protein);
  const steps = numberValue(metric.steps);

  return (
    <section className="card wellness-card" id="wellness" aria-labelledby="wellness-title">
      <div className="section-heading wellness-heading">
        <div>
          <p className="eyebrow">Muscle + health support</p>
          <h2 id="wellness-title">Daily recovery & nutrition</h2>
        </div>
        <label className="date-field compact-date">
          <span>Log date</span>
          <input
            type="date"
            value={metricDate}
            onChange={(event) => setMetricDate(event.target.value)}
          />
        </label>
      </div>

      {!started && (
        <div className="start-notice compact-notice">
          <strong>Start first</strong>
          <span>Your daily health logs will sync with your training plan.</span>
        </div>
      )}

      <div className="daily-log-grid">
        <label>
          <span>Protein</span>
          <div><input disabled={!started} inputMode="decimal" placeholder="0" value={metric.protein} onChange={(event) => onMetricChange(metricDate, { protein: event.target.value })} /><b>g</b></div>
          <small>{proteinGoal && protein ? `${Math.min(Math.round((protein / proteinGoal) * 100), 999)}% of goal` : "Daily total"}</small>
        </label>
        <label>
          <span>Steps</span>
          <div><input disabled={!started} inputMode="numeric" placeholder="0" value={metric.steps} onChange={(event) => onMetricChange(metricDate, { steps: event.target.value })} /><b>steps</b></div>
          <small>{stepGoal && steps ? `${Math.min(Math.round((steps / stepGoal) * 100), 999)}% of goal` : "All-day total"}</small>
        </label>
        <label>
          <span>Body weight</span>
          <div><input disabled={!started} inputMode="decimal" placeholder="—" value={metric.weight} onChange={(event) => onMetricChange(metricDate, { weight: event.target.value, weightUnit: metricWeightUnit })} /><b>{metricWeightUnit}</b></div>
          <small>Use similar conditions</small>
        </label>
        <label>
          <span>Waist</span>
          <div><input disabled={!started} inputMode="decimal" placeholder="—" value={metric.waist} onChange={(event) => onMetricChange(metricDate, { waist: event.target.value, weightUnit: metricWeightUnit })} /><b>{metricWeightUnit === "kg" ? "cm" : "in"}</b></div>
          <small>Optional</small>
        </label>
        <label>
          <span>Sleep</span>
          <div><input disabled={!started} inputMode="decimal" placeholder="—" value={metric.sleepHours} onChange={(event) => onMetricChange(metricDate, { sleepHours: event.target.value })} /><b>hours</b></div>
          <small>Previous night</small>
        </label>
      </div>

      <details className="goal-settings">
        <summary>
          <span><strong>Personal goals</strong><small>Protein, steps, and units</small></span>
          <b>Adjust</b>
        </summary>
        <div className="goal-settings-body">
          <label>
            <span>Weight unit</span>
            <select disabled={!started} value={tracker.profile.weightUnit} onChange={(event) => onProfileChange({ weightUnit: event.target.value === "kg" ? "kg" : "lb" })}>
              <option value="lb">Pounds (lb)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </label>
          <label>
            <span>Default lifting unit</span>
            <select disabled={!started} value={tracker.profile.loadUnit} onChange={(event) => onProfileChange({ loadUnit: event.target.value === "kg" ? "kg" : "lb" })}>
              <option value="lb">Pounds (lb)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </label>
          <label>
            <span>Protein goal</span>
            <div><input disabled={!started} inputMode="numeric" placeholder="Set goal" value={tracker.profile.proteinGoal} onChange={(event) => onProfileChange({ proteinGoal: event.target.value })} /><b>g/day</b></div>
          </label>
          <label>
            <span>Step goal</span>
            <div><input disabled={!started} inputMode="numeric" value={tracker.profile.stepGoal} onChange={(event) => onProfileChange({ stepGoal: event.target.value })} /><b>/day</b></div>
          </label>
          <div className="protein-suggestion">
            <div>
              <strong>{suggestedProtein ? `${suggestedProtein} g starting target` : "Enter today's weight for a suggestion"}</strong>
              <span>Uses 1.6 g/kg as an editable starting point for healthy adults doing resistance training.</span>
            </div>
            {suggestedProtein && (
              <button className="secondary-button" disabled={!started} type="button" onClick={() => onProfileChange({ proteinGoal: String(suggestedProtein) })}>
                Use suggestion
              </button>
            )}
            <a href="https://pubmed.ncbi.nlm.nih.gov/28698222/" rel="noreferrer" target="_blank">Evidence note ↗</a>
          </div>
        </div>
      </details>

      <p className="wellness-disclaimer">
        General tracking only—not a prescription. If you have kidney disease or another condition affecting diet or exercise, use targets from your clinician.
      </p>
    </section>
  );
}
