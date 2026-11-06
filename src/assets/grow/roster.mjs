const esc=value=>String(value??'').replace(/[&<>"']/g,char=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

const initials=name=>name.trim().split(/\s+/u).slice(0,2)
  .map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('id-ID');

export function menteeRoster(scope,title,href) {
  const groups=scope.groups.filter(group=>!scope.group||group.id===scope.group.id);
  const sections=groups.map(group=>{
    const people=scope.people.filter(person=>person.groupId===group.id)
      .sort((a,b)=>a.name.localeCompare(b.name,'id'));
    if(!people.length)return '';
    return `<section class="card stack"><h2>${esc(group.name||'Kelompok dampingan')}</h2>
      <ul class="roster-list">${people.map(person=>`<li><a class="button roster-tile" href="${esc(href({mentee:person.id,group:group.id}))}"><span class="roster-initials" aria-hidden="true">${esc(initials(person.name))}</span><span>${esc(person.name)}</span></a></li>`).join('')}</ul>
    </section>`;
  }).join('');
  return `<header class="rise"><p class="eyebrow">Kelompok · ${esc(scope.cohort.name)}</p>
    <h1>${esc(title)}</h1><p class="sub">Pilih mentee yang ingin kamu lihat.</p></header>
    <div class="stack space">${sections||'<section class="card"><h2>Belum ada mentee ditugaskan</h2><p class="sub">Daftar akan muncul setelah Pengurus melengkapi penempatan kelompok.</p></section>'}</div>`;
}
