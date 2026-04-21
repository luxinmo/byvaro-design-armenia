import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDialogHost } from "@/components/ui/ConfirmDialog";
import Inicio from "@/pages/Inicio";
import Promociones from "@/pages/Promociones";
import Registros from "@/pages/Registros";
import Ventas from "@/pages/Ventas";
import Calendario from "@/pages/Calendario";
import Colaboradores from "@/pages/Colaboradores";
import Contactos from "@/pages/Contactos";
import Microsites from "@/pages/Microsites";
import Emails from "@/pages/Emails";
import Ajustes from "@/pages/Ajustes";
import AjustesEmailIndex from "@/pages/ajustes/email/index";
import AjustesEmailFirma from "@/pages/ajustes/email/firma";
import AjustesEmailPlantillas from "@/pages/ajustes/email/plantillas";
import AjustesEmailAutoRespuesta from "@/pages/ajustes/email/auto-respuesta";
import AjustesEmailSmtp from "@/pages/ajustes/email/smtp";
import CrearPromocion from "@/pages/CrearPromocion";
import Empresa from "@/pages/Empresa";
import PromocionDetalle from "@/pages/PromocionDetalle";
import PromocionesCardsV1 from "@/pages/design-previews/PromocionesCardsV1";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

export default function App() {
  return (
    <BrowserRouter>
      {/* Toasts globales (sonner). Antes faltaba → todas las llamadas
       * a toast.success/info/error eran silenciosas. */}
      <Toaster position="top-right" richColors closeButton />
      <ConfirmDialogHost />
      <Routes>
        {/* Auth · fullscreen (sin AppLayout) — ver docs/screens/auth.md */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Wizard fullscreen (sin AppLayout) */}
        <Route path="/crear-promocion" element={<CrearPromocion />} />

        {/* Resto de páginas dentro del AppLayout estándar */}
        <Route
          path="/*"
          element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/inicio" replace />} />
                <Route path="/inicio" element={<Inicio />} />
                <Route path="/promociones" element={<Promociones />} />
                <Route path="/promociones/:id" element={<PromocionDetalle />} />
                <Route path="/registros" element={<Registros />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/colaboradores" element={<Colaboradores />} />
                <Route path="/contactos" element={<Contactos />} />
                <Route path="/microsites" element={<Microsites />} />
                <Route path="/emails" element={<Emails />} />
                <Route path="/ajustes" element={<Ajustes />} />
                {/* Sub-rutas del módulo Email · placeholders hasta backend */}
                <Route path="/ajustes/email" element={<AjustesEmailIndex />} />
                <Route path="/ajustes/email/firma" element={<AjustesEmailFirma />} />
                <Route path="/ajustes/email/plantillas" element={<AjustesEmailPlantillas />} />
                <Route path="/ajustes/email/auto-respuesta" element={<AjustesEmailAutoRespuesta />} />
                <Route path="/ajustes/email/smtp" element={<AjustesEmailSmtp />} />
                {/* Empresa (administración) — una sola página con tabs internos */}
                <Route path="/empresa" element={<Empresa />} />
                <Route path="/empresa/*" element={<Navigate to="/empresa" replace />} />
                {/* Previews de diseños alternativos (no en el menú, accesibles por URL) */}
                <Route path="/preview/promociones-cards-v1" element={<PromocionesCardsV1 />} />
                <Route path="*" element={<Navigate to="/inicio" replace />} />
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
