/*
 * Generador de páginas estáticas para EmpiezaLibros.
 *
 * Lee los datos de libros y guías que viven dentro de index.html
 * (única fuente de la verdad) y genera:
 *   - /novelas/<slug>/, /thriller/..., /no-ficcion/..., /romantasy/...  (reseña de cada libro)
 *   - /guias/<slug>/index.html                                          (cada guía)
 *   - /novelas/index.html, /thriller/, /no-ficcion/, /romantasy/, /guias/  (hubs por género)
 *   - sitemap.xml                                                        (con todas las URLs)
 *
 * Uso:  node tools/generate-pages.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://empiezalibros.es';
const STORE_ID = 'albertomart09-21';
const BRAND_NAME = 'EmpiezaLibros';
const TODAY = '2026-06-30';
const CONTACT_EMAIL = 'contacto@empiezalibros.es';
// Acción del formulario de newsletter de EmpiezaLibros en MailerLite (cuenta 2480900).
// (También está en index.html, en el formulario de la home.)
const MAILERLITE_ACTION = 'https://assets.mailerlite.com/jsonp/2480900/forms/191732667053507940/subscribe';

// ---------- 1. Extraer los datos desde index.html ----------
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

function evalLiteral(lit) {
  return new Function('return (' + lit + ')')();
}

const novelas    = evalLiteral(extractLiteral(indexSrc, 'const novelas =', '[', ']'));
const thriller   = evalLiteral(extractLiteral(indexSrc, 'const thriller =', '[', ']'));
const desarrollo = evalLiteral(extractLiteral(indexSrc, 'const desarrollo =', '[', ']'));
const romantasy  = evalLiteral(extractLiteral(indexSrc, 'const romantasy =', '[', ']'));
const guides     = evalLiteral(extractLiteral(indexSrc, 'const guides =', '{', '}'));

// ---------- 2. Utilidades ----------
function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function stripHtml(s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function truncate(s, n) { s = s.trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; }
function priceNum(p) { return String(p).replace(/\./g, '').replace(',', '.'); }
function amazonUrl(query) { return `https://www.amazon.es/s?k=${encodeURIComponent(query)}&tag=${STORE_ID}`; }
function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

const CATS = {
  novelas:   { dir: 'novelas',    arr: novelas,    sing: 'Novela',    label: 'Novela y ficción',   hubTitle: 'Mejores novelas 2026: novedades, sinopsis y reseñas' },
  thriller:  { dir: 'thriller',   arr: thriller,   sing: 'Thriller',  label: 'Thriller y misterio', hubTitle: 'Mejores thrillers y novela negra 2026: sinopsis y reseñas' },
  desarrollo:{ dir: 'no-ficcion', arr: desarrollo, sing: 'Ensayo',    label: 'Desarrollo personal', hubTitle: 'Mejores libros de desarrollo personal 2026: reseñas y recomendaciones' },
  romantasy: { dir: 'romantasy',  arr: romantasy,  sing: 'Romance',   label: 'Romance',             hubTitle: 'Mejor romance y fantasía 2026: sinopsis y reseñas' },
};

function productSlug(p) { return slugify(p.brand + ' ' + p.name); }
function productPath(catDir, p) { return `/${catDir}/${productSlug(p)}/`; }
function guideSlug(id) { return slugify(guides[id].title); }
function guidePath(id) { return `/guias/${guideSlug(id)}/`; }

// Portada generada con CSS (sin imágenes externas)
function bookCover(p, big) {
  return `<div class="bookcover${big ? ' big' : ''}" style="--c1:${p.c1};--c2:${p.c2}">
    <img class="bc-img" src="/img/covers/${p.id}.jpg" alt="${esc(p.name + ' — ' + p.brand)}" loading="lazy" onerror="this.closest('.bookcover').classList.add('nocover');this.remove();">
    <div class="bc-fallback">
      <div class="bc-top">${esc(p.brand)}</div>
      <div class="bc-title">${esc(p.name)}</div>
      <div class="bc-author">${esc(p.level)}</div>
    </div>
  </div>`;
}

// ---------- 3. Plantilla base (CSS + cascarón) ----------
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--green:#1d3a64;--green-l:#e8eef6;--green-d:#122644;--lime:#4d8fd6;--black:#101a2b;--white:#fff;--gray-1:#f4f6f8;--gray-2:#e4e8ec;--gray-3:#a8b0ba;--gray-4:#5f6670;--text:#1a1f26}
body{font-family:'DM Sans',sans-serif;background:var(--white);color:var(--text);font-size:16px;line-height:1.7}
a{color:var(--green);text-decoration:none}
a:hover{text-decoration:underline}
.nav{position:sticky;top:0;z-index:100;background:var(--black);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;height:58px;border-bottom:2px solid var(--lime)}
.nav .logo{font-family:'DM Serif Display',serif;font-size:1.4rem;color:var(--white);letter-spacing:-1px}
.nav .logo span{color:var(--lime)}
.nav .logo:hover{text-decoration:none}
.wrap{max-width:860px;margin:0 auto;padding:1.5rem 1.25rem 3rem}
.crumbs{font-size:.8rem;color:var(--gray-4);margin:.5rem 0 1.25rem}
.crumbs a{color:var(--gray-4)}
h1{font-family:'DM Serif Display',serif;font-size:clamp(1.7rem,4.5vw,2.5rem);line-height:1.15;color:var(--black);margin-bottom:.4rem}
.sub{color:var(--gray-4);font-size:1rem;margin-bottom:1.5rem}
h2{font-family:'DM Serif Display',serif;font-size:1.4rem;color:var(--black);margin:2rem 0 .75rem}
h4{font-family:'DM Serif Display',serif;color:var(--black);margin:1.25rem 0 .4rem;font-size:1.08rem}
p{margin-bottom:.85rem}
.bookcover{position:relative;width:100%;height:100%;display:flex;flex-direction:column;padding:20px 18px 18px 22px;background:linear-gradient(150deg,var(--c1,#7a3b1a),var(--c2,#4f2a0f));color:#fff;overflow:hidden}
.bookcover::before{content:'';position:absolute;left:0;top:0;bottom:0;width:7px;background:rgba(0,0,0,.22);box-shadow:inset -2px 0 3px rgba(0,0,0,.25)}
.bookcover::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 80% 15%,rgba(255,255,255,.16),transparent 55%);pointer-events:none}
.bc-top{font-size:.58rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
.bc-title{font-family:'DM Serif Display',serif;font-size:1.2rem;line-height:1.18;margin-top:.7rem}
.bc-author{font-size:.74rem;margin-top:auto;padding-top:.6rem;opacity:.92;font-style:italic}
.bookcover.big .bc-title{font-size:1.7rem}
.bookcover .bc-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2}
.bc-fallback{display:none;flex-direction:column;height:100%}
.bookcover.nocover .bc-fallback{display:flex}
.tag{display:inline-block;background:var(--lime);color:var(--black);font-size:.66rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px;border-radius:20px;margin-bottom:.6rem}
.brand{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--green)}
.stars{color:#d98a00;font-size:.95rem;margin:.4rem 0}
.stars span{color:var(--gray-4);font-size:.78rem;margin-left:6px}
.price{font-family:'DM Serif Display',serif;font-size:1.9rem;color:var(--black);margin:.5rem 0}
.price small{font-size:.72rem;color:var(--gray-3);font-family:'DM Sans',sans-serif;display:block;font-weight:400}
.btn{display:inline-block;background:#ff9900;color:#0d0d0d!important;font-weight:700;padding:.85rem 1.5rem;border-radius:10px;text-align:center;font-size:1rem;transition:filter .2s}
.btn:hover{filter:brightness(.95);text-decoration:none}
.btn.block{display:block}
.hero{display:grid;grid-template-columns:240px 1fr;gap:1.5rem;align-items:start;background:var(--gray-1);border:1.5px solid var(--gray-2);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem}
.hero-cover{width:100%;aspect-ratio:2/3;height:auto;border-radius:8px;overflow:hidden;box-shadow:0 14px 36px rgba(0,0,0,.25)}
.specs{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:1rem 0 1.5rem}
.spec{background:var(--gray-1);border-radius:8px;padding:.6rem .85rem;font-size:.85rem}
.spec b{display:block;color:var(--gray-4);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1px;font-weight:600}
.pc{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin:1.5rem 0}
.pc h4{margin-top:0}
.pc ul{list-style:none}
.pc li{font-size:.9rem;color:var(--gray-4);padding:3px 0;display:flex;gap:7px;align-items:flex-start}
.pros h4{color:var(--green)}.cons h4{color:#c0392b}
.pros li::before{content:'✓';color:#1a8a4a;font-weight:700}
.cons li::before{content:'✗';color:#c0392b;font-weight:700}
.verdict{background:var(--green-l);border-left:3px solid var(--green);border-radius:0 8px 8px 0;padding:1rem 1.25rem;margin:1.5rem 0;color:var(--green-d)}
.verdict b{display:block;text-transform:uppercase;font-size:.74rem;letter-spacing:.07em;margin-bottom:.3rem}
.cta-box{border:1.5px solid var(--gray-2);border-radius:14px;padding:1.5rem;text-align:center;margin:2rem 0}
.cta-box .price{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;margin:1.5rem 0}
.card{border:1.5px solid var(--gray-2);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .2s,transform .2s}
.card:hover{box-shadow:0 8px 28px rgba(29,58,100,.20);transform:translateY(-2px);text-decoration:none}
.card-cover{aspect-ratio:2/3;height:auto}
.card-b{padding:.85rem 1rem 1.1rem}
.card-b .brand{font-size:.66rem}
.card-name{font-family:'DM Serif Display',serif;color:var(--black);margin:.15rem 0 .35rem;line-height:1.25}
.card-meta{font-size:.8rem;color:var(--gray-4)}
.related{border-top:1.5px solid var(--gray-2);margin-top:2.5rem;padding-top:1.5rem}
.related a{display:inline-block;margin:.2rem .6rem .2rem 0}
.disclosure{font-size:.62rem;color:var(--gray-4);opacity:.7;margin-top:1rem;line-height:1.4}
footer{background:var(--black);color:var(--gray-3);padding:2.25rem 1.5rem;text-align:center;font-size:.8rem;line-height:1.7;margin-top:2rem}
footer .logo{font-family:'DM Serif Display',serif;font-size:1.3rem;color:var(--white)}
footer .logo span{color:var(--lime)}
.newsletter{background:var(--green);color:#fff;border-radius:16px;padding:2.25rem 1.75rem;text-align:center;margin:2.5rem 0}
.newsletter h3{font-family:'DM Serif Display',serif;font-size:1.5rem;margin-bottom:.5rem;color:#fff}
.newsletter p{opacity:.92;margin-bottom:1.1rem;font-size:.92rem;max-width:460px;margin-left:auto;margin-right:auto}
.newsletter-form{display:flex;gap:.5rem;max-width:440px;margin:0 auto;flex-wrap:wrap}
.newsletter-form input{flex:1;min-width:190px;border:none;border-radius:8px;padding:.75rem 1rem;font-size:.92rem;font-family:inherit;color:var(--text)}
.newsletter-form button{background:var(--lime);color:var(--black);border:none;border-radius:8px;padding:.75rem 1.4rem;font-weight:700;cursor:pointer;font-family:inherit;font-size:.92rem}
.newsletter small{display:block;margin-top:.7rem;opacity:.7;font-size:.68rem}
@media(max-width:640px){.hero{grid-template-columns:1fr}.hero-cover{max-width:220px;margin:0 auto}.specs,.pc{grid-template-columns:1fr}.grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem}}
`;

function shell({ title, description, canonical, jsonLd, body }) {
  const ld = (jsonLd || []).map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" sizes="any">
<link rel="apple-touch-icon" href="/favicon.png">
<link rel="alternate" type="application/rss+xml" title="EmpiezaLibros — Novedades" href="/rss.xml">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="${BRAND_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/img/og-cover.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
${ld}
</head>
<body>
<nav class="nav"><a class="logo" href="/">Empieza<span>Libros</span></a></nav>
<main class="wrap">
${body}
</main>
<div class="wrap" style="padding-top:0">
<section class="newsletter">
<h3>📩 No te pierdas las novedades literarias</h3>
<p>Cada semana, una selección de los mejores libros y reseñas. Sin spam.</p>
<form class="newsletter-form" action="${MAILERLITE_ACTION}" method="post" target="_blank">
<input type="email" name="fields[email]" placeholder="Tu email" required aria-label="Email">
<button type="submit">Suscribirme</button>
<input type="hidden" name="ml-submit" value="1">
<input type="hidden" name="anticsrf" value="true">
</form>
<small>Te puedes dar de baja cuando quieras. Lee nuestra <a href="/privacidad/" style="color:var(--lime)">política de privacidad</a>.</small>
</section>
</div>
<footer>
<div class="logo">Empieza<span>Libros</span></div>
<p>Reseñas honestas y novedades literarias · Actualizadas en 2026.</p>
<p style="margin-top:.6rem"><a href="/sobre-nosotros/" style="color:var(--gray-3)">Sobre nosotros</a> · <a href="/contacto/" style="color:var(--gray-3)">Contacto</a> · <a href="/privacidad/" style="color:var(--gray-3)">Privacidad</a> · <a href="https://t.me/Empiezalibros" target="_blank" rel="noopener" style="color:var(--lime)">📣 Telegram</a></p>
<p class="disclosure">Como Afiliado de Amazon, ${BRAND_NAME} obtiene ingresos por las compras adscritas que cumplan los requisitos aplicables.</p>
</footer>
</body>
</html>`;
}

function crumbs(parts) {
  return '<nav class="crumbs">' + parts.map((p, i) =>
    i < parts.length - 1 ? `<a href="${p.url}">${esc(p.name)}</a> › ` : `<span>${esc(p.name)}</span>`
  ).join('') + '</nav>';
}
function breadcrumbLd(parts) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: parts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, item: SITE + p.url }))
  };
}

// ---------- 4. Página de libro ----------
function renderProductPage(catKey, p) {
  const cat = CATS[catKey];
  const url = productPath(cat.dir, p);
  const canonical = SITE + url;
  const aff = amazonUrl(p.query);
  const fullName = `${p.name}`;
  const title = `${p.name}, de ${p.brand}: sinopsis y reseña | ${BRAND_NAME}`;
  const description = truncate(`Reseña y sinopsis de «${p.name}» de ${p.brand} (${p.level}). ${stripHtml(p.desc)}`, 158);

  const specsHtml = Object.entries(p.specs).map(([k, v]) =>
    `<div class="spec"><b>${esc(k)}</b>${esc(v)}</div>`).join('');
  const prosHtml = p.pros.map(x => `<li>${esc(x)}</li>`).join('');
  const consHtml = p.cons.map(x => `<li>${esc(x)}</li>`).join('');

  const related = cat.arr.filter(x => x.id !== p.id).slice(0, 4);
  const relatedHtml = related.length ? `
  <section class="related">
    <h2>Otros libros de ${esc(cat.label.toLowerCase())} que te pueden gustar</h2>
    <div class="grid">
      ${related.map(r => `<a class="card" href="${productPath(cat.dir, r)}">
        <div class="card-cover">${bookCover(r)}</div>
        <div class="card-b"><div class="brand">${esc(r.brand)}</div><div class="card-name">${esc(r.name)}</div><div class="card-meta">${esc(r.level)} · ${esc(r.price)}€</div></div>
      </a>`).join('')}
    </div>
  </section>` : '';

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Book',
      name: p.name, author: { '@type': 'Person', name: p.brand },
      genre: p.level, description: stripHtml(p.desc),
      numberOfPages: p.specs['Páginas'] ? Number(p.specs['Páginas']) : undefined,
      review: {
        '@type': 'Review',
        author: { '@type': 'Organization', name: BRAND_NAME },
        reviewRating: { '@type': 'Rating', ratingValue: p.stars, bestRating: 5 }
      },
      offers: {
        '@type': 'Offer', price: priceNum(p.price), priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock', url: aff
      }
    },
    breadcrumbLd([{ name: 'Inicio', url: '/' }, { name: cat.label, url: `/${cat.dir}/` }, { name: fullName, url }])
  ];

  const body = `
${crumbs([{ name: 'Inicio', url: '/' }, { name: cat.label, url: `/${cat.dir}/` }, { name: fullName, url }])}
<div class="brand">${esc(p.brand)}</div>
<h1>${esc(p.name)}</h1>
<p class="sub">Sinopsis, reseña y dónde comprarlo — ${esc(p.level)}</p>
<div class="hero">
  <div class="hero-cover">${bookCover(p, true)}</div>
  <div>
    ${p.badge === 'top' ? '<span class="tag">Bestseller</span>' : ''}${p.badge === 'new' ? '<span class="tag">Novedad 2026</span>' : ''}
    <div class="stars">${stars(p.stars)} <span>Valoración de ${BRAND_NAME}</span></div>
    <div class="price">${esc(p.price)} €<small>Precio orientativo en Amazon.es</small></div>
    <a class="btn block" href="${aff}" target="_blank" rel="sponsored noopener">🛒 Ver precio en Amazon</a>
  </div>
</div>

<h2>Sinopsis</h2>
<p>${esc(p.desc)}</p>

<h2>Ficha del libro</h2>
<div class="specs">${specsHtml}</div>

<h2>Lo mejor y lo peor</h2>
<div class="pc">
  <div class="pros"><h4>A favor</h4><ul>${prosHtml}</ul></div>
  <div class="cons"><h4>A tener en cuenta</h4><ul>${consHtml}</ul></div>
</div>

<div class="verdict"><b>Veredicto de ${BRAND_NAME}</b>${esc(p.verdict)}</div>

<div class="cta-box">
  <div class="price">${esc(p.price)} €<small>Precio orientativo en Amazon.es</small></div>
  <a class="btn" href="${aff}" target="_blank" rel="sponsored noopener">🛒 Comprar «${esc(p.name)}» en Amazon</a>
</div>
${relatedHtml}
`;

  return { url, html: shell({ title, description, canonical, jsonLd, body }) };
}

// ---------- 5. Página de guía ----------
function renderGuidePage(id) {
  const g = guides[id];
  const url = guidePath(id);
  const canonical = SITE + url;
  const title = `${g.title} | ${BRAND_NAME}`;
  const description = truncate(stripHtml(g.body), 158);

  const linksHtml = (g.links || []).map(l =>
    `<a class="btn block" style="margin-bottom:.6rem" href="${amazonUrl(l.query)}" target="_blank" rel="sponsored noopener">🛒 ${esc(l.text)}</a>`
  ).join('');

  const others = Object.keys(guides).filter(k => k !== id).slice(0, 6);
  const othersHtml = `
  <section class="related">
    <h2>Más guías de lectura</h2>
    ${others.map(k => `<a href="${guidePath(k)}">${esc(guides[k].title)}</a>`).join('')}
  </section>`;

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: g.title, inLanguage: 'es-ES',
      image: SITE + '/img/og-cover.jpg',
      author: { '@type': 'Organization', name: BRAND_NAME },
      publisher: { '@type': 'Organization', name: BRAND_NAME },
      datePublished: TODAY, dateModified: TODAY,
      mainEntityOfPage: canonical
    },
    breadcrumbLd([{ name: 'Inicio', url: '/' }, { name: 'Guías', url: '/guias/' }, { name: g.title, url }])
  ];

  const body = `
${crumbs([{ name: 'Inicio', url: '/' }, { name: 'Guías', url: '/guias/' }, { name: g.title, url }])}
<div class="brand">${esc(g.cat)}</div>
<h1>${esc(g.title)}</h1>
<p class="sub">${esc(g.meta)}</p>
<article>${g.body}</article>
${linksHtml ? `<div class="cta-box"><b style="display:block;margin-bottom:.75rem;text-transform:uppercase;font-size:.74rem;letter-spacing:.07em;color:var(--gray-4)">Libros recomendados</b>${linksHtml}</div>` : ''}
${othersHtml}
`;

  return { url, html: shell({ title, description, canonical, jsonLd, body }) };
}

// ---------- 6. Páginas hub por género ----------
function renderProductHub(catKey) {
  const cat = CATS[catKey];
  const url = `/${cat.dir}/`;
  const canonical = SITE + url;
  const title = `${cat.hubTitle} | ${BRAND_NAME}`;
  const description = truncate(`Reseñas y sinopsis de los mejores libros de ${cat.label.toLowerCase()} de 2026. Opiniones honestas para elegir tu próxima lectura.`, 158);
  const cards = cat.arr.map(p => `<a class="card" href="${productPath(cat.dir, p)}">
    <div class="card-cover">${bookCover(p)}</div>
    <div class="card-b"><div class="brand">${esc(p.brand)}</div><div class="card-name">${esc(p.name)}</div><div class="card-meta">${esc(p.level)} · ${esc(p.price)}€</div></div>
  </a>`).join('');
  const body = `
${crumbs([{ name: 'Inicio', url: '/' }, { name: cat.label, url }])}
<h1>${esc(cat.hubTitle)}</h1>
<p class="sub">${cat.arr.length} libros de ${esc(cat.label.toLowerCase())} reseñados para 2026.</p>
<div class="grid">${cards}</div>`;
  const jsonLd = [breadcrumbLd([{ name: 'Inicio', url: '/' }, { name: cat.label, url }])];
  return { url, html: shell({ title, description, canonical, jsonLd, body }) };
}

function renderGuidesHub() {
  const url = '/guias/';
  const canonical = SITE + url;
  const title = `Guías de lectura 2026 | ${BRAND_NAME}`;
  const description = 'Todas las guías de lectura: por dónde empezar, qué leer según tu ánimo, los más vendidos y cómo crear el hábito de leer.';
  const cards = Object.keys(guides).map(k => `<a class="card" href="${guidePath(k)}" style="padding:1.1rem 1.25rem">
    <div class="brand">${esc(guides[k].cat)}</div>
    <div class="card-name" style="margin-top:.3rem">${esc(guides[k].title)}</div>
    <div class="card-meta">${esc(guides[k].meta)}</div>
  </a>`).join('');
  const body = `
${crumbs([{ name: 'Inicio', url: '/' }, { name: 'Guías', url }])}
<h1>Guías de lectura 2026</h1>
<p class="sub">${Object.keys(guides).length} guías para ayudarte a elegir tu próximo libro.</p>
<div class="grid">${cards}</div>`;
  const jsonLd = [breadcrumbLd([{ name: 'Inicio', url: '/' }, { name: 'Guías', url }])];
  return { url, html: shell({ title, description, canonical, jsonLd, body }) };
}

// ---------- 7. Escribir ficheros ----------
function writePage(url, html) {
  const dir = path.join(ROOT, url.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

const allUrls = ['/'];
let count = 0;

for (const catKey of Object.keys(CATS)) {
  const hub = renderProductHub(catKey);
  writePage(hub.url, hub.html); allUrls.push(hub.url); count++;
  for (const p of CATS[catKey].arr) {
    const page = renderProductPage(catKey, p);
    writePage(page.url, page.html); allUrls.push(page.url); count++;
  }
}

const gh = renderGuidesHub();
writePage(gh.url, gh.html); allUrls.push(gh.url); count++;
for (const id of Object.keys(guides)) {
  const page = renderGuidePage(id);
  writePage(page.url, page.html); allUrls.push(page.url); count++;
}

// ---------- 7b. Páginas estáticas (confianza / E-E-A-T / legal) ----------
const staticPages = [
  {
    url: '/sobre-nosotros/', h1: 'Sobre EmpiezaLibros',
    title: `Sobre nosotros | ${BRAND_NAME}`,
    description: 'Quiénes somos y cómo reseñamos libros en EmpiezaLibros: sinopsis claras y opiniones honestas para ayudarte a elegir tu próxima lectura.',
    bodyHtml: `
<p>${BRAND_NAME} nace para ayudarte a <strong>elegir bien tu próxima lectura</strong> sin perderte entre miles de novedades y opiniones contradictorias.</p>
<h2>Qué hacemos</h2>
<p>Reseñamos novelas, thrillers, no ficción y romantasy, y los resumimos en fichas claras: de qué va el libro (sinopsis sin destripes), para quién es, sus puntos fuertes y débiles, y un veredicto directo. Nuestro objetivo es que aciertes y disfrutes de la lectura.</p>
<h2>Cómo trabajamos</h2>
<p>Seleccionamos los libros por su calidad, repercusión y la valoración de los lectores. Priorizamos la honestidad: si un libro no nos parece para todos los públicos, lo decimos.</p>
<h2>Transparencia</h2>
<p>EmpiezaLibros se financia mediante enlaces de afiliado de Amazon: si compras a través de nuestros enlaces, podemos recibir una pequeña comisión <strong>sin coste adicional para ti</strong>. Esto nunca condiciona nuestras recomendaciones.</p>
<p style="color:var(--gray-4);font-size:.85rem;margin-top:1.5rem">¿Tienes dudas o sugerencias? Escríbenos desde la página de <a href="/contacto/">contacto</a>.</p>`
  },
  {
    url: '/contacto/', h1: 'Contacto',
    title: `Contacto | ${BRAND_NAME}`,
    description: 'Ponte en contacto con el equipo de EmpiezaLibros para dudas, sugerencias, recomendaciones de libros o colaboraciones.',
    bodyHtml: `
<p>¿Quieres recomendarnos un libro, tienes una duda o una propuesta de colaboración? Estaremos encantados de leerte.</p>
<h2>Email</h2>
<p>Escríbenos a <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> y te responderemos lo antes posible.</p>
<p style="color:var(--gray-4);font-size:.85rem;margin-top:1.5rem">Normalmente respondemos en un plazo de 24-48 horas.</p>`
  },
  {
    url: '/privacidad/', h1: 'Política de privacidad',
    title: `Política de privacidad | ${BRAND_NAME}`,
    description: 'Política de privacidad de EmpiezaLibros: qué datos tratamos, newsletter, enlaces de afiliado de Amazon y analítica web.',
    bodyHtml: `
<p style="color:var(--gray-4);font-size:.85rem"><em>Última actualización: junio de 2026. Esta página es una plantilla orientativa; revísala y adáptala a tu caso antes de publicarla definitivamente.</em></p>
<h2>Responsable</h2>
<p>El responsable de este sitio web (${BRAND_NAME}, ${SITE}) trata los datos conforme al Reglamento General de Protección de Datos (RGPD).</p>
<h2>Datos que tratamos</h2>
<p>Este sitio es informativo. Solo recogemos datos personales si te suscribes voluntariamente a nuestra newsletter (tu dirección de email), que gestionamos a través de la plataforma MailerLite con el único fin de enviarte novedades y recomendaciones de libros.</p>
<h2>Newsletter</h2>
<p>Puedes darte de baja en cualquier momento con el enlace incluido en cada email. Al suscribirte, tus datos se tratan según la política de privacidad de MailerLite, nuestro proveedor de envío.</p>
<h2>Analítica web</h2>
<p>Usamos analítica que mide las visitas de forma agregada para mejorar el contenido, sin identificarte de forma individual.</p>
<h2>Enlaces de afiliado</h2>
<p>${BRAND_NAME} participa en el programa de afiliados de Amazon. Algunos enlaces dirigen a Amazon y, si realizas una compra, podemos recibir una comisión sin coste adicional para ti. Al hacer clic, Amazon aplica su propia política de privacidad y de cookies.</p>
<h2>Tus derechos</h2>
<p>Puedes ejercer tus derechos de acceso, rectificación o supresión escribiendo a <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
  }
];
for (const sp of staticPages) {
  const body = `${crumbs([{ name: 'Inicio', url: '/' }, { name: sp.h1, url: sp.url }])}
<h1>${esc(sp.h1)}</h1>
${sp.bodyHtml}`;
  const jsonLd = [breadcrumbLd([{ name: 'Inicio', url: '/' }, { name: sp.h1, url: sp.url }])];
  writePage(sp.url, shell({ title: sp.title, description: sp.description, canonical: SITE + sp.url, jsonLd, body }));
  allUrls.push(sp.url); count++;
}

// ---------- 8. Sitemap ----------
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${SITE}${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);

// ---------- 9. Feed RSS (para el digest de newsletter por MailerLite) ----------
const gItems = Object.keys(guides).reverse().map(id => ({
  title: guides[id].title, url: guidePath(id), cat: 'Guía',
  desc: truncate(stripHtml(guides[id].body), 220)
}));
const pItems = [];
for (const catKey of Object.keys(CATS)) {
  const cat = CATS[catKey];
  cat.arr.slice().reverse().forEach(p => pItems.push({
    title: `${p.name} — ${p.brand}`, url: productPath(cat.dir, p), cat: cat.sing,
    desc: truncate(stripHtml(p.desc), 200) + ` Precio orientativo: ${p.price}€.`
  }));
}
// Intercala guías y libros (lo más nuevo arriba), tope 40
const feedItems = [];
for (let i = 0; i < Math.max(gItems.length, pItems.length); i++) {
  if (gItems[i]) feedItems.push(gItems[i]);
  if (pItems[i]) feedItems.push(pItems[i]);
}
const now = Date.now();
const rssItems = feedItems.slice(0, 40).map((it, i) => {
  const pub = new Date(now - i * 3600 * 1000).toUTCString();
  return `  <item>
    <title>${esc(it.title)}</title>
    <link>${SITE}${it.url}</link>
    <guid isPermaLink="true">${SITE}${it.url}</guid>
    <category>${esc(it.cat)}</category>
    <pubDate>${pub}</pubDate>
    <description>${esc(it.desc)}</description>
  </item>`;
}).join('\n');
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>EmpiezaLibros — Novedades de libros 2026</title>
  <link>${SITE}/</link>
  <description>Nuevas reseñas de novela, thriller, no ficción, romantasy y guías de lectura.</description>
  <language>es-ES</language>
  <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems}
</channel>
</rss>
`;
fs.writeFileSync(path.join(ROOT, 'rss.xml'), rss);

console.log(`Generadas ${count} páginas + sitemap con ${allUrls.length} URLs + RSS con ${Math.min(feedItems.length, 40)} items.`);
console.log(`Libros: novelas=${novelas.length} thriller=${thriller.length} noficcion=${desarrollo.length} romantasy=${romantasy.length} | guías=${Object.keys(guides).length}`);
