# EmpiezaLibros (empiezalibros.es)

Web estática de reseñas y guías de libros, con monetización por afiliación de Amazon.
Repo: `https://github.com/AlbertCascales/empiezalibros.git` · Deploy: Cloudflare Pages (push a `main` despliega).

## Arquitectura: index.html es la única fuente de la verdad

Los datos de **libros y guías viven dentro de `index.html`**, en literales JavaScript. No hay base de
datos ni ficheros JSON de contenido. `tools/generate-pages.js` los extrae parseando `index.html` y
genera todo lo demás:

- `/thriller/<slug>/` — ficha de cada libro; `/novelas/<slug>/` — solo el núcleo distópico
- `/guias/<slug>/index.html` — cada guía
- Los hubs `/thriller/`, `/novelas/` (distopía) y `/guias/index.html`
- `sitemap.xml` con todas las URLs

**Para añadir contenido: se edita `index.html` y se ejecuta `node tools/generate-pages.js`.** Nunca
editar a mano las páginas generadas — el generador las sobrescribe.

Cada libro y cada guía llevan un campo **`added: 'AAAA-MM-DD'`**: la fecha en que se añadió. Alimenta
el `<lastmod>` del sitemap y el `datePublished` del JSON-LD. Se escribe **una vez y no se toca nunca
más** — actualizarlo le dice a Google que la página cambió cuando no lo ha hecho. Los hubs y la home
derivan su `lastmod` de lo más reciente que cuelga de ellos; las páginas estáticas usan `SITE_LAUNCH`.
Si un libro llega sin `added`, el generador no falla: usa hoy y lo avisa por consola al terminar.

## Nicho: thriller, misterio y suspense (23/07/2026)

La web se **centró en thriller/misterio/suspense** tras ver en Search Console que ahí estaban sus
mejores posiciones (Castillo, Gómez-Jurado, Pérez-Reverte…). Antes cubría 4 géneros y competía de
frente con los gigantes en todos. Se decidió con datos de GSC (`gsc-report.js`).

- **Núcleo:** array `thriller` (23 libros). Aquí va todo el contenido nuevo.
- **Secundario que se conserva:** array `novelas`, reducido a **distopía/ci-fi** (`1984`, `Un mundo
  feliz`), que ya rankeaba ("ciencia ficción distópica" en pos. 6). Su hub `/novelas/` se re-etiquetó
  como "Distopía y ciencia ficción" (la URL sigue siendo `/novelas/`, no se rompe SEO).
- **Podado:** desarrollo personal (`/no-ficcion/`) y romance/romantasy (`/romantasy/`) enteros, más las
  novelas literarias que no rankeaban, y 11 guías fuera de nicho. Los arrays `desarrollo` y `romantasy`
  quedan **vacíos** en `index.html` (el generador los sigue leyendo sin fallar) y ya no están en `CATS`.
- **Tres libros se movieron** de `novelas` a `thriller` conservando su id (`n3` El problema final, `n16`
  Terra Alta, `n17` El italiano). Por eso el array `thriller` tiene ids con prefijo `n`: es a propósito.
- **`_redirects`** (raíz) redirige con 301 las ~73 URLs viejas: los 3 movidos a su nueva `/thriller/…`,
  y libros/hubs/guías podados a home o a `/guias/`. Es **imprescindible**: Cloudflare sirve 200 en rutas
  inexistentes (ver trampas), así que sin redirección quedarían soft-404. Se regenera comparando el
  sitemap nuevo con el viejo si se vuelve a podar.
- **Ángulo editorial:** cada ficha responde "¿debería leerlo? ¿es para mí? ¿por dónde entro?". La
  plantilla usa encabezados "De qué trata" / "¿Es para ti?" / "¿Deberías leerlo?".

(Ampliar el catálogo más adelante es la vía prevista; el nicho estrecho es el punto de partida, no un dogma.)

## Scripts (`tools/`)

