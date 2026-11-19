const { chromium } = require('R:/sad_slt/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let file = path.join(root, pathname === '/' ? 'sigma-ahp.html' : pathname.slice(1));
  if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});

server.listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);

    for (const count of [2, 7, 20]) {
      await page.evaluate((value) => {
        localStorage.setItem('ahp_criteriaCount', String(value));
        localStorage.removeItem('ahp_criteria');
      }, count);
      await page.goto(`${origin}/step2-nomes`);
      const layout = await page.locator('#criteriaInputs > .c-form-group').evaluateAll((items) => items.map((item) => {
        const box = item.getBoundingClientRect();
        const input = item.querySelector('input').getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), inputWidth: Math.round(input.width) };
      }));
      if (layout.length !== count) throw new Error(`Esperados ${count} campos; encontrados ${layout.length}.`);
      const columns = [...new Set(layout.map((item) => item.x))];
      if (count >= 2 && columns.length !== 2) throw new Error(`O grid de ${count} campos não formou duas colunas.`);
      layout.forEach((item, index) => {
        if (item.inputWidth > item.width + 1) throw new Error(`O input ${index + 1} excedeu a própria coluna.`);
        if (index >= 2 && item.x !== layout[index % 2].x) throw new Error(`Há lacuna intermediária antes do campo ${index + 1}.`);
      });
    }
    console.log('criteria-grid: ok');
  } finally {
    await browser.close();
    server.close();
  }
});
