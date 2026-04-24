/**
 * SignerPickerDialog · añadir un firmante al contrato de colaboración.
 *
 * Dos pasos:
 *   1. `pick`   → lista de contactos candidatos (contacto principal
 *                 de la agencia + firmantes de contratos anteriores
 *                 con esta agencia). Al seleccionar uno, **arrastra
 *                 todos sus datos** (nombre, NIF, email, teléfono,
 *                 cargo, notificaciones) al form sin tener que
 *                 teclearlos de nuevo.
 *   2. `form`   → formulario completo (misma shape Firmafy) con los
 *                 campos pre-rellenados si vino de `pick`, o vacíos
 *                 si vino de "Crear nuevo firmante".
 *
 * Al confirmar, `onAdd(signer)` devuelve el `ContractSigner` para que
 * el caller lo añada a su lista local.
 *
 * Se usa tanto desde `ContractUploadDialog` (añadir firmante del
 * contrato a subir) como desde `ContractDetailDialog` (añadir
 * firmante a uno existente, si lo activamos en el futuro).
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/Switch";
import {
  Search, X, UserPlus, ArrowLeft, AtSign, Phone, IdCard, Check,
  Building2, ChevronRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import type { ContractSigner } from "@/lib/collaborationContracts";
import { getContractsForAgency } from "@/lib/collaborationContracts";

/* ═════════════ Validaciones ═════════════ */

function isValidEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()); }
function isValidNif(s: string) {
  const v = s.trim().toUpperCase();
  if (!v) return false;
  return /^[0-9]{7,8}[A-Z]$/.test(v)
      || /^[XYZ][0-9]{7}[A-Z]$/.test(v)
      || /^[A-Z0-9]{6,12}$/.test(v);
}
function isValidPhone(s: string) {
  const v = s.replace(/[\s-]/g, "");
  return /^\+?[0-9]{9,15}$/.test(v);
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/* ═════════════ Candidatos ═════════════ */

interface Candidate {
  id: string;
  source: "contacto-principal" | "firmante-previo";
  nombre: string;
  email: string;
  nif?: string;
  telefono?: string;
  cargo?: string;
  empresa?: string;
  cif?: string;
  lastUsedAt?: number;   // para ordenar firmantes previos
  timesUsed?: number;    // "usado en N contratos"
}

/** Construye la lista de contactos candidatos a partir de:
 *  · `agency.contactoPrincipal` (si tiene).
 *  · Firmantes únicos de contratos anteriores con la agencia
 *    (dedup por NIF o email). */
function buildCandidates(agency: Agency): Candidate[] {
  const out: Candidate[] = [];

  const cp = agency.contactoPrincipal;
  if (cp?.email) {
    out.push({
      id: `cp-${agency.id}`,
      source: "contacto-principal",
      nombre: cp.nombre,
      email: cp.email,
      telefono: cp.telefono ?? "",
      cargo: cp.rol,
    });
  }

  /* Deduplicar firmantes previos · la clave es nif || email. */
  const previous = getContractsForAgency(agency.id);
  const map = new Map<string, Candidate>();
  for (const c of previous) {
    for (const s of c.signers) {
      const key = (s.nif || s.email).toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.timesUsed = (existing.timesUsed ?? 1) + 1;
        existing.lastUsedAt = Math.max(existing.lastUsedAt ?? 0, c.createdAt);
      } else {
        map.set(key, {
          id: `prev-${key}`,
          source: "firmante-previo",
          nombre: s.nombre,
          email: s.email,
          nif: s.nif,
          telefono: s.telefono,
          cargo: s.cargo,
          empresa: s.empresa,
          cif: s.cif,
          lastUsedAt: c.createdAt,
          timesUsed: 1,
        });
      }
    }
  }
  /* Excluir los que ya sean contacto principal (mismo email). */
  const cpEmail = cp?.email?.toLowerCase();
  for (const cand of map.values()) {
    if (cand.email.toLowerCase() === cpEmail) continue;
    out.push(cand);
  }

  /* Ordenar: contacto principal primero, luego previos por recencia. */
  return out.sort((a, b) => {
    if (a.source === "contacto-principal") return -1;
    if (b.source === "contacto-principal") return 1;
    return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
  });
}

