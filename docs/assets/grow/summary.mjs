import {phaseName} from './phases.mjs';
export function growSummary(state,cohort,mentee,base){
 const latestByPeriod=new Map();for(const p of state.publications)latestByPeriod.set(p.period,p);
 const entries=[...latestByPeriod.values()].sort((a,b)=>a.period-b.period),last=entries.at(-1),fmt=n=>typeof n==='number'?n.toLocaleString('id-ID',{maximumFractionDigits:2}):'—';
 const link=file=>{const u=new URL(file,base);u.searchParams.set('cohort',cohort);u.searchParams.set('mentee',mentee);return u.pathname+u.search;};
 const points=entries.slice(-3).map((p,i,a)=>({x:a.length===1?150:10+i*280/(a.length-1),y:80-p.score.total*.65,label:phaseName(p.period)+' · '+fmt(p.score.total)})),line=points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
 return{score:fmt(last?.score.total),scoreLabel:last?'Nilai program · '+phaseName(last.period):'Nilai program',scoreStatus:last?'Raport diterbitkan':'Belum ada raport diterbitkan',processScore:fmt(last?.score.asmen),achievementScore:fmt(last?.score.mentor),hasTrend:points.length>1,trendLine:line,trendArea:points.length?line+' L'+points.at(-1).x+' 90 L'+points[0].x+' 90 Z':'',trendPoints:points,trendLabel:points.map(p=>p.label).join(', '),reportError:'',todo:[{id:'grow',title:state.canvas?.status==='Disepakati'?'Catat hasil mentoring dan action berikutnya':'Lengkapi GROW Canvas awal',meta:state.canvas?.status||'Belum diisi',tag:'Program',tagBg:'#E4EBF8',tagInk:'#3157A5',href:link(state.canvas?.status==='Disepakati'?'mentoring.html':'grow-canvas.html')}]};
}
