// Version envelope only. Does not alter scoring, weights, thresholds or rounding.
export function sourceSnapshot(w,period){
 const records=w.records.filter(r=>r.kind!=='review'&&r.month_no<=period).map(r=>({id:r.id,kind:r.kind,latest:r.latest_version??r.versions.at(-1)?.number??0,version:r.versions.at(-1)?.id??null,checks:r.checks.map(c=>c.id).sort()})).sort((a,b)=>a.id.localeCompare(b.id));
 const sessions=w.sessions.filter(s=>s.month_no<=period).map(s=>({id:s.id,cancelled:s.cancelled,reason:s.cancellation_reason??null,starts:s.starts_at,participants:[...s.participant_ids].sort()})).sort((a,b)=>a.id.localeCompare(b.id));
 const m6=period===9?w.records.find(r=>r.kind==='review'&&r.month_no===6)?.publications.at(-1)?.id??null:null;
 return JSON.stringify({records,sessions,m6});
}
