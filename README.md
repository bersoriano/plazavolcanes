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
