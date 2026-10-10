import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { require, state, edit } from './fixtures.mjs';
const c=require('../.test-build/app/cardio-logic.js');
const logic=require('../.test-build/app/tracker-logic.js');
const sessions=require('../.test-build/app/session-logic.js');
const {sanitizeTrackerState}=require('../.test-build/lib/tracker-validation.js');
const {parseBackup,serializeBackup,cardioCsvRows,csvCell}=require('../.test-build/app/backup-logic.js');
const {TrackerSync}=require('../.test-build/lib/tracker-sync.js');
const {coachingCardio}=require('../.test-build/lib/gemini-coach.js');
const date='2026-10-10',stamp='2026-10-10T12:00:00Z';
const enabled=()=>c.enableCardio(state(),date,stamp);
const rows=value=>c.cardioOpportunities(value.cardio,c.cardioWeek(date),date);
const input=(patch={})=>({date,modality:'treadmill',minutes:12,effort:null,note:'',...patch});
function disk(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};}
function setup(t,base=enabled(),storage=disk()){
 let remote={state:base,version:1,updatedAt:1},writes=[];
 const api={read:async()=>structuredClone(remote),write:async(value,version)=>{writes.push(structuredClone(value));remote={state:sanitizeTrackerState(value),version:version+1,updatedAt:2};return {conflict:false,progress:structuredClone(remote)};}};
 const controller=new TrackerSync('cardio-account',()=>storage,api);controller.hydrate();t.after(()=>controller.dispose());return {controller,api,storage,writes,setRemote:value=>remote=value,remote:()=>remote};
}
test('explicit cardio opt-in gives 3 flexible treadmill walks, no existing account enrollment or strength mutation',()=>{
 const original=state(),before=JSON.stringify(original);assert.equal(original.cardio,null);const value=c.enableCardio(original,date,stamp);
 assert.equal(JSON.stringify(original),before);assert.equal(value.cardio.plan.sessionsPerWeek,3);assert.equal(value.cardio.plan.minutesPerSession,20);assert.deepEqual(value.cardio.plan.preferred,['treadmill']);assert.deepEqual(value.cardio.plan.available,['treadmill','elliptical','bike','stairs']);
 assert.equal(rows(value).length,3);assert.ok(rows(value).every(row=>row.plannedDate===null));assert.equal(c.cardioSummary(value.cardio,date,date).plannedMinutes,60);assert.deepEqual(value.workouts,original.workouts);assert.equal(value.fourDayPlan,original.fourDayPlan);assert.equal(value.schedule,original.schedule);assert.equal(value.programVersion,original.programVersion);
});
test('cardio actions leave four strength dates, order, prescriptions, incomplete continuation and history intact',()=>{
 const strength=logic.activateFourDayPlan(state(),'2026-10-12','four-day','2026-10-10T12:00:00Z',date);strength.workouts[1000001]=sessions.hydratedWorkoutLog(strength,1000001);strength.workouts[1000001].sets['flat-db-bench'][0].load='25';const snapshot=structuredClone(strength);
 let value=c.enableCardio(strength,date,stamp);const row=rows(value)[0];value=c.setCardioOpportunity(value,row,{plannedDate:'2026-10-13'});value=c.logCardio(value,row,input());value=c.editCardioPlan(value,{enabled:false});value=c.editCardioPlan(value,{enabled:true});
 for(const key of ['workouts','fourDayPlan','schedule','scheduleModifiedAt','startDate','blockId','profile','dailyMetrics','equipment','programVersion'])assert.deepEqual(value[key],snapshot[key]);
 assert.deepEqual(logic.scheduledDaysInRange(value,'2026-10-12','2026-10-18'),[1000001,1000002,1000003,1000004]);assert.equal(logic.nextWorkoutDay(value,date),logic.nextWorkoutDay(snapshot,date));assert.equal(value.workouts[1000001].completed,false);
});
test('one visit reschedules independently without cascading; actual completion dates do not follow planned dates',()=>{
 let value=enabled();let [a,b]=rows(value);value=c.setCardioOpportunity(value,a,{plannedDate:'2026-10-10'},stamp);value=c.setCardioOpportunity(value,b,{plannedDate:'2026-10-11'},stamp);const bBefore=structuredClone(value.cardio.opportunities[b.id]);
 value=c.setCardioOpportunity(value,a,{plannedDate:'2026-10-14'},stamp);assert.deepEqual(value.cardio.opportunities[b.id],bBefore);assert.equal(c.cardioSummary(value.cardio,date,date).planned,2);assert.equal(c.cardioSummary(value.cardio,'2026-10-14','2026-10-14').planned,4);
 value=c.logCardio(value,b,input({date:'2026-10-10',minutes:7}),stamp);assert.equal(c.cardioSessionFor(value.cardio,b.id).date,'2026-10-10');assert.equal(c.cardioSessionFor(value.cardio,b.id).minutes,7);assert.throws(()=>c.setCardioOpportunity(value,b,{plannedDate:'2026-10-15'}),/completed/);
 assert.equal(c.cardioStatus(value.cardio,value.cardio.opportunities[a.id],'2026-10-15'),'overdue');assert.equal(c.cardioSummary(value.cardio,'2026-10-15','2026-10-15').completed,0);
});
test('skip, pause, resume and future target edits preserve saved opportunities and completed history',()=>{
 let value=enabled();const [a,b]=rows(value);value=c.setCardioOpportunity(value,a,{status:'skipped'},stamp);assert.equal(c.cardioStatus(value.cardio,value.cardio.opportunities[a.id],date),'skipped');value=c.logCardio(value,b,input(),stamp);const history=JSON.stringify(value.cardio.sessions);value=c.editCardioPlan(value,{enabled:false},stamp);
 assert.equal(c.cardioStatus(value.cardio,value.cardio.opportunities[rows(value)[2].id],date),'paused');assert.equal(c.cardioOpportunities(value.cardio,'2026-10-12','2026-10-12').length,0);
 value=c.editCardioPlan(value,{enabled:true},stamp);value=c.editCardioPlan(value,{minutesPerSession:25},stamp);assert.equal(rows(value)[0].targetMinutes,20);assert.equal(c.cardioOpportunities(value.cardio,'2026-10-12',date)[0].targetMinutes,25);assert.equal(JSON.stringify(value.cardio.sessions),history);value=c.setCardioOpportunity(value,a,{status:'planned'},stamp);assert.equal(c.cardioStatus(value.cardio,value.cardio.opportunities[a.id],date),'planned');
});
test('duplicate completion IDs survive reload; corrections retain identity and actual modality stays distinct',()=>{
 const original=enabled();const row=rows(original)[0];const once=c.logCardio(original,row,input({modality:'bike'}),stamp);assert.equal(c.logCardio(once,row,input({minutes:30})),once);
 const reloaded=parseBackup(serializeBackup(once));assert.equal(c.logCardio(reloaded,row,input()),reloaded);const session=c.cardioSessionFor(reloaded.cardio,row.id);assert.equal(session.modality,'bike');assert.equal(reloaded.cardio.opportunities[row.id].modality,'treadmill');
 const corrected=c.editCardioSession(reloaded,session.id,input({date:'2026-10-11',minutes:15,modality:'elliptical'}),'2026-10-12T12:00:00Z');assert.equal(Object.keys(corrected.cardio.sessions).length,1);assert.equal(corrected.cardio.sessions[session.id].completedAt,stamp);assert.equal(corrected.cardio.sessions[session.id].date,'2026-10-11');
 const another=c.logCardio(corrected,rows(corrected)[1],input({modality:'stairs'}),stamp);assert.equal(another.cardio.sessions[session.id].modality,'elliptical');
 const extra=c.logExtraCardio(another,'extra-stable-id',input({minutes:3}),stamp);assert.equal(c.logExtraCardio(extra,'extra-stable-id',input()),extra);assert.equal(extra.cardio.sessions['extra-stable-id'].opportunityId,null);
});
test('local Monday–Sunday boundaries, leap dates, every start weekday and DST are stable across timezones',()=>{
 for(let i=0;i<7;i++){const start=logic.isoDateOffset('2026-10-05',i);const value=c.enableCardio(state(),start,stamp);assert.equal(c.cardioWeek(start),'2026-10-05');assert.equal(c.cardioOpportunities(value.cardio,'2026-10-05',start).length,3);}
 for(const [actual,week]of [['2028-02-29','2028-02-28'],['2027-03-14','2027-03-08'],['2026-11-01','2026-10-26'],['2026-12-31','2026-12-28'],['2027-01-03','2026-12-28']])assert.equal(c.cardioWeek(actual),week);
 const script="const c=require('./.test-build/app/cardio-logic.js');console.log(JSON.stringify(['2027-03-14','2026-11-01','2028-02-29'].map(c.cardioWeek)))";
 for(const TZ of ['America/New_York','UTC','Pacific/Auckland']){const result=spawnSync(process.execPath,['-e',script],{env:{...process.env,TZ},encoding:'utf8'});assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),['2027-03-08','2026-10-26','2028-02-28']);}
});
test('weekly summary counts actual local dates/minutes only; past weeks and warm-ups are not invented cardio',()=>{
 let value=enabled();value=c.logCardio(value,rows(value)[0],input({date:'2026-10-11',minutes:12.5}),stamp);value=c.logCardio(value,rows(value)[1],input({date:'2026-10-12',minutes:8}),stamp);
 assert.equal(c.cardioSummary(value.cardio,date,date).minutes,12.5);assert.equal(c.cardioSummary(value.cardio,date,date).completed,1);assert.equal(c.cardioSummary(value.cardio,'2026-10-12','2026-10-12').minutes,8);
 assert.equal(c.cardioSummary(value.cardio,'2026-09-21',date).planned,0);assert.equal(c.cardioSummary(value.cardio,'2026-09-21',date).completed,0);assert.equal(c.cardioSummary(null,date,date).minutes,0);
 const warmupOnly=state();warmupOnly.workouts[1].warmup.cardio=true;assert.equal(logic.normalizeTrackerState(warmupOnly).cardio,null);
});
test('schema 5/6/7 backups migrate without opt-in; schema 8 cardio round-trips and malformed values fail strictly',()=>{
 for(const version of [5,6,7]){const old=state();old.schemaVersion=version;delete old.cardio;if(version<7)delete old.equipment;const restored=parseBackup(JSON.stringify(old));assert.equal(restored.schemaVersion,8);assert.equal(restored.cardio,null);assert.deepEqual(restored.workouts,old.workouts);}
 const valid=c.logCardio(enabled(),rows(enabled())[0],input({note:'Private cardio note',effort:'moderate'}),stamp);assert.deepEqual(parseBackup(serializeBackup(valid)),valid);
 const invalidMutations=[v=>v.cardio.plan.preferred=['rower'],v=>v.cardio.plan.minutesPerSession=0,v=>v.cardio.plan.sessionsPerWeek=8,v=>v.cardio.plan.available=[],v=>v.cardio.plan.extra='drop',v=>Object.values(v.cardio.sessions)[0].modality='rower',v=>Object.values(v.cardio.sessions)[0].minutes=-1,v=>Object.values(v.cardio.sessions)[0].minutes=0,v=>Object.values(v.cardio.sessions)[0].minutes=Infinity,v=>Object.values(v.cardio.sessions)[0].date='2026-02-30',v=>Object.values(v.cardio.sessions)[0].id='wrong',v=>Object.values(v.cardio.sessions)[0].effort='unknown',v=>Object.values(v.cardio.sessions)[0].note='x'.repeat(501),v=>Object.values(v.cardio.opportunities)[0].week='2026-10-07',v=>Object.values(v.cardio.opportunities)[0].plannedDate='not-date',v=>Object.values(v.cardio.sessions)[0].opportunityId='missing',v=>delete v.cardio];
 for(const mutate of invalidMutations){const bad=structuredClone(valid);mutate(bad);assert.equal(sanitizeTrackerState(bad),null);assert.throws(()=>parseBackup(JSON.stringify(bad)));}
 assert.throws(()=>c.logCardio(enabled(),rows(enabled())[0],input({minutes:0})),/positive/);
});
test('independent cardio visits merge safely alongside strength edits; conflicting same visits are detected',()=>{
 const base=enabled();const [a,b]=rows(base);const remote=c.logCardio(base,a,input({minutes:10}),stamp);const local=c.logCardio(base,b,input({minutes:15}),stamp);assert.equal(c.cardioConflict(remote.cardio,local.cardio,base.cardio),false);
 const merged=logic.mergeTrackerStates(remote,edit(local,'note','Pending strength note'),base);assert.equal(Object.keys(merged.cardio.sessions).length,2);assert.equal(merged.workouts[1].note,'Pending strength note');assert.ok(sanitizeTrackerState(merged));
 const incompatible=c.logCardio(base,a,input({minutes:30}),stamp);assert.equal(c.cardioConflict(remote.cardio,incompatible.cardio,base.cardio),true);const skipped=c.setCardioOpportunity(base,a,{status:'skipped'},stamp);assert.equal(c.cardioConflict(remote.cardio,skipped.cardio,base.cardio),true);
});
test('offline cardio outbox survives reload, reconnect and acknowledged sync',async t=>{
 const storage=disk(),first=setup(t,enabled(),storage);await first.controller.sync();first.api.write=async()=>{throw Error('offline');};first.controller.mutate(value=>c.logCardio(value,rows(value)[0],input(),stamp));assert.equal(await first.controller.sync(false),false);assert.equal(first.controller.getSnapshot().pending,true);first.controller.dispose();
 const restored=setup(t,enabled(),storage);assert.equal(Object.keys(restored.controller.getSnapshot().state.cardio.sessions).length,1);assert.equal(await restored.controller.sync(),true);assert.equal(restored.controller.getSnapshot().pending,false);assert.equal(Object.keys(restored.remote().state.cardio.sessions).length,1);
});
test('same-session conflicting edits pause sync with a valid exportable local draft, no overwrite',async t=>{
 const base=c.logCardio(enabled(),rows(enabled())[0],input(),stamp),id=Object.keys(base.cardio.sessions)[0];const s=setup(t,base);await s.controller.sync();s.controller.mutate(value=>c.editCardioSession(value,id,input({minutes:15}),'2026-10-11T12:00:00Z'));s.api.read=async()=>({state:c.editCardioSession(base,id,input({minutes:18}),'2026-10-12T12:00:00Z'),version:2,updatedAt:2});
 assert.equal(await s.controller.sync(),false);assert.equal(s.controller.getSnapshot().conflict,true);assert.equal(s.writes.length,0);assert.equal(s.controller.getSnapshot().state.cardio.sessions[id].minutes,15);assert.equal(parseBackup(serializeBackup(s.controller.getSnapshot().state)).cardio.sessions[id].minutes,15);
});
test('late reads and in-flight write acknowledgements preserve newer cardio and strength edits',async t=>{
 const s=setup(t);await s.controller.sync();const read=deferred();s.api.read=()=>read.promise;const reading=s.controller.sync();s.controller.mutate(value=>c.logCardio(value,rows(value)[0],input(),stamp));read.resolve({state:enabled(),version:1,updatedAt:1});assert.equal(await reading,true);assert.equal(Object.keys(s.controller.getSnapshot().state.cardio.sessions).length,1);
 const write=deferred();let calls=0,sent;s.api.write=async(value,version)=>{if(++calls===1){sent=structuredClone(value);return write.promise;}return {conflict:false,progress:{state:value,version:version+1,updatedAt:4}};};s.controller.mutate(value=>c.logCardio(value,rows(value)[1],input({minutes:7}),stamp));const writing=s.controller.sync(false);s.controller.mutate(value=>edit(c.logExtraCardio(value,'extra-during-write',input({minutes:5}),stamp),'note','Strength edit stays'));write.resolve({conflict:false,progress:{state:sent,version:3,updatedAt:3}});assert.equal(await writing,true);assert.equal(Object.keys(s.controller.getSnapshot().state.cardio.sessions).length,3);assert.equal(s.controller.getSnapshot().state.workouts[1].note,'Strength edit stays');assert.equal(calls,2);
});
test('actual atomic SQL protects cardio from older clients and enforces account/version match',()=>{
 const sql=readFileSync(new URL('../lib/progress-store.ts',import.meta.url),'utf8').match(/"(UPDATE gym_progress SET state_json = .*?json_extract.*?)"/)[1],db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE gym_progress(user_email TEXT PRIMARY KEY,state_json TEXT,version INTEGER,updated_at INTEGER)');db.prepare('INSERT INTO gym_progress VALUES(?,?,1,1)').run('owner',JSON.stringify(enabled()));
 for(const version of [5,6,7])assert.equal(db.prepare(sql).run(JSON.stringify({...state(),cardio:undefined,schemaVersion:version}),2,2,'owner',1,version,version,version).changes,0);
 assert.equal(db.prepare(sql).run(JSON.stringify(enabled()),2,2,'other',1,8,8,8).changes,0);assert.equal(db.prepare(sql).run(JSON.stringify(enabled()),2,2,'owner',1,8,8,8).changes,1);assert.equal(db.prepare(sql).run(JSON.stringify(enabled()),3,3,'owner',1,8,8,8).changes,0);
 }finally{db.close();}
});
test('account recovery keys and Gemini cardio context omit notes, IDs and unconfirmed machines',async t=>{
 const storage=disk(),s=setup(t,enabled(),storage);await s.controller.sync();s.controller.mutate(value=>c.logCardio(value,rows(value)[0],input({note:'PRIVATE ONLY'}),stamp));const other=new TrackerSync('other-account',()=>storage,null);other.hydrate();t.after(()=>other.dispose());assert.equal(other.getSnapshot().state.cardio,null);const context=coachingCardio(s.controller.getSnapshot().state,date);assert.equal(context.recent.length,1);assert.ok(!JSON.stringify(context).includes('PRIVATE ONLY'));assert.ok(!JSON.stringify(context).includes('done-walk-'));assert.equal(context.summary.minutes,12);
});

