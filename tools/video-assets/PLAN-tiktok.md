# Plan TikTok — 1 vídeo cada 3 días sobre las guías

Réplica del montaje de empiezapadel.es. Objetivo: llevar tráfico a empiezalibros.es publicando en
TikTok un vídeo vertical por guía, **1 cada 3 días**. Cada vídeo es un *listicle/explainer* faceless
(tipografía cinética, sin cara ni stock), generado con `tools/scaffold-video.js` + HyperFrames y
cerrado con CTA a `empiezalibros.es`. Doble foco de la web (manda en el copy): **lector que empieza**
+ **thriller/misterio/suspense**.

## Estado de las guías (18 existentes)

El catálogo crece solo: la rutina `empiezalibros-contenido-auto` añade 1 libro + 1 guía cada 3 días
(g24–g29 se crearon así, 14–21/08/2026). **El calendario de TikTok NO se autoactualiza**: hay que
volcar a mano las guías nuevas a `plan-tiktok/calendario-tiktok.txt`, que es la fuente de la verdad
del pipeline de vídeo.

| id | Guía | Encaje nicho | Prioridad vídeo |
|----|------|--------------|-----------------|
| g22 | Gómez-Jurado: orden saga Reina Roja | ✅ autor top (GSC) | **Alta** |
| g13 | Stephen King: por dónde empezar | ✅ terror/suspense | **Alta** |
| g12 | Agatha Christie: por dónde empezar | ✅ misterio | **Alta** |
| g4  | Novela negra española: por dónde empezar | ✅ novela negra | **Alta** |
| g25 | Thriller psicológico con giro final | ✅ subgénero-ancla | **Alta** (formato top en stats) |
| g26 | Thriller de asesino en serie | ✅ subgénero | **Alta** (formato top en stats) |
| g24 | Novela negra nórdica: por dónde empezar | ✅ novela negra | **Alta** (novela negra = vídeo nº1) |
| g29 | Novela negra francesa: por dónde empezar | ✅ novela negra | Media-alta |
| g10 | Ciencia ficción distópica imprescindibles | ✅ (1984/Un mundo feliz, keyword pos.6) | Media |
| g15 | Thrillers cortos para reengancharte | ✅ thriller (reenfocada) | Media |
| g27 | Eva García Sáenz: Trilogía Ciudad Blanca | ✅ novela negra + saga | Media |
| g28 | Camilla Läckberg: saga Fjällbacka | ✅ nórdica + saga | Media (nicho) |
| g1  | Mejores libros para empezar a leer 2026 | ✅ entrada 100% thriller (reenfocada) | Media |
| g6  | Hábito de leer empezando por thrillers | ✅ entrada thriller (reenfocada) | Media |
| g23 | Domingo Villar: orden serie Leo Caldas | ✅ novela negra (autor nicho) | Baja (poco alcance) |
| g2  | Elige tu thriller según tu ánimo | ✅ thriller (reenfocada) | Baja (formato no probado) |
| g3  | Los thrillers más vendidos | ✅ thriller (reenfocada) | Baja (formato no probado) |
| g7  | Thrillers para la playa verano 2026 | ✅ thriller (reenfocada) | Estacional (solo jun–jul) |

Todas son 100% thriller/misterio. Las 6 de entrada u off-nicho originales (g1, g2, g3, g6, g7, g15) se
reescribieron en clave thriller (30/07/2026). Las estacionales solo se publican en temporada.

## Lecciones de rendimiento (stats TikTok, 25/08/2026)

Con los 9 primeros vídeos publicados, los datos mandan sobre la prioridad de arriba:

- **Gana: género/subgénero + lista de libros CONCRETOS + pregunta abierta al final.** Novela negra
  española (1.149 views, 7 comentarios, lo más comentado) y thrillers cortos (1.108 views, 13 likes).
- **El "dolor del lector" solo funciona si la promesa es una lista de libros**, no consejos abstractos:
  "thrillers cortos" 1.108 vs "3 errores para leer más" 238 (mismo gancho, resultado opuesto).
- **El "versus" tira** (1984 vs Un mundo feliz: 796 sin ser autor top).
- **Autor único orden-de-saga rinde flojo** salvo iconos universales (Christie 786; Gómez-Jurado, King
  y Domingo Villar por debajo). Por eso los de autor van detrás de los de género.
