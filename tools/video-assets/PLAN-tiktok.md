# Plan TikTok — 1 vídeo cada 3 días sobre las guías

Réplica del montaje de empiezapadel.es. Objetivo: llevar tráfico a empiezalibros.es publicando en
TikTok un vídeo vertical por guía, **1 cada 3 días**. Cada vídeo es un *listicle/explainer* faceless
(tipografía cinética, sin cara ni stock), generado con `tools/scaffold-video.js` + HyperFrames y
cerrado con CTA a `empiezalibros.es`. Doble foco de la web (manda en el copy): **lector que empieza**
+ **thriller/misterio/suspense**.

## Estado de las guías (11 existentes)

| id | Guía | Encaje nicho | Prioridad vídeo |
|----|------|--------------|-----------------|
| g22 | Gómez-Jurado: orden saga Reina Roja | ✅ autor top (GSC) | **Alta** |
| g13 | Stephen King: por dónde empezar | ✅ terror/suspense | **Alta** |
| g12 | Agatha Christie: por dónde empezar | ✅ misterio | **Alta** |
| g4  | Novela negra española: por dónde empezar | ✅ novela negra | **Alta** |
| g10 | Ciencia ficción distópica imprescindibles | ✅ (1984/Un mundo feliz, keyword pos.6) | Media |
| g15 | Thrillers cortos para reengancharte | ✅ thriller (reenfocada) | Media |
| g1  | Mejores libros para empezar a leer 2026 | ✅ entrada 100% thriller (reenfocada) | Media |
| g6  | Hábito de leer empezando por thrillers | ✅ entrada thriller (reenfocada) | Media |
| g2  | Elige tu thriller según tu ánimo | ✅ thriller (reenfocada) | Baja |
| g3  | Los thrillers más vendidos | ✅ thriller (reenfocada) | Baja |
| g7  | Thrillers para la playa verano 2026 | ✅ thriller (reenfocada) | Estacional (verano) |

Las 11 guías son ya 100% thriller/misterio: las 6 que eran de entrada u off-nicho (g1, g2, g3, g6, g7,
g15) se reescribieron en clave thriller (30/07/2026) para que todas sirvan al doble foco y al guion de
vídeo. Las estacionales solo se publican en temporada.

## Guías nuevas a crear (autores/temas que YA tienen fichas en la web)

Todas apuntan a libros que ya existen en el array `thriller` de `index.html`, así enlazan a fichas
reales. Se escriben en `index.html` (como el resto de guías) y se ejecuta `node tools/generate-pages.js`
**antes** de generar su vídeo.

| Nueva guía | Libros que ya tenemos | Por qué |
|------------|------------------------|---------|
| **Javier Castillo: por dónde empezar** | La chica de nieve · El cuco de cristal · El día que se perdió la cordura | Autor que rankea bien (GSC); 3 fichas ya |
| **Thrillers con giro final que no verás venir** | La paciente silenciosa · Perdida · La chica del tren · La asistenta | Keyword muy buscada, 4 fichas |
| **Carmen Mola: por dónde empezar** | La novia gitana · Las madres | Saga inspectora Elena Blanco; 2 fichas |
| **Arturo Pérez-Reverte: por dónde empezar** | El italiano · El problema final | Autor top (GSC); 2 fichas |
| **Los mejores thrillers psicológicos para empezar** | La paciente silenciosa · El psicoanalista · Perdida · La asistenta | Subgénero-ancla del nicho |
| **Los mejores thrillers de 2026 (novedades)** | (rotar con lo nuevo del catálogo) | Captura búsquedas de novedad cada año |

Con 11 + 6 = **17 guías** hay ~7 semanas de material a 1 vídeo/3 días antes de reciclar.

## Calendario (arranque 2026-08-01, cada 3 días)

`[nueva]` = escribir la guía en `index.html` + `generate-pages.js` antes de montar el vídeo.

| # | Fecha | Guía / vídeo |
|---|-------|--------------|
| 1 | Ago 01 | g22 — Gómez-Jurado, orden Reina Roja |
| 2 | Ago 04 | g13 — Stephen King, por dónde empezar |
| 3 | Ago 07 | g12 — Agatha Christie, por dónde empezar |
| 4 | Ago 10 | g4 — Novela negra española |
| 5 | Ago 13 | **[nueva]** Javier Castillo, por dónde empezar |
| 6 | Ago 16 | g10 — Ciencia ficción distópica |
| 7 | Ago 19 | **[nueva]** Thrillers con giro final que no verás venir |
| 8 | Ago 22 | g15 — Libros cortos para reengancharte |
| 9 | Ago 25 | **[nueva]** Carmen Mola, por dónde empezar |
| 10 | Ago 28 | g1 — Mejores libros para empezar a leer |
| 11 | Ago 31 | **[nueva]** Arturo Pérez-Reverte, por dónde empezar |
| 12 | Sep 03 | g6 — Cómo crear el hábito de leer |
| 13 | Sep 06 | **[nueva]** Mejores thrillers psicológicos |
| 14 | Sep 09 | g2 — Elegir lectura según ánimo |
| 15 | Sep 12 | g3 — Más vendidos de 2025 |
| 16 | Sep 15 | **[nueva]** Mejores thrillers de 2026 |
| 17 | Sep 18 | g7 — Libros para la playa (solo si sigue siendo temporada; si no, recolocar) |

Se front-cargan los autores fuertes en GSC (Gómez-Jurado, King, Christie, novela negra) para captar
tráfico cuanto antes; las guías nuevas se intercalan para repartir el trabajo de redacción.

Tras el 18-sep: reciclar los que mejor funcionen con otro ángulo/gancho (no republicar idéntico) y
sumar guías nuevas según crezca el catálogo.

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
  **manual**. El calendario máquina solo lleva las 11 guías existentes; al redactar las 6 nuevas, se
  añaden sus bloques a `calendario-tiktok.txt`.
