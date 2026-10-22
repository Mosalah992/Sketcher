// The sketcher's desk: pictures come in (chosen, dropped or pasted), each is
// sketched in turn, and the sketches are saved one by one or all at once.
// Inside the app, saving goes through Neutralino's native dialogs; opened in a
// plain browser (for development), it falls back to downloads.

import { FORMATS, encode, sketch } from './sketch.js';

const native = typeof window.NL_PORT !== 'undefined' && typeof window.Neutralino !== 'undefined';
if (native) {
  Neutralino.init();
  // The native API token is handed out once per launch, so a reload would
  // leave the app unable to save. Keep the browser's own reload and menus away.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) e.preventDefault();
  });
}

const $ = (id) => document.getElementById(id);
const optionsForm = $('options');
const sheets = $('sheets');
const bar = $('bar');
const count = $('count');
const viewer = $('viewer');
const viewerSketch = $('viewerSketch');
const viewerOriginal = $('viewerOriginal');
const viewerToggle = $('viewerToggle');
const toastEl = $('toast');

/** @type {{ file: File, name: string, url: string, canvas: HTMLCanvasElement | null, have: string | null, error: string | null, li: HTMLLIElement, frame: HTMLElement }[]} */
const items = [];

function options() {
  const data = new FormData(optionsForm);
  return { frame: data.get('frame'), scale: Number(data.get('scale')), format: data.get('format') };
}
/** What a sketch depends on; the format only matters when saving. */
const sketchKey = ({ frame, scale }) => `${frame}@${scale}`;

// ---------- Taking pictures in ----------

/** Windows does not always give a dropped picture a type, so the name counts too. */
const isPicture = (f) => f.type.startsWith('image/') || /\.(jpe?g|jfif|png|webp|gif|bmp|avif|ico)$/i.test(f.name);

function add(fileList) {
  const files = [...fileList].filter(isPicture);
  if (!files.length) {
    if (fileList.length) toast('Those are not pictures.');
    return;
  }
  for (const file of files) items.push(card(file));
  refresh();
  pump();
}

function card(file) {
  const li = document.createElement('li');
  li.className = 'sheet is-busy';
  li.innerHTML = `
    <button type="button" class="sheet__view"><span class="sheet__frame"><span class="sheet__wait">Sketching…</span></span></button>
    <div class="sheet__foot">
      <span class="sheet__name"></span>
      <button type="button" class="btn btn--small" data-act="save">Save…</button>
      <button type="button" class="sheet__remove" data-act="remove" aria-label="Remove">×</button>
    </div>`;
  const name = file.name || 'pasted picture.png';
  li.querySelector('.sheet__name').textContent = name;
  li.querySelector('.sheet__name').title = name;
  li.querySelector('.sheet__view').setAttribute('aria-label', `View the sketch of ${name}`);
  sheets.append(li);
  const item = { file, name, url: URL.createObjectURL(file), canvas: null, have: null, error: null, li, frame: li.querySelector('.sheet__frame') };
  li.querySelector('.sheet__view').addEventListener('click', () => item.canvas && view(item));
  li.querySelector('[data-act="save"]').addEventListener('click', () => saveOne(item));
  li.querySelector('[data-act="remove"]').addEventListener('click', () => remove(item));
  return item;
}

function remove(item) {
  const at = items.indexOf(item);
  if (at < 0) return;
  items.splice(at, 1);
  item.li.remove();
  URL.revokeObjectURL(item.url);
  refresh();
}

function refresh() {
  const total = items.length;
  const busy = items.filter((it) => it.have !== sketchKey(options())).length;
  document.body.classList.toggle('has-sheets', total > 0);
  bar.hidden = total === 0;
  count.textContent = `${total} ${total === 1 ? 'picture' : 'pictures'}${busy ? ` · sketching ${busy}…` : ''}`;
}

// ---------- Sketching, one at a time ----------

let pumping = null;
/** After the next paint, or shortly if the window is minimised and nothing paints. */
const nextFrame = () =>
  new Promise((r) => {
    requestAnimationFrame(() => setTimeout(r, 0));
    setTimeout(r, 50);
  });

/** Sketch every picture whose sketch is missing or out of date. Resolves when all are current. */
function pump() {
  pumping ??= (async () => {
    for (;;) {
      const opts = options();
      const key = sketchKey(opts);
      const item = items.find((it) => it.have !== key);
      if (!item) break;
      item.li.classList.add('is-busy');
      await nextFrame(); // let "Sketching…" paint before the loops hold the thread
      try {
        const canvas = await sketch(item.file, opts);
        item.canvas = canvas;
        item.error = null;
        item.frame.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
        item.frame.replaceChildren(canvas);
      } catch (e) {
        item.canvas = null;
        item.error = e.message;
        item.frame.innerHTML = '<span class="sheet__wait sheet__wait--error"></span>';
        item.frame.firstChild.textContent = e.message;
      }
      item.have = key;
      item.li.classList.remove('is-busy');
      item.li.classList.toggle('is-broken', !!item.error);
      refresh();
    }
  })().finally(() => {
    pumping = null;
  });
  return pumping;
}

