/**
 * ClientRegistrationDialog
 * ------------------------
 * Diálogo multi-flujo para registrar un cliente sobre una promoción.
 *
 * Flujos:
 *   1. MODE PICKER (solo promotor)  → elige "Directo" o "A través de colaborador".
 *   2. Flujo DIRECTO
 *        - search  → buscar cliente existente por nombre / teléfono / email.
 *        - create  → alta de cliente nuevo con detector de duplicados.
 *        - confirm → resumen y confirmación del registro.
 *   3. Flujo COLABORADOR (solo promotor)
 *        - search                 → buscar agente/agencia o email.
 *        - invite-existing-agency → completar datos de agente de agencia ya en sistema.
 *        - invite-external        → invitar por email (agencia detectada por dominio).
 *        - confirm                → resumen final.
 *
 * Props:
 *   - open, onOpenChange          → visibilidad controlada.
 *   - promotionName               → se muestra en el header.
 *   - promotionId?                → id para filtrar agencias ya colaborando.
 *   - validezDias?                → 0/undefined ⇒ no expira.
 *   - isCollaboratorView?         → si true, salta el mode picker y usa flujo directo.
 *
 * TODO(backend):
 *   - GET  /api/clientes?q=...           (búsqueda con debounce).
 *   - POST /api/clientes                 (crear cliente nuevo).
 *   - POST /api/promociones/:id/registros  { clienteId }.
 *   - POST /api/colaboradores/invitar    { email, agencyId?, promotionId }.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Flag } from "@/components/ui/Flag";
import {
  Search, UserPlus, Check, User, Phone, Globe, ArrowLeft, Clock,
  Users, Building2, AlertTriangle, Mail, Send, ShieldCheck, ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { agencies as allAgencies, type Agency } from "@/data/agencies";
import { NATIONALITIES, resolveNationality } from "@/data/nationalities";
import { useCurrentUser } from "@/lib/currentUser";
import { addCreatedRegistro } from "@/lib/registrosStorage";
import type { Registro } from "@/data/records";
import { registros as SEED_REGISTROS } from "@/data/records";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { generatePublicRef } from "@/lib/publicRef";
import { TEAM_MEMBERS } from "@/lib/team";
import { recordTypeAny } from "@/components/contacts/contactEventsStorage";
import { RegistrationTermsDialog } from "@/components/legal/RegistrationTermsDialog";
import { getRegistrationTerms } from "@/data/legal/registrationTerms";
import { captureFingerprint } from "@/lib/audit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionName: string;
  /** Id de la promoción para filtrar agencias ya colaborando. */
  promotionId?: string;
  /** 0 o undefined ⇒ no expira */
  validezDias?: number;
  /** true cuando estamos en vista agencia ⇒ saltar el mode picker. */
  isCollaboratorView?: boolean;
  /** Condiciones obligatorias para registrar un cliente en esta promoción.
   *  Defina el promotor desde "Colaboradores · Condiciones de registro".
   *  Si no se pasa, se usa el default razonable del producto. */
  registrationRequirements?: string[];
}

const DEFAULT_REGISTRATION_CONDITIONS = [
  "Nombre completo",
  "Nacionalidad",
  "Últimos 4 dígitos del teléfono",
];

/** Origen del cliente · opciones del desplegable para el flujo directo
 *  del promotor. Se pueden ampliar/ajustar en Ajustes · Contactos ·
 *  Orígenes (ver src/components/contacts/sources.ts). */
const CLIENT_SOURCE_OPTIONS: Array<{ value: string; icon?: string }> = [
  { value: "Idealista" },
  { value: "Fotocasa" },
  { value: "Habitaclia" },
  { value: "Web propia" },
  { value: "Instagram" },
  { value: "Facebook" },
  { value: "TikTok" },
  { value: "WhatsApp" },
  { value: "Referido" },
  { value: "Llamada directa" },
  { value: "Feria / evento" },
  { value: "Walk-in (oficina)" },
  { value: "Otro" },
];

/* ─────────────────── MOCK DATA ─────────────────── */

/**
 * Pool de clientes mock. Cada cliente pertenece a un tenant concreto
 * (`ownerAgencyId` cuando es de una agencia, o `"developer"` cuando es
 * del promotor). La agencia NUNCA ve los clientes de otra agencia — el
 * CRM es privado por tenant. El promotor ve todos los suyos + los que
 * las agencias han enviado como registros (no como contactos directos).
 *
 * Cuando exista backend, sustituir por:
 *   - Agencia → GET /api/contactos          (RLS scopeada a su tenant)
 *   - Promotor → GET /api/contactos         (sus propios contactos)
 */
const mockClients: Array<{
  id: string;
  name: string;
  phone: string;
  nationality: string;
  email: string;
  ownerAgencyId?: string;        // undefined ⇒ cliente del promotor
}> = [
  { id: "1", name: "Carlos García López", phone: "+34 612 345 678", nationality: "Spanish", email: "carlos@email.com", ownerAgencyId: "ag-1" },
  { id: "2", name: "Sarah Johnson", phone: "+34 698 112 233", nationality: "British", email: "sarah.j@email.com", ownerAgencyId: "ag-1" },
  { id: "3", name: "Hans Müller", phone: "+49 170 555 1234", nationality: "German", email: "hans.m@email.com", ownerAgencyId: "ag-2" },
  { id: "4", name: "Marie Dupont", phone: "+33 6 12 34 56 78", nationality: "French", email: "marie.d@email.com", ownerAgencyId: "ag-2" },
  { id: "5", name: "Ahmed Al-Farsi", phone: "+971 50 123 4567", nationality: "Emirati", email: "ahmed@email.com", ownerAgencyId: "ag-3" },
];

/** Posibles duplicados en el sistema (aviso al crear). */
const possibleDuplicates = [
  { name: "Sarah Johnson", phone: "+34 698 112 233", source: "Ya registrada con Prime Properties · hace 4 días" },
  { name: "Carlos Garcia", phone: "+34 612 345 678", source: "Lead existente en tu CRM (Iberia Homes) · hace 2 semanas" },
];

/** Clientes con un registro previo por otra agencia en esta misma promoción.
 *  `expiresInDays` <= 0 ⇒ registro caducado (ya no protege al cliente de la otra agencia).
 *  `expiresInDays` > 0 ⇒ registro en vigor (otra agencia tiene prioridad).
 *  `expiresInDays` null ⇒ registro sin caducidad (siempre en vigor).
 *  TODO(backend): GET /api/promociones/:id/registros?clientId=...
 */
const existingRegistrationsByClient: Record<string, {
  agencyName: string;
  agentName: string;
  daysAgo: number;
  expiresInDays: number | null;
}> = {
  "2": { agencyName: "Prime Properties Costa del Sol", agentName: "Laura Sánchez", daysAgo: 4, expiresInDays: 26 },
  "4": { agencyName: "Meridian Real Estate", agentName: "James Whitfield", daysAgo: 120, expiresInDays: -30 },
};

type SystemAgent = { id: string; name: string; email: string; agencyId: string };

const systemAgents: SystemAgent[] = [
  { id: "ag1-a1", name: "Laura Sánchez", email: "laura@primeproperties.com", agencyId: "ag-1" },
  { id: "ag1-a2", name: "Tom Brennan", email: "tom@primeproperties.com", agencyId: "ag-1" },
  { id: "ag2-a1", name: "Erik Lindqvist", email: "erik@nordichomefinders.com", agencyId: "ag-2" },
  { id: "ag2-a2", name: "Anna Bergström", email: "anna@nordichomefinders.com", agencyId: "ag-2" },
  { id: "ag3-a1", name: "Pieter De Vries", email: "pieter@dutchbelgianrealty.com", agencyId: "ag-3" },
  { id: "ag4-a1", name: "James Whitfield", email: "james@meridianrealestate.co.uk", agencyId: "ag-4" },
  { id: "ag5-a1", name: "João Almeida", email: "joao@iberialuxuryhomes.pt", agencyId: "ag-5" },
];

/* ─────────────────── TYPES ─────────────────── */

type Mode = "direct" | "collaborator";
/** `done` señaliza que la fase "cliente" ha terminado y entramos en la
 *  fase "colaborador" (solo relevante cuando `mode === "collaborator"`). */
type DirectView = "search" | "create" | "confirm" | "done";
type CollabView = "search" | "invite-existing-agency" | "invite-external" | "confirm";

type Client = (typeof mockClients)[0] | { id: string; name: string; phone: string; nationality: string; email: string };

