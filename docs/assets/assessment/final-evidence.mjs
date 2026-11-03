// Pilihan dokumen POC; disimpan bersama versi KPI, bukan sebagai bukti aktual.
export const EVIDENCE_TRACKS = [
 ['Entrepreneur / Business', ['Invoice dan bukti transaksi','Laporan penjualan','Rekening usaha','Data pelanggan serta pembelian ulang','Catatan arus kas, biaya, dan margin']],
 ['Academic & Research', ['Naskah / karya riset','Bukti submission dan review','Publikasi','Dokumen persetujuan pendanaan riset','Letter of Acceptance studi lanjut']],
 ['Professional / Corporate / Bureaucracy', ['Hasil proyek dan portfolio kontribusi','SK promosi atau penugasan baru','Offering letter','Dokumen perpindahan peran','Bukti resmi kelulusan seleksi ASN/BUMN']],
 ['Politics / Public Leadership', ['SK / mandat dan pembagian peran','Hasil inisiatif publik','Dokumen kontribusi kebijakan','Hasil proyek','Konfirmasi warga atau organisasi mengenai kontribusi mentee']],
 ['Social & Community / Social Impact', ['Catatan pelaksanaan dan penerima manfaat','Data kondisi awal dibanding hasil','Konfirmasi penerima manfaat','Dokumen serah terima','Komitmen mitra','Tim lokal','Pendanaan lanjutan']]
];
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function selectedDocuments(k) {
 return EVIDENCE_TRACKS.flatMap(([track, docs], t) => docs.filter((_, n) => k.finalDocuments?.['t'+t]?.['d'+n] === true));
}
export function evidenceFields(k, i, track, field, select) {
 const chosen = k.finalTrack || track || '';
 return `<section class="form-section final-evidence"><h3>Dokumen bukti akhir periode</h3><p class="help">Pilih dokumen yang relevan dengan track, KPI ini, dan milestone dalam Personal Outcome Contract. Dokumen terpilih dikumpulkan pada akhir masa periode IPB LEAP (M12). Tidak semua jenis dokumen wajib dikumpulkan.</p>${select(`kpis.${i}.finalTrack`, 'Track untuk bukti KPI ini', EVIDENCE_TRACKS.map(([t])=>t), chosen, '', 'data-evidence-track')}${EVIDENCE_TRACKS.map(([t,docs],n)=>`<details data-evidence-group="${escape(t)}" ${t===chosen?'open':''}><summary>${escape(t)}</summary>${docs.map((label,j)=>field(`kpis.${i}.finalDocuments.t${n}.d${j}`,label,k.finalDocuments?.['t'+n]?.['d'+j]===true,'checkbox')).join('')}</details>`).join('')}${field(`kpis.${i}.finalOther`,'Dokumen lain yang relevan (opsional)',k.finalOther,'textarea')}${field(`kpis.${i}.finalMilestone`,'Milestone / hasil yang akan dibuktikan oleh dokumen terpilih',k.finalMilestone,'textarea','Jelaskan dokumen mana yang membuktikan target atau milestone KPI ini, termasuk hasil akhir M12.')}<p class="help">Rencana pilihan dokumen disepakati bersama Mentor dalam POC. Bukti hasil aktual dan tautannya diisi melalui Progres & bukti pada akhir periode.</p></section>`;
}
export function evidenceSummary(k) {
 const docs = selectedDocuments(k), other = k.finalOther?.trim();
 return `<section class="final-evidence"><h4>Dokumen yang dikumpulkan pada akhir periode · M12</h4>${k.finalTrack?`<p class="help">Track: ${escape(k.finalTrack)}</p>`:''}${docs.length||other?`<ul>${docs.map(d=>`<li>${escape(d)}</li>`).join('')}${other?`<li>${escape(other)}</li>`:''}</ul>`:'<p class="help">Pilihan dokumen akhir periode belum ditetapkan. Rencana bukti POC sebelumnya tetap berlaku.</p>'}${k.finalMilestone?`<p><strong>Milestone yang dibuktikan:</strong> ${escape(k.finalMilestone)}</p>`:''}<p class="help">Dokumen mengikuti track, KPI yang dipilih, dan milestone POC. Pilihan ini adalah rencana pengumpulan; capaian diperiksa melalui bukti hasil aktual.</p></section>`;
}
export function bindEvidenceTracks(doc = document) {
 doc.querySelectorAll('[data-evidence-track]').forEach(select => select.addEventListener('change',()=>{
  select.closest('.final-evidence').querySelectorAll('[data-evidence-group]').forEach(group=>group.open=group.dataset.evidenceGroup===select.value);
 }));
}
