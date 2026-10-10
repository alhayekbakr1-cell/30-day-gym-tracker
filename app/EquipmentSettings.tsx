"use client";
import { useState } from 'react';
import { EQUIPMENT, type EquipmentProfile, type EquipmentId } from './equipment-logic';
export default function EquipmentSettings({profile, disabled, onChange}: {profile: EquipmentProfile; disabled: boolean; onChange: (next: EquipmentProfile)=>void}) {
  const [message,setMessage] = useState('');
  const change = (patch: Partial<EquipmentProfile>) => onChange({...profile,...patch,modifiedAt:new Date().toISOString()});
  return <details className="card equipment-settings"><summary>My gym equipment & setup</summary>
    <p>Permanent inventory. A busy station is handled inside your workout. Changes never edit old sessions.</p>
    <p>Dumbbells are pairs from 5–50 kg <strong>each</strong>. Exact rack steps, kettlebell weights and stack increments are not set. A high cable pulley for crunches has not been confirmed; enable it only if the station supports that setup.</p>
    <label className="equipment-choice"><input type="checkbox" disabled={disabled} checked={profile.futureUpperBFlat} onChange={e=>change({futureUpperBFlat:e.target.checked})}/>Use flat dumbbell bench instead of machine chest press in future, unstarted Upper B sessions</label>
    <p className="history-help">This explicit preference keeps the original program slot and prescription. Started sessions retain their saved movement. You can return to the original before logging any sets.</p>
    {Object.entries(EQUIPMENT).map(([id,label])=>{const key=id as EquipmentId;return <details className="equipment-item" key={id}><summary>{label} · {profile.available[key]?'Available':'Not available / unconfirmed'}</summary>
      <label className="equipment-choice"><input type="checkbox" disabled={disabled} checked={profile.available[key]} onChange={e=>change({available:{...profile.available,[key]:e.target.checked}})}/>Available in my gym</label>
      <label>Exact selectable weights in kg, comma separated (optional)<input type="text" key={`${id}:${profile.loadsKg[key]?.join(',')}`} disabled={disabled} defaultValue={profile.loadsKg[key]?.join(', ')??''} placeholder="Not set" onBlur={e=>{const text=e.target.value.trim();const values=text?text.split(',').map(v=>Number(v.trim())):[];if(values.length>100 || values.some(v=>!Number.isFinite(v)||v<=0||v>100000||(key==='dumbbells'&&(v<5||v>50)))){setMessage('Weights must be positive kg values; dumbbells must be 5–50 kg each. No changes saved.');return;}change({loadsKg:{...profile.loadsKg,[key]:[...new Set(values)].sort((a,b)=>a-b)}});setMessage('Load choices saved locally; check the sync status for server acknowledgement.');}}/></label>
      <label>Personal setup reminder<textarea rows={2} maxLength={500} disabled={disabled} value={profile.notes[key]??''} onChange={e=>change({notes:{...profile.notes,[key]:e.target.value}})}/></label>
    </details>;})}<p role="status">{message}</p>
  </details>;
}
