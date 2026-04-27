/**
 * DuplicateContext — contexto enriquecido al revisar un duplicado.
 *
 * Complementa al `<DuplicateResult>` con dos secciones que ayudan al
 * promotor a decidir con evidencia (Bloque H Phase 2):
 *
 *   1. "Cómo llegó este cliente al CRM" · histórico de orígenes del
 *      Contact existente (si lo encontramos por email/teléfono). Conecta
 *      con `Contact.origins[]` (Phase 1 Core).
 *
 *   2. "Atribución actual" · estado de actividad de la atribución
 *      activa con `<ActivityFreshness>`. Si el otro registro lleva
 *      ≥45 días sin actividad, banner ámbar habilita override sin
 *      penalty.
 *
 * Solo se renderiza para el promotor (la agencia ya tiene el detalle
 * del registro filtrado por privacidad cross-tenant).
 */

import { Link } from "react-router-dom";
import { Sparkles, Clock, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ActivityFreshness } from "@/components/contacts/ActivityFreshness";
import { activityLevel, daysSince } from "@/lib/contactActivity";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { loadCreatedContacts } from "@/components/contacts/createdContactsStorage";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import type { Registro } from "@/data/records";
import type { Contact } from "@/components/contacts/types";

/* ══════ Helpers ═════════════════════════════════════════════════ */

function normEmail(s?: string): string {
  return (s ?? "").trim().toLowerCase();
}
function normPhone(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Busca el Contact que matchea el cliente del registro · email o teléfono. */
function findMatchedContact(record: Registro): Contact | null {
  const email = normEmail(record.cliente.email);
  const phone = normPhone(record.cliente.telefono);
  if (!email && !phone) return null;
  const all = [...loadCreatedContacts(), ...loadImportedContacts(), ...MOCK_CONTACTS];
  return all.find((c) => {
    if (email && normEmail(c.email) === email) return true;
    if (phone && normPhone(c.phone) === phone) return true;
    return false;
  }) ?? null;
}

/* ══════ Componente ═══════════════════════════════════════════════ */

export function DuplicateContext({ record }: { record: Registro }) {
  const contact = findMatchedContact(record);

  /* Si no encontramos el contact en CRM, no hay contexto histórico
     que mostrar · solo el matchCliente del registro suelto basta. */
  if (!contact) return null;

  const level = contact.lastActivityAt ? activityLevel(contact.lastActivityAt) : "dormant";
  const days = contact.lastActivityAt ? daysSince(contact.lastActivityAt) : 0;
  const isStale = level === "dormant"; // ≥45 días sin actividad

  const sortedOrigins = [...contact.origins].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  return (
    <div className="space-y-3">
      {/* ── Sección 1 · Histórico de orígenes ── */}
      {sortedOrigins.length > 0 && (
        <section className="rounded-xl border border-border bg-card px-4 py-3">
          <header className="flex items-center gap-2 mb-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground leading-tight">
                Cómo llegó este cliente al CRM
              </p>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                {sortedOrigins.length} {sortedOrigins.length === 1 ? "canal previo" : "canales previos"} · contexto antes de decidir
              </p>
            </div>
          </header>
          <ol className="space-y-1.5">
            {sortedOrigins.map((o, idx) => (
              <li
                key={`${o.source}-${o.occurredAt}-${idx}`}
                className="flex items-center gap-2 text-[11.5px]"
              >
                <span className="text-[10px] tabular-nums text-muted-foreground/70 font-semibold shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="font-medium text-foreground truncate">{o.label}</span>
                <span className="text-muted-foreground/70 shrink-0">·</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {format(parseISO(o.occurredAt), "d MMM yyyy", { locale: es })}
                </span>
                {idx === 0 && (
                  <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                    Primer contacto
                  </span>
                )}
              </li>
            ))}
            {/* El registro entrante · destacado al final con borde dashed. */}
            <li className="flex items-center gap-2 text-[11.5px] mt-2 pt-2 border-t border-dashed border-border/50">
              <span className="text-[10px] tabular-nums text-warning font-semibold shrink-0">
                {String(sortedOrigins.length + 1).padStart(2, "0")}
              </span>
              <span className="font-semibold text-warning truncate">
                {record.origen === "direct" ? "Registro directo del promotor" : "Esta nueva solicitud"}
              </span>
              <span className="text-muted-foreground/70 shrink-0">·</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {format(parseISO(record.fecha), "d MMM yyyy", { locale: es })}
              </span>
              <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-wider text-warning bg-warning/15 px-1.5 py-0.5 rounded-full shrink-0">
                Decidir
              </span>
            </li>
          </ol>
        </section>
      )}

      {/* ── Sección 2 · Atribución actual + freshness ── */}
      <section className={cn(
        "rounded-xl border px-4 py-3",
        isStale
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card",
      )}>
        <header className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "h-7 w-7 rounded-lg grid place-items-center shrink-0",
              isStale ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
            )}>
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className={cn(
                "text-[11px] font-bold uppercase tracking-[0.14em] leading-tight",
                isStale ? "text-destructive" : "text-foreground",
              )}>
                Atribución actual
              </p>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                {contact.name} · en CRM como {contact.primarySource?.label ?? "—"}
              </p>
            </div>
          </div>
          <ActivityFreshness lastActivityAt={contact.lastActivityAt} />
        </header>

        {isStale && (
          <p className="text-[11.5px] text-destructive/90 leading-relaxed mt-2">
            ⚠ Sin actividad desde hace {days} días · supera el umbral de
            45 días. Puedes reasignar la atribución al nuevo registro
            con override · queda auditado en historial.
          </p>
        )}

        {!isStale && level === "inactive" && (
          <p className="text-[11.5px] text-warning leading-relaxed mt-2">
            Inactividad moderada ({days} días) · revisa antes de aprobar.
          </p>
        )}

        <Link
          to={`/contactos/${contact.id}`}
          className="text-[11px] font-semibold text-foreground hover:underline mt-2 inline-flex items-center gap-1"
        >
          Ver ficha completa del contacto <ExternalLink className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}
