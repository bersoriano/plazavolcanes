# Aviso de privacidad · analítica del sitio (borrador para revisión legal)

**Estado:** borrador, 2026-11-20. No está aprobado ni publicado. Lo tiene que revisar un abogado en México antes de incorporarse al `privacy_notice` (ver `docs/legal/launch-state.json`: todavía no hay abogado contratado y ningún documento legal, incluido el aviso de privacidad, está publicado).

**Origen:** el sitio incorpora Google Analytics 4 (rama `feat/google-analytics`, `docs/google-analytics.md`) y reconstruye PostHog sobre el mismo código (`docs/posthog-analytics.md`): ambas herramientas reciben los mismos eventos bajo las mismas reglas. Ambas se activan solo si sus variables de entorno están configuradas en producción. Esta sección tiene que estar en el aviso de privacidad cuando se publique, y antes si la analítica se activa primero.

**Lo que hace el sistema hoy** (para que el texto no prometa de más ni de menos):

- Google Analytics y PostHog solo funcionan en `plazavolcanes.com` y solo en páginas públicas: inicio, vender, explorar, cómo comprar, blog, productos, tiendas, estados, registro, ingreso y páginas legales. No funciona en el panel de tiendas, mensajes, compras, carrito, administración ni en la recuperación de contraseña.
- Ninguno de los dos se carga si el navegador envía «Do Not Track» o «Global Privacy Control».
- Envía la dirección de la página sin parámetros, salvo las cinco etiquetas de campaña `utm_*`; de otros sitios de procedencia solo envía el dominio.
- Registra visitas a páginas, clics en botones de registro e ingreso, secciones vistas, apertura de preguntas frecuentes, avance de lectura del blog, y si un formulario de registro o de contacto se envió, falló o se completó. **Nunca** el contenido de los campos (correo, nombre, teléfono, mensaje, contraseña) ni identificadores de cuenta.
- Desactivados: Google Signals (gráfico publicitario entre dispositivos) y personalización de anuncios (`npa=1`).
- Cookies propias de Google Analytics: `_ga` y `_ga_<ID>`, de primera parte, con duración aproximada de 13 meses. Retención configurada en GA: 14 meses.
- Google procesa los datos, incluida la dirección IP para estimar ubicación aproximada, conforme a sus propios términos. Google Analytics 4 no registra ni almacena direcciones IP según Google.
- PostHog: los mismos eventos y las mismas URLs limpias que Google Analytics. **Sin cookies ni almacenamiento en el navegador** (modo sin cookies): cuenta visitas con un hash diario, rotativo, de IP y navegador calculado en sus servidores, por lo que una visita al día siguiente cuenta como nueva y no hay datos de país. Sin perfiles de persona, sin grabación de sesiones, sin captura automática. Las solicitudes pasan por `plazavolcanes.com/ingest`, que elimina las cookies del sitio y la página de procedencia antes de reenviarlas a PostHog (región EE. UU.). Desde el 20 de noviembre de 2026 ya no registra la actividad de tiendas en el panel. Detalle en `docs/posthog-analytics.md`.

---

## Texto propuesto

### X. Herramientas de analítica

**X.1 Para qué.** Usamos herramientas de analítica para saber cómo se usa el sitio: qué páginas se visitan, de dónde llegan las visitas y cuántas personas abren una cuenta o nos escriben. Con esa información mejoramos el sitio. No la usamos para publicidad personalizada ni la vendemos.

**X.2 Qué herramientas.** Usamos Google Analytics, de [Google LLC], y PostHog, de [PostHog Inc.], que actúan como [encargados / terceros, según confirme la asesoría legal] y tratan los datos por cuenta nuestra conforme a sus propios términos.

**X.3 Qué datos se obtienen.** Las páginas públicas que visitas (sin los parámetros de la dirección, salvo etiquetas de campaña), el sitio desde el que llegaste (solo su dominio), tu navegador, dispositivo, idioma y ubicación aproximada derivada de tu dirección IP, y acciones como abrir una pregunta frecuente, hacer clic en «Crear mi tienda» o enviar un formulario. **No** obtenemos el contenido de los formularios: ni tu nombre, correo, teléfono, mensaje o contraseña. Ninguna de las dos herramientas se usa en las secciones que requieren iniciar sesión.

**X.4 Cookies y almacenamiento local.** Google Analytics guarda en tu navegador las cookies `_ga` y `_ga_<identificador>`, que distinguen visitas de forma anónima y duran aproximadamente 13 meses. PostHog no guarda cookies ni datos en tu navegador: distingue visitas con un código que sus servidores calculan a partir de tu dirección IP y tu navegador y que cambia cada día. Puedes borrar o bloquear las cookies de Google Analytics desde la configuración de tu navegador.

**X.5 Cómo evitarlo.** Si activas en tu navegador «Do Not Track» o «Global Privacy Control», el sitio no carga Google Analytics ni PostHog. También puedes usar el complemento de inhabilitación de Google Analytics.

**X.6 Lo que tenemos desactivado.** Google Signals y la personalización de anuncios de Google Analytics están desactivados, así como la grabación de sesiones, la captura automática y los perfiles de persona de PostHog.

**X.7 Transferencias y conservación.** [Fundamento y condiciones de la remisión a encargados ubicados fuera de México, según confirme la asesoría legal.] Los datos de Google Analytics se conservan 14 meses; los de PostHog, [plazo según la configuración del proyecto].
