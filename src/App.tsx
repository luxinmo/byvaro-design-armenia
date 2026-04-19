import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
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
import CrearPromocion from "@/pages/CrearPromocion";
import EmpresaDatos from "@/pages/empresa/EmpresaDatos";
import EmpresaOficinas from "@/pages/empresa/EmpresaOficinas";
import PromocionesCardsV1 from "@/pages/design-previews/PromocionesCardsV1";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
                <Route path="/registros" element={<Registros />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/colaboradores" element={<Colaboradores />} />
                <Route path="/contactos" element={<Contactos />} />
                <Route path="/microsites" element={<Microsites />} />
                <Route path="/emails" element={<Emails />} />
                <Route path="/ajustes" element={<Ajustes />} />
                {/* Empresa (administración) */}
                <Route path="/empresa" element={<Navigate to="/empresa/datos" replace />} />
                <Route path="/empresa/datos" element={<EmpresaDatos />} />
                <Route path="/empresa/oficinas" element={<EmpresaOficinas />} />
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
