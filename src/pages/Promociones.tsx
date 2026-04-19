import { Tag } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Promociones() {
  return (
    <PlaceholderPage
      icon={Tag}
      eyebrow="Comercial · Promociones"
      title="Listado de promociones"
      status="next"
      description="La pantalla más visitada del Promotor. Lista completa de promociones con filtros, ordenación, toggle grid/tabla y acceso rápido a cada ficha. Es la siguiente que vamos a diseñar tras validar Inicio."
      sections={[
        "Header con buscador + filtros pill (estado, ubicación, tipología, agencia)",
        "Vista grid de tarjetas con cover + KPIs de cada promoción",
        "Vista tabla con columnas personalizables",
        "Selección múltiple + barra de acciones flotante",
        "CTA 'Crear promoción' prominente",
        "Agrupado por estado: Activas · Pre-venta · Borradores · Vendidas",
      ]}
    />
  );
}