interface CollabSelection {
  agencyId?: string;
  agencyName: string;
  agencyLogo?: string;
  agentName: string;
  agentEmail: string;
  isActiveCollaborator: boolean;
  agentInvited: boolean;
}

/* ─────────────────── COMPONENT ─────────────────── */

export function ClientRegistrationDialog({
  open,
  onOpenChange,
  promotionName,
  promotionId,
  validezDias = 0,
  isCollaboratorView = false,
  registrationRequirements,
}: Props) {
  const registrationConditions = registrationRequirements ?? DEFAULT_REGISTRATION_CONDITIONS;
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";
  /* Lista actual de Registros (seed + creados) · usada para generar
     `publicRef` único al crear uno nuevo. */
  const allRegistrosForRef = [...useCreatedRegistros(), ...SEED_REGISTROS];
  const [mode, setMode] = useState<Mode | null>(null);

  /* Estado local del confirm step en vista agencia — permite corregir
   * nombre y nacionalidad antes de enviar. Se inicializan desde el cliente
   * seleccionado cuando se entra al paso. */
  const [confirmName, setConfirmName] = useState("");
  const [confirmNationality, setConfirmNationality] = useState("");
  const [confirmNationalityOpen, setConfirmNationalityOpen] = useState(false);
  const [confirmNationalityQuery, setConfirmNationalityQuery] = useState("");
  const [addVisit, setAddVisit] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  /** Miembro del equipo que acompañará al cliente en la visita. Por defecto
   *  es el propio solicitante (el currentUser); se puede reasignar a otro
   *  miembro de la agencia desde el UserSelect del bloque de visita. */
  const [visitHostId, setVisitHostId] = useState<string | null>(null);
  /** Para clientes NUEVOS la agencia solo introduce las 4 últimas cifras
   *  del móvil — huella de comprobación que el promotor cruza con su CRM
   *  sin que la agencia revele el lead entero. */
  const [confirmPhone, setConfirmPhone] = useState("");
  const pinRefs = useRef<Array<HTMLInputElement | null>>([]);
  /** Origen del cliente desde la óptica del promotor — "Instagram",
   *  "Web propia", "Referido", etc. Solo relevante en flujo DIRECTO del
   *  promotor (el colaborador ya implica origen = "agencia X"). */
  const [clientSource, setClientSource] = useState<string>("");
  const [clientSourceOpen, setClientSourceOpen] = useState(false);
  /** Aceptación de términos y condiciones del registro. Obligatoria antes
   *  de enviar. Al aceptar se graba `audit.termsVersion` + `termsAcceptedAt`. */
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  /* Direct flow */
  const [directView, setDirectView] = useState<DirectView>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ fullName: "", phone: "", nationality: "", email: "" });
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalityQuery, setNationalityQuery] = useState("");

  /* Collab flow */
  const [collabView, setCollabView] = useState<CollabView>("search");
  const [collabSearch, setCollabSearch] = useState("");
  const [collabInviteEmail, setCollabInviteEmail] = useState("");
  const [collabInviteAgentName, setCollabInviteAgentName] = useState("");
  /** Nombre de la empresa (agencia) cuando NO existe en Byvaro y hay
   *  que invitarla desde cero. Se pide ANTES del comercial. */
  const [collabInviteAgencyName, setCollabInviteAgencyName] = useState("");
  const [collabSelection, setCollabSelection] = useState<CollabSelection | null>(null);
  const [pendingExistingAgency, setPendingExistingAgency] = useState<Agency | null>(null);

  const resetDirect = () => {
    setDirectView("search");
    setSearchQuery("");
    setSelectedClient(null);
    setNewClient({ fullName: "", phone: "", nationality: "", email: "" });
    setNationalityQuery("");
    setConfirmName("");
    setConfirmNationality("");
    setConfirmNationalityQuery("");
    setConfirmPhone("");
    setAddVisit(false);
    setVisitDate("");
    setVisitTime("");
    setVisitHostId(null);
    setClientSource("");
    setTermsAccepted(false);
    setTermsAcceptedAt(null);
    setTermsDialogOpen(false);
  };

  /** Marca los términos como aceptados — se llama tanto desde el checkbox
   *  como desde el botón "Aceptar términos" del diálogo de lectura. */
  const acceptTerms = () => {
    setTermsAccepted(true);
    setTermsAcceptedAt(new Date().toISOString());
  };

  /** Bloque de aceptación de términos · checkbox + link "Leer".
   *  Reutilizado en los 3 confirms (agencia, promotor directo, collab). */
  const termsAcceptanceBlock = (
    <div className="flex items-start gap-2.5 mb-5 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5">
      <button
        type="button"
        onClick={() => {
          if (termsAccepted) {
            setTermsAccepted(false);
            setTermsAcceptedAt(null);
          } else {
            acceptTerms();
          }
        }}
        aria-pressed={termsAccepted}
        aria-label={termsAccepted ? "Desmarcar aceptación" : "Aceptar términos"}
        className={cn(
          "h-4 w-4 rounded border mt-0.5 shrink-0 inline-flex items-center justify-center transition-colors",
          termsAccepted
            ? "bg-foreground border-foreground text-background"
            : "bg-card border-border hover:border-foreground/40",
        )}
      >
        {termsAccepted && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <p className="text-[11px] text-foreground leading-relaxed flex-1 min-w-0">
        He leído y acepto los{" "}
        <button
          type="button"
          onClick={() => setTermsDialogOpen(true)}
          className="underline underline-offset-2 font-medium hover:text-primary transition-colors"
        >
          términos del registro
        </button>
        .
        <span className="block text-[10px] text-muted-foreground mt-0.5">
          Al aceptar queda traza auditable (fecha, hora y huella digital) junto al registro.
        </span>
      </p>
    </div>
  );

  const resetCollab = () => {
    setCollabView("search");
    setCollabSearch("");
    setCollabInviteEmail("");
    setCollabInviteAgentName("");
    setCollabInviteAgencyName("");
    setCollabSelection(null);
    setPendingExistingAgency(null);
  };

  useEffect(() => {
    if (open) {
      setMode(isCollaboratorView ? "direct" : null);
      resetDirect();
      resetCollab();
    }
  }, [open, isCollaboratorView]);

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) {
      setTimeout(() => {
        setMode(isCollaboratorView ? "direct" : null);
        resetDirect();
        resetCollab();
      }, 200);
    }
  };

  /* ─────────────────── DIRECT FLOW ─────────────────── */

  /* La agencia solo ve SUS propios contactos — no puede buscar ni ver
   * clientes de otra agencia (privacidad comercial entre tenants). El
   * promotor, en cambio, ve los suyos (los que no tienen ownerAgencyId).
   * Cuando exista backend, esto se colapsa a un GET /api/contactos
   * scopeado por RLS al tenant del JWT. */
  const visibleClients = mockClients.filter((c) => {
    if (isAgencyUser) return c.ownerAgencyId === currentUser.agencyId;
    return !c.ownerAgencyId;       // promotor: solo los propios
  });

  const filteredClients = searchQuery.length > 1
    ? visibleClients.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  /** Score de similitud entre dos strings por n-gramas (0-1). */
  const nameSimilarity = (a: string, b: string) => {
    const A = a.toLowerCase().replace(/\s+/g, " ").trim();
    const B = b.toLowerCase().replace(/\s+/g, " ").trim();
    if (!A || !B) return 0;
    if (A === B) return 1;
    const tokensA = new Set(A.split(/\s+/).filter(t => t.length >= 2));
    const tokensB = new Set(B.split(/\s+/).filter(t => t.length >= 2));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let inter = 0;
    tokensA.forEach(t => { if (tokensB.has(t)) inter++; });
    return (2 * inter) / (tokensA.size + tokensB.size);
  };

  const detectedDuplicates = useMemo(() => {
    if (directView !== "create") return [];
    /* La agencia NO ve avisos de posibles duplicados al crear el contacto
     * — no puede saber si el promotor ya tiene a ese cliente, es decisión
     * del promotor aceptar o rechazar tras recibir el registro. Adelantar
     * esa info le quitaría una oportunidad comercial legítima. */
    if (isAgencyUser) return [];
    const fullName = newClient.fullName.trim();
    if (fullName.length < 3 && newClient.phone.length < 4) return [];
    const last4 = newClient.phone.replace(/\D/g, "").slice(-4);

    return possibleDuplicates
      .map(d => {
        const nameScore = fullName.length >= 3 ? nameSimilarity(fullName, d.name) : 0;
        const phoneMatch = last4.length >= 4 && d.phone.replace(/\D/g, "").endsWith(last4);
        // Combina: 70% nombre, 30% teléfono
        const score = Math.round((nameScore * 0.7 + (phoneMatch ? 0.3 : 0)) * 100);
        return { ...d, matchPercentage: score };
      })
      .filter(d => d.matchPercentage >= 40)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, [directView, newClient]);

  /** Últimos 4 dígitos del teléfono. Se muestran como "código de
   *  comprobación" (estilo OTP, letter-spaced) — son la huella mínima que
   *  necesita el promotor para cruzar con su CRM sin exponer el número
   *  entero del cliente. */
  const last4Phone = (p: string): string => {
    const digits = (p ?? "").replace(/\D/g, "");
    return digits.slice(-4).padStart(4, "·");
  };

  /** Busca la bandera emoji que corresponde a una nacionalidad por su label
   *  (o code). Retorna string vacío si no encuentra match. */
  /** ISO 3166-1 alpha-2 para una nacionalidad · alimenta `<Flag iso={isoFor(...)}>`. */
  const isoFor = (nationality: string): string | undefined => {
    if (!nationality) return undefined;
    const lc = nationality.trim().toLowerCase();
    const match = NATIONALITIES.find(
      (n) => n.label.toLowerCase() === lc || n.code.toLowerCase() === lc,
    );
    return match?.code;
  };

  /** Evalúa si cada condición de registro está cumplida con los datos
   *  actuales del paso confirm (los que el agente puede editar inline).
   *  Convención: las 3 condiciones del producto hoy son "Nombre completo",
   *  "Nacionalidad", "Últimos 4 dígitos del teléfono". Para condiciones
   *  custom del promotor en el futuro, extender este matching. */
  const evalCondition = (label: string): boolean => {
    const l = label.toLowerCase();
    if (l.includes("nombre")) return confirmName.trim().split(/\s+/).length >= 2;
    if (l.includes("nacionalidad")) return confirmNationality.trim().length > 0;
    if (l.includes("teléfono") || l.includes("telefono")) {
      /* Para cliente nuevo leemos el input `confirmPhone`; para existentes
       * el teléfono viene del registro. */
      const src = selectedClient?.id === "new" ? confirmPhone : (selectedClient?.phone ?? "");
      const digits = src.replace(/\D/g, "");
      return digits.length >= 4;
    }
    if (l.includes("email")) {
      const email = (selectedClient as { email?: string } | null)?.email ?? "";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    if (l.includes("dni") || l.includes("documento")) {
      const dni = (selectedClient as { dni?: string } | null)?.dni ?? "";
      return dni.trim().length >= 6;
    }
    return true;
  };
  const allConditionsMet = registrationConditions.every(evalCondition);

  /** Miembros disponibles como anfitrión de la visita.
   *  · Agencia  → sus agentes (systemAgents filtrados por agencyId).
   *  · Promotor → su equipo comercial (TEAM_MEMBERS).
   *  En ambos casos el primer elemento es el propio usuario logueado. */
  const agencyTeamMembers = useMemo(() => {
    const own = { id: currentUser.id, name: currentUser.name, email: currentUser.email };
    if (isAgencyUser && currentUser.agencyId) {
      const team = systemAgents
        .filter((a) => a.agencyId === currentUser.agencyId && a.email !== own.email)
        .map((a) => ({ id: a.id, name: a.name, email: a.email }));
      return [own, ...team];
    }
    // Promotor: equipo del promotor. El propio promotor suele estar en
    // TEAM_MEMBERS — si no, lo prependeamos para que aparezca el primero.
    const team = TEAM_MEMBERS
      .filter((m) => m.email !== own.email)
      .map((m) => ({ id: m.id, name: m.name, email: m.email }));
    const ownInTeam = TEAM_MEMBERS.find((m) => m.email === own.email);
    const ownEntry = ownInTeam
      ? { id: ownInTeam.id, name: ownInTeam.name, email: ownInTeam.email }
      : own;
    return [ownEntry, ...team];
  }, [isAgencyUser, currentUser.id, currentUser.name, currentUser.email, currentUser.agencyId]);

  const resolvedVisitHost = useMemo(() => {
    const defaultId = agencyTeamMembers[0]?.id ?? null;
    const id = visitHostId ?? defaultId;
    return agencyTeamMembers.find((m) => m.id === id) ?? null;
  }, [agencyTeamMembers, visitHostId]);

  const filteredConfirmNationalities = useMemo(() => {
    const q = confirmNationalityQuery.trim().toLowerCase();
    if (!q) return NATIONALITIES;
    return NATIONALITIES.filter((n) => n.label.toLowerCase().includes(q));
  }, [confirmNationalityQuery]);

  const filteredNationalities = useMemo(() => {
    const q = nationalityQuery.trim().toLowerCase();
    if (!q) return NATIONALITIES;
    return NATIONALITIES.filter(n => n.label.toLowerCase().includes(q));
  }, [nationalityQuery]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setConfirmName(client.name);
    setConfirmNationality(client.nationality || "");
    setDirectView("confirm");
  };

  const handleCreateSubmit = () => {
    setSelectedClient({
      id: "new",
      name: newClient.fullName,
      phone: newClient.phone,
      nationality: newClient.nationality,
      email: newClient.email,
    });
    setConfirmName(newClient.fullName);
    setConfirmNationality(newClient.nationality || "");
    setDirectView("confirm");
  };

  const handleConfirmDirect = () => {
    /* Persistimos el registro para que aparezca en `/registros`. En modo
     * agencia, `origen = "collaborator"` con el `agencyId` del usuario.
     * En modo promotor, `origen = "direct"` (registro propio, sin agencia).
     *
     * La agencia puede haber editado nombre/nacionalidad inline en el paso
     * confirm, y puede haber activado "Añadir visita" (→ tipo
     * registration_visit con fecha+hora propuestas). */
    /* Hardening · si el usuario es agencia debe tener `agencyId`. Sin él
     * no se puede atribuir el registro y se perdería la comisión. Falla
     * fuerte (toast error + abort) en lugar de crear un registro huérfano.
     * TODO(backend): el endpoint POST /api/registros valida que
     *   `JWT.accountType === "agency" → agencyId` siempre esté presente. */
    if (isAgencyUser && !currentUser.agencyId) {
      toast.error("No se puede registrar", {
        description: "Tu cuenta de agencia no tiene `agencyId` configurado · contacta soporte.",
      });
      return;
    }
    if (selectedClient && promotionId) {
      const email = (selectedClient as { email?: string }).email ?? "";
      const existingPhone = (selectedClient as { phone?: string }).phone ?? "";
      /* Cliente nuevo en vista agencia: el teléfono viene del input
       * `confirmPhone`. Cliente existente: se reutiliza el del registro. */
      const telefono = isAgencyUser && selectedClient.id === "new"
        ? confirmPhone
        : existingPhone;
      const effectiveName = isAgencyUser
        ? (confirmName.trim() || selectedClient.name)
        : selectedClient.name;
      const effectiveNationality = isAgencyUser
        ? (confirmNationality.trim() || selectedClient.nationality || "")
        : (selectedClient.nationality || "");
      const includeVisit = isAgencyUser && addVisit && visitDate;
      /* Huella digital capturada en el instante del envío. Incluye la
       * versión de términos y la fecha exacta de aceptación para tener
       * traza legal ante disputas. */
      const fingerprint = captureFingerprint(currentUser, {
        termsVersion: getRegistrationTerms(isAgencyUser ? "agency" : "developer").version,
        termsAcceptedAt: termsAcceptedAt ?? new Date().toISOString(),
      });
      const newPublicRef = generatePublicRef("registration", allRegistrosForRef);
      /* ISO derivado del nombre de la nacionalidad para que el registro
         lleve la bandera SVG desde el inicio · evita que el header del
         detalle salga sin bandera ("jaun carlos" sin ES). */
      const inferredIso = resolveNationality(effectiveNationality).iso;
      const registroBase: Registro = isAgencyUser
        ? {
            id: `reg-local-${Date.now()}`,
            publicRef: newPublicRef,
            origen: "collaborator",
            promotionId,
            agencyId: currentUser.agencyId,
            cliente: { nombre: effectiveName, email, telefono, dni: "", nacionalidad: effectiveNationality, nationalityIso: inferredIso },
            fecha: new Date().toISOString(),
            estado: "pendiente",
            matchPercentage: 0,
            consent: true,
            recommendation: "Registro desde agencia · pendiente de aprobación del promotor.",
            audit: fingerprint,
          }
        : {
            id: `reg-local-${Date.now()}`,
            publicRef: newPublicRef,
            origen: "direct",
            promotionId,
            cliente: { nombre: effectiveName, email, telefono, dni: "", nacionalidad: effectiveNationality, nationalityIso: inferredIso },
            fecha: new Date().toISOString(),
            estado: "pendiente",
            matchPercentage: 0,
            consent: true,
            recommendation: "Registro directo del promotor.",
            origenCliente: clientSource || undefined,
            audit: fingerprint,
          };
      const registro: Registro = includeVisit
        ? { ...registroBase, tipo: "registration_visit", visitDate, visitTime: visitTime || undefined }
        : registroBase;
      addCreatedRegistro(registro);

      /* Además del /registros, dejamos traza en el historial del contacto
       * (tab Historial + tab Registros de la ficha de contacto). Para
       * contactos nuevos (id="new") no hay ficha aún — el storage queda
       * igualmente bajo esa clave; cuando se cree la ficha real del
       * contacto, el evento se consolida.
       * TODO(logic): al crear un contacto nuevo desde este flujo,
       *   persistirlo también en createdContactsStorage para que la ficha
       *   de contacto muestre los datos sin esperar a backend. */
      const contactId = selectedClient.id;

      /* Si el cliente es nuevo, primero dejamos traza de "contacto
       * creado" — así el historial del contacto empieza con su evento
       * génesis y luego viene el registro. Regla: todas las acciones
       * que toquen un contacto deben reflejarse en su histórico. */
      if (contactId === "new") {
        recordTypeAny(
          contactId,
          "contact_created",
          `Contacto creado · ${effectiveName}`,
          isAgencyUser
            ? `Creado al solicitar registro en ${promotionName}`
            : `Creado al registrar en ${promotionName}${clientSource ? ` · origen: ${clientSource}` : ""}`,
          { name: currentUser.name, email: currentUser.email },
        );
      }

      const titulo = includeVisit
        ? `Registro + visita enviados · ${promotionName}`
        : (isAgencyUser
            ? `Solicitud de registro enviada · ${promotionName}`
            : `Registro creado · ${promotionName}`);
      const descPartes = [
        `Cliente: ${effectiveName}`,
        effectiveNationality ? `Nacionalidad: ${effectiveNationality}` : null,
        includeVisit
          ? `Visita propuesta: ${visitDate}${visitTime ? ` a las ${visitTime}` : ""}${resolvedVisitHost ? ` · con ${resolvedVisitHost.name}` : ""}`
          : null,
        isAgencyUser ? `Agencia: ${currentUser.agencyName}` : null,
        !isAgencyUser && clientSource ? `Origen: ${clientSource}` : null,
      ].filter(Boolean).join(" · ");
      recordTypeAny(
        contactId,
        "registration",
        titulo,
        descPartes,
        { name: currentUser.name, email: currentUser.email },
      );
    }
    const visitLabel = isAgencyUser && addVisit && visitDate ? " y visita propuesta" : "";
    toast.success(`Registro enviado${visitLabel}`, {
      description: isAgencyUser
        ? `${confirmName || selectedClient?.name} · ${promotionName}. Queda pendiente de la aprobación del promotor.`
        : `${selectedClient?.name} registrado en ${promotionName}.`,
    });
    handleOpenChange(false);
  };

  /* ─────────────────── COLLAB FLOW ─────────────────── */

  const collaboratingAgencies = useMemo(() => {
    if (!promotionId) return allAgencies.filter(a => a.status === "active");
    return allAgencies.filter(a => a.promotionsCollaborating.includes(promotionId));
  }, [promotionId]);

  const collaboratingAgencyIds = useMemo(
    () => new Set(collaboratingAgencies.map(a => a.id)),
    [collaboratingAgencies],
  );

  const collabResults = useMemo(() => {
    const q = collabSearch.trim().toLowerCase();
    if (q.length < 2) return { activeAgents: [], otherAgents: [], otherAgencies: [] };

    const activeAgents = systemAgents.filter(
      a => collaboratingAgencyIds.has(a.agencyId) &&
        (a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    );
    const otherAgents = systemAgents.filter(
      a => !collaboratingAgencyIds.has(a.agencyId) &&
        (a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    );
    const otherAgencies = allAgencies.filter(
      a => !collaboratingAgencyIds.has(a.id) &&
        (a.name.toLowerCase().includes(q) ||
          (q.includes("@") && a.name.toLowerCase().replace(/\s+/g, "").includes(q.split("@")[1]?.split(".")[0] || "")))
    );

    return { activeAgents, otherAgents, otherAgencies };
  }, [collabSearch, collaboratingAgencyIds]);

  const detectedDomainAgency = useMemo(() => {
    const q = collabSearch.trim().toLowerCase();
    if (!q.includes("@")) return null;
    const domain = q.split("@")[1];
    if (!domain || domain.length < 3) return null;
    const domainKey = domain.split(".")[0];
    return allAgencies.find(
      a =>
        !collaboratingAgencyIds.has(a.id) &&
        a.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(domainKey)
    ) ?? null;
  }, [collabSearch, collaboratingAgencyIds]);

  const isInviteCandidate = useMemo(() => {
    const q = collabSearch.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
  }, [collabSearch]);

  const noResults =
    collabSearch.length > 1 &&
    collabResults.activeAgents.length === 0 &&
    collabResults.otherAgents.length === 0 &&
    collabResults.otherAgencies.length === 0;

  const handlePickActiveAgent = (agent: SystemAgent) => {
    /* Aunque la agencia ya colabore y el agente exista, SIEMPRE pasamos
     * por el paso "email del comercial" para que el promotor valide que
     * es el correcto — así la notificación llega al agente adecuado y
     * al mailbox genérico de la agencia. Precargamos los valores para
     * que el promotor solo tenga que confirmar. */
    const agency = allAgencies.find(a => a.id === agent.agencyId);
    if (!agency) return;
    setPendingExistingAgency(agency);
    setCollabInviteAgentName(agent.name);
    setCollabInviteEmail(agent.email);
    setCollabView("invite-existing-agency");
  };

  const handlePickOtherAgent = (agent: SystemAgent) => {
    const agency = allAgencies.find(a => a.id === agent.agencyId);
    if (!agency) return;
    setPendingExistingAgency(agency);
    setCollabInviteAgentName(agent.name);
    setCollabInviteEmail(agent.email);
    setCollabView("invite-existing-agency");
  };

  const handlePickAgencyForInvite = (agency: Agency) => {
    setPendingExistingAgency(agency);
    setCollabInviteAgentName("");
    setCollabInviteEmail("");
    setCollabView("invite-existing-agency");
  };

  const handleSubmitInviteExistingAgency = () => {
    if (!pendingExistingAgency) return;
    /* Si la agencia ya colabora en esta promoción, el paso de "email del
     * comercial" solo confirma el agente — no es invitación. El flag
     * `isActiveCollaborator` se propaga al confirm final para pintar el
     * estado correcto (verde activo vs. ámbar invitación). */
    const isCollaborating = promotionId
      ? pendingExistingAgency.promotionsCollaborating.includes(promotionId)
      : false;
    setCollabSelection({
      agencyId: pendingExistingAgency.id,
      agencyName: pendingExistingAgency.name,
      agencyLogo: pendingExistingAgency.logo,
      agentName: collabInviteAgentName,
      agentEmail: collabInviteEmail,
      isActiveCollaborator: isCollaborating,
      agentInvited: !systemAgents.some(s => s.email === collabInviteEmail),
    });
    setCollabView("confirm");
  };

  const handleSubmitInviteExternal = () => {
    /* Cuando la agencia no existe en Byvaro, el promotor teclea el
     * nombre de la empresa explícitamente. Si lo dejase vacío (caso
     * defensivo), lo inferimos del dominio del email. */
    const fallbackDomain = collabInviteEmail.split("@")[1]?.split(".")[0] ?? "external";
    const agencyName = collabInviteAgencyName.trim()
      || fallbackDomain.charAt(0).toUpperCase() + fallbackDomain.slice(1);
    setCollabSelection({
      agencyName,
      agentName: collabInviteAgentName || collabInviteEmail.split("@")[0],
      agentEmail: collabInviteEmail,
      isActiveCollaborator: false,
      agentInvited: true,
    });
    setCollabView("confirm");
  };

  const handleConfirmCollab = () => {
    if (!collabSelection) return;

    /* Persistimos el Registro con la combinación cliente + agencia. El
     * promotor es quien lo crea a nombre de la agencia: origen siempre
     * "collaborator" con el agencyId elegido. Si la agencia aún no
     * existe en Byvaro, agencyId llega undefined (lo rellena el backend
     * al procesar la invitación). */
    if (selectedClient && promotionId) {
      const nombre = selectedClient.id === "new" && confirmName.trim()
        ? confirmName.trim()
        : selectedClient.name;
      const email = (selectedClient as { email?: string }).email ?? "";
      const telefono = (selectedClient as { phone?: string }).phone ?? "";
      const nacionalidad = confirmNationality.trim() || selectedClient.nationality || "";
      const fingerprint = captureFingerprint(currentUser, {
        termsVersion: getRegistrationTerms(isAgencyUser ? "agency" : "developer").version,
        termsAcceptedAt: termsAcceptedAt ?? new Date().toISOString(),
      });
      const registro: Registro = {
        id: `reg-local-${Date.now()}`,
        publicRef: generatePublicRef("registration", allRegistrosForRef),
        origen: "collaborator",
        promotionId,
        agencyId: collabSelection.agencyId,
        cliente: { nombre, email, telefono, dni: "", nacionalidad, nationalityIso: resolveNationality(nacionalidad).iso },
        fecha: new Date().toISOString(),
        estado: "pendiente",
        matchPercentage: 0,
        consent: true,
        recommendation: collabSelection.isActiveCollaborator
          ? `Registro creado por el promotor para ${collabSelection.agencyName}.`
          : `Registro + invitación enviados a ${collabSelection.agencyName} (${collabSelection.agentEmail}).`,
        audit: fingerprint,
      };
      addCreatedRegistro(registro);

      /* Historial del contacto — deja traza del registro y de la agencia
       * a la que se le asigna. Si el contacto es nuevo, antes del
       * registro dejamos también el evento "contacto creado". */
      const contactId = selectedClient.id;
      if (contactId === "new") {
        recordTypeAny(
          contactId,
          "contact_created",
          `Contacto creado · ${nombre}`,
          `Creado al registrar en ${promotionName}`,
          { name: currentUser.name, email: currentUser.email },
        );
      }
      recordTypeAny(
        contactId,
        "registration",
        `Registro vía colaborador · ${promotionName}`,
        `Cliente: ${nombre} · Agencia: ${collabSelection.agencyName} · Agente: ${collabSelection.agentName}`,
        { name: currentUser.name, email: currentUser.email },
      );
    }

    if (collabSelection.isActiveCollaborator) {
      toast.success("Registro creado", {
        description: `${collabSelection.agentName} (${collabSelection.agencyName}) recibirá la notificación.`,
      });
    } else {
      toast.success("Invitación y registro enviados", {
        description: `${collabSelection.agentEmail} recibirá una invitación para unirse y tramitar este registro.`,
      });
    }
    handleOpenChange(false);
  };

  /* ─────────────────── RENDER ─────────────────── */

  const headerLabel = (() => {
    if (!mode) return "Registrar cliente";
    if (mode === "direct") return "Registro directo";
    return "Registro vía colaborador";
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-y-auto bg-muted border-0 max-w-[560px]",
          /* Altura limitada · 85vh en desktop / 100dvh en móvil. Cada
           * step dentro tiene su propio scroll vertical, así el botón
           * de acción final siempre queda visible sobre el borde. */
          "max-h-[85vh]",
          "max-sm:max-w-none max-sm:max-h-[100dvh] max-sm:h-[100dvh] max-sm:rounded-none max-sm:top-0 max-sm:translate-y-0",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{headerLabel}</DialogTitle>
          <DialogDescription>{promotionName}</DialogDescription>
        </DialogHeader>

        {/* ═════════ STEP 0 · MODE PICKER (solo promotor) ═════════ */}
        {!mode && !isCollaboratorView && (
          <div className="p-7">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-base font-semibold">Registrar cliente</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              ¿Cómo llega este cliente a <span className="text-foreground/80">{promotionName}</span>?
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("direct")}
                className="bg-card border border-border/30 hover:border-foreground/30 rounded-2xl p-5 text-left transition-all"
              >
                <User className="h-5 w-5 text-foreground/70 mb-3" strokeWidth={1.5} />
                <p className="text-sm font-semibold mb-1">Cliente directo</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Un cliente que viene directamente a ti, sin agencia intermediaria.
                </p>
              </button>
              <button
                onClick={() => {
                  /* En el flujo colaborador arrancamos IGUAL que en el
                   * directo (buscar/crear cliente). Cuando el cliente esté
                   * confirmado, pasamos a elegir/invitar la agencia + su
                   * comercial. */
                  setMode("collaborator");
                  setDirectView("search");
                }}
                className="bg-card border border-border/30 hover:border-foreground/30 rounded-2xl p-5 text-left transition-all"
              >
                <Users className="h-5 w-5 text-foreground/70 mb-3" strokeWidth={1.5} />
                <p className="text-sm font-semibold mb-1">A través de colaborador</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Registra un cliente en nombre de una agencia o invita a una nueva.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ═════════════ DIRECT FLOW ═════════════ */}

        {(mode === "direct" || mode === "collaborator") && directView === "search" && (
          <div className="p-7">
            {!isCollaboratorView && (
              <button
                onClick={() => setMode(null)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
              </button>
            )}
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-base font-semibold">Busca o crea el cliente</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{promotionName}</p>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Buscar por nombre, teléfono o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-full text-sm bg-card"
                autoFocus
              />
            </div>

            {searchQuery.length > 1 ? (
              <div className="bg-card rounded-2xl border border-border/30 max-h-[320px] overflow-auto p-1">
                {filteredClients.map(c => {
                  const existing = existingRegistrationsByClient[c.id];
                  const isActive = existing && (existing.expiresInDays === null || existing.expiresInDays > 0);
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectClient(c)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.phone} · {c.nationality}</p>
                      </div>
                      {/* Chips "En vigor / Caducado" solo para el promotor.
                          La agencia NO debe saber que otros agentes tienen
                          registros sobre estos contactos — la detección de
                          duplicados ocurre en backend al confirmar y devuelve
                          un mensaje neutro sin revelar la agencia competidora. */}
                      {existing && !isAgencyUser && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-medium border px-2 py-0.5 rounded-full shrink-0",
                            isActive
                              ? "text-warning bg-warning/10 border-warning/25"
                              : "text-muted-foreground bg-muted/60 border-border/40",
                          )}
                        >
                          <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                          {isActive ? "En vigor" : "Caducado"}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Crear nuevo contacto — siempre al final del desplegable,
                    en azul. En vista agencia saltamos directo al confirm
                    con inputs editables (un solo modal para todo el flujo);
                    en vista promotor mantenemos el step `create` clásico
                    con detección de duplicados y más campos. */}
                <button
                  onClick={() => {
                    /* Todos los roles saltan al confirm unificado con
                     * `selectedClient.id === "new"`. El nombre se arrastra
                     * desde el buscador y los demás campos (4 cifras,
                     * nacionalidad con bandera, visita opcional, origen
                     * si es promotor) se rellenan ahí mismo. */
                    const prefill = searchQuery.trim();
                    setSelectedClient({ id: "new", name: prefill, phone: "", nationality: "", email: "" });
                    setConfirmName(prefill);
                    setConfirmNationality("");
                    setConfirmPhone("");
                    setDirectView("confirm");
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-primary hover:bg-primary/5 transition-colors",
                    filteredClients.length > 0 && "border-t border-border/30 mt-1 rounded-t-none",
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                  <span className="text-xs font-medium">Crear nuevo contacto</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Search className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground">Escribe para buscar un cliente existente</p>
              </div>
            )}
          </div>
        )}

        {(mode === "direct" || mode === "collaborator") && directView === "create" && (
          <div className="p-7">
            <button
              onClick={() => setDirectView("search")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver a búsqueda
            </button>

            <h2 className="text-base font-semibold mb-1">Nuevo cliente</h2>
            <p className="text-xs text-muted-foreground mb-4">Rellena al menos nombre y teléfono.</p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Nombre completo</Label>
                <Input
                  placeholder="Ej. María González Pérez"
                  value={newClient.fullName}
                  onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                  className="h-10 rounded-xl text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    placeholder="+34 600 000 000"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="pl-9 h-10 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="h-10 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Nacionalidad</Label>
                <Popover open={nationalityOpen} onOpenChange={(o) => { setNationalityOpen(o); if (!o) setNationalityQuery(""); }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={nationalityOpen}
                      className="w-full h-10 rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-left flex items-center relative hover:border-foreground/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      {newClient.nationality ? (
                        <span className="flex items-center gap-2 truncate">
                          <Flag iso={NATIONALITIES.find(n => n.label === newClient.nationality)?.code} size={14} />
                          <span className="truncate">{newClient.nationality}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">Selecciona nacionalidad...</span>
                      )}
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="p-2 border-b border-border/50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                        <Input
                          placeholder="Buscar nacionalidad..."
                          value={nationalityQuery}
                          onChange={(e) => setNationalityQuery(e.target.value)}
                          className="h-8 pl-8 text-xs rounded-full"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-[240px] overflow-auto p-1">
                      {filteredNationalities.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground">Sin resultados</div>
                      ) : (
                        filteredNationalities.map(n => (
                          <button
                            key={n.code}
                            type="button"
                            onClick={() => {
                              setNewClient({ ...newClient, nationality: n.label });
                              setNationalityOpen(false);
                              setNationalityQuery("");
                            }}
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors"
                          >
                            <Flag iso={n.code} size={14} />
                            <span className="flex-1">{n.label}</span>
                            {newClient.nationality === n.label && (
                              <Check className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Origen del cliente · desplegable · solo aplica al flujo
                  DIRECTO (en colaborador el origen ya es la agencia). */}
              {mode === "direct" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Origen del cliente
                  </Label>
                  <Popover open={clientSourceOpen} onOpenChange={setClientSourceOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "w-full h-10 rounded-xl border border-border bg-card px-3 text-sm text-left inline-flex items-center gap-2 hover:border-foreground/30 transition-colors",
                          !clientSource && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate flex-1 font-medium">
                          {clientSource || "Selecciona origen..."}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-1">
                      <div className="max-h-[280px] overflow-y-auto">
                        {CLIENT_SOURCE_OPTIONS.map((opt) => {
                          const selected = clientSource === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setClientSource(selected ? "" : opt.value);
                                setClientSourceOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-left hover:bg-muted transition-colors",
                                selected && "bg-muted/60 font-medium",
                              )}
                            >
                              <span className="truncate flex-1">{opt.value}</span>
                              {selected && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Duplicate warning */}
            {detectedDuplicates.length > 0 && (() => {
              const maxScore = Math.max(...detectedDuplicates.map(d => d.matchPercentage));
              const isHigh = maxScore >= 75;
              return (
                <div
                  className={cn(
                    "mt-4 rounded-2xl border p-4",
                    isHigh
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-warning/25 bg-warning/10",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        isHigh ? "text-destructive" : "text-warning",
                      )}
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p
                          className={cn(
                            "text-xs font-semibold",
                            isHigh ? "text-destructive" : "text-warning",
                          )}
                        >
                          {isHigh ? "Coincidencia alta detectada" : `Posible${detectedDuplicates.length > 1 ? "s" : ""} duplicado${detectedDuplicates.length > 1 ? "s" : ""}`}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                            isHigh
                              ? "text-destructive bg-destructive/10 border-destructive/20"
                              : "text-warning bg-warning/20 border-warning/25",
                          )}
                        >
                          {maxScore}% match
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {detectedDuplicates.map((d, i) => (
                          <li
                            key={i}
                            className={cn(
                              "text-[11px] flex items-start justify-between gap-2",
                              isHigh ? "text-destructive/90" : "text-warning/80",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="font-medium">{d.name}</span> · {d.source}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold shrink-0 tabular-nums",
                                d.matchPercentage >= 75
                                  ? "text-destructive"
                                  : d.matchPercentage >= 60
                                    ? "text-warning"
                                    : "text-muted-foreground",
                              )}
                            >
                              {d.matchPercentage}%
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p
                        className={cn(
                          "text-[10px] mt-2",
                          isHigh ? "text-destructive/80" : "text-warning",
                        )}
                      >
                        {isHigh
                          ? "Revisa si es el mismo cliente antes de continuar — la IA marcará conflicto."
                          : "Puedes continuar — el promotor validará por su parte."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 mt-5">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-9 px-4 text-xs"
                onClick={() => setDirectView("search")}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-full h-9 px-5 text-xs"
                disabled={!newClient.fullName.trim() || !newClient.phone}
                onClick={handleCreateSubmit}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ═════════ CONFIRMAR · VISTA AGENCIA ═════════
            Diseño reenfocado para agencia:
            · Cliente editable inline (nombre + nacionalidad).
            · Teléfono enmascarado (solo últimos 4) por privacidad.
            · Exigencias de registro de la promoción (pueden venir del
              promotor — hoy default estable).
            · Quién hace el registro (agente + agencia activa).
            · Toggle "Añadir visita" con fecha + hora opcionales.
            · Sin chip "En vigor / Caducado": la decisión es del promotor. */}
        {(mode === "direct" || mode === "collaborator") && directView === "confirm" && selectedClient && (
          <div className="p-5 sm:p-7">
            <button
              onClick={() => { setDirectView("search"); setSelectedClient(null); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Cambiar cliente
            </button>

            {/* Título condicional · agencia solicita, promotor crea o
                (en collab) está en un paso intermedio de continuación. */}
            <h2 className="text-[17px] sm:text-base font-semibold mb-1 leading-tight">
              {isAgencyUser
                ? "Solicitud de registro"
                : mode === "collaborator"
                  ? "Datos del registro"
                  : "Crear registro"}
            </h2>
            <p className="text-xs text-muted-foreground mb-5">
              {mode === "collaborator" && !isAgencyUser
                ? `${promotionName} · continúa para asignar el colaborador`
                : promotionName}
            </p>

            {/* ── Cliente · nombre editable, código últimos-4 del teléfono,
                 nacionalidad con bandera ── */}
            <div className="space-y-4 mb-5">
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Nombre completo"
                className="h-10 text-base font-semibold rounded-xl"
              />

              {/* Teléfono + Nacionalidad en la MISMA línea (≥sm). En móvil
                  stackean. El teléfono muestra 4 casillas PIN editables
                  para cliente nuevo, o readonly para existente. */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-4">
                {/* Teléfono · 4 cifras */}
                <div className="shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Phone className="h-2.5 w-2.5" strokeWidth={2} />
                    Últimas 4 cifras del teléfono
                  </p>
                  <div className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    {selectedClient.id === "new"
                      ? [0, 1, 2, 3].map((i) => (
                          <input
                            key={i}
                            ref={(el) => { pinRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            autoComplete="off"
                            value={confirmPhone[i] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "").slice(-1);
                              setConfirmPhone((prev) => {
                                const arr = prev.padEnd(4, "").split("");
                                arr[i] = v;
                                return arr.join("").slice(0, 4).replace(/\s/g, "");
                              });
                              if (v && i < 3) pinRefs.current[i + 1]?.focus();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !confirmPhone[i] && i > 0) {
                                pinRefs.current[i - 1]?.focus();
                              }
                              if (e.key === "ArrowLeft" && i > 0) pinRefs.current[i - 1]?.focus();
                              if (e.key === "ArrowRight" && i < 3) pinRefs.current[i + 1]?.focus();
                            }}
                            onPaste={(e) => {
                              const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(-4);
                              if (digits.length) {
                                e.preventDefault();
                                setConfirmPhone(digits.padEnd(4, "").slice(0, 4));
                                pinRefs.current[Math.min(digits.length, 3)]?.focus();
                              }
                            }}
                            className={cn(
                              "h-10 w-10 text-center text-base font-semibold rounded-lg border outline-none transition-colors",
                              "focus:border-primary focus:ring-2 focus:ring-primary/20",
                              confirmPhone[i]
                                ? "border-border bg-card text-foreground"
                                : "border-dashed border-border text-muted-foreground bg-card",
                            )}
                          />
                        ))
                      : last4Phone(selectedClient.phone).split("").map((d, i) => (
                          <span
                            key={i}
                            className="h-10 w-10 rounded-lg border border-border bg-card inline-flex items-center justify-center text-base font-semibold text-foreground"
                            title="Código de comprobación — el promotor ve el número completo"
                          >
                            {d}
                          </span>
                        ))}
                  </div>
                </div>

                {/* Nacionalidad · popover con bandera */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-3">Nacionalidad</p>
                  <Popover open={confirmNationalityOpen} onOpenChange={setConfirmNationalityOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "w-full h-10 px-3 rounded-lg border border-border bg-card text-left text-sm inline-flex items-center gap-2",
                          !confirmNationality && "text-muted-foreground",
                        )}
                      >
                        {confirmNationality && (
                          <Flag iso={isoFor(confirmNationality)} size={14} />
                        )}
                        <span className="truncate font-medium flex-1">
                          {confirmNationality || "Selecciona..."}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[280px] p-0">
                      <div className="p-2 border-b border-border/30">
                        <Input
                          autoFocus
                          placeholder="Buscar..."
                          value={confirmNationalityQuery}
                          onChange={(e) => setConfirmNationalityQuery(e.target.value)}
                          className="h-8 rounded-lg text-xs"
                        />
                      </div>
                      <div className="max-h-[240px] overflow-y-auto">
                        {filteredConfirmNationalities.map((n) => (
                          <button
                            key={n.code}
                            onClick={() => {
                              setConfirmNationality(n.label);
                              setConfirmNationalityOpen(false);
                              setConfirmNationalityQuery("");
                            }}
                            className={cn(
                              "w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors inline-flex items-center gap-2",
                              confirmNationality === n.label && "bg-muted/60 font-medium",
                            )}
                          >
                            <Flag iso={n.code} size={14} />
                            <span className="truncate">{n.label}</span>
                          </button>
                        ))}
                        {filteredConfirmNationalities.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {selectedClient.id === "new" && (
                <p className="text-[10px] text-muted-foreground/70">
                  Con estas 4 cifras el promotor comprueba si ya tiene a este cliente.
                  Tú conservas el número completo hasta que apruebe el registro.
                </p>
              )}
            </div>

            {/* ── Exigencias de registro · minimalista, chips inline ── */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {registrationConditions.map((c) => {
                const met = evalCondition(c);
                return (
                  <span
                    key={c}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border",
                      met
                        ? "bg-success/10 text-success border-success/25"
                        : "bg-muted/40 text-muted-foreground border-border/60",
                    )}
                  >
                    {met ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                    {c}
                  </span>
                );
              })}
            </div>

            {/* ── Firma · agente + agencia, con avatar (sin label) ── */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold text-[10px] shrink-0">
                {currentUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                <span className="text-foreground font-medium">{currentUser.name}</span>
                <span className="text-muted-foreground/70"> · {currentUser.agencyName}</span>
              </p>
            </div>

            {/* ── Añadir visita (opcional) ── */}
            <div
              className={cn(
                "rounded-xl border transition-colors mb-5",
                addVisit ? "bg-primary/5 border-primary/30" : "bg-card border-border/30",
              )}
            >
              <button
                type="button"
                onClick={() => setAddVisit((v) => !v)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    addVisit ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Clock className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {addVisit ? "Visita incluida" : "Añadir visita"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {addVisit
                      ? "Se enviará junto al registro como propuesta de fecha"
                      : "Propón fecha y hora para la visita (opcional)"}
                  </p>
                </div>
                {addVisit ? (
                  <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                )}
              </button>

              {addVisit && (
                <div className="px-4 pb-4 space-y-3 border-t border-primary/20 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1.5">Fecha</label>
                      {/* type="date" abre el datepicker nativo del móvil. */}
                      <input
                        type="date"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        className="w-full h-11 sm:h-10 px-3 rounded-lg border border-border bg-card text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1.5">Hora</label>
                      {/* type="time" abre el clock picker nativo del móvil. */}
                      <input
                        type="time"
                        value={visitTime}
                        onChange={(e) => setVisitTime(e.target.value)}
                        className="w-full h-11 sm:h-10 px-3 rounded-lg border border-border bg-card text-sm"
                      />
                    </div>
                  </div>

                  {/* Quién hará la visita · por defecto el agente que
                      solicita el registro, reasignable a otro miembro del
                      equipo de la agencia. */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                      Quién hará la visita
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full h-11 sm:h-10 px-3 rounded-lg border border-border bg-card text-left text-sm inline-flex items-center gap-2.5"
                        >
                          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold text-[10px] shrink-0">
                            {resolvedVisitHost?.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "?"}
                          </span>
                          <span className="truncate font-medium flex-1">
                            {resolvedVisitHost?.name ?? "Selecciona miembro"}
                            {resolvedVisitHost?.email === currentUser.email && (
                              <span className="text-[10px] text-muted-foreground ml-1.5">(tú)</span>
                            )}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[280px] p-1">
                        <div className="max-h-[220px] overflow-y-auto">
                          {agencyTeamMembers.map((m) => {
                            const selected = m.id === (visitHostId ?? agencyTeamMembers[0]?.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => setVisitHostId(m.id)}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-muted transition-colors",
                                  selected && "bg-muted/60",
                                )}
                              >
                                <span className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold text-[10px] shrink-0">
                                  {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate">
                                    {m.name}
                                    {m.email === currentUser.email && (
                                      <span className="text-[10px] text-muted-foreground ml-1.5">(tú)</span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                                </div>
                                {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.5} />}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>

            {/* Origen del cliente · solo promotor directo (no agencia,
                no colaborador — ya se sabe de quién viene). */}
            {!isAgencyUser && mode === "direct" && (
              <div className="mb-5 space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Origen del cliente</p>
                <Popover open={clientSourceOpen} onOpenChange={setClientSourceOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full h-10 rounded-xl border border-border bg-card px-3 text-sm text-left inline-flex items-center gap-2 hover:border-foreground/30 transition-colors",
                        !clientSource && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate flex-1 font-medium">
                        {clientSource || "Selecciona origen..."}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-1">
                    <div className="max-h-[280px] overflow-y-auto">
                      {CLIENT_SOURCE_OPTIONS.map((opt) => {
                        const selected = clientSource === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setClientSource(selected ? "" : opt.value);
                              setClientSourceOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-left hover:bg-muted transition-colors",
                              selected && "bg-muted/60 font-medium",
                            )}
                          >
                            <span className="truncate flex-1">{opt.value}</span>
                            {selected && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Términos: en directo se aceptan aquí (aquí se envía el
                registro). En colaborador se aceptan en el paso final. */}
            {mode === "direct" && termsAcceptanceBlock}

            {mode === "collaborator" && !isAgencyUser ? (
              <Button
                className="w-full rounded-full h-10 text-xs gap-2"
                onClick={() => { setDirectView("done"); setCollabView("search"); }}
                disabled={!allConditionsMet}
              >
                Continuar
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Button>
            ) : (
              <Button
                className="w-full rounded-full h-10 text-xs gap-2"
                onClick={handleConfirmDirect}
                disabled={!allConditionsMet || (addVisit && !visitDate) || !termsAccepted}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
                {addVisit
                  ? "Enviar registro con visita"
                  : (isAgencyUser ? "Enviar registro" : "Crear registro")}
              </Button>
            )}
          </div>
        )}
        {/* ═════════════ COLLABORATOR FLOW ═════════════ */}

        {mode === "collaborator" && directView === "done" && collabView === "search" && (
          <div className="p-7">
            <button
              onClick={() => {
                /* Volver al paso "datos del registro" (confirm del cliente).
                 * Conserva el cliente seleccionado y los datos ya editados. */
                setDirectView("confirm");
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver al cliente
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-base font-semibold">Buscar colaborador</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Busca por nombre de agente, agencia o email. Si no están en el sistema, podrás invitarles.
            </p>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Nombre de agente, agencia o email..."
                value={collabSearch}
                onChange={(e) => setCollabSearch(e.target.value)}
                className="pl-9 h-10 rounded-full text-sm bg-card"
                autoFocus
              />
            </div>

            {/* Domain detection banner */}
            {detectedDomainAgency && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 mb-3">
                <div className="flex items-start gap-3">
                  {detectedDomainAgency.logo ? (
                    <img src={detectedDomainAgency.logo} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-blue-700" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-blue-900 mb-0.5">Agencia detectada: {detectedDomainAgency.name}</p>
                    <p className="text-[11px] text-blue-900/80 mb-2">
                      El dominio coincide con una agencia ya en el sistema pero que no colabora en esta promoción. Puedes invitar al agente para registrar en su nombre.
                    </p>
                    <Button
                      size="sm"
                      className="rounded-full h-8 px-4 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handlePickAgencyForInvite(detectedDomainAgency)}
                    >
                      Invitar agente a {detectedDomainAgency.name}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {collabSearch.length > 1 && (
              <div className="bg-card rounded-2xl border border-border/30 max-h-[280px] overflow-auto p-1 mb-3">
                {collabResults.activeAgents.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-3 py-2">
                      Colaboradores activos
                    </p>
                    {collabResults.activeAgents.map(agent => {
                      const agency = allAgencies.find(a => a.id === agent.agencyId);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => handlePickActiveAgent(agent)}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                        >
                          {agency?.logo ? (
                            <img src={agency.logo} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{agent.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{agency?.name} · {agent.email}</p>
                          </div>
                          <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">Activo</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {collabResults.otherAgents.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-3 py-2 mt-1">
                      En sistema · aún no colabora
                    </p>
                    {collabResults.otherAgents.map(agent => {
                      const agency = allAgencies.find(a => a.id === agent.agencyId);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => handlePickOtherAgent(agent)}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                        >
                          {agency?.logo ? (
                            <img src={agency.logo} alt="" className="h-8 w-8 rounded-full object-cover shrink-0 grayscale" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{agent.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{agency?.name} · {agent.email}</p>
                          </div>
                          <span className="text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">Invitar</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {collabResults.otherAgencies.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-3 py-2 mt-1">
                      Agencias en sistema
                    </p>
                    {collabResults.otherAgencies.map(agency => (
                      <button
                        key={agency.id}
                        onClick={() => handlePickAgencyForInvite(agency)}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        {agency.logo ? (
                          <img src={agency.logo} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{agency.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{agency.location}</p>
                        </div>
                        <span className="text-[10px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">Invitar agente</span>
                      </button>
                    ))}
                  </>
                )}

                {noResults && !detectedDomainAgency && (
                  <div className="text-center py-6 px-4">
                    <p className="text-xs text-foreground mb-1">Sin colaboradores</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isInviteCandidate
                        ? "Puedes invitar este email como colaborador externo."
                        : "Introduce un email válido para invitar externamente."}
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full gap-2 rounded-full h-10 bg-card text-xs"
              disabled={!isInviteCandidate}
              onClick={() => {
                setCollabInviteEmail(collabSearch.trim().toLowerCase());
                setCollabInviteAgentName("");
                setCollabView("invite-external");
              }}
            >
              <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
              {isInviteCandidate ? `Invitar ${collabSearch.trim().toLowerCase()}` : "Introduce un email válido para invitar"}
            </Button>
          </div>
        )}

        {mode === "collaborator" && directView === "done" && collabView === "invite-existing-agency" && pendingExistingAgency && (
          <div className="p-7">
            <button
              onClick={() => setCollabView("search")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>

            {(() => {
              /* Copy dinámico: si la agencia ya colabora en esta promoción
               * el texto reconoce esa relación; si está en Byvaro pero no
               * colabora aún, el copy invita. En ambos casos pedimos email
               * del comercial para que la notificación llegue al agente
               * concreto además del mailbox genérico de la agencia. */
              const isCollaborating = promotionId
                ? pendingExistingAgency.promotionsCollaborating.includes(promotionId)
                : false;
              return (
                <>
                  <h2 className="text-base font-semibold mb-1">
                    {isCollaborating ? "Datos del comercial" : "Invitar agente a registrar"}
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    {isCollaborating
                      ? `${pendingExistingAgency.name} ya colabora en esta promoción. Confirma qué comercial gestiona el registro — recibirá la notificación junto con la agencia.`
                      : `${pendingExistingAgency.name} está en nuestro sistema pero aún no colabora en esta promoción. Tanto la agencia como el comercial recibirán la invitación.`}
                  </p>
                </>
              );
            })()}

            <div className="bg-card border border-border/30 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-3">
                {pendingExistingAgency.logo ? (
                  <img src={pendingExistingAgency.logo} alt="" className="h-12 w-12 rounded-2xl object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{pendingExistingAgency.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{pendingExistingAgency.location}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nombre del agente (opcional)</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={collabInviteAgentName}
                  onChange={(e) => setCollabInviteAgentName(e.target.value)}
                  className="h-9 rounded-full text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email del agente</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    type="email"
                    placeholder={`agente@${pendingExistingAgency.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`}
                    value={collabInviteEmail}
                    onChange={(e) => setCollabInviteEmail(e.target.value)}
                    className="pl-9 h-9 rounded-full text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-9 px-4 text-xs"
                onClick={() => setCollabView("search")}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-full h-9 px-5 text-xs gap-1.5"
                disabled={!collabInviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collabInviteEmail)}
                onClick={handleSubmitInviteExistingAgency}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                Continuar
              </Button>
            </div>
          </div>
        )}

        {mode === "collaborator" && directView === "done" && collabView === "invite-external" && (
          <div className="p-7">
            <button
              onClick={() => setCollabView("search")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>

            <h2 className="text-base font-semibold mb-1">Invitar colaborador externo</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Esta agencia aún no está en Byvaro. Indica el nombre de la empresa y los datos del comercial; recibirán la invitación y podrán tramitar el registro.
            </p>

            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4 mb-4">
              {/* 1 · Nombre de la empresa (requerido) */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Nombre de la empresa</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    placeholder="Ej. Costa Luxury Homes"
                    value={collabInviteAgencyName}
                    onChange={(e) => setCollabInviteAgencyName(e.target.value)}
                    className="pl-9 h-10 rounded-xl text-sm"
                    autoFocus
                  />
                </div>
              </div>

              {/* 2 · Email del comercial (requerido) */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Email del comercial</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    type="email"
                    placeholder="comercial@empresa.com"
                    value={collabInviteEmail}
                    onChange={(e) => setCollabInviteEmail(e.target.value)}
                    className="pl-9 h-10 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* 3 · Nombre del comercial (opcional) */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Nombre del comercial (opcional)</Label>
                <Input
                  placeholder="Juan Pérez"
                  value={collabInviteAgentName}
                  onChange={(e) => setCollabInviteAgentName(e.target.value)}
                  className="h-10 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-9 px-4 text-xs"
                onClick={() => setCollabView("search")}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-full h-9 px-5 text-xs gap-1.5"
                disabled={
                  !collabInviteAgencyName.trim()
                  || !collabInviteEmail
                  || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collabInviteEmail)
                }
                onClick={handleSubmitInviteExternal}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                Continuar
              </Button>
            </div>
          </div>
        )}

        {mode === "collaborator" && directView === "done" && collabView === "confirm" && collabSelection && (
          <div className="p-7">
            <button
              onClick={() => { setCollabView("search"); setCollabSelection(null); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Cambiar colaborador
            </button>

            <h2 className="text-base font-semibold mb-1">Confirmar registro</h2>
            <p className="text-xs text-muted-foreground mb-4">{promotionName}</p>

            <div className="bg-card border border-border/30 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                {collabSelection.agencyLogo ? (
                  <img src={collabSelection.agencyLogo} alt="" className="h-10 w-10 rounded-2xl object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{collabSelection.agencyName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{collabSelection.agentName} · {collabSelection.agentEmail}</p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
                    collabSelection.isActiveCollaborator
                      ? "text-success bg-success/10"
                      : "text-warning bg-warning/10",
                  )}
                >
                  {collabSelection.isActiveCollaborator ? "Activo" : "Invitación"}
                </span>
              </div>

              {!collabSelection.isActiveCollaborator && (
                <div className="flex items-start gap-2 pt-3 border-t border-border/30">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-[11px] text-warning/90">
                    {collabSelection.agentInvited
                      ? `${collabSelection.agentEmail} recibirá una invitación para registrarse y tramitar este cliente.`
                      : `${collabSelection.agencyName} recibirá una notificación con la solicitud de registro.`}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-card border border-border/30 rounded-2xl p-4 mb-5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] mb-2">Siguientes pasos</p>
              <div className="space-y-2">
                {[
                  collabSelection.isActiveCollaborator
                    ? "El colaborador recibirá la solicitud de registro"
                    : "Primero se enviará un email de invitación",
                  "Añadirán los datos del cliente por su parte",
                  `Validez: ${validezDias === 0 ? "no expira" : `${validezDias} días`}`,
                ].map((c, i) => (
                  <div key={c} className="flex items-center gap-2.5">
                    <div className="h-4 w-4 rounded-full border border-border bg-muted/40 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{c}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Términos · se aceptan AQUÍ porque este es el paso donde
                realmente se crea el registro (antes era solo "continuar"). */}
            {termsAcceptanceBlock}

            <Button
              className="w-full rounded-full h-10 text-xs gap-2"
              onClick={handleConfirmCollab}
              disabled={!termsAccepted}
            >
              <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
              {collabSelection.isActiveCollaborator ? "Enviar registro" : "Enviar invitación y registro"}
            </Button>
          </div>
        )}

        {/* Modal de lectura de términos · compartido entre los 3 confirms.
            Se abre al hacer click en el link del checkbox. */}
        <RegistrationTermsDialog
          open={termsDialogOpen}
          onOpenChange={setTermsDialogOpen}
          lang="es"
          role={isAgencyUser ? "agency" : "developer"}
          onAccept={acceptTerms}
        />
      </DialogContent>
    </Dialog>
  );
}
