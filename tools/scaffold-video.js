/*
 * scaffold-video.js — Convierte una guía de EmpiezaLibros en un proyecto de vídeo
 * HyperFrames (vertical TikTok) casi listo para renderizar, para no tener que
 * escribir a mano el storyboard/guion de cada vídeo.
 *
 * Uso:   node tools/scaffold-video.js <idGuía>        (p. ej. g22)
 *        node tools/scaffold-video.js --list          (lista las guías)
 *
 * Qué genera en videos/<slug>/ :
 *   - BRIEF.md, capture/extracted/{visible-text.txt,tokens.json}
 *   - frame.md + .hyperframes/caption-skin.html  (copiados de tools/video-assets/;
 *     estilo "Noir 3D / motion comic" aprobado el 23/09/2026 — el blockframe azul
 *     anterior queda en tools/video-assets/frame-blockframe.md)
 *   - referencia-demo.html (composición de referencia del estilo), assets/fonts/ y
 *     assets/img/<idLibro>.jpg (portada REAL de cada libro que nombra la guía)
 *   - STORYBOARD.md + SCRIPT.md  (listicle: gancho + N puntos + CTA, con el ESCENARIO
 *     COMPARTIDO ya escrito y las ventanas de plano por tiempos)
 *
 * Luego solo quedan los pasos "de máquina/agente" (ver README al final de la salida):
 *   voz TTS → construir frames → ensamblar → render.
 *
 * DISEÑO: la construcción de los frames HTML la hace un agente (workers de HyperFrames),
 * así que esto NO produce el MP4 solo; automatiza todo lo de ANTES (que era el 80% del
 * trabajo manual). Los textos generados son un BORRADOR sólido: repasa gancho y VO.
 *
 * Réplica del mismo montaje en empiezapadel.es (ver CLAUDE.md y memoria tiktok-video-pipeline).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REF = path.join(ROOT, 'tools', 'video-assets'); // frame.md + caption-skin.html de marca
const MAX_POINTS = 6;         // tope de puntos (frames de contenido) por vídeo
const VOICE = '3daec88b3c1a49b7a5e10a211426fc81'; // HeyGen "Fernando Sanz" (Mateo sonaba anglosajón)
const SPEED = '1.5';          // ver memoria tiktok-video-pipeline

// ---- extracción de guides desde index.html (mismo enfoque que generate-pages.js) ----
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function extractLiteral(src, marker, open, close) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('No encontrado: ' + marker);
  const openIdx = src.indexOf(open, start);
  let depth = 0, inStr = false, strCh = '', esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(openIdx, i + 1); }
  }
  throw new Error('Literal sin cerrar: ' + marker);
}
const guides = new Function('return (' + extractLiteral(indexSrc, 'const guides =', '{', '}') + ')')();
const books = ['thriller', 'novelas', 'desarrollo', 'romantasy'].flatMap((k) => {
  try { return new Function('return (' + extractLiteral(indexSrc, 'const ' + k + ' =', '[', ']') + ')')(); }
  catch (e) { return []; }
});
function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
// Libros de index.html que nombra un texto, en orden de aparición (título completo, >= 4 letras).
function findBooks(text) {
  const h = ' ' + norm(text) + ' ';
  return books.filter((b) => b.name && norm(b.name).length >= 4 && h.includes(' ' + norm(b.name) + ' '))
    .sort((a, b) => h.indexOf(' ' + norm(a.name) + ' ') - h.indexOf(' ' + norm(b.name) + ' '));
}

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function stripHtml(s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function firstSentence(s, max = 90) {
  const t = stripHtml(s);
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  let out = (m ? m[1] : t).trim();
  if (out.length > max) out = out.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return out;
}
function upper(s) { return String(s).toUpperCase(); }

// Acorta un titular para la tarjeta (quita "según…", ": …", paréntesis, y numeración/emoji inicial).
function shortHeading(h) {
  return stripHtml(h)
    .replace(/^\s*(?:[🥇🥈🥉0-9]+[.)\-–]?\s*)+/u, '')     // "1. ", "🥇 "
    .replace(/\s*[:(].*$/, '').replace(/\s+según.*$/i, '').trim();
}

// Extrae los puntos del cuerpo. Dos formatos habituales en las guías:
//  (a) educación/comparativa → cada <h4> es un punto (texto = <p> siguiente).
//  (b) "top N" → una <p> con lista separada por <br> (a veces con <strong>/números);
//      esos items son los puntos (el ranking). Si aparece una lista de >=3, gana.
function extractPoints(body) {
  // ¿hay una lista <br> de >=3 items dentro de algún <p>?
  const paras = [...body.matchAll(/<p[^>]*>(.*?)<\/p>/gis)].map((m) => m[1]);
  for (const p of paras) {
    if (!/<br\s*\/?>/i.test(p)) continue;
    const items = p.split(/<br\s*\/?>/i).map((s) => stripHtml(s)).filter((s) => s.length > 3);
    if (items.length >= 3) {
      return items.slice(0, MAX_POINTS).map((it) => {
        // "1. Reina roja – Empieza aquí" → heading="Reina roja", takeaway="Empieza aquí"
        const m = it.match(/^(.*?)\s*[–\-—:]\s*(.+)$/);
        const heading = shortHeading(m ? m[1] : it);
        return { heading, takeaway: m ? m[2].trim() : it, full: it };
      });
    }
  }
  // fallback: secciones <h4> + <p>
  const pts = [];
  const re = /<h4[^>]*>(.*?)<\/h4>\s*<p[^>]*>(.*?)<\/p>/gis;
  let m;
  while ((m = re.exec(body)) && pts.length < MAX_POINTS) {
    pts.push({ heading: shortHeading(m[1]) || stripHtml(m[1]), takeaway: firstSentence(m[2]), full: stripHtml(m[2]) });
  }
  return pts;
}

function esc(s) { return String(s).replace(/"/g, '\\"'); }

// ------------------------------ CLI ------------------------------
const arg = process.argv[2];
if (!arg || arg === '--list') {
  console.log('Guías disponibles:\n');
  for (const id of Object.keys(guides)) console.log(`  ${id.padEnd(4)} ${guides[id].title}`);
  console.log('\nUso: node tools/scaffold-video.js <idGuía>');
  process.exit(0);
}
const id = arg;
const g = guides[id];
if (!g) { console.error(`Guía "${id}" no existe. Usa --list.`); process.exit(1); }

const points = extractPoints(g.body);
if (!points.length) { console.error('No se extrajeron puntos (¿la guía no tiene <h4>?).'); process.exit(1); }
// Cada punto: libros que nombra su sección; el principal es el primero que no fue principal antes.
const usados = new Set();
points.forEach((p) => {
  p.books = findBooks(p.heading + ' ' + (p.full || p.takeaway));
  p.book = p.books.find((b) => !usados.has(b.id)) || null;
  if (p.book) usados.add(p.book.id);
});

const slug = slugify(g.title).slice(0, 60);
const projDir = path.join(ROOT, 'videos', slug);
if (fs.existsSync(projDir)) { console.error(`Ya existe ${path.relative(ROOT, projDir)} — bórralo o usa otro.`); process.exit(1); }

// ------------------------------ escribir proyecto ------------------------------
const mk = (p) => fs.mkdirSync(path.join(projDir, p), { recursive: true });
const wr = (p, c) => fs.writeFileSync(path.join(projDir, p), c);
mk('capture/extracted'); mk('.hyperframes'); mk('compositions/frames'); mk('assets/fonts'); mk('assets/img');

// estilo noir: referencia, fuentes locales y portadas reales
const cp = (from, to) => { if (fs.existsSync(from)) { fs.copyFileSync(from, path.join(projDir, to)); return true; } return false; };
cp(path.join(REF, 'noir', 'referencia-demo.html'), 'referencia-demo.html');
cp(path.join(REF, 'noir', 'portada-plantilla.html'), 'cover.html');
for (const f of fs.readdirSync(path.join(REF, 'fonts'))) cp(path.join(REF, 'fonts', f), 'assets/fonts/' + f);
const missingCovers = [];
new Set(points.flatMap((p) => p.books)).forEach((b) => {
  if (!cp(path.join(ROOT, 'img', 'covers', b.id + '.jpg'), 'assets/img/' + b.id + '.jpg')) missingCovers.push(b.id);
});

// frame.md + caption-skin de la marca (tools/video-assets/)
if (fs.existsSync(path.join(REF, 'frame.md'))) {
  fs.copyFileSync(path.join(REF, 'frame.md'), path.join(projDir, 'frame.md'));
  const skin = path.join(REF, 'caption-skin.html');
  if (fs.existsSync(skin)) fs.copyFileSync(skin, path.join(projDir, '.hyperframes', 'caption-skin.html'));
} else {
  wr('FRAME_TODO.txt', 'Falta tools/video-assets/frame.md. Recrear con build-frame.mjs --preset blockframe.');
}

// capture
wr('capture/extracted/visible-text.txt', `${g.title}\n\n${stripHtml(g.body)}\n\nLa guía completa, en empiezalibros.es`);
wr('capture/extracted/tokens.json', JSON.stringify({
  title: g.title, description: firstSentence(g.body, 140),
  colors: ['#4d8fd6', '#101a2b', '#3a78bd'], fonts: ['DM Serif Display', 'DM Sans']
}, null, 2) + '\n');

// BRIEF.md
wr('BRIEF.md', `---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "${esc(g.title)}"
destination: tiktok
aspect: "9:16"
language: es
audience: "Lector que empieza o vuelve a leer, interesado en thriller/misterio/suspense"
angle: listicle
voice_provider: heygen
---

## Intent
Vídeo TikTok generado desde la guía ${id} ("${g.title}") con el scaffolder. Tono directo y honesto,
para el lector que arranca ("¿debería leerlo? ¿es para mí? ¿por dónde entro?"). CTA a empiezalibros.es.
REVISAR gancho y VO antes de renderizar.

## Notes
- Landing: /guias/${slugify(g.title)}/
- Nicho: thriller, misterio y suspense. Nunca inventar datos.
`);

// STORYBOARD.md
const N = points.length;
let sb = `---
format: 1080x1920
duration: ${8 + N * 6}s
message: "${esc(g.title)}"
arc: "Hook → ${N} puntos → CTA"
audience: "Lector que empieza thriller/misterio (TikTok)"
angle: listicle
mode: autonomous
music: "tense minimal mystery underscore, intriga contenida, sin voz"
---

## Video direction
- **estilo**: "Noir 3D / motion comic" — LEER frame.md y referencia-demo.html (en este proyecto) antes de construir nada y reutilizar su CSS/patrones (libro 3D, atmósfera, captions palabra a palabra, siluetas a contraluz).
- **palette** (frame.md): noir #0c0809 + granate, texto crema #f3e9dc, acento rojo #ff5a7a; glow/lomo teñidos con c1/c2 de cada libro. Nunca inventar colores.
- **motion**: eases power3/expo, VO-paced (cada pieza entra en su cue hablado). Reposo: libro girando despacio, polvo flotando, barrido de luz.
- **ESCENARIO COMPARTIDO (puntos)**: pill "Nº X" arriba · libro 3D con su PORTADA REAL (assets/img/<id>.jpg) cae girando y aterriza (thock) · 1–2 viñetas de motion comic que ilustran la PREMISA del libro (sin spoilers; ver frame.md) · caption narrativo con la frase de la VO y la clave en rojo. Transición: el libro "se abre" hacia cámara o fundido corto.
- **negative list**: sin nav/cursores/chrome, sin bokeh "IA", sin emojis, sin spoilers, sin portadas prestadas. Contenido en el 83% superior (UI de TikTok tapa el borde inferior).

## Frame 1 — Gancho
- scene: Título-gancho a pantalla completa
- voiceover: "EDITAR gancho: engancha en 2s. FÓRMULA QUE MEJOR RINDE (dato TikTok): número concreto + promesa de lista. P.ej. 'Agatha Christie escribió 66 novelas: te digo por cuál empezar'. Evita el problema abstracto ('no sabes por dónde')."
- duration: 4s
- transition_in: cut
- status: outline
- type: hook
- persuasion: Direct address
- beat: intriga
- blueprint: kinetic-type-beats (Adapt)
- focal: la frase-gancho
- roles: frase = foreground · atmósfera noir (glow, barrido, polvo) = background · libros = supporting
- src: compositions/frames/01-gancho.html

Scene 1 (0.0–1.3s): atmósfera noir ya viva; entra la primera línea (Space Grotesk, pill arriba).
Scene 2 (1.3–2.7s): la línea-gancho palabra a palabra en DM Serif crema con la clave en rojo; detrás, las portadas reales de los libros de la guía caen en abanico 3D.
Scene 3 (2.7–4.0s): remate + hold con los libros girando despacio.

narrativeRole: Abrir el hueco de curiosidad del tema.
keyMessage: ${firstSentence(g.body, 80)}
`;

let script = `# SCRIPT — ${slug}

**Voice:** HeyGen Narrator Mateo (${VOICE}) · --speed ${SPEED}
**Voice direction:** Cercano, directo, honesto, sin locución publicitaria. Ritmo ágil. Tono de quien recomienda un libro a un amigo que empieza.

---

## Line 1 — Gancho (Frame 1)
**Delivery:** Reto directo a cámara.

    EDITAR: gancho de 1 frase, fórmula número + promesa de lista (ver Frame 1).
`;

points.forEach((p, i) => {
  const n = i + 2;               // frame number
  const fid = String(n).padStart(2, '0');
  sb += `
## Frame ${n} — Punto ${i + 1}: ${p.heading}
- scene: Nº ${i + 1} · ${p.book ? `libro 3D "${esc(p.book.name)}" · motion comic de su premisa` : `viñeta conceptual "${esc(p.heading)}"`} · caption
- voiceover: "${esc(p.heading)}: ${esc(firstSentence(p.takeaway, 70))}"
- duration: 6s
- transition_in: push-slide UP
- status: outline
- type: feature_showcase
- persuasion: Progressive disclosure
- beat: comprension
- blueprint: kinetic-type-beats (Adapt)
- focal: el titular "${upper(p.heading)}"
- roles: libro 3D = foreground · viñeta motion comic = foreground · caption = foreground · atmósfera = background
- sfx: thock, pop
- src: compositions/frames/${fid}-punto-${i + 1}.html
${p.books.length ? p.books.map((b) => `- libro${b === p.book ? ' PRINCIPAL' : ''}: id ${b.id} · "${esc(b.name)}" de ${esc(b.brand)} · portada assets/img/${b.id}.jpg · tinte c1 ${b.c1} / c2 ${b.c2}
  premisa (ficha web; VERIFICAR con la sinopsis oficial antes de ilustrar): ${esc(stripHtml(b.desc || ''))}`).join('\n')
  : `- libro: ninguno con ficha en esta sección. Si es un punto CONCEPTUAL, ilústralo con una viñeta de motion comic del concepto (sin libro 3D). Si nombra un libro concreto sin ficha, crea antes la ficha con datos verificados y su portada real.`}

Usa el ESCENARIO COMPARTIDO (frame.md + referencia-demo.html).
Scene 1 (0.0–1.3s): pill "Nº ${i + 1}" + el libro 3D cae girando con su portada real y aterriza (thock) mientras se dice el título.
Scene 2 (1.3–4.4s): el libro "se abre" hacia cámara y entra la viñeta de motion comic de la premisa (1–2 golpes visuales, sin spoilers); caption palabra a palabra con la frase de la VO.
Scene 3 (4.4–6.0s): vuelve el libro girando despacio + tag con "${esc(firstSentence(p.takeaway, 60))}"; hold.

narrativeRole: Enseñar el punto ${i + 1} del tema.
keyMessage: ${p.takeaway}
`;
  script += `
## Line ${n} — Punto ${i + 1} (Frame ${n})
**Delivery:** Claro, un punto por respiración.

    ${p.heading}: ${firstSentence(p.takeaway, 70)}
`;
});

const cta = N + 2;
sb += `
## Frame ${cta} — CTA
- scene: Pregunta a comentarios + wordmark EmpiezaLibros azul (guía en la bio)
- voiceover: "¿Por cuál empezarías tú? Cuéntamelo en comentarios. Y la guía entera, en la bio."
- duration: 4s
- transition_in: crossfade
- status: outline
- type: cta
- persuasion: Callback + Distillation
- beat: resolucion
- blueprint: titlecard-reveal (Reproduce)
- focal: wordmark EmpiezaLibros + URL
- roles: wordmark = foreground · "gratis" pill = supporting · icono libro = supporting · fondo = background
- sfx: soft-chime
- src: compositions/frames/${String(cta).padStart(2, '0')}-cta.html

Reproduce de titlecard-reveal en estilo noir (frame.md): libros de la guía en fila girando, pregunta en DM Serif crema, wordmark con "Libros" en rojo.
Scene 1 (0.0–1.4s): "¿Por cuál empezarías tú?" en DM Serif; slide-up al centro (comment-bait).
Scene 2 (1.4–2.8s): icono de libro + "EmpiezaLibros" (Libros en rojo #ff5a7a) debajo.
Scene 3 (2.8–4.0s): "Guía completa en la bio" en pill azul; hold. Cierre suave, sin URL grande.

narrativeRole: Pedir el comentario (señal de algoritmo) y dejar la bio como puerta a la web.
keyMessage: Comenta por cuál empezarías; la guía entera está en la bio.
`;

script += `
## Line ${cta} — CTA (Frame ${cta})
**Delivery:** Cálido; pregunta a cámara, luego cierre suave.

    ¿Por cuál empezarías tú? Cuéntamelo en comentarios. Y la guía entera, en la bio.
`;

wr('STORYBOARD.md', sb);
wr('SCRIPT.md', script);

// ------------------------------ instrucciones ------------------------------
const rel = path.relative(ROOT, projDir).replace(/\\/g, '/');
const SK = 'C:/Users/marti/.claude/skills/faceless-explainer/scripts';
console.log(`✓ Proyecto creado: ${rel}
  guía: ${id} — "${g.title}"
  frames: 1 gancho + ${N} puntos + 1 CTA = ${N + 2}
  libros por punto: ${points.map((p, i) => (i + 1) + ') ' + (p.books.length ? p.books.map((b) => b.id + ' ' + b.name).join(', ') : 'conceptual')).join(' · ')}
${missingCovers.length ? '  ⚠ faltan portadas en img/covers/: ' + missingCovers.join(', ') + '\n' : ''}
REVISA primero (borrador): el gancho (Frame 1 / Line 1) y las líneas de VO en SCRIPT.md.

Luego, pasos de máquina/agente (desde ${rel}/):
  1. Voz+música+SFX:  node "${SK}/audio.mjs" --script ./SCRIPT.md --storyboard ./STORYBOARD.md --hyperframes . --out ./audio_meta.json --voice ${VOICE} --speed ${SPEED}
  2. sync + sfx:      node "${SK}/audio.mjs" sync-durations --audio-meta ./audio_meta.json --storyboard ./STORYBOARD.md
                      node "${SK}/audio.mjs" fetch-sfx --storyboard ./STORYBOARD.md --hyperframes .
  3. packets:         node "${SK}/frame-packets.mjs" --project . --storyboard ./STORYBOARD.md
  4. Construir frames: despachar 1 worker por frame (Claude) con _role.md + su packet.
  5. Ensamblar:       node "${SK}/assemble-index.mjs" --storyboard ./STORYBOARD.md --hyperframes .
                      node "${SK}/transitions.mjs" inject --storyboard ./STORYBOARD.md --hyperframes .
  6. Check + render:  npx hyperframes@0.8.63 check  &&  npx hyperframes@0.8.63 render --skill=faceless-explainer --quality high --output renders/video.mp4
`);
