// IPB LEAP Learning & Curriculum Draft 4, slides 17, 19, 22, 25, 28.
// Existing track catalogue; these are focus areas, not automatic personal targets.
export const TRACKS=[
 {field:'Entrepreneur / Business',aliases:['Entrepreneur','Business'],pathways:['Validate','Grow'],kpis:['Market & Customer Validation','Customer Traction','Commercial Performance','Business Sustainability']},
 {field:'Academic & Research',aliases:['Academic','Akademisi & Peneliti'],pathways:['Produce','Advance'],kpis:['Kejelasan arah riset','Kualitas dan produktivitas karya','Kolaborasi dan jaringan ilmiah','Kesiapan jenjang berikutnya']},
 {field:'Professional / Corporate / Bureaucracy',aliases:['Professional','Professional & Birokrat'],pathways:['Career Acceleration','Career Transition'],kpis:['Nilai profesional','Kinerja dan kontribusi','Jaringan dan portfolio','Kesiapan transisi karier']},
 {field:'Politics / Public Leadership',aliases:['Politics','Public','Politik'],pathways:['Community Leadership','Organizational Leadership','Policy / Public Initiative'],kpis:['Kejelasan isu dan konstituen','Koalisi dan legitimasi','Eksekusi inisiatif publik','Tanggung jawab kepemimpinan']},
 {field:'Social & Community / Social Impact',aliases:['Social & Community / NGO / Social Impact','Social & Community','Social','Sosial & Komunitas'],pathways:['Implement','Strengthen / Scale'],kpis:['Masalah dan penerima manfaat','Desain dan eksekusi intervensi','Kekuatan kemitraan','Keberlanjutan dampak']}
];
export const trackFor=field=>TRACKS.find(t=>[t.field,...t.aliases].some(x=>x.toLowerCase()===String(field||'').trim().toLowerCase()));
