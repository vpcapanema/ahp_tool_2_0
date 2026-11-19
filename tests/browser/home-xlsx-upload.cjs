const { chromium } = require('R:/sad_slt/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

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

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${base}/sigma-ahp.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.sigma-cabecalho-fixo a[href="glossario"]', { state: 'attached' });
    if (await page.locator('main a[href="glossario"]').count()) throw new Error('O link antigo do glossário permanece no conteúdo da página.');
    const offsets = await page.locator('.process-card').evaluateAll((cards) => cards.map((card) => {
      const number = card.querySelector('.process-number').getBoundingClientRect();
      const title = card.querySelector('h3').getBoundingClientRect();
      return Math.abs((number.top + number.height / 2) - (title.top + title.height / 2));
    }));
    if (offsets.some((offset) => offset > 1)) throw new Error(`Desalinhamento vertical: ${offsets.join(', ')}`);

    await page.goto(`${base}/step1-criterios.html`, { waitUntil: 'networkidle' });
    await page.check('#method-upload');
    const xlsxButton = page.getByRole('button', { name: /Baixar Modelo XLSX/i });
    if (!(await xlsxButton.isVisible())) throw new Error('Botão XLSX não está visível.');
    if (await page.getByText(/Baixar Modelo JSON/i).count()) throw new Error('Botão JSON ainda aparece.');
    const accept = await page.locator('#matrix-file-input').getAttribute('accept');
    if (accept !== '.csv,.xlsx') throw new Error(`Tipos aceitos incorretos: ${accept}`);
    const [download] = await Promise.all([page.waitForEvent('download'), xlsxButton.click()]);
    if (download.suggestedFilename() !== 'modelo_matriz_ahp.xlsx') throw new Error('Nome do download XLSX incorreto.');

    await page.locator('#matrix-file-input').setInputFiles(path.join(root, 'modelo_matriz_ahp.xlsx'));
    await page.waitForSelector('.notification-success');
    await page.getByRole('button', { name: /Processar Matriz/i }).click();
    const stored = await page.evaluate(() => ({
      criteria: JSON.parse(localStorage.getItem('ahp_criteria')),
      matrix: JSON.parse(localStorage.getItem('ahp_uploadedMatrix'))
    }));
    if (stored.criteria.length !== 3 || stored.matrix.length !== 3) throw new Error('A matriz XLSX não foi armazenada corretamente.');
    console.log(JSON.stringify({ offsets, accept, criteria: stored.criteria, matrix: stored.matrix }));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
