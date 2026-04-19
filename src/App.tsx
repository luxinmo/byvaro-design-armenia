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

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