optionsForm.addEventListener('change', () => {
  refresh();
  pump();
});

// ---------- Saving ----------

function outName(item, format) {
  const base = item.name.replace(/\.[^.]+$/, '') || 'picture';
  return `${base}-sketch.${FORMATS[format].ext}`;
}

async function saveOne(item) {
  await pump();
  if (!item.canvas) return toast(item.error ?? 'This picture has no sketch.');
  const { format } = options();
  const blob = await encode(item.canvas, format);
  const name = outName(item, format);
  if (!native) return download(blob, name);

  const fmt = FORMATS[format];
  let path = await Neutralino.os.showSaveDialog('Save the sketch', {
    defaultPath: name,
    filters: [{ name: fmt.label, extensions: [fmt.ext] }],
  });
  if (!path) return;
  if (!/\.[a-z0-9]+$/i.test(path)) path += `.${fmt.ext}`;
  try {
    await Neutralino.filesystem.writeBinaryFile(path, await blob.arrayBuffer());
    toast(`Saved ${path.split(/[\\/]/).pop()}`);
  } catch (e) {
    toast(`Could not save: ${e.message ?? e}`);
  }
}

async function saveAll() {
  await pump();
  const ready = items.filter((it) => it.canvas);
  if (!ready.length) return toast('There is nothing to save yet.');
  const { format } = options();

  if (!native) {
    for (const item of ready) download(await encode(item.canvas, format), outName(item, format));
    return;
  }
  const dir = await Neutralino.os.showFolderDialog('Choose a folder for the sketches');
  if (!dir) return;
  let saved = 0;
  try {
    for (const item of ready) {
      const path = await freePath(dir, outName(item, format));
      await Neutralino.filesystem.writeBinaryFile(path, await (await encode(item.canvas, format)).arrayBuffer());
      saved++;
    }
  } catch (e) {
    return toast(`Saved ${saved}, then could not save: ${e.message ?? e}`);
  }
  toast(`Saved ${saved} ${saved === 1 ? 'sketch' : 'sketches'}.`, { label: 'Open folder', run: () => Neutralino.os.open(dir) });
}

/** A path in `dir` for `name` that does not overwrite anything: "x-sketch (2).png" and so on. */
async function freePath(dir, name) {
  const dot = name.lastIndexOf('.');
  for (let n = 1; ; n++) {
    const candidate = `${dir}/${n === 1 ? name : `${name.slice(0, dot)} (${n})${name.slice(dot)}`}`;
    try {
      await Neutralino.filesystem.getStats(candidate);
    } catch {
      return candidate;
    }
  }
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

$('saveAll').addEventListener('click', saveAll);
$('clear').addEventListener('click', () => [...items].forEach(remove));

// ---------- The viewer ----------

let viewing = null;

function view(item) {
  viewing = item;
  viewerSketch.width = item.canvas.width;
  viewerSketch.height = item.canvas.height;
  viewerSketch.getContext('2d').drawImage(item.canvas, 0, 0);
  viewerOriginal.src = item.url;
  showOriginal(false);
  $('viewerName').textContent = item.name;
  viewer.showModal();
}

function showOriginal(on) {
  viewerOriginal.hidden = !on;
  viewerSketch.hidden = on;
  viewerToggle.setAttribute('aria-pressed', String(on));
  viewerToggle.textContent = on ? 'Show sketch' : 'Show original';
}

viewerToggle.addEventListener('click', () => showOriginal(viewerOriginal.hidden));
$('viewerSave').addEventListener('click', () => viewing && saveOne(viewing));
$('viewerClose').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', (e) => e.target === viewer && viewer.close());
viewer.addEventListener('close', () => {
  viewing = null;
  viewerOriginal.removeAttribute('src');
});

// ---------- Toast ----------

let toastTimer = 0;
function toast(message, action) {
  toastEl.replaceChildren(document.createTextNode(message));
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--small';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      action.run();
      toastEl.hidden = true;
    });
    toastEl.append(b);
  }
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), action ? 8000 : 4000);
}

// ---------- Choose, drop, paste ----------

$('pick').addEventListener('change', (e) => {
  add(e.target.files);
  e.target.value = '';
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (++dragDepth === 1) document.body.classList.add('is-dragging');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    document.body.classList.remove('is-dragging');
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('is-dragging');
  if (e.dataTransfer?.files?.length) add(e.dataTransfer.files);
});

window.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
  if (files.length) add(files);
});
