import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { require, state, workout } from './fixtures.mjs';
const equipment = require('../.test-build/app/equipment-logic.js');
const logic = require('../.test-build/app/tracker-logic.js');
const sessions = require('../.test-build/app/session-logic.js');
const {sanitizeTrackerState} = require('../.test-build/lib/tracker-validation.js');
const backup = require('../.test-build/app/backup-logic.js');
const history = require('../.test-build/app/exercise-history.js');
const first = 1000001;
test('exact apartment defaults and unknown rack/stack details; stable requirements and movement-aware busy choices',()=>{
 const p=equipment.defaultEquipment();
 assert.deepEqual(Object.keys(p.available).filter(k=>p.available[k]).sort(),['dumbbells','bench','pulldown','lowCable','legPress','legCurl','legExtension','smith','pullup','kettlebells'].sort());
 assert.deepEqual(p.loadsKg,{}); assert.equal(p.available.chestPress,false); assert.equal(p.available.highCable,false);
 assert.deepEqual(equipment.equipmentAlternatives('machine-press',p),['flat-db-bench','incline-db-bench']);
 assert.deepEqual(equipment.equipmentAlternatives('seated-row',p,true),['one-arm-row','lat-pulldown']);
 assert.ok(equipment.equipmentAlternatives('lat-pulldown',p,true).includes('assisted-pullup'));
 assert.deepEqual(equipment.equipmentAlternatives('leg-curl',p,true),[]);
 assert.ok(!equipment.equipmentAlternatives('leg-press',p,true).includes('leg-press'));
 p.available.dumbbells=false; assert.ok(!equipment.equipmentAlternatives('machine-press',p).includes('flat-db-bench'));
});
test('explicit future Upper B substitution never rewrites started prescriptions, logs or plan identity',()=>{
 const old=state(); const value=logic.activateFourDayPlan(old,'2026-10-12','four','2026-10-10T12:00:00Z','2026-10-10');
 const original=structuredClone(value); const begun=sessions.hydratedWorkoutLog(value,first+2); value.workouts[first+2]=begun;
 const changed={...value,equipment:{...value.equipment,futureUpperBFlat:true}};
 assert.equal(sessions.hydratedWorkoutLog(changed,first+2).substitutions['machine-press'],undefined);
 const fresh=sessions.hydratedWorkoutLog(changed,first+6); assert.equal(fresh.substitutions['machine-press'],'flat-db-bench');
 assert.equal(fresh.prescription.templateVersion,1);assert.equal(fresh.prescription.exercises['machine-press'].reps,'10–15 reps');
 assert.deepEqual(changed.workouts[first+2],begun); assert.deepEqual(changed.fourDayPlan,original.fourDayPlan); assert.deepEqual(changed.workouts[1],old.workouts[1]);
});
test('exact configured load choices convert for display, preserve old loads, and assistance is explicit',()=>{
 const value=state(); const before=JSON.stringify(value.workouts);value.equipment.loadsKg.dumbbells=[5,7.5,12];
 assert.deepEqual(equipment.loadOptions('flat-db-bench',value.equipment,'kg'),[5,7.5,12]);
 assert.equal(equipment.loadOptions('flat-db-bench',value.equipment,'lb')[0],11.02);
 assert.deepEqual(equipment.loadOptions('leg-press',value.equipment,'kg'),[]);
 assert.equal(equipment.equipmentProgression('flat-db-bench',value.equipment,'kg',7.5),12);
 assert.match(equipment.loadConvention('flat-db-bench'),/per hand/);assert.match(equipment.loadConvention('assisted-pullup'),/easier/);
 assert.equal(JSON.stringify(value.workouts),before);const bad=structuredClone(value);bad.equipment.loadsKg.dumbbells=[2];assert.equal(sanitizeTrackerState(bad),null);
});
test('equipment notes and independent field edits round-trip, old backups remain supported and invalid data rejected',()=>{
 const base=state(),remote=structuredClone(base),local=structuredClone(base);
 remote.equipment.notes.legCurl='Seat 3';remote.equipment.modifiedAt='2026-10-11T12:00:00Z';
 local.equipment.exerciseNotes['one-arm-row']='My bench setup';local.equipment.modifiedAt='2026-10-12T12:00:00Z';
 const merged=logic.mergeTrackerStates(remote,local,base);assert.equal(merged.equipment.notes.legCurl,'Seat 3');assert.equal(merged.equipment.exerciseNotes['one-arm-row'],'My bench setup');
 assert.deepEqual(backup.parseBackup(backup.serializeBackup(merged)),merged);
 for(const version of [5,6]){const old=structuredClone(base);old.schemaVersion=version;delete old.equipment;assert.deepEqual(backup.parseBackup(JSON.stringify(old)).workouts,base.workouts);}
 const invalid=structuredClone(base);invalid.equipment.exerciseNotes['unknown']='bad';assert.equal(sanitizeTrackerState(invalid),null);
 const missing=structuredClone(base);delete missing.equipment;assert.equal(sanitizeTrackerState(missing),null);
});
test('latest edited incomplete resumes after reload and substituted history retains planned identity and raw unit',()=>{
 const value=state();value.workouts[3]=workout(3);value.workouts[3].modifiedAt='2026-10-12T12:00:00Z';value.workouts[3].substitutions['seated-row']='one-arm-row';value.workouts[3].sets['seated-row'][0]={done:false,load:'15',reps:'8',rir:'3'};
 const reloaded=backup.parseBackup(backup.serializeBackup(value));assert.equal(equipment.latestIncomplete(reloaded),'3');
 const before=JSON.stringify(reloaded);const rows=history.exerciseHistory(reloaded);const row=rows.find(r=>r.slot==='seated-row');assert.equal(row.exerciseId,'one-arm-row');assert.equal(row.substituted,true);assert.equal(row.unit,'lb');assert.equal(row.completed,false);assert.match(row.plannedName,/row/i);assert.equal(JSON.stringify(reloaded),before);
 const copied=sessions.copyPreviousSets(reloaded,3,reloaded.workouts[3],'seated-row',2);assert.equal(copied.sets['seated-row'][0].done,false);
});
test('actual atomic SQL prevents schema-6 equipment erasure, preserves CAS and account separation',()=>{
 const sql=readFileSync(new URL('../lib/progress-store.ts',import.meta.url),'utf8').match(/"(UPDATE gym_progress SET state_json = .*?json_extract.*?)"/)[1];const db=new DatabaseSync(':memory:');
 try{db.exec('CREATE TABLE gym_progress(user_email TEXT PRIMARY KEY,state_json TEXT,version INTEGER,updated_at INTEGER)');const saved=state();saved.equipment.notes.smith='My safety stops';db.prepare('INSERT INTO gym_progress VALUES(?,?,1,1)').run('owner',JSON.stringify(saved));
 const old={...saved,schemaVersion:6,equipment:undefined};assert.equal(db.prepare(sql).run(JSON.stringify(old),2,2,'owner',1,6,6).changes,0);
 assert.equal(db.prepare(sql).run(JSON.stringify(saved),2,2,'other',1,7,7).changes,0);
 assert.equal(db.prepare(sql).run(JSON.stringify(saved),2,2,'owner',1,7,7).changes,1);
 assert.equal(db.prepare(sql).run(JSON.stringify(saved),3,3,'owner',1,7,7).changes,0);
 }finally{db.close();}
});