/* ════════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agency: Agency;
  /** IDs/emails de firmantes ya incluidos · los filtramos de la lista
   *  para no duplicar. Se pasa como Set de emails (lower-case). */
  excludeEmails?: Set<string>;
  onAdd: (signer: ContractSigner) => void;
}

type Step = "pick" | "form";

const EMPTY_DRAFT: ContractSigner & { juridica?: boolean } = {
  nombre: "", nif: "", email: "", telefono: "",
  cargo: "", notifications: "email,sms",
};

export function SignerPickerDialog({
  open, onOpenChange, agency, excludeEmails, onAdd,
}: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ContractSigner & { juridica?: boolean }>(EMPTY_DRAFT);

  /* Candidatos memoizados, filtrados por query y excludeEmails. */
  const candidates = useMemo(() => {
    if (!open) return [];
    const all = buildCandidates(agency);
    const q = query.trim().toLowerCase();
    return all.filter((c) => {
      if (excludeEmails?.has(c.email.toLowerCase())) return false;
      if (!q) return true;
      return c.nombre.toLowerCase().includes(q)
          || c.email.toLowerCase().includes(q)
          || (c.nif?.toLowerCase().includes(q) ?? false);
    });
  }, [open, agency, query, excludeEmails]);

  useEffect(() => {
    if (open) {
      setStep("pick");
      setQuery("");
      setDraft(EMPTY_DRAFT);
    }
  }, [open, agency.id]);

  /** Arrastra los datos de un candidato al draft y salta al form. */
  const pickCandidate = (c: Candidate) => {
    setDraft({
      nombre: c.nombre,
      email: c.email,
      nif: c.nif ?? "",
      telefono: c.telefono ?? "",
      cargo: c.cargo ?? "",
      empresa: c.empresa,
      cif: c.cif,
      notifications: "email,sms",
      juridica: !!(c.empresa || c.cif),
    });
    setStep("form");
  };

  const goCreateNew = () => {
    setDraft(EMPTY_DRAFT);
    setStep("form");
  };

  /* Validación del form. */
  const nombreOk = draft.nombre.trim().length > 0;
  const emailOk  = isValidEmail(draft.email);
  const nifOk    = isValidNif(draft.nif);
  const phoneOk  = draft.notifications === "email"
    ? true
    : isValidPhone(draft.telefono);
  const formValid = nombreOk && emailOk && nifOk && phoneOk;

  const handleConfirm = () => {
    if (!formValid) return;
    onAdd({
      nombre: draft.nombre.trim(),
      email: draft.email.trim().toLowerCase(),
      nif: draft.nif.trim().toUpperCase(),
      telefono: draft.telefono.trim(),
      cargo: draft.cargo?.trim() || undefined,
      empresa: draft.juridica && draft.empresa ? draft.empresa.trim() : undefined,
      cif: draft.juridica && draft.cif ? draft.cif.trim().toUpperCase() : undefined,
      notifications: draft.notifications,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "pick" ? "Añadir firmante" : "Datos del firmante"}
          </DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? <>Elige una persona conocida o crea una nueva.
                  Si seleccionas una existente, se <span className="text-foreground font-medium">rellenan todos los datos automáticamente</span>.</>
              : <>Revisa los datos · puedes editarlos antes de añadir.</>
            }
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-3 py-2">
            {/* Search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="Buscar por nombre, NIF o email…"
                className="w-full h-10 pl-8 pr-3 rounded-full border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted grid place-items-center"
                  aria-label="Limpiar"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Candidatos */}
            {candidates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
                <Sparkles className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground">
                  {query
                    ? "Sin contactos coincidentes."
                    : "Sin contactos conocidos aún de esta agencia."}
                </p>
              </div>
            ) : (
              <ul className="rounded-2xl border border-border bg-card divide-y divide-border/50 overflow-hidden max-h-[320px] overflow-y-auto">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickCandidate(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors group"
                    >
                      <span className="h-9 w-9 rounded-full bg-muted/60 grid place-items-center shrink-0 text-[11px] font-semibold text-muted-foreground">
                        {initials(c.nombre) || "—"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{c.nombre}</p>
                          {c.source === "contacto-principal" && (
                            <span className="inline-flex items-center h-5 px-2 rounded-full bg-foreground/5 border border-border text-[10px] font-medium text-foreground shrink-0">
                              Contacto principal
                            </span>
                          )}
                          {c.source === "firmante-previo" && (
                            <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted/70 text-[10px] font-medium text-muted-foreground shrink-0">
                              Firmó {c.timesUsed}×
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-muted-foreground truncate">
                          {c.email}
                          {c.nif ? ` · ${c.nif}` : ""}
                          {c.cargo ? ` · ${c.cargo}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Crear nuevo */}
            <button
              type="button"
              onClick={goCreateNew}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-border bg-card hover:bg-muted/40 transition-colors text-left"
            >
              <span className="h-9 w-9 rounded-full bg-foreground/5 grid place-items-center shrink-0">
                <UserPlus className="h-4 w-4 text-foreground" strokeWidth={1.75} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Crear firmante nuevo</p>
                <p className="text-[11.5px] text-muted-foreground">
                  Rellena manualmente los datos del firmante.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              Volver a elegir contacto
            </button>

            {/* Nombre + NIF */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-2">
              <input
                value={draft.nombre}
                onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                placeholder="Nombre y apellidos"
                autoFocus
                className="h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="relative">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                <input
                  value={draft.nif}
                  onChange={(e) => setDraft({ ...draft, nif: e.target.value.toUpperCase() })}
                  placeholder="NIF / NIE"
                  className={cn(
                    "h-10 w-full pl-8 pr-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
                    draft.nif.length > 0 && !nifOk ? "border-destructive/40" : "border-border",
                  )}
                />
              </div>
            </div>

            {/* Email + Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-2">
              <div className="relative">
                <AtSign className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="email@agencia.com"
                  className={cn(
                    "h-10 w-full pl-8 pr-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
                    draft.email.length > 0 && !emailOk ? "border-destructive/40" : "border-border",
                  )}
                />
              </div>
              <div className="relative">
                <Phone className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                <input
                  value={draft.telefono}
                  onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
                  placeholder="+34 600 000 000"
                  className={cn(
                    "h-10 w-full pl-8 pr-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
                    draft.telefono.length > 0 && !phoneOk ? "border-destructive/40" : "border-border",
                  )}
                />
              </div>
            </div>

            {/* Cargo */}
            <input
              value={draft.cargo ?? ""}
              onChange={(e) => setDraft({ ...draft, cargo: e.target.value })}
              placeholder="Cargo (Apoderado, Socio, Director…)"
              className="h-10 w-full px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            {/* Notificaciones */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Notificación</span>
              <div className="inline-flex items-center gap-0.5 rounded-full bg-muted/40 border border-border p-0.5">
                {(["email", "sms", "email,sms"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDraft({ ...draft, notifications: opt })}
                    className={cn(
                      "h-6 px-2.5 rounded-full text-[11px] font-medium transition-colors",
                      draft.notifications === opt
                        ? "bg-background text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt === "email" ? "Email" : opt === "sms" ? "SMS" : "Ambos"}
                  </button>
                ))}
              </div>
            </div>

            {/* Persona jurídica · colapsable */}
            <button
              type="button"
              onClick={() => setDraft({ ...draft, juridica: !draft.juridica })}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Building2 className="h-3 w-3" strokeWidth={1.75} />
              {draft.juridica ? "Quitar datos de empresa" : "Firma como persona jurídica"}
            </button>
            {draft.juridica && (
              <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-2">
                <input
                  value={draft.empresa ?? ""}
                  onChange={(e) => setDraft({ ...draft, empresa: e.target.value })}
                  placeholder="Razón social"
                  className="h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  value={draft.cif ?? ""}
                  onChange={(e) => setDraft({ ...draft, cif: e.target.value.toUpperCase() })}
                  placeholder="CIF"
                  className="h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          {step === "form" && (
            <Button onClick={handleConfirm} disabled={!formValid} className="rounded-full">
              <Check className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
              Añadir firmante
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
