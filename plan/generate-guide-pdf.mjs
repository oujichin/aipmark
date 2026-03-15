import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'pmark-guide.html');
const pdfPath = path.join(__dirname, 'Pマーク完全理解ガイド.pdf');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', right: '16mm', bottom: '22mm', left: '16mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;text-align:center;font-size:8pt;color:#999;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
await browser.close();
console.log('PDF generated:', pdfPath);
