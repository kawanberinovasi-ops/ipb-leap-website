const ICONS = {
  beranda: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21v-7h6v7',
  program: 'M4 4h6a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H4z M20 4h-6a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h5z',
  kelompok: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M22 21v-2a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8',
  kehadiran: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h3v3h3v3 M15 21v-3 M21 15v1',
  kalender: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 3v4 M17 3v4 M3 10h18 M8 15h2 M14 15h2',
  event: 'M4 6h16a1 1 0 0 1 1 1v2a3 3 0 0 0 0 6v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a3 3 0 0 0 0-6V7a1 1 0 0 1 1-1z M15 6v2m0 3v2m0 3v2',
  workspace: 'M3 7h18v13H3z M8 7V4h8v3 M3 12h18 M10 11v3h4v-3',
  sistem: 'M3 4h18v13H3z M8 21h8 M12 17v4',
  more: 'M5 12h.1 M12 12h.1 M19 12h.1',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0z M15 15l5 5',
  account: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  logout: 'M10 20H4V4h6 M9 12h12 m-4-4 4 4-4 4',
  close: 'M6 6l12 12 M18 6 6 18',
};
const pathOf = href => new URL(href, location.href).pathname;
const node = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};
function icon(key) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  for (const [attr,val] of Object.entries({viewBox:'0 0 24 24',width:21,height:21,fill:'none',stroke:'currentColor','stroke-width':key==='more'?3.7:1.75,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) svg.setAttribute(attr,val);
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d',ICONS[key]||ICONS.program);
  svg.append(path);
  return svg;
}

export function mountMobileNavigation({items, mobileRole:role, mobileTheme:theme, mobilePresence, name, roleLabel, logout}) {
  const header=document.querySelector('.leap-erp-header');
  if(!header || location.pathname.includes('/review-penilaian/'))return;
  document.querySelector('.leap-mobile-menu[open]')?.close();
  document.querySelector('.leap-mobile-nav')?.remove();
  document.querySelector('.leap-mobile-menu')?.remove();
  const nav=node('nav','leap-mobile-nav');
  nav.setAttribute('aria-label','Menu utama seluler');
  nav.dataset.theme=theme;
  const sheet=node('dialog','leap-mobile-menu');
  sheet.id='leap-mobile-menu';
  sheet.dataset.theme=theme;
  sheet.setAttribute('aria-labelledby','leap-mobile-title');
  const current=location.pathname;
  const isCurrent=item=>Boolean(item.href&&pathOf(item.href)===current);
  const moreLinks=[];
  let primary=items.slice(0,4);
  if(role==='mentee'){
    primary=[...items.slice(0,2),{key:'kehadiran',label:'Kehadiran Saya',href:mobilePresence},items.find(x=>x.key==='kalender')];
  }else if(role==='event'){
    const entries=items.find(x=>x.key==='program').children;
    primary=[{...entries[1],key:'kehadiran',mobileLabel:'Absensi'},{...entries[0],key:'event',mobileLabel:'Kegiatan'},items.find(x=>x.key==='kalender')];
  }else if(role==='superadmin'){
    primary=items.filter(x=>['beranda','program'].includes(x.key));
  }
  for(const item of items){
    if(role==='event'||role==='superadmin')continue;
    if(!primary.some(x=>x.key===item.key))moreLinks.push(item);
  }
  const directMatch=primary.some(isCurrent)||moreLinks.some(isCurrent);
  let trigger;
  function show(button,title,entries,account=false) {
    trigger=button;
    const head=node('div','leap-sheet-head');
    const titleBox=node('div');
    const heading=node('h2','',title);
    heading.id='leap-mobile-title';
    titleBox.append(heading);
    if(account)titleBox.append(node('p','',[name,roleLabel].filter(Boolean).join(' · ')));
    const close=node('button','leap-sheet-close');
    close.type='button';
    close.setAttribute('aria-label','Tutup menu');
    close.append(icon('close'));
    close.addEventListener('click',()=>sheet.close());
    head.append(titleBox,close);
    const links=node('div','leap-sheet-links');
    for(const entry of entries){
      const link=node(entry.href?'a':'button','leap-sheet-link');
      if(entry.href)link.href=entry.href;
      else link.type='button';
      if(isCurrent(entry))link.setAttribute('aria-current','page');
      if(entry.logout)link.addEventListener('click',logout);
      if(entry.search)link.addEventListener('click',()=>{
        sheet.close();
        // The existing search handles keyboard shortcuts, results, and permissions.
        requestAnimationFrame(()=>header.querySelector('[data-leap-search]')?.click());
      });
      const label=node('span','',entry.label);
      if(entry.desc)label.append(node('small','',entry.desc));
      link.append(icon(entry.key),label);
      links.append(link);
    }
    sheet.replaceChildren(head,links);
    button.setAttribute('aria-expanded','true');
    sheet.showModal();
    close.focus();
  }
  sheet.addEventListener('close',()=>{
    trigger?.setAttribute('aria-expanded','false');
    trigger?.focus({preventScroll:true});
  });
  sheet.addEventListener('click',e=>{
    const bounds=sheet.getBoundingClientRect();
    if(e.target===sheet&&(e.clientY<bounds.top||e.clientX<bounds.left||e.clientX>bounds.right))sheet.close();
  });
  header.leapMobileController?.abort();
  header.leapMobileController=new AbortController();
  const mode=matchMedia('(max-width:980px)');
  mode.addEventListener('change',e=>{if(!e.matches&&sheet.open)sheet.close();},{signal:header.leapMobileController.signal});
  for(const item of [...primary,{key:'more',label:'Lainnya'}]){
    const isMore=item.key==='more';
    const control=node(item.href?'a':'button');
    const selected=isMore?moreLinks.some(isCurrent):isCurrent(item)||(!directMatch&&Boolean(item.children)&&(item.children.some(isCurrent)||item.current==='page'));
    control.dataset.active=String(selected);
    if(item.href){
      control.href=item.href;
      if(selected)control.setAttribute('aria-current','page');
    }else{
      control.type='button';
      control.setAttribute('aria-haspopup','dialog');
      control.setAttribute('aria-controls',sheet.id);
      control.setAttribute('aria-expanded','false');
      control.addEventListener('click',()=>show(control,item.label,isMore?[
        ...moreLinks,{key:'search',label:'Cari',search:true},
        {key:'account',label:'Profil & ID Card',href:'pengaturan.html'},
        {key:'account',label:'Pengaturan akun',href:'pengaturan.html'},
        {key:'logout',label:'Keluar',href:'index.html',logout:true},
      ]:item.children,isMore));
    }
    const wrap=node('span','leap-mobile-icon');
    wrap.append(icon(role==='superadmin'&&item.key==='beranda'?'sistem':item.key));
    control.append(wrap,node('span','',item.mobileLabel||(item.key==='kehadiran'?'Kehadiran':item.label)));
    nav.append(control);
  }
  document.body.append(nav,sheet);
}
