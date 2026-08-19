# Plaza Volcanes Shop — Design Specification

## Objective

Build a Spanish-language, multi-seller product marketplace named **Plaza Volcanes Shop**. Visitors browse published products and shops without an account. Users register with email and password, create shops immediately, and manage product listings for shops they own.

Version 1 is a catalog and seller-management product. It does not support carts, checkout, payments, orders, inventory, categories, ratings, administrative approval, or analytics.

## Technology

- Latest stable Next.js with App Router, React, TypeScript, and Tailwind CSS at implementation time
- Supabase Auth for email/password authentication
- Supabase PostgreSQL for shops and products
- Supabase Storage for one image per shop or product
- Supabase SSR integration for cookie-based sessions
- Server Components by default; Client Components only where browser interaction requires them
- Server Actions for validated mutations
- Zod for shared input validation
- Pinned dependency versions and committed lockfile

## Application Structure

### Public routes

- `/`: marketplace home with prominent product search, newest published products, and shops; optional `q` query filters published product names case-insensitively
- `/tiendas/[slug]`: shop details and its published products
- `/productos/[id]`: product detail
- `/ingresar`: email/password sign-in
- `/registro`: email/password registration

### Protected routes

- `/panel`: seller overview and owned shops
- `/panel/tiendas/nueva`: shop creation
- `/panel/tiendas/[id]`: shop editing and product list
- `/panel/tiendas/[id]/productos/nuevo`: product creation
- `/panel/productos/[id]/editar`: product editing

Anonymous visitors may browse public routes. Protected routes require a valid server-verified session and redirect unauthenticated visitors to `/ingresar`.

## Data Model

### `shops`

- `id`: bigint identity primary key
- `owner_id`: UUID foreign key to `auth.users`, required
- `name`: text, required
- `slug`: text, required and unique
- `description`: text, required
- `image_path`: text, optional
- `created_at`: timezone-aware timestamp
- `updated_at`: timezone-aware timestamp

### `products`

- `id`: bigint identity primary key
- `shop_id`: bigint foreign key to `shops`, required, cascading on shop deletion
- `name`: text, required
- `description`: text, required
- `price_mxn`: exact `numeric(12,2)`, required and non-negative
- `image_path`: text, optional
- `status`: text constrained to `draft` or `published`
- `created_at`: timezone-aware timestamp
- `updated_at`: timezone-aware timestamp

Foreign keys and ownership columns receive indexes. Public listing access uses an index suited to published products ordered by creation time. Database constraints protect status, price, and required values independently of application validation.

No separate profile table exists in version 1. Authentication identity comes from Supabase Auth; shop ownership holds marketplace authorization.

## Authorization and Storage Security

Row-level security is enabled on every table in the exposed `public` schema.

- Everyone may read shops.
- Everyone may read published products.
- Authenticated sellers may read drafts belonging to their own shops.
- Authenticated sellers may create, edit, and delete only shops where `owner_id` matches `(select auth.uid())`.
- Authenticated sellers may create, edit, and delete products only when the parent shop belongs to them.
- Update policies include both `USING` and `WITH CHECK` ownership predicates.
- RLS helper expressions use cached `(select auth.uid())` form and indexed ownership paths.

Storage uses a `catalogo` bucket. Object paths begin with the authenticated seller UUID. Policies permit public reads and restrict inserts, updates, and deletes to the matching seller path. Product or shop records store paths, not privileged URLs.

Frontend receives only Supabase publishable configuration. Secret and service-role keys never enter browser code or `NEXT_PUBLIC_` variables.

## User Flows

### Registration and sign-in

1. User enters email and password on `/registro`.
2. Supabase creates account and sends an email-confirmation link in production.
3. UI displays `Revisa tu correo para confirmar tu cuenta` until confirmation succeeds.
4. After a valid session exists, user enters `/panel`.
5. Sign-out clears session and returns user to public marketplace.

### Shop creation

1. Seller selects `Crear tienda`.
2. Seller provides name, description, and optional image.
3. Server validates input and derives a URL-safe unique slug.
4. Storage upload and database write complete without leaving a broken public record.
5. Seller lands on shop management page with `Tienda creada` feedback.

