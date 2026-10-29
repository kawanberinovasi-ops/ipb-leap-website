const { chromium } = require('playwright');
(async () => {
  const pages = process.argv.slice(2);
  const b = await chromium.launch();
  for (const p of pages) {
    const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    await pg.goto('http://localhost:8765/' + p, { waitUntil: 'networkidle' }).catch(e => errs.push('NAV ' + e.message));
    await pg.waitForTimeout(2500);
    const h = await pg.evaluate(() => document.body.scrollHeight);
    await pg.screenshot({ path: 'shots/' + p.replace('.html', '') + '.png', fullPage: true });
    console.log(p, 'height', h, errs.length ? errs.slice(0, 5).join(' | ') : 'OK');
    await pg.close();
  }
  await b.close();
})();
