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
| `download-covers.js` | Descarga las portadas que falten a `img/covers/`. Algunos libros necesitan un alias del título original (mapa `OVERRIDES`) porque Open Library no indexa la edición española. |
| `telegram-post.js` | Publica en el canal `@Empiezalibros`. `book <id>` publica un libro concreto; `backfill` publica el pendiente más antiguo. |

`telegram-post.js` es de **ruta fija a propósito**: existe para que las rutinas programadas no
improvisen `node -e "..."`, que disparaba aprobaciones de permisos cada día.

`backfill` no usa una cola fija: guarda solo la lista de **ya publicados** (en `estado.json`) y en cada
ejecución recalcula el catálogo de `index.html` para coger el primer pendiente. Así todo lo que se
añada a la web entra solo. (El modelo anterior era una cola congelada y los libros nuevos nunca
habrían entrado.)

## Secretos

Fuera del repo, en `C:\Users\marti\.empiezalibros-secrets\`: `telegram.key`, `mailerlite.key`.
Nunca imprimirlos ni commitearlos. MailerLite es la cuenta 2480900. Afiliación Amazon: `albertomart09-21`.

## Rutinas programadas

En `C:\Users\marti\.claude\scheduled-tasks\` (cada una con su `SKILL.md`). Solo hay **dos activas**:

| Rutina | Hora | Qué hace |
|---|---|---|
| `empiezalibros-contenido-auto` | 04:00 diario | Solo web: añade 1 libro + 1 guía que falten, portada, regenera y hace push. **No toca Telegram.** |
| `empiezalibros-telegram-backfill` | 05:00 diario | Solo Telegram: publica 1 pendiente. Estado en su `estado.json`. **No toca git.** |

Las dos son **independientes**: Telegram publica el pendiente más antiguo de la web, no lo generado
ese mismo día. Como la web crece 1/día y Telegram publica 1/día, el desfase no se cierra nunca —
es intencional y asumido.

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
- Los permisos amplios de las rutinas están en `.claude/settings.local.json` (no se commitea, está en
  `.gitignore`).

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
