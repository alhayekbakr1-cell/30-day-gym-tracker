import type { TrackerState } from './tracker-types';
import { isIsoDate, isoDateOffset, localIsoDate } from './tracker-logic';
export const CARDIO_MODALITIES = { treadmill:'Treadmill walk', elliptical:'Elliptical', bike:'Stationary bike', stairs:'Stair climber' } as const;
export type CardioModality = keyof typeof CARDIO_MODALITIES;
export const TALK_TEST = 'Breathing is faster, but you can speak in sentences; singing would be difficult.';
export type CardioPlan = { enabled:boolean; startsOn:string; modifiedAt:string; preferred:CardioModality[]; available:CardioModality[]; sessionsPerWeek:number; minutesPerSession:number; effortCue:string };
export type CardioOpportunity = { id:string; week:string; plannedDate:string|null; modality:CardioModality; targetMinutes:number; effortCue:string; status:'planned'|'skipped'; modifiedAt:string };
export type CardioSession = { id:string; opportunityId:string|null; date:string; modality:CardioModality; minutes:number; effort:'easy'|'moderate'|'hard'|null; note:string; completedAt:string; modifiedAt:string };
export type CardioState = { plan:CardioPlan; opportunities:Record<string,CardioOpportunity>; sessions:Record<string,CardioSession> };
const now = () => new Date().toISOString();
export function cardioWeek(date:string) { const [y,m,d]=date.split('-').map(Number); const day=new Date(y,m-1,d,12).getDay();return isoDateOffset(date,-(day===0?6:day-1)); }
export function cardioOpportunityId(week:string,index:number) { return `walk-${week}-${index}`; }
function newOpportunities(plan:CardioPlan,week:string):CardioOpportunity[] { return Array.from({length:plan.sessionsPerWeek},(_,i)=>({id:cardioOpportunityId(week,i+1),week,plannedDate:null,modality:plan.preferred[0],targetMinutes:plan.minutesPerSession,effortCue:plan.effortCue,status:'planned',modifiedAt:plan.modifiedAt})); }
export function enableCardio(state:TrackerState,date=localIsoDate(),timestamp=now()):TrackerState {
 if(state.cardio) return {...state,cardio:{...state.cardio,plan:{...state.cardio.plan,enabled:true,modifiedAt:timestamp}}};
 const plan:CardioPlan={enabled:true,startsOn:date,modifiedAt:timestamp,preferred:['treadmill'],available:['treadmill','elliptical','bike','stairs'],sessionsPerWeek:3,minutesPerSession:20,effortCue:TALK_TEST};
 return {...state,cardio:{plan,opportunities:Object.fromEntries(newOpportunities(plan,cardioWeek(date)).map(row=>[row.id,row])),sessions:{}}};
}
/** Only this/future weeks generate flexible opportunities; no invented historical activity. */
export function cardioOpportunities(cardio:CardioState,week:string,today=localIsoDate()) {
 const rows=new Map(Object.values(cardio.opportunities).filter(row=>row.week===week).map(row=>[row.id,row]));
 if(!rows.size && cardio.plan.enabled && week>=cardioWeek(today) && isoDateOffset(week,6)>=cardio.plan.startsOn) for(const row of newOpportunities(cardio.plan,week)) if(!rows.has(row.id)) rows.set(row.id,row);
 return [...rows.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
function weekSnapshot(cardio:CardioState,week:string) { if(Object.values(cardio.opportunities).some(row=>row.week===week))return cardio.opportunities; return {...Object.fromEntries(newOpportunities(cardio.plan,week).map(row=>[row.id,row])),...cardio.opportunities}; }
export function cardioSessionFor(cardio:CardioState,id:string) {return Object.values(cardio.sessions).find(session=>session.opportunityId===id)??null;}
export function cardioStatus(cardio:CardioState,row:CardioOpportunity,today=localIsoDate()) { if(cardioSessionFor(cardio,row.id))return 'completed';if(row.status==='skipped')return 'skipped';if(!cardio.plan.enabled)return 'paused';return row.plannedDate && row.plannedDate<today?'overdue':'planned'; }
export function setCardioOpportunity(state:TrackerState,row:CardioOpportunity,patch:Partial<Pick<CardioOpportunity,'plannedDate'|'modality'|'status'>>,timestamp=now()) {
 if(!state.cardio)throw Error('Enable a cardio plan first.');
 if(cardioSessionFor(state.cardio,row.id))throw Error('This visit is completed. Edit its actual log instead.');
 const next={...(state.cardio.opportunities[row.id]??row),...patch,modifiedAt:timestamp};
 if(next.plannedDate!==null && (!isIsoDate(next.plannedDate)||next.plannedDate<state.cardio.plan.startsOn))throw Error('Choose a valid date on or after the cardio start date.');
 if(patch.modality && !state.cardio.plan.available.includes(next.modality))throw Error('Choose available cardio equipment.');
 return {...state,cardio:{...state.cardio,opportunities:{...weekSnapshot(state.cardio,row.week),[row.id]:next}}};
}
export function logCardio(state:TrackerState,row:CardioOpportunity,input:Pick<CardioSession,'date'|'modality'|'minutes'|'effort'|'note'>,timestamp=now()):TrackerState {
 if(!state.cardio)throw Error('Enable cardio first.');
 if(cardioSessionFor(state.cardio,row.id))return state; // deterministic identity also survives reload / double taps
 if(!state.cardio.plan.enabled)throw Error('Resume your plan before logging a planned visit.');
 if(!validSessionInput(input) || !state.cardio.plan.available.includes(input.modality))throw Error('Enter a valid local date, available machine and positive duration up to 600 minutes.');
 const id=`done-${row.id}`; const session:CardioSession={...input,id,opportunityId:row.id,completedAt:timestamp,modifiedAt:timestamp};
 return {...state,cardio:{...state.cardio,opportunities:{...weekSnapshot(state.cardio,row.week),[row.id]:state.cardio.opportunities[row.id]??row},sessions:{...state.cardio.sessions,[id]:session}}};
}
export function logExtraCardio(state:TrackerState,id:string,input:Pick<CardioSession,'date'|'modality'|'minutes'|'effort'|'note'>,timestamp=now()):TrackerState {
 if(!state.cardio || !state.cardio.plan.enabled)throw Error('Enable or resume cardio first.');
 if(state.cardio.sessions[id])return state;
 if(!/^extra-[a-zA-Z0-9_-]{1,80}$/.test(id)||!validSessionInput(input)||!state.cardio.plan.available.includes(input.modality))throw Error('Enter valid cardio details.');
 return {...state,cardio:{...state.cardio,sessions:{...state.cardio.sessions,[id]:{...input,id,opportunityId:null,completedAt:timestamp,modifiedAt:timestamp}}}};
}
function validSessionInput(input:Pick<CardioSession,'date'|'modality'|'minutes'|'effort'|'note'>) {return isIsoDate(input.date)&&Object.hasOwn(CARDIO_MODALITIES,input.modality)&&typeof input.minutes==='number'&&Number.isFinite(input.minutes)&&input.minutes>0&&input.minutes<=600&&[null,'easy','moderate','hard'].includes(input.effort)&&typeof input.note==='string'&&input.note.length<=500;}
export function editCardioSession(state:TrackerState,id:string,input:Pick<CardioSession,'date'|'modality'|'minutes'|'effort'|'note'>,timestamp=now()):TrackerState {
 if(!state.cardio?.sessions[id]||!validSessionInput(input))throw Error('Enter valid cardio details.');
 return {...state,cardio:{...state.cardio,sessions:{...state.cardio.sessions,[id]:{...state.cardio.sessions[id],...input,modifiedAt:timestamp}}}};
}
export function editCardioPlan(state:TrackerState,patch:Partial<Pick<CardioPlan,'enabled'|'preferred'|'available'|'sessionsPerWeek'|'minutesPerSession'>>,timestamp=now()):TrackerState {
 if(!state.cardio)throw Error('Enable cardio first.');
 const plan={...state.cardio.plan,...patch,modifiedAt:timestamp};
 if(!validPlan(plan))throw Error('Choose 1–7 visits, 1–180 minutes, and at least one available preferred machine.');
 return {...state,cardio:{...state.cardio,plan}};
}
export function cardioSummary(cardio:CardioState|null,date=localIsoDate(),today=localIsoDate()) {
 const week=cardioWeek(date),end=isoDateOffset(week,6);
 const own=cardio?cardioOpportunities(cardio,week,today):[];
 const incoming=cardio?Object.values(cardio.opportunities).filter(row=>row.week!==week&&row.plannedDate&&row.plannedDate>=week&&row.plannedDate<=end):[];
 const rows=[...own.filter(row=>!row.plannedDate||(row.plannedDate>=week&&row.plannedDate<=end)),...incoming];
 const sessions=cardio?Object.values(cardio.sessions).filter(row=>row.date>=week&&row.date<=end):[];
 return {week,end,planned:rows.length,plannedMinutes:rows.reduce((sum,row)=>sum+row.targetMinutes,0),completed:sessions.length,minutes:Number(sessions.reduce((sum,row)=>sum+row.minutes,0).toFixed(2)),skipped:rows.filter(row=>row.status==='skipped'&&!cardioSessionFor(cardio!,row.id)).length};
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const timestamp=(v:unknown):v is string=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
function modalities(v:unknown):v is CardioModality[] {return Array.isArray(v)&&v.length>0&&v.length<=4&&new Set(v).size===v.length&&v.every(id=>typeof id==='string'&&Object.hasOwn(CARDIO_MODALITIES,id));}
function validPlan(plan:CardioPlan) {return typeof plan.enabled==='boolean'&&isIsoDate(plan.startsOn)&&timestamp(plan.modifiedAt)&&modalities(plan.available)&&modalities(plan.preferred)&&plan.preferred.every(id=>plan.available.includes(id))&&Number.isInteger(plan.sessionsPerWeek)&&plan.sessionsPerWeek>=1&&plan.sessionsPerWeek<=7&&Number.isInteger(plan.minutesPerSession)&&plan.minutesPerSession>=1&&plan.minutesPerSession<=180&&typeof plan.effortCue==='string'&&plan.effortCue.length<=200;}
const exactKeys=(value:object,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export function cleanCardio(value:unknown):CardioState|null {
 if(!record(value)||!exactKeys(value,['plan','opportunities','sessions'])||!record(value.plan)||!record(value.opportunities)||!record(value.sessions))return null;
 const plan=value.plan as CardioPlan;
 if(!exactKeys(plan,['enabled','startsOn','modifiedAt','preferred','available','sessionsPerWeek','minutesPerSession','effortCue'])||!validPlan(plan)||Object.keys(value.opportunities).length>5000||Object.keys(value.sessions).length>5000)return null;
 const opportunities:CardioState['opportunities']={},sessions:CardioState['sessions']={};
 for(const [key,raw]of Object.entries(value.opportunities)){
  if(!record(raw)||!exactKeys(raw,['id','week','plannedDate','modality','targetMinutes','effortCue','status','modifiedAt']))return null;
  const row=raw as CardioOpportunity;const index=Number(key.slice(-1));
  if(row.id!==key||!isIsoDate(row.week)||cardioWeek(row.week)!==row.week||!Number.isInteger(index)||index<1||index>7||key!==cardioOpportunityId(row.week,index)||isoDateOffset(row.week,6)<plan.startsOn||!(row.plannedDate===null||(isIsoDate(row.plannedDate)&&row.plannedDate>=plan.startsOn))||!Object.hasOwn(CARDIO_MODALITIES,row.modality)||!Number.isInteger(row.targetMinutes)||row.targetMinutes<1||row.targetMinutes>180||!['planned','skipped'].includes(row.status)||typeof row.effortCue!=='string'||row.effortCue.length>200||!timestamp(row.modifiedAt))return null;
  opportunities[key]={...row};
 }
 const associations=new Set<string>();
 for(const [key,raw]of Object.entries(value.sessions)){
  if(!record(raw)||!exactKeys(raw,['id','opportunityId','date','modality','minutes','effort','note','completedAt','modifiedAt']))return null;
  const row=raw as CardioSession;
  if(row.id!==key||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(key)||!validSessionInput(row)||!timestamp(row.completedAt)||!timestamp(row.modifiedAt))return null;
  if(row.opportunityId!==null){if(typeof row.opportunityId!=='string'||!Object.hasOwn(opportunities,row.opportunityId)||associations.has(row.opportunityId)||key!==`done-${row.opportunityId}`)return null;associations.add(row.opportunityId);}
  sessions[key]={...row};
 }
 return {plan:{...plan,available:[...plan.available],preferred:[...plan.preferred]},opportunities,sessions};
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Same-record conflicts stop sync; independent sessions/opportunities merge without field mixing. */
export function cardioConflict(remote:CardioState|null,local:CardioState|null,base:CardioState|null) {
 if(same(remote,local)||same(remote,base)||same(local,base))return false;
 if(!remote||!local)return true;
 if(!same(remote.plan,local.plan)&&!same(remote.plan,base?.plan)&&!same(local.plan,base?.plan))return true;
 const bundle=(cardio:CardioState|null,id:string)=>cardio?{opportunity:cardio.opportunities[id],session:cardioSessionFor(cardio,id)}:undefined;
 for(const id of new Set([...Object.keys(remote.opportunities),...Object.keys(local.opportunities)])){
  const r=bundle(remote,id),l=bundle(local,id),b=bundle(base,id);
  if(!same(r,l)&&!same(r,b)&&!same(l,b))return true;
 }
 for(const field of ['opportunities','sessions']as const)for(const key of new Set([...Object.keys(remote[field]),...Object.keys(local[field])])){
  const r=remote[field][key],l=local[field][key],b=base?.[field][key];
  if(r&&l&&!same(r,l)&&!same(r,b)&&!same(l,b))return true;
  if(b&&(!r||!l)&&!same(r,l)&&!same(r,b)&&!same(l,b))return true;
 }
 return false;
}
export function mergeCardio(remote:CardioState|null,local:CardioState|null,base:CardioState|null):CardioState|null {
 if(same(local,base))return remote;if(same(remote,base))return local;if(!remote)return local;if(!local)return remote;
 const mergeRecords=<T extends {modifiedAt:string}>(r:Record<string,T>,l:Record<string,T>,b:Record<string,T>={})=>Object.fromEntries([...new Set([...Object.keys(r),...Object.keys(l)])].map(key=>[key,!r[key]?l[key]:!l[key]?r[key]:same(l[key],b[key])?r[key]:same(r[key],b[key])?l[key]:Date.parse(l[key].modifiedAt)>Date.parse(r[key].modifiedAt)?l[key]:r[key]]));
 return {plan:same(local.plan,base?.plan)?remote.plan:same(remote.plan,base?.plan)?local.plan:Date.parse(local.plan.modifiedAt)>Date.parse(remote.plan.modifiedAt)?local.plan:remote.plan,opportunities:mergeRecords(remote.opportunities,local.opportunities,base?.opportunities),sessions:mergeRecords(remote.sessions,local.sessions,base?.sessions)};
}