test('CSV cardio rows keep actual minutes separate from lifting columns and escape private note formulas',()=>{
 const value=c.logExtraCardio(enabled(),'extra-csv',input({minutes:9.5,effort:'easy',note:'=SUM(A1:A2)'}),stamp);const [row]=cardioCsvRows(value);assert.equal(row.length,20);assert.equal(row[0],'cardio');assert.equal(row[1],date);assert.equal(row[16],9.5);assert.equal(row[15],'treadmill');for(const i of [3,4,5,6,7,8])assert.equal(row[i],'');assert.match(csvCell(row[18]),/^'/);assert.equal(row[19],'');
});
test('future opportunities freeze when first edited; viewed past weeks do not adopt a newer target',()=>{
 let value=enabled();const futureWeek='2026-10-12';const visit=c.cardioOpportunities(value.cardio,futureWeek,date)[0];value=c.setCardioOpportunity(value,visit,{plannedDate:'2026-10-14'},stamp);assert.equal(Object.values(value.cardio.opportunities).filter(row=>row.week===futureWeek).length,3);value=c.editCardioPlan(value,{sessionsPerWeek:4},stamp);assert.equal(c.cardioOpportunities(value.cardio,futureWeek,date).length,3);assert.equal(c.cardioOpportunities(value.cardio,'2026-10-19',date).length,4);assert.equal(c.cardioSummary(value.cardio,'2026-10-12','2026-10-20').planned,3);
});

test('each strength session has one stable 20-minute cardio action without changing lifting history',()=>{
 const original=state();let value=c.logStrengthCardio(original,1,input({minutes:20}),stamp);
 assert.equal(value.cardio.plan.sessionsPerWeek,4);assert.equal(value.cardio.plan.minutesPerSession,20);
 assert.deepEqual(value.workouts,original.workouts);assert.deepEqual(value.fourDayPlan,original.fourDayPlan);
 assert.deepEqual(c.logStrengthCardio(value,1,input({minutes:20}),stamp),value);
 value=c.logStrengthCardio(value,3,input({minutes:15}),stamp);assert.equal(Object.keys(value.cardio.sessions).length,2);
 assert.ok(sanitizeTrackerState(value));assert.deepEqual(parseBackup(serializeBackup(value)),value);
});
