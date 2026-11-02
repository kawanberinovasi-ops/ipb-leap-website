import {workspace,errorText} from './api.mjs';
import {mountSession} from './session.mjs';
export function publishedSummary(w){
 const subject=w.actor?.id;
 const entries=w.records.filter(r=>r.kind==='review'&&r.mentee_id===subject).flatMap(r=>(r.publications||[]).map(p=>({...p,period:r.month_no}))).filter(p=>typeof p.score?.total==='number').sort((a,b)=>a.period-b.period||a.number-b.number);
 const lastByPeriod=new Map();for(const p of entries)lastByPeriod.set(p.period,p);
 const results=[...lastByPeriod.values()],last=results.at(-1),trend=results.slice(-3),fmt=n=>typeof n==='number'?n.toLocaleString('id-ID',{maximumFractionDigits:2}):'—';
 const points=trend.map((p,i)=>({x:trend.length===1?150:10+i*280/(trend.length-1),y:80-p.score.total*.65,label:'M'+p.period+' · '+fmt(p.score.total)}));
 const line=points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
 return {score:fmt(last?.score.total),scoreLabel:last?'Nilai program · M'+last.period:'Nilai program',scoreStatus:last?'Raport diterbitkan':'Belum ada raport diterbitkan',processScore:fmt(last?.score.components?.p1),achievementScore:fmt(last?.score.components?.p2),hasTrend:points.length>1,trendLine:line,trendArea:points.length?line+' L'+points.at(-1).x+' 90 L'+points[0].x+' 90 Z':'',trendPoints:points,trendLabel:points.map(p=>p.label).join(', '),reportError:''};
}
export async function mountHome(){const actor=await mountSession();if(!actor)return;try{const w=await workspace(null,actor.id);window.dispatchEvent(new CustomEvent('leap:report',{detail:publishedSummary(w)}));}catch(e){window.dispatchEvent(new CustomEvent('leap:report',{detail:{score:'—',scoreStatus:'Nilai belum dapat dimuat',reportError:errorText(e)}}));}}
