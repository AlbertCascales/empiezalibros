---
version: 1
name: EmpiezaLibros — Noir 3D (motion comic)
description: >
  Estilo de vídeo aprobado por el usuario el 23/09/2026 (demo "Reina roja"). Sustituye al blockframe
  azul (guardado en frame-blockframe.md). Ambiente de thriller: fondo noir granate/negro, libros en 3D
  con su PORTADA REAL girando, y escenas de "motion comic" (ilustración SVG/CSS animada) que cuentan la
  PREMISA de cada libro sin spoilers. Referencia viva, copiada en el proyecto:
  `referencia-demo.html` — leerla antes de construir cualquier frame y reutilizar su CSS/patrones.
unit: 1080×1920 vertical · contenido en el 83% superior (y ≤ 1594px)
principle: cada libro se ve (portada real) · cada historia se ilustra (sin spoilers) · nada inventado
---

## Paleta
- fondo: #0c0809 (negro cálido) con radial granate #4a1020 → #1c0a0f; glow rojo rgba(200,40,70,.35)
- texto: #f3e9dc (crema) · acento: #ff5a7a / #ff3d63 (rojo) · secundario: #ff8fa5 / #ffb3c1
- estrellas / detalle: #ffcf5a (oro) · cinta policial #f2c230
- **Tinte por libro:** cada libro de `index.html` trae `c1`/`c2` (colores de su portada). Úsalos para el
  glow y el lomo 3D de ese libro, de modo que cada punto tenga su color sin salirse de la base noir.

## Tipografía (locales en `assets/fonts/`, @font-face root-relative)
- Display: DM Serif Display (títulos, captions narrativos 70–150px)
- Etiquetas: Space Grotesk 600–800, mayúsculas, tracking .12–.22em (pills, tags, labels)
- Cuerpo: DM Sans 500–600 (tarjetas)

## Atmósfera (siempre, en capas bajo el contenido)
- `.bg` radial granate + `.glow` que respira (scale .8→1.15 durante toda la pieza)
- `.sweep`: banda de luz diagonal que barre la pantalla (x 0→2600 en ~5s)
- polvo: ~40 partículas deterministas (PRNG con semilla, NUNCA Math.random) que flotan hacia arriba
- `.grain` + `.vignette` DEBAJO del texto (encima dan falsos positivos de oclusión en `check`)

## Componentes
- **Libro 3D** (`.bookwrap > .book > .front/.back/.spine/.pages/.top`, ver referencia): 440×671, grosor 64px,
  `.front` = portada real `assets/img/<idLibro>.jpg` con brillo diagonal; lomo con el título en vertical.
  Entradas: cae desde z:-2600 girando rotationY -600→-22 y rebota al aterrizar (thock); en reposo gira
  despacio (sine.inOut). Sombra elíptica bajo el libro que acompaña su escala/posición.
- **Caption narrativo** (`.cap`): DM Serif 80px centrado en y≈1290, palabra a palabra (blur 8→0, y 50→0,
  stagger .07), con la parte clave en `<em>` rojo. Franja `.capfade` oscura detrás para legibilidad.
- **Pill de capítulo** arriba (y≈130): "La historia · sin spoilers", "Reseña en 12 segundos"…
- **Estrellas** (nota editorial `stars` = "Nuestra valoración", nunca "valoración de lectores"), contadores
  que suben (páginas, año, precio) — datos SOLO de la ficha del libro.
- **Tarjetas pros/contras** que voltean en rotationX -95→0; la de contra tiembla.
- **Sello** "EMPIEZA AQUÍ" (borde rojo 10px, fondo casi opaco) que cae desde scale 3.2 y sacude el libro.
  Nunca encima del título de la portada: debajo del libro.

## Escenas de historia (motion comic) — el corazón del estilo
Por cada libro, 1–3 viñetas animadas que ilustran su PREMISA (lo que cuenta la sinopsis oficial, nunca
giros ni finales). Se construyen con SVG/CSS: siluetas planas a contraluz (rim-light rojo con
drop-shadow), arquitectura/escenario simple, y UN efecto de movimiento fuerte por viñeta. Vocabulario
ya probado en la referencia:
- ciudad nocturna con luna, ventana encendida con silueta, lluvia (gotas en bucle determinista), zoom de cámara
- hueco de escalera en espiral (cuadrados anidados que giran) + sombra que crece a golpe de pasos (thock)
- gota de sangre que cae → salpicadura → la pantalla se tiñe de rojo + cintas policiales que cruzan y tiemblan
- pareja protagonista en silueta a contraluz con tags de nombre
Ideas análogas según el libro: pueblo nevado/bosque (nórdica), faro/costa, casa aislada, tren, hospital,
huella/lupa, fotografía antigua que se revela, mapa con chinchetas unidas por hilo rojo, reloj, teléfono.
Siluetas: formas simples y reconocibles (hombros + cabeza + pelo), nunca "muñeco de nieve" (dos círculos).
Ninguna figura debe tapar más de ~40% del frame ni el caption.

## Movimiento
- eases power3/expo para entradas, sine.inOut para reposo; cortes secos + fundidos cortos (.3–.4s) entre viñetas
- sacudidas (x ±10–14px, repeat 5, yoyo) solo en impactos (aterrizaje, sello, sangre)
- todo en UNA timeline GSAP pausada por composición, seek-safe: `immediateRender:false` en fromTo repetidos
  sobre el mismo elemento; nada de letterSpacing animado (usar scale/x)
- el texto entra EN SU CUE de voz (timestamps de `audio_meta.json`), no antes ni 1s después

## Prohibido
- inventar datos, portadas o premisas; usar la portada de otro libro; spoilers
- emojis, bokeh genérico "IA", nav/cursores; contenido por debajo de y=1594