| Script | Qué hace |
|---|---|
| `generate-pages.js` | Regenera todas las páginas y el sitemap desde `index.html`. Ejecutar tras cada cambio de contenido. |
| `download-covers.js` | Descarga las portadas que falten a `img/covers/`. Algunos libros necesitan un alias del título original (mapa `OVERRIDES`) porque Open Library no indexa la edición española. |
| `telegram-post.js` | Publica en el canal `@Empiezalibros`. `book <id>` publica un libro concreto; `backfill` publica el pendiente más antiguo. |
| `gsc-report.js` | Informe de Search Console (solo lectura). `--perf` rendimiento (rápido, 2 llamadas); `--index` estado URL a URL (~110 llamadas, lento, con reintentos); sin flag, ambos. Sin dependencias: JWT RS256 con módulos nativos. |

`telegram-post.js` es de **ruta fija a propósito**: existe para que las rutinas programadas no
improvisen `node -e "..."`, que disparaba aprobaciones de permisos cada día.

`backfill` no usa una cola fija: guarda solo la lista de **ya publicados** (en `estado.json`) y en cada
ejecución recalcula el catálogo de `index.html` para coger el primer pendiente. Así todo lo que se
añada a la web entra solo. (El modelo anterior era una cola congelada y los libros nuevos nunca
habrían entrado.)

## Secretos