- **Duración óptima 33–36 s.** Los dos más cortos (27 s, 29 s) fueron los únicos con 0 likes; no bajar
  de ~33 s (esto se controla al montar el vídeo, no en el caption).

Por eso el calendario máquina se reordenó (25/08) para front-cargar g25/g26/g24/g29 (formato ganador),
dejar g2/g3 al final (formato no probado) y sacar g7 (playa) por estacionalidad.

## Ideas de guías futuras (autores/temas con fichas ya en la web)

Cuando toque ampliar, estas apuntan a libros que ya existen como ficha:

| Idea de guía | Libros que ya tenemos | Por qué |
|------------|------------------------|---------|
| **Javier Castillo: por dónde empezar** | La chica de nieve · El cuco de cristal · El día que se perdió la cordura | Autor que rankea bien (GSC); 3 fichas ya |
| **Carmen Mola: por dónde empezar** | La novia gitana · Las madres | Saga inspectora Elena Blanco; 2 fichas |
| **Arturo Pérez-Reverte: por dónde empezar** | El italiano · El problema final | Autor top (GSC); 2 fichas |
| **Los mejores thrillers de 2026 (novedades)** | (rotar con lo nuevo del catálogo) | Captura búsquedas de novedad cada año |

## Calendario

**La fuente de la verdad es `plan-tiktok/calendario-tiktok.txt`** (con caption + hashtags + landing por
vídeo, listo para copiar). Este fichero es solo estrategia; aquel es el operativo que lee la rutina.

Orden real vigente (25/08/2026): V1 g22 · V2 g13 · V3 g12 · V4 g4 · V5 g23 · V6 g10 · V7 g15 · V8 g1 ·
V9 g6 (publicados) → V10 g25 · V11 g26 · V12 g24 · V13 g29 · V14 g27 · V15 g28 · V16 g2 · V17 g3.
Se front-cargó por GSC (Gómez-Jurado, King, Christie, novela negra) y, desde V10, por rendimiento real
(ver "Lecciones de rendimiento": género/subgénero + lista + pregunta gana). g7 (playa) fuera hasta
jun–jul 2027.

Tras V17: reciclar los que mejor funcionen con otro ángulo/gancho (no republicar idéntico) y sumar las
guías nuevas que vaya creando `contenido-auto`, volcándolas a mano al calendario máquina.

## Flujo operativo por vídeo (desde la raíz del repo)

1. Si es `[nueva]`: escribir la guía en `index.html` y `node tools/generate-pages.js`.
2. `node tools/scaffold-video.js <idGuía>` → crea `videos/<slug>/` (borrador de guion+storyboard+estética).
3. **Revisar a mano** el gancho (Frame 1) y las líneas de voz del `SCRIPT.md` — son borrador.
4. Ejecutar los pasos de máquina que imprime el scaffold (voz HeyGen → frames por workers →
   ensamblar → `npx hyperframes render`). Ver [[tiktok-video-pipeline]] en memoria.
5. Subir el MP4 a TikTok **a mano** (no hay API gratis); la música se pone en la app de TikTok al
   subir (mejor alcance y licencia). En la bio/descripción, enlace a la guía en `empiezalibros.es`.

## Notas

- **Sin coste de generación**: HyperFrames renderiza HTML→MP4 con Chrome headless + FFmpeg (ya
  instalado). Voz y música vía sesión HeyGen (OAuth en `~/.heygen/`, caduca ~08-ago-2026; renovar con
  `npx hyperframes auth login`). Voz ES: "Narrator Mateo" `0077225a877e457db4572ccaf245910b`, `--speed 1.12`.
- **Guion sin frases cortadas a punto**: Mateo mete pausas largas en cada punto y seguido; escribir las
  líneas de voz unidas con comas/`;`.
- `videos/` está en `.gitignore` (proyectos grandes). Los activos de marca (`frame.md`,
  `caption-skin.html`) sí se versionan, en `tools/video-assets/`.
- **Automatizado**: la rutina `empiezalibros-tiktok-video` (10:00 diario) lee el calendario máquina
  `plan-tiktok/calendario-tiktok.txt` + `plan-tiktok/generados.txt` y genera el vídeo que toque (1 cada
  3 días; nada en los días intermedios). Genera el MP4 en `videos/`; la subida a TikTok sigue siendo
  **manual**. Cuando `contenido-auto` cree una guía nueva, hay que añadir su bloque (caption + hashtags
  + landing) a `calendario-tiktok.txt` a mano: el calendario máquina no se autoactualiza.
