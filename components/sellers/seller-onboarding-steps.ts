import { ImagePlus, PackageCheck, Store } from "lucide-react";

/**
 * How selling works, for the /registro guide screen.
 *
 * /vender tells a different three-step story now, one that leads with bringing
 * a reputation over. This list stays plain and product-shaped: somebody reading
 * it is already signing up and wants to know what the next screens ask of them.
 */
export const sellerSteps = [
  {
    icon: Store,
    title: "Crea tu tienda",
    description: "Nombre, descripción y estado. Queda pública en minutos, sin revisión previa.",
  },
  {
    icon: ImagePlus,
    title: "Publica tus productos",
    description: "Foto, precio, categoría y condición. Guarda borradores y publica cuando quieras.",
  },
  {
    icon: PackageCheck,
    title: "Recibe solicitudes",
    description:
      "Acuerdas pago y envío con la persona compradora y confirmas la entrega en la plaza.",
  },
];
