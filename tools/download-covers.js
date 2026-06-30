/*
 * Descarga las carátulas de los libros desde Open Library (gratis, sin clave).
 *
 * Lee los datos de libros desde index.html (misma fuente que generate-pages.js)
 * y guarda cada portada en  img/covers/<id>.jpg  (id = n1, t3, d7, r2…).
 *
 * Uso:  node tools/download-covers.js            (solo descarga las que faltan)
 *       node tools/download-covers.js --force     (vuelve a descargar todas)
 *
 * No requiere dependencias externas (usa el módulo https de Node).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'img', 'covers');
const FORCE = process.argv.includes('--force');

// ---------- Extraer los datos desde index.html ----------
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function extractLiteral(src, marker, open, close) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('No encontrado: ' + marker);
  const openIdx = src.indexOf(open, start);
  let depth = 0, inStr = false, strCh = '', esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(openIdx, i + 1); }
  }
  throw new Error('Literal sin cerrar: ' + marker);
}
function evalLiteral(lit) { return new Function('return (' + lit + ')')(); }

const novelas    = evalLiteral(extractLiteral(indexSrc, 'const novelas =', '[', ']'));
const thriller   = evalLiteral(extractLiteral(indexSrc, 'const thriller =', '[', ']'));
const desarrollo = evalLiteral(extractLiteral(indexSrc, 'const desarrollo =', '[', ']'));
const romantasy  = evalLiteral(extractLiteral(indexSrc, 'const romantasy =', '[', ']'));
const books = [...novelas, ...thriller, ...desarrollo, ...romantasy];

// ---------- Utilidades HTTP ----------
// GET con seguimiento de redirecciones (Open Library redirige a su CDN de portadas)
function get(url, cb, redirects = 0) {
  https.get(url, { headers: { 'User-Agent': 'EmpiezaLibros/1.0 (cover fetcher)' } }, res => {
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
      res.resume();
      return get(new URL(res.headers.location, url).toString(), cb, redirects + 1);
    }
    cb(null, res);
  }).on('error', e => cb(e));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    get(url, (err, res) => {
      if (err) return reject(err);
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    get(url, (err, res) => {
      if (err) return reject(err);
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/')) { res.resume(); return reject(new Error('No es imagen: ' + ct)); }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => {
        const size = fs.statSync(dest).size;
        if (size < 2500) { fs.unlink(dest, () => {}); return reject(new Error('imagen vacía/placeholder')); }
        resolve(size);
      }));
      file.on('error', err => { fs.unlink(dest, () => {}); reject(err); });
    });
  });
}

const enc = encodeURIComponent;

// "default=false" hace que Open Library devuelva 404 si la portada no existe
// (en vez de una imagen en blanco), para poder pasar a la siguiente candidata.
function collectCovers(docs, set) {
  for (const d of docs) {
    if (d.cover_i) set.add(`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg?default=false`);
    for (const isbn of (d.isbn || []).slice(0, 3)) {
      set.add(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
    }
  }
}

// Algunos libros Open Library los indexa por su título original (inglés).
const OVERRIDES = {
  n10: 'title=Where the Crawdads Sing&author=Delia Owens',
  d9:  'title=Rich Dad Poor Dad&author=Robert Kiyosaki',
  r6:  'title=Divine Rivals&author=Rebecca Ross',
};

async function findCandidates(book) {
  const full = book.name;
  const short = full.split(/[:.(]/)[0].trim();
  const titles = short && short !== full ? [full, short] : [full];

  const queries = [];
  for (const t of titles) {
    queries.push(`title=${enc(t)}&author=${enc(book.brand)}&language=spa`);
    queries.push(`title=${enc(t)}&author=${enc(book.brand)}`);
    queries.push(`title=${enc(t)}`);
  }
  queries.push(`q=${enc(book.name + ' ' + book.brand)}`); // último recurso
  if (OVERRIDES[book.id]) queries.unshift(OVERRIDES[book.id]); // alias en inglés primero

  const set = new Set();
  for (const qs of queries) {
    if (set.size >= 12) break;
    let json;
    try { json = await getJson(`https://openlibrary.org/search.json?${qs}&fields=cover_i,isbn&limit=10`); }
    catch (e) { continue; }
    collectCovers(json.docs || [], set);
  }
  return [...set];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0, skip = 0, fail = 0;
  const failed = [];

  for (const book of books) {
    const dest = path.join(OUT_DIR, `${book.id}.jpg`);
    if (!FORCE && fs.existsSync(dest)) { skip++; continue; }
    const candidates = await findCandidates(book);
    if (!candidates.length) {
      fail++; failed.push(`${book.id}  ${book.name} — ${book.brand} (sin resultado)`);
      await sleep(300); continue;
    }
    let done = false, lastErr = '';
    for (const url of candidates) {
      try {
        const size = await download(url, dest);
        console.log(`OK   ${book.id}  ${book.name}  (${Math.round(size / 1024)} KB)`);
        ok++; done = true; break;
      } catch (e) { lastErr = e.message; }
    }
    if (!done) { fail++; failed.push(`${book.id}  ${book.name} — ${book.brand} (${lastErr || 'sin portada'})`); }
    await sleep(300); // cortesía con la API
  }

  console.log(`\nResumen: ${ok} descargadas, ${skip} ya existían, ${fail} fallidas.`);
  if (failed.length) {
    console.log('\nFallidas (revisar a mano):');
    failed.forEach(f => console.log('  - ' + f));
  }
  console.log(`\nCarátulas en: ${path.relative(ROOT, OUT_DIR)}`);
})();
