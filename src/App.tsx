import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDialogHost } from "@/components/ui/ConfirmDialog";
import { UpgradeModal } from "@/components/paywall/UpgradeModal";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RequireAuth } from "@/components/RequireAuth";
import { SupabaseHydrator } from "@/components/SupabaseHydrator";
import Inicio from "@/pages/Inicio";
import Notificaciones from "@/pages/Notificaciones";
import Actividad from "@/pages/Actividad";
import Sugerencias from "@/pages/Sugerencias";
import Estadisticas from "@/pages/Estadisticas";
import Promociones from "@/pages/Promociones";
import Planes from "@/pages/Planes";
import Inmuebles from "@/pages/Inmuebles";
import Registros from "@/pages/Registros";
import Leads from "@/pages/Leads";
import LeadDetalle from "@/pages/LeadDetalle";
import Ventas from "@/pages/Ventas";
import Calendario from "@/pages/Calendario";
import Colaboradores, { ColaboradoresTestPage } from "@/pages/Colaboradores";
import Promotores from "@/pages/Promotores";
import Contratos from "@/pages/Contratos";
import AgenciaDetalle from "@/pages/AgenciaDetalle";
import ColaboracionPanel from "@/pages/ColaboracionPanel";
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
import AjustesPlantillas from "@/pages/ajustes/plantillas";
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
import AjustesEmpresaDepartamentos from "@/pages/ajustes/empresa/departamentos";
import AjustesCalendarioSync from "@/pages/ajustes/calendario/sync";
import AjustesUsuariosMiembros from "@/pages/ajustes/usuarios/miembros";
import { CriticalActionGuard } from "@/components/agency-onboarding/CriticalActionGuard";
import { AdminOnlyRoute } from "@/components/AdminOnlyRoute";
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
import AjustesZonaCriticaDatosPrueba from "@/pages/ajustes/zona-critica/datos-prueba";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";
import CrearPromocion from "@/pages/CrearPromocion";
import Empresa from "@/pages/Empresa";
import Promotor from "@/pages/Promotor";
import PromotorPanel from "@/pages/PromotorPanel";
import PromocionDetalle from "@/pages/PromocionDetalle";
import PromocionesCardsV1 from "@/pages/design-previews/PromocionesCardsV1";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Terminos from "@/pages/legal/Terminos";
import Privacidad from "@/pages/legal/Privacidad";
import InviteAccept from "@/pages/InviteAccept";
import ResponsibleAccept from "@/pages/ResponsibleAccept";
import { useCurrentUser } from "@/lib/currentUser";
import { usePlanState } from "@/lib/plan";
import { toast } from "sonner";

/** Rutas promotor-only · si una agencia entra por URL directa la
 *  redirigimos a /inicio (el sidebar ya las oculta, pero no podemos
 *  confiar solo en eso para GDPR). */
function PromotorOnly({ children }: { children: JSX.Element }) {
  const isAgencyUser = useCurrentUser().accountType === "agency";
  if (isAgencyUser) return <Navigate to="/inicio" replace />;
  return children;
}

/** Guard por audiences · refleja la categorización del sidebar
 *  (`AppSidebar.tsx`). Si NINGÚN pack del array está activo, el
 *  user no puede entrar por URL directa · redirect a /inicio +
 *  toast informativo (admin con CTA "Ver planes" / member con
 *  "pídele al admin"). */
