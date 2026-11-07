import {periods,phaseName,phaseDates} from './phases.mjs';

let assetsPromise;

async function loadAssets(){
 if(!assetsPromise)assetsPromise=(async()=>{
  const files=['./fonts/PlusJakartaSans-Regular.ttf','./fonts/PlusJakartaSans-Bold.ttf','../logo-color.png'];
  const [library,...filesData]=await Promise.all([
   import('./vendor/jspdf-4.2.1.umd.min.js'),
   ...files.map(async file=>{
    const response=await fetch(new URL(file,import.meta.url));
    if(!response.ok)throw Error('Bahan PDF belum dapat dimuat. Coba unduh lagi.');
    return new Uint8Array(await response.arrayBuffer());
   })
  ]);
  const jsPDF=globalThis.jspdf?.jsPDF||library.default?.jsPDF;
  if(!jsPDF)throw Error('Pembuat PDF belum dapat dimuat. Muat ulang lalu coba lagi.');
  return {jsPDF,regular:filesData[0],bold:filesData[1],logo:filesData[2]};
 })().catch(error=>{assetsPromise=null;throw error;});
 return assetsPromise;
}

function base64(bytes){
 let value='';
 for(let start=0;start<bytes.length;start+=8192)value+=String.fromCharCode(...bytes.subarray(start,start+8192));
 return btoa(value);
}

const clean=value=>String(value??'').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'');
const navy=[50,48,111],blue=[49,87,165],ink=[23,25,48],muted=[94,100,125];

export function renderGrowPdf({jsPDF,regular,bold,logo},info){
 const {canvas}=info;
 if(!canvas?.data)throw Error('Simpan GROW Canvas terlebih dahulu sebelum mengunduh.');
 const pdf=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
 for(const [name,style,bytes] of [['PlusJakartaSans-Regular.ttf','normal',regular],['PlusJakartaSans-Bold.ttf','bold',bold]]){
  pdf.addFileToVFS(name,base64(bytes));
  pdf.addFont(name,'PlusJakartaSans',style);
 }
 pdf.setFont('PlusJakartaSans');
 pdf.setProperties({title:'GROW Canvas - '+clean(info.name),author:'IPB LEAP',creator:'IPB LEAP'});
 const left=17,width=176,bottom=276,lineHeight=5.3;
 let y;
 function page(){
  if(y!==undefined)pdf.addPage();
  pdf.setFillColor(...navy);
  pdf.rect(0,0,210,3,'F');
  const image=pdf.getImageProperties(logo);
  const imageWidth=25;
  pdf.addImage(logo,'PNG',left,10,imageWidth,imageWidth*image.height/image.width);
  pdf.setFont('PlusJakartaSans','bold').setFontSize(18).setTextColor(...navy);
  pdf.text('GROW Canvas',52,18);
  pdf.setFont('PlusJakartaSans','normal').setFontSize(8).setTextColor(...muted);
  pdf.text('IPB LEAP · Leadership Acceleration Program',52,24);
  pdf.setDrawColor(222,227,241).line(left,32,193,32);
  y=40;
 }
 function space(height){if(y+height>bottom)page();}
 function lines(value,size=9.5,color=ink,bold=false){
  pdf.setFont('PlusJakartaSans',bold?'bold':'normal').setFontSize(size);
  const wrapped=pdf.splitTextToSize(clean(value),width);
  for(const line of wrapped){
   space(lineHeight);
   pdf.setFont('PlusJakartaSans',bold?'bold':'normal').setFontSize(size).setTextColor(...color);
   pdf.text(line,left,y);
   y+=lineHeight;
  }
 }
 function field(label,value){
  space(17);
  lines(label,8.5,blue,true);
  lines(value===undefined||value===null||value===''?'Belum diisi':value);
  y+=3;
 }
 function section(title){
  space(24);
  pdf.setFillColor(237,241,251).roundedRect(left,y-4,width,11,2,2,'F');
  pdf.setFont('PlusJakartaSans','bold').setFontSize(12).setTextColor(...navy);
  pdf.text(title,left+4,y+3);
  y+=16;
 }
 page();
 field('Mentee',info.name);
 field('Batch',info.batch);
 field('Track',info.track);
 if(info.group)field('Kelompok',info.group);
 field('Status',canvas.status||'Draft');
 if(canvas.version)field('Versi',canvas.version);
 const saved=new Date(canvas.at||canvas.savedAt||'');
 if(!Number.isNaN(saved.getTime()))field('Terakhir disimpan',new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(saved)+' WIB');
 if(info.northStar)field('North Star',info.northStar);

 const d=canvas.data;
 section('G · Goal');
 field('Tujuan yang ingin dicapai',d.goal);
 field('Mengapa tujuan ini penting?',d.why);
 for(const [index,kpi] of (d.kpis||[]).entries()){
  space(25);
  lines('KPI '+(index+1),11,navy,true);
  lines(info.kpiLabels?.[kpi.id]||kpi.id,10,ink,true);
  y+=4;
  field('Kondisi awal / baseline',kpi.baseline);
  field('Cara ukur dan bukti keberhasilan',kpi.measurement);
  for(const period of periods){
   const dates=phaseDates(period,info.startsOn);
   field('Milestone '+phaseName(period)+(dates?' · '+dates:''),kpi.milestones?.[period]);
  }
 }
 if(!d.kpis?.length)field('KPI dan milestone','Belum ada KPI yang ditambahkan.');
 section('R · Reality');
 field('Kondisi sekarang dan hambatan',d.reality);
 field('Dukungan yang dibutuhkan dari Mentor',d.mentorNeed);
 section('O · Options');
 field('Pilihan cara atau strategi',d.options);
 section('W · Way Forward');
 field('Langkah awal yang dipilih',d.wayForward);
 if(canvas.asmenComment||canvas.mentorComment){
  section('Catatan pendamping');
  if(canvas.asmenComment)field('Catatan Asmen',canvas.asmenComment);
  if(canvas.mentorComment)field('Catatan Mentor',canvas.mentorComment);
 }
 const count=pdf.getNumberOfPages();
 for(let index=1;index<=count;index++){
  pdf.setPage(index);
  pdf.setDrawColor(222,227,241).line(left,283,193,283);
  pdf.setFont('PlusJakartaSans','normal').setFontSize(8).setTextColor(...muted);
  pdf.text('IPB LEAP · '+clean(canvas.status||'Draft'),left,289);
  pdf.text(index+' / '+count,193,289,{align:'right'});
 }
 return new Uint8Array(pdf.output('arraybuffer'));
}

export async function downloadGrowPdf(info){
 const resources=await loadAssets();
 const bytes=renderGrowPdf(resources,info);
 const name=clean(info.name||'Mentee').replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/\s+/g,'-').slice(0,70)||'Mentee';
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const link=document.createElement('a');
 link.href=url;
 link.download='GROW-Canvas-'+name+'.pdf';
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