Fuera del repo, en `C:\Users\marti\.empiezalibros-secrets\`: `telegram.key`, `mailerlite.key` y
`gsc-service-account.json` (cuenta de servicio de Google, lectura de Search Console; la cuenta
`gsc-lector@empiezalibros-gsc.iam.gserviceaccount.com` está añadida como usuario en la propiedad, que
es **de dominio**: `sc-domain:empiezalibros.es`). Nunca imprimirlos ni commitearlos. Los scripts los
leen solos de esa ruta; no hace falta pasarlos por el chat. MailerLite es la cuenta 2480900.
Afiliación Amazon: `albertomart09-21`.

La Search Console API se habilita una vez en el proyecto Cloud `empiezalibros-gsc` (número 1058034996183);
si `gsc-report.js` devuelve 403 "API has not been used", es que se deshabilitó.

## Rutinas programadas

En `C:\Users\marti\.claude\scheduled-tasks\` (cada una con su `SKILL.md`). Hay dos, ambas **pausadas
ahora mismo** (`enabled: false`, desde el 23/07/2026):

| Rutina | Hora | Qué hace |
|---|---|---|
| `empiezalibros-contenido-auto` | 04:00 diario | Solo web: añade 1 libro + 1 guía que falten, portada, regenera y hace push. **No toca Telegram.** |
| `empiezalibros-telegram-backfill` | 05:00 diario | Solo Telegram: publica 1 pendiente. Estado en su `estado.json`. **No toca git.** |

Las dos son **independientes**: Telegram publica el pendiente más antiguo de la web, no lo generado
ese mismo día. Cuando están activas la web crece 1/día y Telegram publica 1/día, y el desfase no se
cierra nunca — es intencional y asumido.

**Por qué pausadas:** con la web recién creada, Google no rastreaba parte de las URLs (presupuesto de
rastreo). Seguir publicando 1/día reparte ese presupuesto entre más páginas y frena la indexación. Se
pausaron para que Google digiera lo que ya hay. Se reactivan (a mano, `enabled: true` en el programador)
cuando la indexación se recupere — medir con `node tools/gsc-report.js --index`. Ojo: la pausa NO es
condicional, el programador no la reactiva solo. El estado real manda siempre sobre esta nota; si al
leer esto ya están activas, es que alguien las reactivó y no actualizó aquí.

Existen carpetas de `empiezalibros-newsletter-auto` y `empiezalibros-reddit-monitor`, pero esas
rutinas están **eliminadas** del programador (al borrarlas se conserva el `SKILL.md` en disco).
La carpeta suelta no significa que la rutina exista: comprobar siempre contra el programador.

## Trampas que ya nos mordieron (leer antes de tocar nada de esto)

- **Cloudflare Pages no da 404 en rutas inexistentes**: devuelve **HTTP 200 con el HTML de la web**.
  Por eso una portada que falta "responde 200" y Telegram falla al mandarla como foto. La existencia
  de una portada se comprueba SIEMPRE con `fs.existsSync` en local, **nunca por HTTP**.
- **Patrones que fuerzan aprobación manual de permisos**, por diseño y sin importar la allowlist:
  `cd <ruta> && git ...` y cualquier sustitución de comandos `$(...)` (p. ej. here-docs en el mensaje
  de commit). Por eso las rutinas ejecutan git directo (su raíz ya es este proyecto) y hacen commits
  con mensaje de **una sola línea**. Si una rutina empieza a pedir permisos cada día, es casi seguro
  uno de estos dos.
- **La redirección `www` → dominio raíz no está en el código**: es una *Redirect Rule* del panel de
  Cloudflare. Con Pages no se puede hacer por host desde `_redirects`.
- **El `robots.txt` que se sirve no es el del repo.** Cloudflare le antepone un bloque *Managed
  content* con `Content-Signal` y `Disallow` a los bots de IA (GPTBot, ClaudeBot, CCBot, Google-Extended…).
  Google Search no se ve afectado (`search=yes`, `Allow: /`), pero por eso un `WebFetch` al dominio
  responde **403**: lo bloquea Cloudflare, no el sitio. Para comprobar cabeceras, usar `curl` con UA
  de Googlebot.
- `TODAY` **era una constante fija** (`'2026-06-30'`, el día que nació el sitio) y congelaba el
  `lastmod` de las 101 URLs. Ahora existe `added` por página; `TODAY` solo es la reserva de quien
  llegue sin fecha. No volver a estampar una fecha global en el sitemap.
- Los permisos amplios de las rutinas están en `.claude/settings.local.json` (no se commitea, está en
  `.gitignore`).

## Convenciones

- **`stars` es la nota editorial y no hay recuento de opiniones.** Existía un campo `reviews` con una
  cifra inventada, que se mostraba como "(1.840 opiniones)": afirmaba que N personas reales habían
  valorado el libro. Se eliminó de los 76 libros y **no se vuelve a añadir** en ninguna forma. El
  JSON-LD usa `review` (una reseña, autor `Organization`), que sí es legítimo para una opinión propia;
  lo ilegítimo es `aggregateRating`, que significa "promedio de N usuarios" — si alguien propone
  ponerlo para ganar estrellas en los resultados, la respuesta es no. Mismo criterio en empiezapadel.
- Commits en español, en imperativo, describiendo el efecto para el usuario ("Añadir X y guía sobre Y").
- El "libro del momento" rota cada 2 días, determinista por fecha.
- `_headers` fija caché larga de imágenes y cabeceras de seguridad (convención de Cloudflare Pages).
- Servidor local: `npx serve -l 5180 .` (ya definido en `.claude/launch.json`).

## Proyectos hermanos

`empiezapadel.es` (en `Downloads/padelzone`) es el mismo patrón aplicado a pádel — si algo aquí
cambia de forma estructural, probablemente aplique allí también.

## Mantenimiento de este fichero

Si un cambio contradice algo que este fichero afirma (rutas, flujo de despliegue, scripts, secretos,
decisiones con historia), **actualízalo en el mismo commit que el cambio**. Un CLAUDE.md
desactualizado es peor que no tenerlo: se cree sin verificar y lleva a actuar sobre supuestos falsos.

**No es un changelog.** No se anota aquí el contenido añadido ni el trabajo de cada sesión: solo lo
estructural, lo que no se deduce leyendo el código, y lo que costó descubrir una vez y no debería
costar dos. Si supera las ~120 líneas, recortar lo que ya sea evidente desde el propio código.
