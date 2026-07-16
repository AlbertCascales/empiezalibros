/*
 * Publica en el canal de Telegram @Empiezalibros.
 * Encapsula TODA la lógica (leer token, comprobar portada local, sendPhoto/sendMessage)
 * en un script de ruta fija, para que las rutinas programadas no tengan que escribir
 * scripts `node -e "..."` improvisados cada día (que disparaban aprobaciones de permisos).
 *
 * Uso:
 *   node tools/telegram-post.js book <id>   -> publica el libro con ese id (portada + ficha)
 *   node tools/telegram-post.js backfill    -> publica el siguiente elemento de la cola de sembrado (libro o guía)
 *
 * La clave del bot vive fuera del repo, en C:\Users\marti\.empiezalibros-secrets\telegram.key
 * Nunca se imprime.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://empiezalibros.es';
const CHANNEL = '@Empiezalibros';
const TOKEN_PATH = 'C:\\Users\\marti\\.empiezalibros-secrets\\telegram.key';
const BACKFILL_STATE = 'C:\\Users\\marti\\.claude\\scheduled-tasks\\empiezalibros-telegram-backfill\\estado.json';

function readToken() {
  if (!fs.existsSync(TOKEN_PATH)) throw new Error('NO_TOKEN: falta ' + TOKEN_PATH);
  const t = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  if (!t) throw new Error('NO_TOKEN: archivo vacío ' + TOKEN_PATH);
  return t;
}

// ---------- Extracción de datos (misma lógica que tools/generate-pages.js) ----------
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function extractLiteral(src, marker, open, close) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('No encontrado: ' + marker);
  const openIdx = src.indexOf(open, start);
  let depth = 0, inStr = false, strCh = '', esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(openIdx, i + 1); }
  }
  throw new Error('Literal sin cerrar: ' + marker);
}
function ev(marker, o, c) { return new Function('return (' + extractLiteral(indexSrc, marker, o, c) + ')')(); }
function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function stripHtml(s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function truncate(s, n) { s = String(s).trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; }

const novelas    = ev('const novelas =', '[', ']');
const thriller   = ev('const thriller =', '[', ']');
const desarrollo = ev('const desarrollo =', '[', ']');
const romantasy  = ev('const romantasy =', '[', ']');
const guides     = ev('const guides =', '{', '}');

const ARRAYS = {
  novelas:    { arr: novelas,    dir: 'novelas',    emoji: '📖' },
  thriller:   { arr: thriller,   dir: 'thriller',   emoji: '🔎' },
  desarrollo: { arr: desarrollo, dir: 'no-ficcion', emoji: '💡' },
  romantasy:  { arr: romantasy,  dir: 'romantasy',  emoji: '🐉' },
};

function findBook(id) {
  for (const k of Object.keys(ARRAYS)) {
    const found = ARRAYS[k].arr.find((b) => b.id === id);
    if (found) return { book: found, dir: ARRAYS[k].dir, emoji: ARRAYS[k].emoji };
  }
  return null;
}

// ---------- Telegram (JSON UTF-8, sin curl) ----------
function api(token, method, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.telegram.org', path: `/bot${token}/${method}`, method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ ok: false, description: 'respuesta no válida' }); } });
    });
    req.on('error', (e) => resolve({ ok: false, description: e.message }));
    req.write(body); req.end();
  });
}

function bookMessage(book, dir, emoji) {
  const url = `${SITE}/${dir}/${slugify(book.brand + ' ' + book.name)}/`;
  const tag = '#libros #' + slugify(book.level).replace(/-/g, '');
  return emoji + ' <b>' + esc(book.name) + '</b> — ' + esc(book.brand) +
    '\n\n' + esc(truncate(book.desc, 240)) +
    '\n\n📖 Sinopsis y dónde comprarlo 👉 ' + url + '\n\n' + tag;
}
function guideMessage(g) {
  const url = `${SITE}/guias/${slugify(g.title)}/`;
  const plain = stripHtml(g.body || g.meta || '');
  return '🧭 <b>' + esc(g.title) + '</b>\n\n' + esc(truncate(plain, 240)) +
    '\n\n👉 Léela completa: ' + url + '\n\n#libros #guíadelectura';
}

// Publica un libro: portada como foto SOLO si el archivo existe en local (fs.existsSync).
// Nunca comprueba por HTTP: Cloudflare devuelve 200+HTML para rutas inexistentes.
async function postBook(token, id) {
  const f = findBook(id);
  if (!f) throw new Error('Libro no encontrado: ' + id);
  const caption = bookMessage(f.book, f.dir, f.emoji);
  const coverPath = path.join(ROOT, 'img', 'covers', id + '.jpg');
  let r;
  if (fs.existsSync(coverPath)) {
    r = await api(token, 'sendPhoto', { chat_id: CHANNEL, photo: `${SITE}/img/covers/${id}.jpg`, caption, parse_mode: 'HTML' });
    if (!r.ok) { // si la foto falla por lo que sea, reintenta como texto
      r = await api(token, 'sendMessage', { chat_id: CHANNEL, text: caption, parse_mode: 'HTML', disable_web_page_preview: false });
    }
  } else {
    r = await api(token, 'sendMessage', { chat_id: CHANNEL, text: caption, parse_mode: 'HTML', disable_web_page_preview: false });
  }
  return r;
}

async function cmdBook(id) {
  const token = readToken();
  const r = await postBook(token, id);
  if (r.ok) console.log('OK libro publicado:', id);
  else { console.error('ERROR Telegram:', r.error_code, r.description); process.exit(1); }
}

// ---------- Sembrado (backfill) ----------
function buildQueue() {
  const libros = [...novelas, ...thriller, ...desarrollo, ...romantasy].map((b) => ({ type: 'libro', id: b.id }));
  const gs = Object.keys(guides).map((k) => ({ type: 'guia', key: k }));
  const queue = []; let gi = 0;
  for (let i = 0; i < libros.length; i++) { queue.push(libros[i]); if ((i + 1) % 4 === 0 && gi < gs.length) queue.push(gs[gi++]); }
  while (gi < gs.length) queue.push(gs[gi++]);
  return queue;
}

async function cmdBackfill() {
  const token = readToken();
  let state;
  if (fs.existsSync(BACKFILL_STATE)) {
    state = JSON.parse(fs.readFileSync(BACKFILL_STATE, 'utf8'));
  } else {
    state = { queue: buildQueue(), index: 0 };
    fs.writeFileSync(BACKFILL_STATE, JSON.stringify(state, null, 2));
    console.log('Cola creada:', state.queue.length, 'elementos');
  }

  // Busca el siguiente elemento válido
  let item = null;
  while (state.index < state.queue.length) {
    const it = state.queue[state.index];
    if (it.type === 'libro' && findBook(it.id)) { item = it; break; }
    if (it.type === 'guia' && guides[it.key]) { item = it; break; }
    state.index++; // elemento ya inexistente (renombrado/eliminado): saltar
  }
  fs.writeFileSync(BACKFILL_STATE, JSON.stringify(state, null, 2));

  if (!item) { console.log('Sembrado completado: no queda nada por publicar.'); return; }

  let r;
  if (item.type === 'libro') {
    r = await postBook(token, item.id);
  } else {
    r = await api(token, 'sendMessage', { chat_id: CHANNEL, text: guideMessage(guides[item.key]), parse_mode: 'HTML', disable_web_page_preview: false });
  }

  if (r.ok) {
    state.index++;
    fs.writeFileSync(BACKFILL_STATE, JSON.stringify(state, null, 2));
    console.log('OK publicado #' + state.index + '/' + state.queue.length + ' — quedan ' + (state.queue.length - state.index));
  } else {
    console.error('ERROR Telegram:', r.error_code, r.description, '(no avanzo el índice)');
    process.exit(1);
  }
}

// ---------- CLI ----------
const cmd = process.argv[2];
(async () => {
  try {
    if (cmd === 'book') { const id = process.argv[3]; if (!id) throw new Error('Uso: node tools/telegram-post.js book <id>'); await cmdBook(id); }
    else if (cmd === 'backfill') { await cmdBackfill(); }
    else { console.error('Uso: node tools/telegram-post.js <book <id>|backfill>'); process.exit(1); }
  } catch (e) { console.error('ERROR:', e.message); process.exit(1); }
})();
