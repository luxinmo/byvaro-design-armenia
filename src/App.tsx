import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDialogHost } from "@/components/ui/ConfirmDialog";
import Inicio from "@/pages/Inicio";
import Promociones from "@/pages/Promociones";
import Registros from "@/pages/Registros";
import Leads from "@/pages/Leads";
import LeadDetalle from "@/pages/LeadDetalle";
import Ventas from "@/pages/Ventas";
import Calendario from "@/pages/Calendario";
import Colaboradores from "@/pages/Colaboradores";
import AgenciaDetalle from "@/pages/AgenciaDetalle";
import ColaboradorHistorial from "@/pages/ColaboradorHistorial";
import ColaboradoresEstadisticas from "@/pages/ColaboradoresEstadisticas";
import Contactos from "@/pages/Contactos";
import Equipo from "@/pages/Equipo";
import EquipoMiembroEstadisticas from "@/pages/EquipoMiembroEstadisticas";
import ContactoDetalle from "@/pages/ContactoDetalle";
import Microsites from "@/pages/Microsites";
import AgenciaEntry from "@/pages/AgenciaEntry";
import Emails from "@/pages/Emails";
import Ajustes from "@/pages/Ajustes";
import AjustesEmailIndex from "@/pages/ajustes/email/index";
import AjustesEmailFirma from "@/pages/ajustes/email/firma";
import AjustesEmailPlantillas from "@/pages/ajustes/email/plantillas";
import AjustesEmailAutoRespuesta from "@/pages/ajustes/email/auto-respuesta";
import AjustesEmailSmtp from "@/pages/ajustes/email/smtp";
import AjustesContactosEtiquetas from "@/pages/ajustes/contactos/etiquetas";
import AjustesContactosOrigenes from "@/pages/ajustes/contactos/origenes";
import AjustesContactosCampos from "@/pages/ajustes/contactos/campos";
import AjustesContactosLeadScore from "@/pages/ajustes/contactos/lead-score";
import AjustesContactosImportar from "@/pages/ajustes/contactos/importar";
import AjustesContactosRelaciones from "@/pages/ajustes/contactos/relaciones";
import AjustesIdioma from "@/pages/ajustes/idioma-region/idioma";
import AjustesZonaHoraria from "@/pages/ajustes/idioma-region/zona-horaria";
import AjustesFormatoFecha from "@/pages/ajustes/idioma-region/formato-fecha";
import AjustesMoneda from "@/pages/ajustes/idioma-region/moneda";
import AjustesPerfilPersonal from "@/pages/ajustes/perfil/personal";
import AjustesPerfilContacto from "@/pages/ajustes/perfil/contacto";
import AjustesEmpresaDatos from "@/pages/ajustes/empresa/datos";
import AjustesEmpresaOficinas from "@/pages/ajustes/empresa/oficinas";
import AjustesEmpresaVerificacion from "@/pages/ajustes/empresa/verificacion";
import AjustesEmpresaSuscripcion from "@/pages/ajustes/empresa/suscripcion";
import AjustesUsuariosMiembros from "@/pages/ajustes/usuarios/miembros";
import AjustesUsuariosRoles from "@/pages/ajustes/usuarios/roles";
import AjustesUsuariosInvitaciones from "@/pages/ajustes/usuarios/invitaciones";
import AjustesSeguridadContrasena from "@/pages/ajustes/seguridad/contrasena";
import AjustesSeguridad2fa from "@/pages/ajustes/seguridad/dos-fa";
import AjustesSeguridadSesiones from "@/pages/ajustes/seguridad/sesiones";
import AjustesSeguridadActividad from "@/pages/ajustes/seguridad/actividad";
import AjustesFacturacionPlan from "@/pages/ajustes/facturacion/plan";
import AjustesFacturacionPago from "@/pages/ajustes/facturacion/pago";
import AjustesFacturacionFacturas from "@/pages/ajustes/facturacion/facturas";
import AjustesFacturacionUso from "@/pages/ajustes/facturacion/uso";
import AjustesNotificacionesEmail from "@/pages/ajustes/notificaciones/email";
import AjustesNotificacionesPush from "@/pages/ajustes/notificaciones/push";
import AjustesNotificacionesAlertas from "@/pages/ajustes/notificaciones/alertas";
import AjustesNotificacionesResumen from "@/pages/ajustes/notificaciones/resumen";
import AjustesPrivacidadAnalitica from "@/pages/ajustes/privacidad/analitica";
import AjustesPrivacidadVisibilidad from "@/pages/ajustes/privacidad/visibilidad";
import AjustesPrivacidadRetencion from "@/pages/ajustes/privacidad/retencion";
import AjustesPrivacidadExportar from "@/pages/ajustes/privacidad/exportar";
import AjustesMensajeriaComentarios from "@/pages/ajustes/mensajeria/comentarios";
import AjustesMensajeriaMenciones from "@/pages/ajustes/mensajeria/menciones";
import AjustesMensajeriaSonidos from "@/pages/ajustes/mensajeria/sonidos";
import AjustesPromocionesValidez from "@/pages/ajustes/promociones/validez";
import AjustesWhatsAppNumero from "@/pages/ajustes/whatsapp/numero";
import AjustesZonaCriticaCerrarSesion from "@/pages/ajustes/zona-critica/cerrar-sesion";
import AjustesZonaCriticaTransferir from "@/pages/ajustes/zona-critica/transferir";
import AjustesZonaCriticaEliminarWorkspace from "@/pages/ajustes/zona-critica/eliminar-workspace";
import AjustesZonaCriticaEliminarCuenta from "@/pages/ajustes/zona-critica/eliminar-cuenta";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";
import CrearPromocion from "@/pages/CrearPromocion";
import Empresa from "@/pages/Empresa";
import PromocionDetalle from "@/pages/PromocionDetalle";
import PromocionesCardsV1 from "@/pages/design-previews/PromocionesCardsV1";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { useCurrentUser } from "@/lib/currentUser";

