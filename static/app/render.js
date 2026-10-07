/**
 * The rendered page: the preview frame, kept in step with the editor.
 */

import { el, state, RENDER_DELAY } from './state.js';
import { api, contentUrl } from './api.js';
import { toast } from './status.js';
import { updatePresentable } from './deck.js';

// The frame says 'ready' when it loads, but it may have loaded before this
// module ran and that message is gone. So also ask: a 'ping' is answered with
// 'ready' by a frame that's already listening, and lost harmlessly by one
// that isn't (it will announce itself when it loads).
export function whenReady(frame) {
  return new Promise((resolve) => {
    window.addEventListener('message', (e) => {
      if (e.source === frame.contentWindow && e.data?.type === 'ready') resolve();
    });
    const ping = () => frame.contentWindow?.postMessage({ type: 'ping' }, '*');
    frame.addEventListener('load', ping);
    ping();
  });
}

let renderTimer = 0;
export function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, RENDER_DELAY);
}

export async function renderNow({ resetScroll = false } = {}) {
  clearTimeout(renderTimer);
  if (state.current?.type !== 'md') return;
  const seq = ++state.renderSeq;
  const path = state.current.path;
  let out;
  try {
    out = await api('POST', '/api/render', { text: el.editor.value, path });
  } catch (err) {
    return toast(`render: ${err.message}`, true);
  }
  if (seq !== state.renderSeq) return;
  updatePresentable(out.deck);
  await state.previewReady;
  el.preview.contentWindow.postMessage({
    type: 'render',
    css: out.css,
    body: out.body,
    base: baseFor(path),
    resetScroll,
  }, '*');
}

/** Where a note's relative links and images resolve. */
export function baseFor(path) {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  return new URL(contentUrl(dir), location.href).href;
}

export function showPreview() {
  el.preview.hidden = false;
  el.pdfView.hidden = true;
  el.empty.hidden = true;
  el.split.classList.remove('pdf-mode');
}

export function showEmpty(msg) {
  el.preview.hidden = true;
  el.pdfView.hidden = true;
  el.empty.hidden = false;
  el.empty.textContent = msg;
  el.editor.disabled = true;
}

export function syncScroll() {
  if (state.current?.type !== 'md' || el.preview.hidden) return;
  const t = el.editor;
  const max = t.scrollHeight - t.clientHeight;
  el.preview.contentWindow.postMessage({ type: 'scroll', fraction: max > 0 ? t.scrollTop / max : 0 }, '*');
}
