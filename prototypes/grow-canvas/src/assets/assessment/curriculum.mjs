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

// English presentation labels; canonical identifiers above preserve existing answers/history.
const KPI_LABELS={
 'Kejelasan arah riset':'Research Direction Clarity',
 'Kualitas dan produktivitas karya':'Research Quality & Productivity',
 'Kolaborasi dan jaringan ilmiah':'Scientific Collaboration & Networks',
 'Kesiapan jenjang berikutnya':'Readiness for the Next Academic Stage',
 'Nilai profesional':'Professional Value',
 'Kinerja dan kontribusi':'Performance & Contribution',
 'Jaringan dan portfolio':'Professional Network & Portfolio',
 'Kesiapan transisi karier':'Career Transition Readiness',
 'Kejelasan isu dan konstituen':'Issue & Constituency Clarity',
 'Koalisi dan legitimasi':'Coalition Building & Legitimacy',
 'Eksekusi inisiatif publik':'Public Initiative Execution',
 'Tanggung jawab kepemimpinan':'Leadership Accountability',
 'Masalah dan penerima manfaat':'Problem & Beneficiaries',
 'Desain dan eksekusi intervensi':'Intervention Design & Execution',
 'Kekuatan kemitraan':'Partnership Strength',
 'Keberlanjutan dampak':'Impact Sustainability'
};
export const kpiLabel=value=>KPI_LABELS[value]||value;
