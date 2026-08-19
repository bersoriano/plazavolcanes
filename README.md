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
2. Define `http://localhost:3000` como Site URL durante desarrollo.
3. Agrega `http://localhost:3000/auth/confirm` a Redirect URLs.
4. En **Authentication → Providers → Email**, desactiva confirmación de correo para que una cuenta nueva pueda abrir su tienda inmediatamente. Si prefieres verificar correo, deja confirmación activa; `/auth/confirm` ya acepta ambos flujos de Supabase.

Inicia proyecto:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

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

Migraciones versionadas: `supabase/migrations/`.

## Alcance de esta versión

Incluye registro, inicio/cierre de sesión, gestión de múltiples tiendas, ubicación por estado, borradores, publicación, imágenes, condición de producto nuevo/usado, catálogo público, búsqueda y páginas públicas de tienda/producto.

Fuera de alcance: carrito, checkout, pagos, pedidos, mensajería, administración global, categorías, reseñas y favoritos.
