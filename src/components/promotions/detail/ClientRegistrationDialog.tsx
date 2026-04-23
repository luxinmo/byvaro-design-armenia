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
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search, UserPlus, Check, User, Phone, Globe, ArrowLeft, Clock,
  Users, Building2, AlertTriangle, Mail, Send, ShieldCheck, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { agencies as allAgencies, type Agency } from "@/data/agencies";
import { NATIONALITIES } from "@/data/nationalities";
import { useCurrentUser } from "@/lib/currentUser";
import { addCreatedRegistro } from "@/lib/registrosStorage";
import type { Registro } from "@/data/records";

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
}

const registrationConditions = [
  "Nombre completo",
  "Nacionalidad",
  "Últimos 4 dígitos del teléfono",
];

/* ─────────────────── MOCK DATA ─────────────────── */

const mockClients = [
  { id: "1", name: "Carlos García López", phone: "+34 612 345 678", nationality: "Spanish", email: "carlos@email.com" },
  { id: "2", name: "Sarah Johnson", phone: "+34 698 112 233", nationality: "British", email: "sarah.j@email.com" },
  { id: "3", name: "Hans Müller", phone: "+49 170 555 1234", nationality: "German", email: "hans.m@email.com" },
  { id: "4", name: "Marie Dupont", phone: "+33 6 12 34 56 78", nationality: "French", email: "marie.d@email.com" },
  { id: "5", name: "Ahmed Al-Farsi", phone: "+971 50 123 4567", nationality: "Emirati", email: "ahmed@email.com" },
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
type DirectView = "search" | "create" | "confirm";
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
}: Props) {
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";
  const [mode, setMode] = useState<Mode | null>(null);

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
  const [collabSelection, setCollabSelection] = useState<CollabSelection | null>(null);
  const [pendingExistingAgency, setPendingExistingAgency] = useState<Agency | null>(null);

  const resetDirect = () => {
    setDirectView("search");
    setSearchQuery("");
    setSelectedClient(null);
    setNewClient({ fullName: "", phone: "", nationality: "", email: "" });
    setNationalityQuery("");
  };

  const resetCollab = () => {
    setCollabView("search");
    setCollabSearch("");
    setCollabInviteEmail("");
    setCollabInviteAgentName("");
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

  const filteredClients = searchQuery.length > 1
    ? mockClients.filter((c) =>
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

  const filteredNationalities = useMemo(() => {
    const q = nationalityQuery.trim().toLowerCase();
    if (!q) return NATIONALITIES;
    return NATIONALITIES.filter(n => n.label.toLowerCase().includes(q));
  }, [nationalityQuery]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
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
    setDirectView("confirm");
  };

  const handleConfirmDirect = () => {
    /* Persistimos el registro para que aparezca en `/registros`. En modo
     * agencia, `origen = "collaborator"` con el `agencyId` del usuario.
     * En modo promotor, `origen = "direct"` (registro propio, sin agencia). */
    if (selectedClient && promotionId) {
      const nombre = selectedClient.name;
      const email = (selectedClient as { email?: string }).email ?? "";
      const telefono = (selectedClient as { phone?: string }).phone ?? "";
      const nacionalidad = (selectedClient as { nationality?: string }).nationality ?? "";
      const registro: Registro = isAgencyUser
        ? {
            id: `reg-local-${Date.now()}`,
            origen: "collaborator",
            promotionId,
            agencyId: currentUser.agencyId,
            cliente: { nombre, email, telefono, dni: "", nacionalidad },
            fecha: new Date().toISOString(),
            estado: "pendiente",
            matchPercentage: 0,
            consent: true,
            recommendation: "Registro desde agencia · sin análisis de duplicados.",
          }
        : {
            id: `reg-local-${Date.now()}`,
            origen: "direct",
            promotionId,
            cliente: { nombre, email, telefono, dni: "", nacionalidad },
            fecha: new Date().toISOString(),
            estado: "pendiente",
            matchPercentage: 0,
            consent: true,
            recommendation: "Registro directo del promotor.",
          };
      addCreatedRegistro(registro);
    }
    toast.success("Cliente registrado", {
      description: `${selectedClient?.name} registrado en ${promotionName}.`,
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
    const agency = allAgencies.find(a => a.id === agent.agencyId);
    if (!agency) return;
    setCollabSelection({
      agencyId: agency.id,
      agencyName: agency.name,
      agencyLogo: agency.logo,
      agentName: agent.name,
      agentEmail: agent.email,
      isActiveCollaborator: true,
      agentInvited: false,
    });
    setCollabView("confirm");
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
    setCollabSelection({
      agencyId: pendingExistingAgency.id,
      agencyName: pendingExistingAgency.name,
      agencyLogo: pendingExistingAgency.logo,
      agentName: collabInviteAgentName,
      agentEmail: collabInviteEmail,
      isActiveCollaborator: false,
      agentInvited: !systemAgents.some(s => s.email === collabInviteEmail),
    });
    setCollabView("confirm");
  };

  const handleSubmitInviteExternal = () => {
    const domain = collabInviteEmail.split("@")[1] ?? "external";
    const agencyName = domain.split(".")[0];
    setCollabSelection({
      agencyName: agencyName.charAt(0).toUpperCase() + agencyName.slice(1),
      agentName: collabInviteAgentName || collabInviteEmail.split("@")[0],
      agentEmail: collabInviteEmail,
      isActiveCollaborator: false,
      agentInvited: true,
    });
    setCollabView("confirm");
  };

  const handleConfirmCollab = () => {
    if (!collabSelection) return;
    if (collabSelection.isActiveCollaborator) {
      toast.success("Registro enviado", {
        description: `${collabSelection.agentName} (${collabSelection.agencyName}) recibirá la solicitud de registro.`,
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
      <DialogContent className="p-0 overflow-hidden bg-muted border-0 max-w-[560px]">
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
                onClick={() => setMode("collaborator")}
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

        {mode === "direct" && directView === "search" && (
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
                      {existing && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-medium border px-2 py-0.5 rounded-full shrink-0",
                            isActive
                              ? "text-amber-800 bg-amber-50 border-amber-200"
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

                {/* Crear nuevo contacto — siempre al final del desplegable, en azul */}
                <button
                  onClick={() => setDirectView("create")}
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

        {mode === "direct" && directView === "create" && (
          <div className="p-7">
            <button
              onClick={() => setDirectView("search")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver a búsqueda
            </button>

            <h2 className="text-base font-semibold mb-1">Nuevo cliente</h2>
            <p className="text-xs text-muted-foreground mb-4">Rellena al menos nombre y teléfono.</p>

            <div className="bg-card border border-border/30 rounded-2xl p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nombre completo</Label>
                <Input
                  placeholder="Ej. María González Pérez"
                  value={newClient.fullName}
                  onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                  className="h-9 rounded-full text-xs"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    placeholder="+34 600 000 000"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="pl-9 h-9 rounded-full text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="h-9 rounded-full text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nacionalidad</Label>
                <Popover open={nationalityOpen} onOpenChange={(o) => { setNationalityOpen(o); if (!o) setNationalityQuery(""); }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={nationalityOpen}
                      className="w-full h-9 rounded-full border border-border/50 bg-background pl-9 pr-9 text-xs text-left flex items-center relative hover:border-border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      {newClient.nationality ? (
                        <span className="flex items-center gap-2 truncate">
                          {NATIONALITIES.find(n => n.label === newClient.nationality)?.flag}
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
                            <span className="text-base leading-none">{n.flag}</span>
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
                      : "border-amber-200 bg-amber-50/60",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        isHigh ? "text-destructive" : "text-amber-600",
                      )}
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p
                          className={cn(
                            "text-xs font-semibold",
                            isHigh ? "text-destructive" : "text-amber-900",
                          )}
                        >
                          {isHigh ? "Coincidencia alta detectada" : `Posible${detectedDuplicates.length > 1 ? "s" : ""} duplicado${detectedDuplicates.length > 1 ? "s" : ""}`}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                            isHigh
                              ? "text-destructive bg-destructive/10 border-destructive/20"
                              : "text-amber-900 bg-amber-100/70 border-amber-200",
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
                              isHigh ? "text-destructive/90" : "text-amber-900/80",
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
                                    ? "text-amber-900"
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
                          isHigh ? "text-destructive/80" : "text-amber-700",
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

        {mode === "direct" && directView === "confirm" && selectedClient && (
          <div className="p-7">
            <button
              onClick={() => { setDirectView("search"); setSelectedClient(null); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Cambiar cliente
            </button>

            <h2 className="text-base font-semibold mb-1">Confirmar registro</h2>
            <p className="text-xs text-muted-foreground mb-4">{promotionName}</p>

            {(() => {
              const existing = existingRegistrationsByClient[selectedClient.id];
              if (!existing) return null;
              const isActive = existing.expiresInDays === null || existing.expiresInDays > 0;
              const validityLabel = existing.expiresInDays === null
                ? "Sin caducidad · siempre en vigor"
                : existing.expiresInDays > 0
                  ? `En vigor · caduca en ${existing.expiresInDays} ${existing.expiresInDays === 1 ? "día" : "días"}`
                  : `Caducado hace ${Math.abs(existing.expiresInDays)} ${Math.abs(existing.expiresInDays) === 1 ? "día" : "días"}`;
              return (
                <div
                  className={cn(
                    "rounded-2xl border p-4 mb-4",
                    isActive
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-border/40 bg-muted/40",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0 mt-0.5",
                        isActive ? "text-amber-600" : "text-muted-foreground",
                      )}
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-xs font-semibold mb-1",
                          isActive ? "text-amber-900" : "text-foreground",
                        )}
                      >
                        {isActive
                          ? "Este cliente ya está registrado por otra agencia"
                          : "Este cliente tuvo un registro previo (caducado)"}
                      </p>
                      <p
                        className={cn(
                          "text-[11px] mb-1.5",
                          isActive ? "text-amber-900/80" : "text-muted-foreground",
                        )}
                      >
                        <span className="font-medium">{existing.agencyName}</span> · {existing.agentName} · hace {existing.daysAgo} {existing.daysAgo === 1 ? "día" : "días"}
                      </p>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border",
                            isActive
                              ? "text-amber-900 bg-amber-100/70 border-amber-200"
                              : "text-muted-foreground bg-background border-border/40",
                          )}
                        >
                          <Clock className="h-3 w-3" strokeWidth={2} />
                          {validityLabel}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-[10px]",
                          isActive ? "text-amber-700" : "text-muted-foreground",
                        )}
                      >
                        {isActive
                          ? "Si continúas, se creará un registro duplicado y la IA marcará conflicto. Confirma con el promotor antes de seguir."
                          : "El registro anterior ya no protege al cliente. Puedes continuar sin conflicto."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="bg-card border border-border/30 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-foreground/5 flex items-center justify-center">
                  <User className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedClient.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{selectedClient.email || "Sin email"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/30">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Teléfono</p>
                  <p className="text-xs font-medium">{selectedClient.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Nacionalidad</p>
                  <p className="text-xs font-medium">{selectedClient.nationality || "—"}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/30 rounded-2xl p-4 mb-5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Condiciones cumplidas</p>
              <div className="space-y-2">
                {registrationConditions.map(c => (
                  <div key={c} className="flex items-center gap-2.5">
                    <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-emerald-700" strokeWidth={3} />
                    </div>
                    <span className="text-xs text-foreground">{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full rounded-full h-10 text-xs gap-2" onClick={handleConfirmDirect}>
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
              Confirmar registro
            </Button>
          </div>
        )}

        {/* ═════════════ COLLABORATOR FLOW ═════════════ */}

        {mode === "collaborator" && collabView === "search" && (
          <div className="p-7">
            <button
              onClick={() => setMode(null)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
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
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Activo</span>
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
                          <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">Invitar</span>
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
                        <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">Invitar agente</span>
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

        {mode === "collaborator" && collabView === "invite-existing-agency" && pendingExistingAgency && (
          <div className="p-7">
            <button
              onClick={() => setCollabView("search")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>

            <h2 className="text-base font-semibold mb-1">Invitar agente a registrar</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {pendingExistingAgency.name} está en nuestro sistema pero aún no colabora en esta promoción.
            </p>

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

        {mode === "collaborator" && collabView === "invite-external" && (
          <div className="p-7">
            <button
              onClick={() => setCollabView("search")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>

            <h2 className="text-base font-semibold mb-1">Invitar colaborador externo</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Recibirá una invitación para crear su cuenta y tramitar este registro.
            </p>

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
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    type="email"
                    placeholder="agente@agencia.com"
                    value={collabInviteEmail}
                    onChange={(e) => setCollabInviteEmail(e.target.value)}
                    className="pl-9 h-9 rounded-full text-xs"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-muted-foreground pl-1">
                  Detectaremos la agencia por el dominio del email.
                </p>
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
                onClick={handleSubmitInviteExternal}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                Continuar
              </Button>
            </div>
          </div>
        )}

        {mode === "collaborator" && collabView === "confirm" && collabSelection && (
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
                      ? "text-emerald-700 bg-emerald-50"
                      : "text-amber-800 bg-amber-50",
                  )}
                >
                  {collabSelection.isActiveCollaborator ? "Activo" : "Invitación"}
                </span>
              </div>

              {!collabSelection.isActiveCollaborator && (
                <div className="flex items-start gap-2 pt-3 border-t border-border/30">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-[11px] text-amber-900/90">
                    {collabSelection.agentInvited
                      ? `${collabSelection.agentEmail} recibirá una invitación para registrarse y tramitar este cliente.`
                      : `${collabSelection.agencyName} recibirá una notificación con la solicitud de registro.`}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-card border border-border/30 rounded-2xl p-4 mb-5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Siguientes pasos</p>
              <div className="space-y-2">
                {[
                  collabSelection.isActiveCollaborator
                    ? "El colaborador recibirá la solicitud de registro"
                    : "Primero se enviará un email de invitación",
                  "Añadirán los datos del cliente por su parte",
                  `Validez: ${validezDias === 0 ? "no expira" : `${validezDias} días`}`,
                ].map(c => (
                  <div key={c} className="flex items-center gap-2.5">
                    <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-emerald-700" strokeWidth={3} />
                    </div>
                    <span className="text-xs text-foreground">{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full rounded-full h-10 text-xs gap-2" onClick={handleConfirmCollab}>
              <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
              {collabSelection.isActiveCollaborator ? "Enviar registro" : "Enviar invitación y registro"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
