# Aviso de privacidad · avisos por correo a tiendas (borrador para revisión legal)

**Estado:** borrador, 2026-10-04. No está aprobado ni publicado. Lo tiene que revisar un abogado en México antes de incorporarse al `privacy_notice` (ver `docs/legal/launch-state.json`: todavía no hay abogado contratado y ningún documento legal, incluido el aviso de privacidad, está publicado; `legal_document_versions` está vacía en producción).

**Origen:** desde el 4 de octubre de 2026 la plataforma envía correos a las tiendas (PR #44, `docs/superpowers/specs/2026-10-04-seller-email-notifications-design.md`). Los envía un proveedor externo, Resend, que procesa la dirección de correo de cada tienda. Esta sección tiene que estar en el aviso de privacidad cuando se publique.

**Lo que hace el sistema hoy** (para que el texto no prometa de más ni de menos):

- Destinatarios: solo personas dueñas de tiendas, en el correo de su cuenta. A compradores no se les envía nada.
- Motivos: una solicitud de compra nueva, un mensaje de una persona compradora (como máximo uno por conversación cada hora, salvo que la tienda haya respondido) y una solicitud a la que le quedan menos de 24 horas para vencer.
- Contenido: nombre de la tienda, nombre del producto, número de pedido, cantidad, fecha límite y un enlace al panel. **Nunca** el texto de los mensajes, la dirección de entrega, el teléfono ni el nombre de la persona compradora (`supabase/functions/_shared/seller-notifications.ts`; la consulta `claim_notification_batch` ni siquiera los lee).
- Desactivación: «Avisos por correo» en Mi cuenta (`/panel/cuenta`). Cada correo enlaza ahí. Se respeta al momento de enviar, también para correos ya en cola.
- Proveedor: Resend. Recibe la dirección de correo de la tienda y el contenido del correo, y guarda un registro de cada envío según su propia política de retención.
- Registro interno: `private.notification_outbox` guarda a quién se envió, de qué tipo, cuándo y si falló. No guarda el contenido del correo.

---

## Texto propuesto

### X. Avisos por correo electrónico a tiendas

**X.1 Qué enviamos y por qué.** Si tienes una tienda en Plaza Volcanes, te enviamos correos electrónicos para avisarte de actividad que requiere tu atención: solicitudes de compra nuevas, mensajes de personas compradoras y solicitudes que están por vencer. Usamos para ello la dirección de correo de tu cuenta.

**X.2 Qué datos incluyen.** Estos correos incluyen el nombre de tu tienda, el nombre del producto, el número de pedido, la cantidad y la fecha límite para responder, y un enlace a tu panel. No incluyen el contenido de los mensajes ni datos personales de la persona compradora, como su nombre, dirección o teléfono.

**X.3 Cómo dejar de recibirlos.** Puedes desactivarlos en cualquier momento en «Mi cuenta», sección «Avisos por correo». Cada correo incluye un enlace a esa sección. Si los desactivas, seguirás viendo la misma información en tu panel.

**X.4 Proveedor de envío.** Para enviar estos correos usamos los servicios de [Resend, Inc.], con domicilio en [Estados Unidos de América], que actúa como encargado y trata tu dirección de correo y el contenido del aviso únicamente para entregarlo por cuenta nuestra. [Fundamento y condiciones de la remisión a un encargado ubicado fuera de México, según confirme la asesoría legal.]

**X.5 Conservación.** Conservamos el registro de cada aviso enviado (destinatario, tipo, fecha y resultado de la entrega) durante [plazo por definir] para atender problemas de entrega. El proveedor conserva sus propios registros de envío durante [plazo según su política vigente].

---

## Preguntas para el abogado

1. **Finalidad:** ¿estos avisos son una finalidad primaria (necesaria para la relación con la tienda) o secundaria? Si son primaria, ¿basta con poder desactivarlos, o hay que pedir consentimiento expreso al abrir la tienda?
2. **Encargado en el extranjero (X.4):** Resend procesa los correos en Estados Unidos. Con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares vigente en 2026, ¿esto es una remisión a un encargado (sin consentimiento del titular) o una transferencia? ¿Qué debe decir el aviso y qué tiene que contener el contrato o acuerdo de tratamiento con el proveedor?
3. **Nombre del proveedor:** ¿hay que nombrar a Resend en el aviso, o basta con describir la categoría («proveedor de envío de correo»)? Lo mismo aplica a Supabase (base de datos) y Vercel (hospedaje), que hoy no aparecen en ningún documento publicado.
4. **Conservación (X.5):** ¿qué plazo es razonable para el registro interno de envíos? Hoy no se borra automáticamente.
5. **Enlace de baja:** cada correo enlaza a la sección de Mi cuenta donde se desactivan (hay que iniciar sesión). ¿Es suficiente, o hace falta un enlace de baja directa sin iniciar sesión?
6. **Situación actual:** los avisos ya se envían en producción y el aviso de privacidad todavía no está publicado. ¿Qué riesgo implica mientras la plataforma no esté abierta al público, y conviene pausar los envíos hasta publicar el aviso?
