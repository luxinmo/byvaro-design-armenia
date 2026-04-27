/**
 * CrossPromotionWarning · banner en el detalle del registro.
 *
 * Detecta si el cliente entrante (por email o teléfono) ya está
 * ACTIVO en otra promoción del MISMO workspace (aprobado o con
 * venta). Indica posible conflicto de comisión · la agencia podría
 * estar intentando registrar a un cliente que ya pertenece a otra.
 *
 * Este es un diferencial del producto mencionado en la regla de oro
 * "IA de duplicados cross-promoción" · hoy se detectaba solo dentro
 * de una misma promoción.
 *
 * TODO(backend): moverse a `GET /api/records/:id/cross-check` que
 * cruce con toda la base del tenant + respete RLS.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { registros as SEED_REGISTROS, type Registro } from "@/data/records";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { promotions } from "@/data/promotions";

/** Normaliza email/tel para comparar · case-insensitive, sin
 *  espacios y solo dígitos para el teléfono. */
function normalizeEmail(s?: string): string {
  return (s ?? "").trim().toLowerCase();
}
function normalizePhoneDigits(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

type CrossHit = {
  registro: Registro;
  promotionName: string;
  matchedOn: ("email" | "telefono")[];
};

/** Busca otros registros APROBADOS del workspace con el mismo
 *  email/teléfono pero en OTRA promoción. Devuelve hasta 3 hits. */
function findCrossPromotionHits(
  current: Registro,
  all: Registro[],
): CrossHit[] {
  const myEmail = normalizeEmail(current.cliente.email);
  const myPhone = normalizePhoneDigits(current.cliente.telefono);
  if (!myEmail && !myPhone) return [];

  const hits: CrossHit[] = [];
  for (const r of all) {
    if (r.id === current.id) continue;
    if (r.estado !== "aprobado") continue;          // solo aprobados cuentan como conflicto
    if (r.promotionId === current.promotionId) continue; // misma promo = duplicado normal, ya lo cubre la IA
    const matched: ("email" | "telefono")[] = [];
    const otherEmail = normalizeEmail(r.cliente.email);
    const otherPhone = normalizePhoneDigits(r.cliente.telefono);
    if (myEmail && otherEmail && myEmail === otherEmail) matched.push("email");
    if (myPhone && otherPhone && myPhone === otherPhone) matched.push("telefono");
    if (matched.length === 0) continue;
    const promotionName = promotions.find((p) => p.id === r.promotionId)?.name ?? r.promotionId;
    hits.push({ registro: r, promotionName, matchedOn: matched });
    if (hits.length >= 3) break;
  }
  return hits;
}

type Props = {
  record: Registro;
  className?: string;
};

export function CrossPromotionWarning({ record, className }: Props) {
  const created = useCreatedRegistros();
  const hits = useMemo(
    () => findCrossPromotionHits(record, [...created, ...SEED_REGISTROS]),
    [record, created],
  );

  if (hits.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 p-3.5",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive grid place-items-center shrink-0">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-destructive leading-snug">
            Posible conflicto cross-promoción
          </p>
          <p className="text-[11.5px] text-foreground mt-1 leading-relaxed">
            Este cliente ya está aprobado en {hits.length === 1 ? "otra promoción" : `${hits.length} promociones`} del workspace. Revisa antes de aprobar para evitar conflictos de comisión.
          </p>
          <ul className="mt-2.5 space-y-1">
            {hits.map((h) => {
              const matchedLabel = h.matchedOn.join(" + ");
              const agencyNote = h.registro.agencyId ? " · otra agencia" : " · promotor directo";
              return (
                <li key={h.registro.id}>
                  <Link
                    to={`/registros?active=${h.registro.id}`}
                    className="flex items-center justify-between gap-2 text-[11.5px] text-foreground hover:text-destructive transition-colors py-1"
                  >
                    <span className="truncate inline-flex items-center gap-1.5">
                      <span className="font-semibold">{h.promotionName}</span>
                      {h.registro.publicRef && (
                        <span className="font-mono tabular-nums text-[10px] text-muted-foreground">
                          ({h.registro.publicRef})
                        </span>
                      )}
                      <span className="text-muted-foreground"> · coincide por {matchedLabel}{agencyNote}</span>
                    </span>
                    <ArrowUpRight className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
