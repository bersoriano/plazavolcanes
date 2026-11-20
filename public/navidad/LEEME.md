# Capa navideña · Plaza Volcanes

16 piezas SVG pensadas para montarse **encima** de la landing que ya existe.
Ninguna cambia la estructura ni el layout: todas son `position:absolute`
con `pointer-events:none` dentro de un contenedor que ya está en la página.

## Instalación

1. Copia la carpeta `navidad/` a `public/navidad/`.
2. Importa `navidad/navidad.css` (o pega su contenido en tu hoja global).
3. Añade `class="nv-anclaje"` al contenedor que va a sostener cada pieza
   (header, hero, tarjeta, CTA) — es sólo `position: relative`.
4. Mete el overlay como último hijo de ese contenedor.

```html
<header class="header nv-anclaje">
  <!-- tu nav, sin tocar -->

  <div class="nv nv--guirnalda" aria-hidden="true">
    <img src="/navidad/guirnalda.svg" alt="" />
  </div>
</header>
```

`aria-hidden="true"` y `alt=""` son importantes: la decoración no debe
anunciarse a un lector de pantalla.

## Piezas y dónde van

| Archivo | Clase | Elemento que la ancla |
|---|---|---|
| `guirnalda.svg` | `.nv--guirnalda` | header de la nav |
| `gorro.svg` | `.nv--gorro` | marca circular del logo |
| `nochebuena.svg` | `.nv--flor` | tarjeta de fundadoras / de producto |
| `esfera-roja.svg` `esfera-oro.svg` `esfera-pino.svg` | `.nv--esfera` | borde superior del hero y del footer |
| `copo-blanco.svg` `copo-pino.svg` `copo-lima.svg` | `.nv--copos` | fondo del hero, CTA, barra y footer |
| `mono.svg` | `.nv--mono` | botón «Abrir mi tienda gratis» |
| `acebo.svg` | `.nv--acebo` | insignia circular «0% comisión» |
| `posada.svg` | `.nv--posada` | tarjeta «Reglas de mi tienda» |
| `rama.svg` | `.nv--rama` | esquina inferior del CTA final |
| `luces.svg` | `.nv--luces` | borde superior del CTA final |
| `nieve.svg` + `carambanos.svg` | `.nv--nieve` | resaltado «tus reglas», tarjetas, footer |
| `sello-navidad.svg` | `.nv--sello` | hero, como sticker promocional |
| (sin archivo, es CSS) | `.nv-liston` | tarjeta de producto con `overflow:hidden` |

## Notas

- `nieve.svg` lleva `preserveAspectRatio="none"`: se estira a lo ancho que
  le des sin deformar el resto. Dale una altura fija en CSS (20–30 px).
- `guirnalda.svg` y `luces.svg` están dibujadas a 1280 px y escalan
  proporcionalmente con `width:100%; height:auto`.
- Los copos se colocan sueltos dentro de `.nv--copos` con `left/top` en %
  y `opacity` entre .13 y .22 para que no compitan con el texto.
- Paleta: pino `#0E4A32`, rojo `#C8322B`, oro `#E3A93C`, nieve `#FFFFFF`,
  sobre el morado `#32174D` y el lima `#BEF38A` de la marca.