function PackGuard({
  audiences, children,
}: {
  audiences: Array<"promoter" | "agency">;
  children: JSX.Element;
}) {
  const planState = usePlanState();
  const user = useCurrentUser();
  const promoterActive = planState.promoterPack !== "none";
  const agencyActive = planState.agencyPack !== "none";
  const allowed = audiences.some((a) =>
    (a === "promoter" && promoterActive) ||
    (a === "agency" && agencyActive),
  );
  if (allowed) return children;

  const moduleLabel = audiences.length === 2
    ? "Promotor o Agencia Inmobiliaria"
    : audiences[0] === "agency" ? "Agencia Inmobiliaria" : "Promotor";
  if (user.role === "admin") {
    toast.info(`Activa el módulo ${moduleLabel} para acceder`, {
      description: "Ve a /planes y actívalo para entrar a esta sección.",
    });
  } else {
    toast.info(`El módulo ${moduleLabel} no está activo`, {
      description: "Pídele al administrador de tu cuenta que lo active.",
    });
  }
  return <Navigate to="/inicio" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Resetea el scroll al top en cada cambio de pathname. Regla
       * global · ver docs/scroll-restoration.md y CLAUDE.md. */}
      <ScrollToTop />
      {/* Hydrator · bloqueante en la primera carga · espera a que
       *  todos los stores se hidraten desde Supabase a memoria antes
       *  de pintar la app. localStorage NO es source-of-truth. */}
      <SupabaseHydrator>
      {/* Toasts globales (sonner). Antes faltaba → todas las llamadas
       * a toast.success/info/error eran silenciosas. */}
      <Toaster position="top-right" richColors closeButton />
      <ConfirmDialogHost />
      {/* Paywall global · CLAUDE.md §"Paywall validación". Cualquier
       *  componente dispara con `useUsageGuard(...).openUpgrade()`. */}
      <UpgradeModal />
      <Routes>
        {/* Auth · fullscreen (sin AppLayout) — ver docs/screens/auth.md */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Páginas legales públicas · accesibles sin sesión.
         *  Linkadas desde el checkbox de aceptación en /register. */}
        <Route path="/legal/terminos" element={<Terminos />} />
        <Route path="/legal/privacidad" element={<Privacidad />} />

        {/* Aceptación de invitación pública (caso 1 alta nueva, caso 2b
         *  workspace existente sin sesión, caso 2a redirect tras login).
         *  No envuelta en RequireAuth · el link debe funcionar incluso
         *  para emails que aún no tienen cuenta en Byvaro. */}
        <Route path="/invite/:token" element={<InviteAccept />} />

        {/* Aceptación del rol de Responsable de una agencia (magic-link
         *  desde email que envía el admin actual al pulsar "Quiero
         *  invitar al Responsable" en el `<ResponsibleSetupDialog>`).
         *  Pública · permite crear contraseña + tomar rol admin. */}
        <Route path="/responsible/:token" element={<ResponsibleAccept />} />

        {/* Wizard fullscreen (sin AppLayout) · auth obligatorio. */}
        <Route path="/crear-promocion" element={<RequireAuth><CrearPromocion /></RequireAuth>} />

        {/* Entrada al modo Agencia · picker + atajo directo · auth obligatorio.
         *   `/agencia`        → elige agencia.
         *   `/agencia/:id`    → salta directo a esa agencia y redirige a /inicio. */}
        <Route path="/agencia" element={<RequireAuth><AgenciaEntry /></RequireAuth>} />
        <Route path="/agencia/:id" element={<RequireAuth><AgenciaEntry /></RequireAuth>} />

        {/* Ajustes · fullscreen propio (SettingsShell), no AppLayout.
         * `/ajustes` raíz renderiza la home (directorio de cards),
         * `/ajustes/<path>` renderiza la sub-página con sidebar.
         *
         * Solo admin · el member es redirigido a /inicio si entra por
         * URL directa (sidebar ya oculta el link). */}
        <Route path="/ajustes" element={<RequireAuth><AdminOnlyRoute><Ajustes /></AdminOnlyRoute></RequireAuth>} />
        <Route
          path="/ajustes/*"
          element={
            <RequireAuth>
            <AdminOnlyRoute>
            <SettingsShell>
              <Routes>
                {/* Páginas reales con contenido funcional */}
                <Route path="perfil/personal" element={<AjustesPerfilPersonal />} />
                <Route path="perfil/contacto" element={<AjustesPerfilContacto />} />
                {/* Empresa · acción crítica · si la agencia tiene
                 *  setup de Responsable pendiente, el guard bloquea la
                 *  pantalla y abre el modal · CLAUDE.md regla de oro. */}
                <Route path="empresa/datos" element={<CriticalActionGuard><AjustesEmpresaDatos /></CriticalActionGuard>} />
                <Route path="empresa/oficinas" element={<CriticalActionGuard><AjustesEmpresaOficinas /></CriticalActionGuard>} />
                <Route path="empresa/verificacion" element={<CriticalActionGuard><AjustesEmpresaVerificacion /></CriticalActionGuard>} />
                <Route path="empresa/suscripcion" element={<CriticalActionGuard><AjustesEmpresaSuscripcion /></CriticalActionGuard>} />
                <Route path="empresa/departamentos" element={<CriticalActionGuard><AjustesEmpresaDepartamentos /></CriticalActionGuard>} />
                <Route path="calendario/sync" element={<AjustesCalendarioSync />} />
                {/* Usuarios · misma regla · invitar miembros sin
                 *  Responsable definido es problema legal. */}
                <Route path="usuarios/miembros" element={<CriticalActionGuard><AjustesUsuariosMiembros /></CriticalActionGuard>} />
                <Route path="usuarios/roles" element={<CriticalActionGuard><AjustesUsuariosRoles /></CriticalActionGuard>} />
                <Route path="usuarios/invitaciones" element={<CriticalActionGuard><AjustesUsuariosInvitaciones /></CriticalActionGuard>} />
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
                <Route path="plantillas" element={<AjustesPlantillas />} />
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
                <Route path="zona-critica/datos-prueba" element={<AjustesZonaCriticaDatosPrueba />} />
                {/* Catch-all → SettingsPlaceholder. Detecta el link en el
                 * registry y muestra un cartel "En diseño" con el contexto. */}
                <Route path="*" element={<SettingsPlaceholder />} />
              </Routes>
            </SettingsShell>
            </AdminOnlyRoute>
            </RequireAuth>
          }
        />

        {/* Resto de páginas dentro del AppLayout estándar · auth obligatorio. */}
        <Route
          path="/*"
          element={
            <RequireAuth>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/inicio" replace />} />
                <Route path="/inicio" element={<Inicio />} />
                <Route path="/notificaciones" element={<Notificaciones />} />
                <Route path="/actividad" element={<PackGuard audiences={["promoter"]}><Actividad /></PackGuard>} />
                <Route path="/sugerencias" element={<PackGuard audiences={["promoter"]}><Sugerencias /></PackGuard>} />
                <Route path="/estadisticas" element={<Estadisticas />} />
                <Route path="/promociones" element={<PackGuard audiences={["promoter", "agency"]}><Promociones /></PackGuard>} />
                <Route path="/promociones/:id" element={<PromocionDetalle />} />
                <Route path="/planes" element={<Planes />} />
                {/* Inmuebles · catálogo de unidades sueltas del workspace.
                 *  Accesible a developer Y agency · cada org ve sólo los
                 *  suyos (storage scopeado por workspace).
                 *  Dos rutas · misma página, distinta vista inicial. */}
                <Route path="/inmuebles" element={<PackGuard audiences={["promoter", "agency"]}><Inmuebles defaultView="list" /></PackGuard>} />
                <Route path="/inmuebles/cuadricula" element={<PackGuard audiences={["promoter", "agency"]}><Inmuebles defaultView="grid" /></PackGuard>} />
                {/* Oportunidades · agencia SÍ entra · la página debe
                 *  filtrar internamente por agencyId (TODO: si todavía
                 *  hay fuga en `Leads.tsx`, añadir filtro · verificar
                 *  cross-tenant). */}
                <Route path="/oportunidades" element={<Leads />} />
                <Route path="/oportunidades/:id" element={<LeadDetalle />} />
                <Route path="/registros" element={<Registros />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/calendario" element={<Calendario />} />
                {/* /colaboradores · accesible a developer Y agency · el
                    componente ramifica: developer → lista de agencias,
                    agency → lista de promotores con los que colabora.
                    Las sub-rutas (`:id`, `:id/panel`, `:id/historial`,
                    `estadisticas`) siguen `PromotorOnly` · son ficha y
                    panel del PROMOTOR mirando una agencia. La agencia
                    tiene su mirror en `/promotor/:id` y `/promotor/:id/panel`. */}
                <Route path="/colaboradores" element={<PackGuard audiences={["promoter"]}><Colaboradores /></PackGuard>} />
                {/* Variante "test" · misma maquinaria de filtros + sort,
                 *  pero con la card antigua `FeatureCardV3` para A/B
                 *  comparar con la nueva `AgencyGridCard`. */}
                <Route path="/colaboradores-test" element={<PromotorOnly><ColaboradoresTestPage /></PromotorOnly>} />
                {/* Promotores & comercializadores · accesible a developer
                 *  Y agency · cada rol ve la lista que le corresponde.
                 *  Developer: empresas con las que colabora como
                 *  comercializador. Agency: promotores cuya cartera tiene. */}
                <Route path="/promotores" element={<PackGuard audiences={["agency"]}><Promotores /></PackGuard>} />
                {/* Contratos · solo promotor por ahora · la agencia no
                 *  lo tiene en su menú. Si en el futuro hace falta, se
                 *  hace una versión filtrada por `agencyId`. */}
                <Route path="/contratos" element={<PromotorOnly><Contratos /></PromotorOnly>} />
                <Route path="/colaboradores/estadisticas" element={<PromotorOnly><ColaboradoresEstadisticas /></PromotorOnly>} />
                {/* Ficha pública de inmobiliaria · accesible a TODOS
                    los usuarios (developer + agency). El componente
                    `AgenciaDetalle` esconde las acciones de gestión
                    (aprobar/pausar/eliminar) para visitor agency · son
                    acciones del workspace dueño. */}
                <Route path="/colaboradores/:id" element={<AgenciaDetalle />} />
                <Route path="/colaboradores/:id/ficha" element={<AgenciaDetalle />} />
                <Route path="/colaboradores/:id/panel" element={<PromotorOnly><ColaboracionPanel /></PromotorOnly>} />
                <Route path="/colaboradores/:id/historial" element={<PromotorOnly><ColaboradorHistorial /></PromotorOnly>} />
                <Route path="/contactos" element={<Contactos />} />
                <Route path="/contactos/:id" element={<ContactoDetalle />} />
                {/* Equipo · solo admin · gestión de miembros + roles. */}
                <Route path="/equipo" element={<AdminOnlyRoute><CriticalActionGuard><Equipo /></CriticalActionGuard></AdminOnlyRoute>} />
                <Route path="/equipo/:id/estadisticas" element={<AdminOnlyRoute><EquipoMiembroEstadisticas /></AdminOnlyRoute>} />
                <Route path="/microsites" element={<PackGuard audiences={["promoter"]}><Microsites /></PackGuard>} />
                {/* Emails · agencia SÍ entra · cuenta nativa
                 *  `<localpart>@mail.byvaro.com` filtrada por user. */}
                <Route path="/emails" element={<Emails />} />
                {/* /ajustes/* viven fuera del AppLayout (SettingsShell propio) */}
                {/* Empresa (administración) · solo admin con setup
                 *  completo · misma regla que Ajustes. La agencia
                 *  recién creada cae en el modal de Responsable
                 *  hasta confirmar/aplazar. */}
                <Route path="/empresa" element={<AdminOnlyRoute><CriticalActionGuard><Empresa /></CriticalActionGuard></AdminOnlyRoute>} />
                <Route path="/empresa/*" element={<Navigate to="/empresa" replace />} />
                {/* Promotor · vista desde la AGENCIA. Mirror de
                 *  /colaboradores/:id (ficha) y /colaboradores/:id/panel
                 *  (operativa). El helper `developerHref()` decide a
                 *  cuál mandar según haya colaboración activa. */}
                <Route path="/promotor/:id" element={<Promotor />} />
                <Route path="/promotor/:id/panel" element={<PromotorPanel />} />
                {/* Previews de diseños alternativos (no en el menú, accesibles por URL) */}
                <Route path="/preview/promociones-cards-v1" element={<PromocionesCardsV1 />} />
                <Route path="*" element={<Navigate to="/inicio" replace />} />
              </Routes>
            </AppLayout>
            </RequireAuth>
          }
        />
      </Routes>
      </SupabaseHydrator>
    </BrowserRouter>
  );
}
