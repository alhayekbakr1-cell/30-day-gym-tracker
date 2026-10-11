import { canonicalExerciseId, EXERCISE_SUBSTITUTIONS } from './workout-data';
import type { TrackerState } from './tracker-types';
export const EQUIPMENT = {
  dumbbells: 'Paired dumbbells · 5–50 kg each', bench: 'Flat / incline bench', pulldown: 'Lat-pulldown station', lowCable: 'Low pulley / seated cable row', legPress: 'Leg press / calf raises', legCurl: 'Seated leg curl', legExtension: 'Leg extension', smith: 'Smith machine', pullup: 'Pull-up / assisted pull-up station', kettlebells: 'Kettlebells', chestPress: 'Chest-press machine', pecDeck: 'Pec-deck / reverse fly', rack: 'Barbell / power rack', ezBar: 'Fixed barbell / EZ bar and plates', bands: 'Resistance bands', highCable: 'High pulley for cable crunch',
} as const;
export type EquipmentId = keyof typeof EQUIPMENT;
export type EquipmentProfile = { modifiedAt: string; available: Record<EquipmentId, boolean>; loadsKg: Partial<Record<EquipmentId, number[]>>; notes: Partial<Record<EquipmentId, string>>; exerciseNotes: Record<string, string>; futureUpperBFlat: boolean };
const known = ['dumbbells','bench','pulldown','lowCable','legPress','legCurl','legExtension','smith','pullup','kettlebells'];
export function defaultEquipment(): EquipmentProfile { return { modifiedAt: new Date(0).toISOString(), available: Object.fromEntries(Object.keys(EQUIPMENT).map(id => [id, known.includes(id)])) as EquipmentProfile['available'], loadsKg: {}, notes: {}, exerciseNotes: {}, futureUpperBFlat: false }; }
export const REQUIREMENTS: Record<string, EquipmentId[]> = {
  'db-supinated-curl':['dumbbells'],'incline-db-curl':['dumbbells','bench'],'concentration-curl':['dumbbells','bench'],
  'lying-db-triceps':['dumbbells','bench'],'single-arm-overhead-triceps':['dumbbells'],
  'chest-supported-rear-delt-fly':['dumbbells','bench'],'standing-db-lateral-raise':['dumbbells'],'side-plank':[],'bird-dog':[],
  'flat-db-bench':['dumbbells','bench'],'incline-db-bench':['dumbbells','bench'],'machine-press':['chestPress'],'db-rdl':['dumbbells'],'db-hip-thrust':['dumbbells','bench'],'one-arm-row':['dumbbells','bench'],'seated-row':['lowCable'],'lat-pulldown':['pulldown'],'leg-press':['legPress'],'leg-curl':['legCurl'],'split-squat':['dumbbells','bench'],'lateral-raise-a':['dumbbells'],'hammer-curl':['dumbbells'],'triceps-extension':['dumbbells'],'calf-raise':['dumbbells'],'front-plank':[],'dead-bug':[],'cable-crunch':['highCable'],'assisted-pullup':['pullup'],'smith-squat':['smith'],'leg-extension':['legExtension'],'leg-press-calf':['legPress'],
};
export function requirements(id: string) { return REQUIREMENTS[canonicalExerciseId(id)] ?? null; }
export function availableExercise(id: string, profile: EquipmentProfile, blocked: EquipmentId[] = []) { const req = requirements(id); return req !== null && req.every(key => profile.available[key] && !blocked.includes(key)); }
const alternatives: Record<string,string[]> = { 'lat-pulldown':['assisted-pullup'], 'seated-row':['one-arm-row'], 'leg-press':['smith-squat','split-squat'], 'split-squat':['smith-squat','leg-press'], 'smith-squat':['split-squat','leg-press'], 'leg-extension':['split-squat','smith-squat'], 'calf-raise':['leg-press-calf'] };
export function equipmentAlternatives(id: string, profile: EquipmentProfile, busy = false) { const canonical = canonicalExerciseId(id); const blocked = busy ? requirements(id) ?? [] : []; return [...new Set([...(alternatives[canonical] ?? []), ...(EXERCISE_SUBSTITUTIONS[id] ?? [])])].filter(option => availableExercise(option, profile, blocked)); }
export const MOVEMENT_EMPHASIS: Record<string,string> = { 'flat-db-bench':'Horizontal dumbbell press; different loading from a machine', 'incline-db-bench':'Incline press; different pressing angle', 'one-arm-row':'Supported unilateral horizontal row', 'seated-row':'Cable horizontal row', 'lat-pulldown':'Vertical cable pull', 'assisted-pullup':'Vertical pull; choose assistance suitable for your ability (more assistance is easier)', 'smith-squat':'Guided compound squat; different movement from leg press', 'split-squat':'Unilateral compound movement; not knee-extension isolation', 'leg-press':'Supported compound press; different movement from a squat', 'leg-press-calf':'Calf raise using the leg press; distinct from standing dumbbell raises' };
export function loadOptions(id: string, profile: EquipmentProfile, unit: 'kg'|'lb') { const key = requirements(id)?.find(key => key !== 'bench'); return (key ? profile.loadsKg[key] ?? [] : []).map(kg => Number((unit === 'kg' ? kg : kg * 2.2046226218).toFixed(2))); }
export function loadConvention(id: string) { if (id === 'assisted-pullup') return 'Record assistance consistently; a larger assistance value makes the movement easier. No load-increase recommendation.'; if (requirements(id)?.includes('dumbbells')) return 'Rack weights are per dumbbell, available as pairs. For new paired lifts enter per hand; for one-dumbbell movements enter the single load. Older entries remain exactly as entered; do not compare if their convention differs.'; return 'Enter the displayed machine / equipment load consistently. Stack steps are unset until configured.'; }
export function equipmentProgression(id: string, profile: EquipmentProfile, unit: 'kg'|'lb', current: number|null) { const values = loadOptions(id,profile,unit); return current === null ? null : values.find(value => value > current) ?? null; }
export function cleanEquipment(value: unknown, exercises: Set<string>): EquipmentProfile|null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as EquipmentProfile;
  if (typeof raw.modifiedAt !== 'string' || !Number.isFinite(Date.parse(raw.modifiedAt)) || raw.modifiedAt.length > 40 || typeof raw.futureUpperBFlat !== 'boolean') return null;
  const record = (v: unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!record(raw.available) || !record(raw.loadsKg) || !record(raw.notes) || !record(raw.exerciseNotes)) return null;
  if (Object.keys(raw.available).length !== Object.keys(EQUIPMENT).length || Object.keys(raw.available).some(key => !Object.hasOwn(EQUIPMENT,key)) || Object.keys(EQUIPMENT).some(key => typeof raw.available[key as EquipmentId] !== 'boolean')) return null;
  const out = defaultEquipment(); out.modifiedAt = raw.modifiedAt; out.futureUpperBFlat = raw.futureUpperBFlat; out.available = {...raw.available};
  for (const [key, values] of Object.entries(raw.loadsKg)) { if (!Object.hasOwn(EQUIPMENT,key) || !Array.isArray(values) || values.length > 100 || values.some(v => typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 100000) || values.some((v,i) => i>0 && v <= values[i-1]) || (key === 'dumbbells' && values.some(v=>v<5 || v>50))) return null; out.loadsKg[key as EquipmentId] = [...values]; }
  for (const [key,note] of Object.entries(raw.notes)) { if (!Object.hasOwn(EQUIPMENT,key) || typeof note !== 'string' || note.length > 500) return null; out.notes[key as EquipmentId] = note; }
  if (Object.keys(raw.exerciseNotes).length > 100) return null;
  for (const [key,note] of Object.entries(raw.exerciseNotes)) { if (!exercises.has(key) || typeof note !== 'string' || note.length > 500) return null; out.exerciseNotes[key] = note; }
  return out;
}
export function latestIncomplete(state: TrackerState) { return Object.entries(state.workouts).filter(([,log])=>!log.completed).sort((a,b)=>Date.parse(b[1].modifiedAt)-Date.parse(a[1].modifiedAt))[0]?.[0] ?? null; }
