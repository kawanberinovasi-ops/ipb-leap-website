// Aturan operasional v1. Tidak berisi akun, laporan, atau nilai contoh.
export const RULE='IPB-LEAP-2026-v1';
export const FIELDS=['Entrepreneur / Business','Academic & Research','Professional / Corporate / Bureaucracy','Politics / Public Leadership','Social & Community / Social Impact'];
export const PERIODS=[3,6,9,12];
export const LEVELS=['Not Achieved','Progress','Achieve','Exceed'];
export const COMPETENCIES=['Mengenal diri','Berpikir kritis','Komunikasi','Kolaborasi','Eksekusi','Etika'];
export const ACTIVITIES=['Kick-off','Define the Arena','Build & Execute','Mentoring/check-in','Expert Visit','Coaching Clinic','Showcase/Graduation'];
export const latest=r=>r?.versions?.at(-1);
export const agreed=records=>records.filter(r=>r.kind==='poc').flatMap(r=>r.versions.filter(v=>v.status==='Disepakati')).at(-1);
export const lastCheck=(r,kind,source=latest(r)?.id)=>r?.checks?.filter(c=>c.kind===kind&&c.source_version_id===source).at(-1);
export const clean=s=>typeof s==='string'?s.trim():'';
export const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const fail=s=>{throw Error(s)};
const need=(s,label)=>{if(!clean(s))fail('Lengkapi '+label+'.');};
const num=n=>n!==''&&n!==null&&n!==undefined&&Number.isFinite(Number(n));
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const link=s=>{if(!s)return;try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))fail('Tautan bukti harus menggunakan https atau http.');}catch{fail('Tautan bukti belum benar.');}};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function programMonth(startsOn,asOf=today()){const [sy,sm]=startsOn.slice(0,7).split('-').map(Number),[y,m]=asOf.slice(0,7).split('-').map(Number);return Math.max(0,Math.min(12,(y-sy)*12+m-sm+1));}
function sentences(s){return clean(s).split(/[.!?]+(?:\s|$)/).filter(x=>x.trim()).length;}
export function validatePOC(d){
 ['title','outcome','baselineContext','risk','support','plan'].forEach(k=>need(d[k],({title:'judul POC',outcome:'outcome',baselineContext:'kondisi awal',risk:'risiko',support:'dukungan',plan:'rencana kerja'})[k]));
 if(!Array.isArray(d.kpis)||d.kpis.length<1||d.kpis.length>3)fail('POC memuat satu hingga tiga KPI.');
 if(new Set(d.kpis.map(k=>k.id)).size!==d.kpis.length)fail('ID KPI harus berbeda.');
 for(const k of d.kpis){['id','title','unit','measurement','evidencePlan'].forEach(x=>need(k[x],'KPI: '+x));
  if(!['number','milestone'].includes(k.kind))fail('Pilih jenis KPI.');
  if(k.kind==='number'&&(!num(k.baseline)||!['up','down'].includes(k.direction)))fail('Isi baseline dan arah perubahan KPI.');
  if(k.kind==='milestone')need(k.baseline,'baseline milestone');
  for(const m of PERIODS){const b=k.levels?.['M'+m];if(!b)fail('Lengkapi empat patokan KPI untuk M'+m+'.');
   for(const key of ['progress','achieve','exceed']){if(k.kind==='number'?!num(b[key]):!clean(b[key]))fail('Lengkapi batas '+key+' pada M'+m+'.');}
   if(k.kind==='number'){const a=Number(b.progress),t=Number(b.achieve),e=Number(b.exceed);if(k.direction==='up'?!(a<t&&t<e):!(a>t&&t>e))fail('Batas Progress, Achieve, Exceed harus berurutan sesuai arah KPI.');}
  }
 }
}
function reflection(d){
 if(!ACTIVITIES.includes(d.activity))fail('Pilih kegiatan ABC.');if(!date(d.activityDate)||d.activityDate>today())fail('Tanggal kegiatan harus benar dan tidak melewati hari ini (WIB).');
 ['awareness','bestStep','action','evidencePlan','support'].forEach(k=>need(d[k],({awareness:'Awareness',bestStep:'satu Best Step',action:'tindakan komitmen',evidencePlan:'rencana bukti',support:'dukungan (boleh Tidak ada)'})[k]));
 for(const k of ['awareness','bestStep','action'])if(sentences(d[k])>3)fail('Tulis maksimal tiga kalimat pada setiap bagian refleksi. Jawabanmu tetap tersimpan di isian.');
 if(!date(d.deadline))fail('Isi tenggat komitmen.');
 if(d.activity==='Kick-off'&&(!Array.isArray(d.priorities)||d.priorities.length!==3||d.priorities.some(p=>['ability','why','practice'].some(k=>!clean(p[k])))))fail('Lengkapi tiga prioritas belajar pribadi untuk Kick-off.');
}
export function validateMentee(kind,d,root,w){
 if(kind==='poc')validatePOC(d);
 else if(kind==='abc')reflection(d);
 else if(kind==='checkin'||kind==='mentoring'){
  (kind==='checkin'?['action','result','learning','next']:['priority','insight','decision','action','evidencePlan']).forEach(k=>need(d[k],k));
  if(!date(d.deadline))fail('Isi tenggat langkah berikutnya.');
  if(kind==='checkin'){if(!clean(d.proofText)&&!clean(d.proofUrl))fail('Jelaskan bukti hasil aktual atau hambatan jika bukti belum ada.');link(d.proofUrl);}
  const session=w.sessions.find(s=>s.id===root.session_id&&s.kind===(kind==='checkin'?'checkin':'mentoring')&&s.month_no===root.month_no&&s.participant_ids.includes(root.mentee_id)&&!s.cancelled);
  if(!session)fail('Pilih jadwal kegiatan yang ditetapkan pengelola.');
  if(new Date(session.starts_at)>new Date())fail('Kegiatan belum berlangsung. Simpan sebagai draft lebih dahulu.');
 }else if(kind==='actual'){
  if(!PERIODS.includes(root.month_no))fail('Aktual diisi pada M3, M6, M9, dan M12.');
  const poc=agreed(w.records);if(!poc||d.pocVersion!==poc.id)fail('Gunakan versi POC terakhir yang disepakati.');
  if(!Array.isArray(d.items)||d.items.length!==poc.data.kpis.length)fail('Isi aktual untuk setiap KPI.');
  for(const k of poc.data.kpis){const it=d.items.find(x=>x.kpiId===k.id);if(!it)fail('Aktual KPI belum lengkap.');if(!it.noEvidence&&(k.kind==='number'?!num(it.value):!clean(it.value)))fail('Isi aktual KPI; kosong tidak dianggap nol.');need(it.summary,'penjelasan hasil aktual');link(it.proofUrl);if(!it.noEvidence&&!clean(it.proofText)&&!clean(it.proofUrl))fail('Isi bukti aktual atau tandai bukti belum tersedia.');}
  need(d.learning,'pembelajaran');need(d.next,'langkah berikutnya');
 }else if(kind==='portfolio'){
  if(root.month_no!==12)fail('Portofolio akhir diisi pada M12.');['summary','proof','plan'].forEach(k=>need(d[k],k));link(d.proofUrl);
 }else fail('Jenis catatan tidak dapat ditulis mentee.');
 if(d.abcRef){const r=w.records.find(r=>r.id===d.abcRef&&r.kind==='abc');if(!r||!r.versions.some(v=>v.id===d.abcVersion))fail('Referensi ABC tidak ditemukan.');}
 if(d.pocRef&&!w.records.some(r=>r.kind==='poc'&&r.versions.some(v=>v.id===d.pocRef)))fail('Referensi POC tidak ditemukan.');
}
export function processSummary(w,month){
 const mentee=w.selectedMentee;
 const scheduled=w.sessions.filter(s=>s.kind==='checkin'&&s.month_no>=2&&s.month_no<=month&&s.participant_ids.includes(mentee));
 const perMonth=Array.from({length:month-1},(_,i)=>i+2);
 if(perMonth.some(m=>scheduled.filter(s=>s.month_no===m).length!==2))return{complete:false,reason:'Jadwal check-in dua kali per bulan belum lengkap.',count:0,expected:2*(month-1)};
 const required=scheduled.filter(s=>!s.cancelled);let points=0;const sources=[];
 for(const s of required){const r=w.records.find(r=>r.kind==='checkin'&&r.session_id===s.id);const check=lastCheck(r,'process');if(!check)return{complete:false,reason:'Masih ada check-in yang belum diperiksa Asmen.',count:sources.length,expected:required.length};points+=({Green:3,Yellow:1,Red:0})[check.data.color];sources.push({session:s.id,record:r.id,version:latest(r).id,check:check.id,color:check.data.color});}
 if(!required.length)return{complete:false,reason:'Tidak ada check-in aktif sebagai dasar penilaian.',count:0,expected:0};
 return{complete:true,points,max:required.length*3,count:sources.length,expected:required.length,score:round(points/(required.length*3)*25),sources,cancellations:scheduled.filter(s=>s.cancelled).map(s=>({id:s.id,reason:s.cancellation_reason}))};
}
export function numericLevel(k,period,value){const b=k.levels['M'+period],n=Number(value);return k.direction==='down'?(n<=Number(b.exceed)?'Exceed':n<=Number(b.achieve)?'Achieve':n<=Number(b.progress)?'Progress':'Not Achieved'):(n>=Number(b.exceed)?'Exceed':n>=Number(b.achieve)?'Achieve':n>=Number(b.progress)?'Progress':'Not Achieved');}
export function scoreReview(w,month,d){
 const poc=agreed(w.records);if(!poc)fail('POC belum disepakati Mentor.');
 const actual=w.records.find(r=>r.kind==='actual'&&r.month_no===month),av=latest(actual);
 if(!av||av.status!=='Diajukan'||av.data.pocVersion!==poc.id)fail('Aktual terbaru belum diajukan terhadap POC yang disepakati.');
 const evidence=lastCheck(actual,'evidence');if(!evidence)fail('Asmen belum memeriksa bukti aktual terbaru.');
 if(d.pocVersion!==poc.id||d.actualVersion!==av.id||d.evidenceCheck!==evidence.id)fail('Sumber penilaian berubah. Buka ulang penilaian dan periksa sumber terbaru.');
 const p1=processSummary(w,month);if(!p1.complete)fail(p1.reason);
 const levels=[],tiers=[];
 for(const k of poc.data.kpis){const it=d.items?.find(x=>x.kpiId===k.id),actualItem=av.data.items.find(x=>x.kpiId===k.id),ev=evidence.data.items?.find(x=>x.kpiId===k.id);
  if(!it||!LEVELS.includes(it.level)||!it.confirmed)fail('Mentor harus menetapkan dan mengonfirmasi empat level pada setiap KPI.');need(it.reason,'alasan level '+k.title);
  if(!ev||!Number.isInteger(ev.tier)||ev.tier<0||ev.tier>4)fail('Kekuatan bukti KPI belum diperiksa.');
  const verifiable=ev.verified&&ev.tier>=3&&!actualItem.noEvidence;
  if(!verifiable&&it.level!=='Not Achieved')fail('Bukti outcome belum terverifikasi. Putuskan Not Achieved disertai alasan; jangan menyamakan isian lengkap dengan capaian.');
  if(verifiable&&k.kind==='number'&&it.level!==numericLevel(k,month,actualItem.value))fail('Level '+k.title+' belum sesuai patokan angka POC. Jika aktual tidak dapat diverifikasi, tandai melalui pemeriksaan bukti.');
  levels.push({kpi:k.id,level:it.level,points:({'Not Achieved':0,Progress:2,Achieve:3,Exceed:4})[it.level],reason:it.reason});tiers.push({kpi:k.id,tier:ev.verified?ev.tier:0});
 }
 const p2=round(levels.reduce((s,x)=>s+x.points,0)/(levels.length*4)*25),p4=round(tiers.reduce((s,x)=>s+x.tier,0)/(tiers.length*4)*25);
 let p3=null,leadershipSource=null;
 if(month===9){const m6=w.records.find(r=>r.kind==='review'&&r.month_no===6)?.publications?.at(-1);if(!m6)fail('Terbitkan penilaian M6 sebelum M9.');p3=m6.score.components.p3;leadershipSource={publication:m6.id};}
 else if(month!==3){if(!Array.isArray(d.leadership)||d.leadership.length!==6)fail('Lengkapi enam kompetensi kepemimpinan.');
  for(const [i,l] of d.leadership.entries()){if(!Number.isInteger(l.level)||l.level<1||l.level>4)fail('Pilih level 1–4 untuk '+COMPETENCIES[i]+'.');need(l.note,'alasan kepemimpinan');need(l.proofUrl,'tautan bukti kepemimpinan');link(l.proofUrl);}
  p3=round(d.leadership.reduce((s,x)=>s+x.level,0)/24*25);leadershipSource=d.leadership;
 }
 if(month===12){const port=w.records.find(r=>r.kind==='portfolio'&&r.month_no===12);if(latest(port)?.status!=='Diajukan')fail('Portofolio dan rencana 12 bulan berikutnya belum diajukan.');}
 need(d.next,'arahan pendampingan berikutnya');
 const total=month===3?round((p1.score+p2+p4)*100/75):round(p1.score+p2+p3+p4);
 return{score:{rule:RULE,period:month,total,components:{p1:p1.score,p2,p3,p4},levels,tiers,leadershipSource,formula:month===3?'(P1 + P2 + P4) × 100 / 75':'P1 + P2 + P3 + P4'},sources:{poc:poc.id,actual:av.id,evidence:evidence.id,process:p1.sources,cancellations:p1.cancellations,leadership:leadershipSource,portfolio:month===12?latest(w.records.find(r=>r.kind==='portfolio'))?.id:null}};
}
export function buildOperation(w,p){
 const action=p.action,d=p.data||{},r=w.records.find(r=>r.id===p.id),month=Number(p.month),kind=r?.kind||p.kind;
 if(!Number.isInteger(month)||month<0||month>12)fail('Pilih bulan program.');
 if(r&&r.month_no!==month)fail('Bulan catatan tidak cocok.');
 const root=r||{id:p.id,kind,month_no:month,mentee_id:w.selectedMentee,session_id:p.session||null};const op={id:root.id,kind,month,session:root.session_id};
 if(!/^[0-9a-f-]{36}$/i.test(root.id||''))fail('ID catatan tidak sah.');
 if(JSON.stringify(d).length>90000)fail('Isian terlalu panjang.');
 if(['save','submit'].includes(action)){
  if(!['poc','abc','checkin','mentoring','actual','portfolio'].includes(kind))fail('Jenis catatan tidak dapat ditulis.');
  if(r?.publications?.length)fail('Gunakan versi baru melalui alur perbaikan.');
  if(action==='submit')validateMentee(kind,d,root,w);
  if(kind==='poc'&&agreed(w.records)&&p.confirmAmendment!==true)fail('Perubahan POC perlu diajukan sebagai versi baru dan disepakati ulang oleh Mentor. Konfirmasi perubahan POC.');
  return{...op,data:d,status:action==='save'?'Draft':'Diajukan'};
 }
 const v=latest(r);if(!v&&!['review_save','publish'].includes(action))fail('Catatan tidak ditemukan.');
 if(['abc_check','poc_decide','mentoring_check'].includes(action)){
  if(v.status!=='Diajukan')fail('Catatan belum diajukan atau sudah diperiksa.');need(d.note,'catatan pemeriksa');
  const status=d.repair?'Perlu perbaikan':action==='poc_decide'?'Disepakati':'Sudah diperiksa';
  if(action==='poc_decide'&&!d.repair)validatePOC(v.data);
  return{...op,data:v.data,status,check:{kind:action==='abc_check'?'abc':action==='poc_decide'?'poc':'mentoring',source:v.id,data:{note:d.note,repair:!!d.repair}}};
 }
 if(['commitment','process','evidence'].includes(action)){
  if(v.status==='Draft')fail('Ajukan catatan sebelum diperiksa.');
  if(action==='commitment'){
   if(!['Belum dijalankan','Sedang dijalankan','Selesai','Perlu dukungan'].includes(d.status))fail('Pilih status komitmen.');
   ['action','result','learning','next','note'].forEach(k=>need(d[k],k));link(d.proofUrl);
  }else if(action==='process'){
   if(!['Green','Yellow','Red'].includes(d.color))fail('Pilih status proses.');need(d.note,'alasan Green/Yellow/Red');
   const session=w.sessions.find(s=>s.id===r.session_id);if(!session||session.cancelled||new Date(session.starts_at)>new Date())fail('Jadwal check-in belum berlangsung atau dibatalkan.');
   const prior=w.records.filter(x=>x.kind==='checkin'&&x.id!==r.id).map(x=>({r:x,s:w.sessions.find(s=>s.id===x.session_id),c:lastCheck(x,'process')})).filter(x=>x.s&&x.c&&new Date(x.s.starts_at)<new Date(session.starts_at)).sort((a,b)=>a.s.starts_at.localeCompare(b.s.starts_at)).at(-1);
   if(d.color==='Yellow'&&prior?.c.data.color==='Yellow'&&d.noImprovement===true){d.requestedColor='Yellow';d.color='Red';d.escalation='Dua Yellow berturut-turut tanpa perbaikan, dikonfirmasi Asmen.';}
   if(d.color==='Green'&&(!d.actionChecked||!d.evidenceChecked))fail('Konfirmasi tindakan dan bukti sebelum memberi Green.');
  }else{
   const poc=agreed(w.records);if(!poc||v.data.pocVersion!==poc.id)fail('Aktual tidak mengacu POC yang disepakati.');
   if(!Array.isArray(d.items)||d.items.length!==poc.data.kpis.length)fail('Periksa bukti setiap KPI.');
   for(const k of poc.data.kpis){const e=d.items.find(x=>x.kpiId===k.id);if(!e||!Number.isInteger(e.tier)||e.tier<0||e.tier>4||typeof e.verified!=='boolean')fail('Lengkapi tingkat bukti dan verifikasi.');need(e.note,'alasan pemeriksaan bukti');if(v.data.items.find(i=>i.kpiId===k.id)?.noEvidence&&(e.verified||e.tier!==0))fail('Bukti yang belum tersedia tidak dapat diverifikasi.');}
  }
  return{...op,check:{kind:action,source:v.id,data:d}};
 }
 if(['review_save','publish'].includes(action)){
  if(kind!=='review'||!PERIODS.includes(month))fail('Pilih periode review.');
  if(action==='review_save')return{...op,data:d,status:'Draft'};
  const result=scoreReview(w,month,d);return{...op,data:d,status:'Diterbitkan',...result};
 }
 fail('Tindakan tidak dikenali.');
}
