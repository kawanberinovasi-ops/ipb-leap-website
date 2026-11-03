// Pilihan dokumen POC; disimpan bersama versi KPI, bukan sebagai bukti aktual.
// Null entries reserve retired document keys so saved selections never shift.
export const EVIDENCE_TRACKS = [
 ['Entrepreneur / Business', ['Invoice dan bukti transaksi','Laporan penjualan','Rekening usaha','Data pelanggan serta pembelian ulang','Catatan arus kas, biaya, dan margin']],
 ['Academic & Research', ['Naskah / karya riset','Bukti submission dan review','Publikasi','Dokumen persetujuan pendanaan riset','Letter of Acceptance studi lanjut']],
 ['Professional / Corporate / Bureaucracy', ['Hasil proyek dan portfolio kontribusi','SK promosi atau penugasan baru','Offering letter','Dokumen perpindahan peran','Bukti resmi kelulusan seleksi ASN/BUMN']],
 ['Politics / Public Leadership', ['SK / mandat dan pembagian peran','Hasil inisiatif publik','Dokumen kontribusi kebijakan','Hasil proyek','Konfirmasi warga atau organisasi mengenai kontribusi mentee']],
 ['Social & Community / Social Impact', ['Laporan pelaksanaan dan Penerima manfaat','Data kondisi awal dibanding hasil','Konfirmasi penerima manfaat','Dokumen serah terima','Dokumen Kerjasama dengan mitra',null,'Pendanaan lanjutan']]
];
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function selectedDocuments(k, assignedTrack) {
 const chosen = assignedTrack === undefined ? k.finalTrack : assignedTrack;
 return EVIDENCE_TRACKS.flatMap(([track, docs], t) => chosen && track !== chosen ? [] : docs.filter((label, n) => label && k.finalDocuments?.['t'+t]?.['d'+n] === true));
}
export function evidenceFields(k, i, track, field) {
 const chosen = track || '', index = EVIDENCE_TRACKS.findIndex(([name]) => name === chosen);
 const group = EVIDENCE_TRACKS[index];
 const heading = group ? `<p class="help">Track mentee: <strong>${escape(chosen)}</strong> · Mengikuti penugasan mentee.</p><input type="hidden" name="kpis.${i}.finalTrack" value="${escape(chosen)}"><div data-evidence-group="${escape(chosen)}">${group[1].map((label,j)=>label?field(`kpis.${i}.finalDocuments.t${index}.d${j}`,label,k.finalDocuments?.['t'+index]?.['d'+j]===true,'checkbox'):'').join('')}</div>` : '<p class="notice">Track mentee belum ditetapkan. Hubungi pengelola agar pilihan dokumen sesuai track dapat ditampilkan.</p>';
 return `<section class="form-section final-evidence"><h3>Dokumen bukti akhir periode</h3>${heading}${field(`kpis.${i}.finalOther`,'Dokumen lain yang relevan (opsional)',k.finalOther,'textarea')}${field(`kpis.${i}.finalMilestone`,'Milestone / hasil yang akan dibuktikan oleh dokumen terpilih',k.finalMilestone,'textarea','Jelaskan dokumen mana yang membuktikan target atau milestone KPI ini, termasuk hasil akhir M12.')}<p class="help">Rencana pilihan dokumen disepakati bersama Mentor dalam POC. Bukti hasil aktual dan tautannya diisi melalui Progres & bukti pada akhir periode.</p></section>`;
}
export function evidenceSummary(k, assignedTrack) {
 const chosen = assignedTrack === undefined ? k.finalTrack : assignedTrack;
 const docs = chosen === '' ? [] : selectedDocuments(k, chosen), other = k.finalOther?.trim();
 return `<section class="final-evidence"><h4>Dokumen yang dikumpulkan pada akhir periode · M12</h4>${chosen?`<p class="help">Track mentee: ${escape(chosen)}</p>`:''}${docs.length||other?`<ul>${docs.map(d=>`<li>${escape(d)}</li>`).join('')}${other?`<li>${escape(other)}</li>`:''}</ul>`:'<p class="help">Pilihan dokumen akhir periode belum ditetapkan. Rencana bukti POC sebelumnya tetap berlaku.</p>'}${k.finalMilestone?`<p><strong>Milestone yang dibuktikan:</strong> ${escape(k.finalMilestone)}</p>`:''}<p class="help">Dokumen mengikuti track, KPI yang dipilih, dan milestone POC. Pilihan ini adalah rencana pengumpulan; capaian diperiksa melalui bukti hasil aktual.</p></section>`;
}
// Compatibility with the existing shared POC binder; track is no longer editable.
export function bindEvidenceTracks() {}
