import {rpc} from '../assessment/api.mjs';
import {boot, href, role, scope} from '../grow/context.mjs';
import {blocks, blockLimit} from './blocks.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);
const page = 'development-model-canvas.html';
const canvasBlocks = [
  'partners','activities','value','engagement','audience',
  'resources','channels','costs','outcomes',
].map(id => blocks.find(block => block.id === id));

function picker(name, label, options, selected) {
  return `<label>${label}<select name="${name}">${options.map(({id, name}) =>
    `<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
}

function cards(values, editable) {
  return `<div class="dmc-grid">${canvasBlocks.map(({id,label,prompt}, index) => {
    const title = `<span class="dmc-block-title"><span class="step-label" aria-hidden="true">${index+1}</span><span>${label}</span></span>`;
    return editable
      ? `<div class="card" data-block="${id}"><label>${title}<span class="help" id="dmc-help-${id}">${prompt}</span><textarea name="${id}" aria-describedby="dmc-help-${id}" maxlength="${blockLimit}">${esc(values[id])}</textarea></label></div>`
      : `<article class="card" data-block="${id}"><h3>${title}</h3><dl class="facts"><div><dt class="help">${prompt}</dt><dd>${esc(values[id] || 'Belum diisi')}</dd></div></dl></article>`;
  }).join('')}</div>`;
}

export async function mount() {
  const root = document.querySelector('#dmc-app');
  if (!await boot({requireTrack:false})) {
    root.textContent = 'Akun belum dapat diperiksa.';
    return;
  }
  if (!['mentee','asmen','mentor'].includes(role)) throw Error('Fitur ini tersedia untuk Mentee, Asmen, dan Mentor.');

  const editable = role === 'mentee';
  const args = {p_cohort:scope.cohort.id, p_mentee:scope.mentee};
  const state = await rpc('erp_dmc_state', {...args, p_role:role});
  let revision = state.revision;
  const heading = editable ? 'PROGRAM · MENTEE' : `KELOMPOK · ${role.toUpperCase()}`;
  const people = scope.people.find(person => person.id === scope.mentee);
  root.innerHTML = `
    <header class="rise">
      <p class="eyebrow">${heading} · ${esc(scope.cohort.name)}</p>
      <h1>Leadership Model Canvas</h1>
      <p class="sub">Petakan rencana pengembangan dalam sembilan blok sebagai bekal mengisi GROW Canvas.</p>
      <p class="sub">${esc(people?.name)}${scope.enrolment?.field ? ' · '+esc(scope.enrolment.field) : ''}</p>
    </header>
    ${editable?'':`<div class="dmc-scope">
      ${scope.groups.length>1 ? picker('group','Kelompok',scope.groups,scope.group.id) : ''}
      ${picker('mentee','Mentee',scope.people,scope.mentee)}
    </div>`}
    ${editable ? `<form class="stack" id="dmc-form">
      <div><span class="badge" id="dmc-status"></span>
      <p class="help">Isi blok yang relevan. Draft hanya bisa kamu lihat. Asmen dan Mentor melihat versi terakhir yang kamu bagikan.</p></div>
      ${cards(state.draft || state.shared || {}, true)}
      <div class="actions">
        <button class="button" type="submit" value="draft">Simpan draft</button>
        <button class="button primary" type="submit" value="share">Bagikan ke pendamping</button>
        <a class="button" href="${esc(href('grow-canvas.html'))}">Lanjut ke GROW Canvas</a>
      </div>
      <output id="dmc-result" role="status" hidden></output>
    </form>` : state.shared ? `<p class="badge good">Dibagikan mentee</p><div class="space">${cards(state.shared,false)}</div>` :
      '<section class="card"><h2>Canvas belum dibagikan</h2><p class="sub">Canvas akan muncul setelah mentee membagikannya.</p></section>'}`;

  root.querySelector('[name=group]')?.addEventListener('change', event => {
    location.assign(href(page,{group:event.target.value,mentee:undefined}));
  });
  root.querySelector('[name=mentee]')?.addEventListener('change', event => {
    location.assign(href(page,{mentee:event.target.value}));
  });
  if (!editable) return;

  const form = root.querySelector('#dmc-form');
  const result = root.querySelector('#dmc-result');
  const status = root.querySelector('#dmc-status');
  const controls = [...form.querySelectorAll('textarea,button')];
  let dirty = false;
  let saving = false;
  const showStatus = ({draft,shared}) => {
    status.textContent = draft ? 'Draft tersimpan' : shared ? 'Dibagikan' : 'Belum diisi';
    status.classList.toggle('good', !draft && !!shared);
  };
  const showResult = (message, error = false) => {
    result.hidden = false;
    result.className = error ? 'notice error' : 'notice';
    result.textContent = message;
  };

  showStatus(state);
  form.addEventListener('input', () => {
    dirty = true;
    status.textContent = 'Perubahan belum disimpan';
    status.classList.remove('good');
    result.hidden = true;
  });
  window.addEventListener('beforeunload', event => {
    if (dirty || saving) event.preventDefault();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const sharing = event.submitter?.value === 'share';
    const data = new FormData(form);
    const values = Object.fromEntries(blocks.map(({id}) => [id, data.get(id).trim()]));
    if (sharing && !Object.values(values).some(Boolean)) {
      showResult('Isi minimal satu blok sebelum membagikan canvas.', true);
      return;
    }
    saving = true;
    controls.forEach(control => { control.disabled = true; });
    showResult('Menyimpan canvas…');
    try {
      const saved = await rpc('erp_dmc_save', {
        ...args, p_blocks:values, p_share:sharing, p_expected:revision,
      });
      revision = saved.revision;
      showStatus(saved);
      dirty = false;
      showResult(sharing ? 'Canvas dibagikan kepada Asmen dan Mentor.' : 'Draft canvas tersimpan.');
    } catch (error) {
      showResult(error.message || 'Canvas belum tersimpan. Coba lagi.', true);
    } finally {
      saving = false;
      controls.forEach(control => { control.disabled = false; });
      event.submitter?.focus();
    }
  });
}
