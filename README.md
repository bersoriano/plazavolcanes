# Plaza Volcanes Shop

Marketplace en español para descubrir productos de tiendas independientes. Cada persona puede registrarse con correo y contraseña, crear varias tiendas y publicar productos. Esta primera versión es solo catálogo: no incluye carrito, checkout, pagos ni pedidos.

## Stack

- Next.js 16, React 19 y TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres y Storage
- Vitest y Testing Library

## Configuración

Requisitos: Node.js 20 o superior, npm y un proyecto de Supabase.

```bash
npm install
cp .env.example .env.local
```

Completa `.env.local`:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE

# Origen público de las imágenes del catálogo. Si se omite, se usa el bucket
# público de Supabase. Es la única variable que cambia al mover los objetos a
# otro almacenamiento: se copian con las mismas claves y se apunta aquí.
NEXT_PUBLIC_MEDIA_BASE=https://TU-PROYECTO.supabase.co/storage/v1/object/public/catalogo

# Origen que entrega versiones redimensionadas. Si se omite, se usa el
# transformador de Supabase. Déjalo vacío si el almacenamiento no redimensiona:
# entonces se sirve el original, más pesado pero correcto.
NEXT_PUBLIC_MEDIA_RESIZE_BASE=https://TU-PROYECTO.supabase.co/storage/v1/render/image/public/catalogo
```

Vincula Supabase y aplica esquema, políticas RLS y bucket de imágenes:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

En Supabase Dashboard:

1. Abre **Authentication → URL Configuration**.
2. Define `http://localhost:3000` como Site URL durante desarrollo; en producción es el dominio real.
3. Agrega `http://localhost:3000/auth/confirm` a Redirect URLs.
4. En **Authentication → Providers → Email**, desactiva confirmación de correo para que una cuenta nueva pueda abrir su tienda inmediatamente. Si prefieres verificar correo, deja confirmación activa; `/auth/confirm` ya acepta ambos flujos de Supabase.

Inicia proyecto:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Analítica con PostHog

Opcional. PostHog recibe los mismos eventos que Google Analytics, con las mismas
reglas: solo desde el host de `NEXT_PUBLIC_SITE_URL`, solo páginas públicas,
sin cookies ni almacenamiento en el navegador. Usa el token público del
proyecto (`phc_`), nunca una clave personal:

```dotenv
NEXT_PUBLIC_POSTHOG_KEY=phc_TU_TOKEN_PUBLICO
NEXT_PUBLIC_POSTHOG_HOST=/ingest
NEXT_PUBLIC_POSTHOG_REGION=us
# Solo en Preview o local, y con la clave de un proyecto de prueba.
NEXT_PUBLIC_POSTHOG_DEBUG=false
```

`/ingest` es el proxy de `proxy.ts` hacia PostHog. En `localhost` y en las
vistas previas no se envía nada salvo con `NEXT_PUBLIC_POSTHOG_DEBUG=true`; en
ese caso usa la clave de un proyecto de prueba, no la de producción. Antes del
primer despliegue hay que activar el modo sin cookies del proyecto en PostHog,
o descarta todos los eventos. Consulta [eventos, privacidad y
verificación](docs/posthog-analytics.md).

## Analítica con Google Analytics

También es opcional. Comparte el código y las reglas con PostHog y se activa con el ID de
medición de GA4 y solo envía datos desde el host de `NEXT_PUBLIC_SITE_URL`
(nunca desde `localhost` ni las vistas previas de Vercel):

```dotenv
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
# Solo en Preview o local, para ver los eventos en DebugView. En producción se ignora.
NEXT_PUBLIC_GA_DEBUG=false
```

Como las demás `NEXT_PUBLIC_*`, se incrusta durante el build: un cambio necesita
un nuevo despliegue. Antes del primer despliegue con el ID hay que **apagar la
medición mejorada** del flujo web en GA4, o cada página se cuenta dos veces.
Consulta [eventos, privacidad y pasos en GA4](docs/google-analytics.md).

## Producción

El sitio vive en [plazavolcanes.com](https://plazavolcanes.com).

1. En Vercel define `NEXT_PUBLIC_SITE_URL=https://plazavolcanes.com` y vuelve a desplegar: las variables `NEXT_PUBLIC_*` se incrustan durante el build, así que un cambio no surte efecto hasta el siguiente despliegue.
2. En **Authentication → URL Configuration** de Supabase define `https://plazavolcanes.com` como Site URL y agrega `https://plazavolcanes.com/auth/confirm` a Redirect URLs, conservando las entradas de desarrollo y de vistas previas.
3. Revisa `docs/auth-url-configuration.md` antes de cambiar de dominio: cada ajuste falla en silencio.

El correo integrado de Supabase solo entrega a direcciones del equipo del proyecto y admite unos dos envíos por hora, así que la confirmación por correo necesita SMTP propio antes de activarse en producción. Ese mismo SMTP desbloquea la edición de plantillas.

`/robots.txt` y `/sitemap.xml` se construyen con `NEXT_PUBLIC_SITE_URL`. Si el sitemap publica URLs de `localhost`, la variable falta en el despliegue.

## Comandos

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # pruebas unitarias y componentes
npm run build      # build de producción
```

Para probar políticas de base localmente se requiere Docker:

```bash
npx supabase start
npx supabase test db
```

## Blog

Las publicaciones son archivos MDX en `content/posts/<slug>.mdx`; no pasan por la base de datos. Publicar es hacer commit y desplegar.

- Copia `content/posts/example-post.mdx`, que muestra el formato y se queda como borrador. Con Claude Code, `/new-post <tema>` redacta un borrador.
- Frontmatter: `title`, `description`, `date` (AAAA-MM-DD) y `draft`; opcionales `seoTitle` y `updated`. Los borradores solo se ven con `npm run dev`. Pon `draft: false` para publicar.
- El blog queda fuera del índice y del sitemap hasta tener una publicación.
- Las imágenes van en `public/blog/<slug>/`. `npm test` compila cada publicación y rechaza imágenes remotas.

## Reglas de datos

- Tiendas son públicas; solo propietario puede crearlas, editarlas o eliminarlas.
- Tiendas guardan país y división administrativa; México y sus estados están disponibles inicialmente.
- Productos publicados son públicos; borradores solo son visibles para propietario.
- Imágenes aceptan JPEG, PNG o WebP hasta 5 MB.
- Archivos se guardan bajo carpeta UUID del propietario.
- Eliminación de tienda elimina sus productos por cascada.
- Eliminar un producto lo retira del catálogo y borra sus imágenes; el registro se conserva para que sus conversaciones sigan teniendo contexto.

Migraciones versionadas: `supabase/migrations/`.

## Alcance de esta versión

Incluye registro, inicio/cierre de sesión, gestión de múltiples tiendas, ubicación por estado, borradores, publicación, imágenes, condición de producto nuevo/usado, catálogo público, búsqueda, páginas públicas de tienda/producto y enlaces para compartir.

Fuera de alcance: carrito, checkout, pagos, pedidos, mensajería, administración global, categorías, reseñas y favoritos.
