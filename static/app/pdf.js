/**
 * A PDF, drawn page by page with PDF.js as it scrolls into view.
 */

import { el, state } from './state.js';
import { contentUrl } from './api.js';
import { showEmpty } from './render.js';

let pdfjs = null;
let pdfObserver = null;

export async function showPdf(p) {
  el.preview.hidden = true;
  el.empty.hidden = true;
  el.pdfView.hidden = false;
  el.split.classList.add('pdf-mode');
  el.editor.disabled = true;
  el.pdfView.replaceChildren();
  el.pdfView.scrollTop = 0;
  pdfObserver?.disconnect();

  try {
    if (!pdfjs) {
      pdfjs = await import('/vendor/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
    }
    const doc = await pdfjs.getDocument({ url: contentUrl(p) }).promise;
    if (state.current?.path !== p) return;

    const width = el.pdfView.clientWidth - 32;
    const first = await doc.getPage(1);
    const base = first.getViewport({ scale: 1 });
    const scale = width / base.width;

    // Lay out placeholders for every page at once so the scrollbar is right,
    // then draw each page as it comes into view.
    pdfObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !e.target.dataset.drawn) {
          e.target.dataset.drawn = '1';
          drawPdfPage(doc, Number(e.target.dataset.page), scale, e.target);
        }
      }
    }, { root: el.pdfView, rootMargin: '600px 0px' });

    for (let n = 1; n <= doc.numPages; n++) {
      const sheet = document.createElement('div');
      sheet.className = 'pdf-page';
      sheet.dataset.page = n;
      sheet.style.width = `${Math.floor(base.width * scale)}px`;
      sheet.style.height = `${Math.floor(base.height * scale)}px`;
      el.pdfView.append(sheet);
      pdfObserver.observe(sheet);
    }
  } catch (err) {
    showEmpty(`Couldn't open PDF: ${err.message}`);
  }
}

export async function drawPdfPage(doc, n, scale, sheet) {
  const page = await doc.getPage(n);
  const dpr = window.devicePixelRatio || 1;
  const vp = page.getViewport({ scale: scale * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  sheet.style.height = `${Math.floor(vp.height / dpr)}px`;
  sheet.append(canvas);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
}