A seller may create multiple shops without administrator approval.

### Product publishing

1. Seller opens an owned shop and selects `Agregar producto`.
2. Seller provides name, description, MXN price, and optional image.
3. Product starts as a draft unless seller explicitly publishes it; draft review stays inside the protected panel.
4. Publishing changes status to `published` and revalidates home, shop, and product pages.
5. Seller may edit, unpublish, or delete owned products.

## Visual System

The discovery experience borrows familiar marketplace interaction principles: spacious header, prominent search, rounded filter controls, visual product cards, and responsive listing grid. It does not copy Airbnb branding or page composition.

### Color tokens

```css
:root {
  --brand: #32174d;
  --brand-hover: #241035;
  --accent: #b8ff6a;
  --background: #faf7f2;
  --surface: #ffffff;
  --text: #19171b;
  --text-muted: #6d6871;
  --border: #ded8d2;
  --sale: #f05d4e;
  --success: #19734c;
}
```

Approximate visual distribution: 70% cream and white, 20% aubergine, 7% mint, and 3% coral or status colors.

- Aubergine: logo, navigation, primary buttons, and footer
- Dark plum: primary-action hover
- Electric mint: selected filters, badges, promotional highlights, and visible focus rings
- Cream: marketplace background
- White: product cards and form surfaces
- Coral: reserved for genuine offers or urgency; unused decoratively in version 1
- Soft black: product names, prices, and body text

Normal text combinations maintain at least 4.5:1 contrast, targeting WCAG 2.2 AA. Mint is not used as small text on white. All interactive controls have visible keyboard focus. Reduced-motion preferences disable nonessential animation.

### Typography and layout

- Display: Bricolage Grotesque
- Body and interface: Instrument Sans
- Desktop product grid: four columns
- Tablet product grid: two columns
- Mobile product grid: one column
- Product images: consistent 4:3 aspect ratio
- Public cards: large image, shop name, product name, and emphasized MXN price
- Seller dashboard: same visual language with denser management controls

Signature element: a continuous volcanic-ridge line appears in the logo, search treatment, and empty states. Motion is limited to purposeful search expansion and product-image hover.

Because version 1 has no cart, it contains no `Agregar al carrito` control. Primary actions are `Crear tienda`, `Agregar producto`, and `Publicar producto`.

## Validation and Failure Handling

- Shared Zod schemas validate shop and product input on server; client may reuse them for immediate feedback.
- Spanish errors render beside relevant fields.
- Duplicate or invalid slugs produce actionable correction.
- Pending form states prevent duplicate submissions.
- Unauthorized mutations return a safe error even if UI routing is bypassed.
- Failed image uploads do not create records with broken paths; failed record creation triggers uploaded-object cleanup where possible.
- Missing public shops or products render localized not-found pages.
- Successful actions use consistent feedback: `Tienda creada`, `Producto guardado`, and `Producto publicado`.

## Verification

- Unit tests cover Zod schemas and slug generation.
- Database policy tests prove one seller cannot read another seller's drafts or mutate another seller's shops/products.
- Browser smoke tests use confirmed test accounts and cover sign-in, shop creation, product draft creation, publishing, and anonymous public browsing. Registration receives a separate test for confirmation messaging.
- Responsive checks cover mobile, tablet, and desktop grids.
- Accessibility checks cover keyboard navigation, visible focus, labels, and contrast.
- Final gates: lint, type-check, unit tests, relevant integration tests, and production build.

## Acceptance Criteria

- Project runs as a current Next.js, React, TypeScript, and Tailwind application with pinned versions.
- Public visitors can browse shops and published product listings in Spanish.
- User can register and sign in with email/password.
- Authenticated seller can create multiple shops immediately.
- Seller can create, edit, publish, unpublish, and delete products only within owned shops.
- Seller can upload one image per shop or product.
- Draft products stay private to their owner.
- Public pages update after publishing changes.
- Interface follows approved palette, responsive layout, accessibility requirements, and marketplace interaction direction.
- No excluded commerce or administration features appear.
