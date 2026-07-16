# EmpiezaLibros (empiezalibros.es)

Web estática de reseñas y guías de libros, con monetización por afiliación de Amazon.
Repo: `https://github.com/AlbertCascales/empiezalibros.git` · Deploy: Cloudflare Pages (push a `main` despliega).

## Arquitectura: index.html es la única fuente de la verdad

Los datos de **libros y guías viven dentro de `index.html`**, en literales JavaScript. No hay base de
datos ni ficheros JSON de contenido. `tools/generate-pages.js` los extrae parseando `index.html` y
genera todo lo demás:

- `/novelas/<slug>/`, `/thriller/<slug>/`, `/no-ficcion/<slug>/`, `/romantasy/<slug>/` — ficha de cada libro
- `/guias/<slug>/index.html` — cada guía
- Los hubs de cada género y `/guias/index.html`
- `sitemap.xml` con todas las URLs

**Para añadir contenido: se edita `index.html` y se ejecuta `node tools/generate-pages.js`.** Nunca
editar a mano las páginas generadas — el generador las sobrescribe.

Ojo con las etiquetas: las categorías se renombraron en la interfaz (Romantasy → Romance,
No ficción → Desarrollo personal) **pero las URLs siguen siendo las antiguas** (`/romantasy/`,
`/no-ficcion/`). Es intencional, para no romper el SEO.

## Scripts (`tools/`)

| Script | Qué hace |
|---|---|
| `generate-pages.js` | Regenera todas las páginas y el sitemap desde `index.html`. Ejecutar tras cada cambio de contenido. |
| `download-covers.js` | Descarga las portadas que falten a `img/covers/`. Algunos libros necesitan un alias del título original para encontrar la portada. |
| `telegram-post.js` | Publica en el canal `@Empiezalibros`. `book <id>` publica un libro concreto; `backfill` publica el siguiente de la cola. |

`telegram-post.js` es de **ruta fija a propósito**: existe para que las rutinas programadas no
improvisen `node -e "..."`, que disparaba aprobaciones de permisos cada día.

## Secretos

Fuera del repo, en `C:\Users\marti\.empiezalibros-secrets\`: `telegram.key`, `mailerlite.key`.
Nunca imprimirlos ni commitearlos. MailerLite es la cuenta 2480900. Afiliación Amazon: `albertomart09-21`.

## Rutinas programadas

En `C:\Users\marti\.claude\scheduled-tasks\` (cada una con su `SKILL.md`):
`empiezalibros-contenido-auto`, `empiezalibros-telegram-backfill` (estado en `estado.json`),
`empiezalibros-newsletter-auto`, `empiezalibros-reddit-monitor`.

La rutina de web y la de Telegram son **independientes**: Telegram publica de una cola dinámica de
pendientes (lo que está en la web y aún no se ha publicado), no lo generado ese mismo día.

## Convenciones

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