/** Rutas promotor-only · si una agencia entra por URL directa la
 *  redirigimos a /inicio (el sidebar ya las oculta, pero no podemos
 *  confiar solo en eso para GDPR). */
function PromotorOnly({ children }: { children: JSX.Element }) {
  const isAgencyUser = useCurrentUser().accountType === "agency";
  if (isAgencyUser) return <Navigate to="/inicio" replace />;
  return children;
}

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

        {/* Entrada al modo Agencia · picker + atajo directo.
         *   `/agencia`        → elige agencia.
         *   `/agencia/:id`    → salta directo a esa agencia y redirige a /inicio. */}
        <Route path="/agencia" element={<AgenciaEntry />} />
        <Route path="/agencia/:id" element={<AgenciaEntry />} />

        {/* Ajustes · fullscreen propio (SettingsShell), no AppLayout.
         * `/ajustes` raíz renderiza la home (directorio de cards),
         * `/ajustes/<path>` renderiza la sub-página con sidebar. */}
        <Route path="/ajustes" element={<Ajustes />} />
        <Route
          path="/ajustes/*"
          element={
            <SettingsShell>
              <Routes>
                {/* Páginas reales con contenido funcional */}
                <Route path="perfil/personal" element={<AjustesPerfilPersonal />} />
                <Route path="perfil/contacto" element={<AjustesPerfilContacto />} />
                <Route path="empresa/datos" element={<AjustesEmpresaDatos />} />
                <Route path="empresa/oficinas" element={<AjustesEmpresaOficinas />} />
                <Route path="empresa/verificacion" element={<AjustesEmpresaVerificacion />} />
                <Route path="empresa/suscripcion" element={<AjustesEmpresaSuscripcion />} />
                <Route path="usuarios/miembros" element={<AjustesUsuariosMiembros />} />
                <Route path="usuarios/roles" element={<AjustesUsuariosRoles />} />
                <Route path="usuarios/invitaciones" element={<AjustesUsuariosInvitaciones />} />
                <Route path="seguridad/contrasena" element={<AjustesSeguridadContrasena />} />
                <Route path="seguridad/2fa" element={<AjustesSeguridad2fa />} />
                <Route path="seguridad/sesiones" element={<AjustesSeguridadSesiones />} />
                <Route path="seguridad/actividad" element={<AjustesSeguridadActividad />} />
                <Route path="facturacion/plan" element={<AjustesFacturacionPlan />} />
                <Route path="facturacion/pago" element={<AjustesFacturacionPago />} />
                <Route path="facturacion/facturas" element={<AjustesFacturacionFacturas />} />
                <Route path="facturacion/uso" element={<AjustesFacturacionUso />} />
                <Route path="notificaciones/email" element={<AjustesNotificacionesEmail />} />
                <Route path="notificaciones/push" element={<AjustesNotificacionesPush />} />
                <Route path="notificaciones/alertas" element={<AjustesNotificacionesAlertas />} />
                <Route path="notificaciones/resumen" element={<AjustesNotificacionesResumen />} />
                <Route path="privacidad/analitica" element={<AjustesPrivacidadAnalitica />} />
                <Route path="privacidad/visibilidad" element={<AjustesPrivacidadVisibilidad />} />
                <Route path="privacidad/retencion" element={<AjustesPrivacidadRetencion />} />
                <Route path="privacidad/exportar" element={<AjustesPrivacidadExportar />} />
                <Route path="contactos/etiquetas" element={<AjustesContactosEtiquetas />} />
                <Route path="contactos/origenes" element={<AjustesContactosOrigenes />} />
                <Route path="contactos/campos" element={<AjustesContactosCampos />} />
                <Route path="contactos/lead-score" element={<AjustesContactosLeadScore />} />
                <Route path="contactos/importar" element={<AjustesContactosImportar />} />
                <Route path="contactos/relaciones" element={<AjustesContactosRelaciones />} />
                <Route path="promociones/validez" element={<AjustesPromocionesValidez />} />
                <Route path="whatsapp/numero" element={<AjustesWhatsAppNumero />} />
                <Route path="idioma-region/idioma" element={<AjustesIdioma />} />
                <Route path="idioma-region/zona-horaria" element={<AjustesZonaHoraria />} />
                <Route path="idioma-region/formato-fecha" element={<AjustesFormatoFecha />} />
                <Route path="idioma-region/moneda" element={<AjustesMoneda />} />
                <Route path="email" element={<AjustesEmailIndex />} />
                <Route path="email/firma" element={<AjustesEmailFirma />} />
                <Route path="email/plantillas" element={<AjustesEmailPlantillas />} />
                <Route path="email/auto-respuesta" element={<AjustesEmailAutoRespuesta />} />
                <Route path="email/smtp" element={<AjustesEmailSmtp />} />
                <Route path="mensajeria/comentarios" element={<AjustesMensajeriaComentarios />} />
                <Route path="mensajeria/menciones" element={<AjustesMensajeriaMenciones />} />
                <Route path="mensajeria/sonidos" element={<AjustesMensajeriaSonidos />} />
                <Route path="zona-critica/cerrar-sesion" element={<AjustesZonaCriticaCerrarSesion />} />
                <Route path="zona-critica/transferir" element={<AjustesZonaCriticaTransferir />} />
                <Route path="zona-critica/eliminar-workspace" element={<AjustesZonaCriticaEliminarWorkspace />} />
                <Route path="zona-critica/eliminar-cuenta" element={<AjustesZonaCriticaEliminarCuenta />} />
                {/* Catch-all → SettingsPlaceholder. Detecta el link en el
                 * registry y muestra un cartel "En diseño" con el contexto. */}
                <Route path="*" element={<SettingsPlaceholder />} />
              </Routes>
            </SettingsShell>
          }
        />

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
                <Route path="/leads" element={<PromotorOnly><Leads /></PromotorOnly>} />
                <Route path="/leads/:id" element={<PromotorOnly><LeadDetalle /></PromotorOnly>} />
                <Route path="/registros" element={<Registros />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/colaboradores" element={<PromotorOnly><Colaboradores /></PromotorOnly>} />
                <Route path="/colaboradores/estadisticas" element={<PromotorOnly><ColaboradoresEstadisticas /></PromotorOnly>} />
                <Route path="/colaboradores/:id" element={<PromotorOnly><AgenciaDetalle /></PromotorOnly>} />
                <Route path="/colaboradores/:id/historial" element={<PromotorOnly><ColaboradorHistorial /></PromotorOnly>} />
                <Route path="/contactos" element={<Contactos />} />
                <Route path="/contactos/:id" element={<ContactoDetalle />} />
                <Route path="/equipo" element={<PromotorOnly><Equipo /></PromotorOnly>} />
                <Route path="/equipo/:id/estadisticas" element={<PromotorOnly><EquipoMiembroEstadisticas /></PromotorOnly>} />
                <Route path="/microsites" element={<PromotorOnly><Microsites /></PromotorOnly>} />
                <Route path="/emails" element={<PromotorOnly><Emails /></PromotorOnly>} />
                {/* /ajustes/* viven fuera del AppLayout (SettingsShell propio) */}
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
