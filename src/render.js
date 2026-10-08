// Playwright HTML -> PDF (vector text, never screenshot).
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { readFileSync, writeFileSync } from "node:fs";

// Prefer bundled chromium; fall back to the system Edge (Windows/macOS)
// so users can skip the browser download entirely.
async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (e) {
    try {
      return await chromium.launch({ channel: "msedge" });
    } catch {
      try {
        return await chromium.launch({ channel: "chrome" });
      } catch {
        throw e; // report the original missing-chromium error (its hint is the useful one)
      }
    }
  }
}

export async function htmlToPdf(html, { cfg, out, title, author }) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: out,
      width: cfg.page.width,
      height: cfg.page.height,
      margin: { top: "0", bottom: "0", left: "0", right: "0" }, // @page handles margins
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:7pt;color:#98a2b3;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      headerFooterFontSize: 7,
    });
    if (title) {
      // cheap metadata pass via playwright is not available for pdf; skip (title set by some engines)
    }
  } finally {
    await browser.close();
  }
  // metadata pass (title/author from draft.meta)
  if (title) {
    const doc = await PDFDocument.load(readFileSync(out));
    doc.setTitle(title);
    if (author) doc.setAuthor(author);
    doc.setProducer("ai-girls-report");
    doc.setModificationDate(new Date());
    writeFileSync(out, await doc.save());
  }
}
