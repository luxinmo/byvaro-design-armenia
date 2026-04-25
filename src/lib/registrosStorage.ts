/**
 * registrosStorage.ts · Registros creados por el usuario (mock en localStorage).
 *
 * QUÉ
 * ----
 * Los registros "base" viven en `src/data/records.ts` (seed). Cuando el
 * usuario dispara "Registrar cliente" desde la ficha de una promoción,
 * construimos un `Registro` y lo guardamos aquí para que luego se vea
 * listado en `/registros` junto con los mocks de origen.
 *
 * CÓMO
 * ----
 * Clave en localStorage: `byvaro.registros.created.v1`. El hook
 * `useCreatedRegistros()` se suscribe a un evento custom y al evento
 * `storage` para reaccionar a cambios en vivo o desde otra pestaña.
 *
 * TODO(backend): sustituir por POST /api/promociones/:id/registros y
 * un GET que devuelva los que pertenecen al usuario según RLS.
 */

import { useEffect, useState } from "react";
import { registros as SEED_REGISTROS, type Registro } from "@/data/records";

const STORAGE_KEY = "byvaro.registros.created.v1";
const CHANGE_EVENT = "byvaro:registros-change";

function read(): Registro[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Registro[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Registro[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/* ══════ Helpers de normalización · "first-come silent" ══════════ */

function normEmail(s?: string): string {
  return (s ?? "").trim().toLowerCase();
}
function normPhone(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Busca un registro PENDIENTE existente con el mismo cliente
 *  (email o teléfono normalizados) en la MISMA promoción.
 *  Cruza la lista creada + el seed.
 *
 *  IMPORTANTE: la regla "first-come silent" aplica SOLO dentro de
 *  la misma promoción. Un mismo cliente puede tener registros en
 *  promociones distintas (potencial cliente cross-sell) · no es
 *  conflicto de comisión y no se silencia. El conflicto cross-promo
 *  cuando el cliente YA ESTÁ APROBADO en otra promo se gestiona en
 *  `CrossPromotionWarning` con un banner al promotor. */
function findPendingDuplicate(input: Registro): Registro | undefined {
  const email = normEmail(input.cliente.email);
  const phone = normPhone(input.cliente.telefono);
  if (!email && !phone) return undefined;
  const all = [...read(), ...SEED_REGISTROS];
  return all.find((r) => {
    if (r.estado !== "pendiente") return false;
    if (r.promotionId !== input.promotionId) return false; // distinta promo · no es conflicto
    if (r.id === input.id) return false; // evita match consigo mismo
    if (email && normEmail(r.cliente.email) === email) return true;
    if (phone && normPhone(r.cliente.telefono) === phone) return true;
    return false;
  });
}

/**
 * Añade un registro a la cola.
 *
 * Regla "first-come silent" (CLAUDE.md futuro · ver `docs/screens/registros.md`):
 *   · Si ya hay otro registro PENDIENTE con el mismo cliente (email o
 *     teléfono normalizados), el nuevo entra automáticamente como
 *     `estado: "duplicado"` con `matchWith` apuntando al ganador.
 *   · NO se notifica a ninguna agencia · es lógica interna.
 *   · El promotor solo verá el ganador en la cola de pendientes.
 *   · El perdedor solo aparece si filtra por estado "Duplicados".
 */
export function addCreatedRegistro(r: Registro) {
  const winner = findPendingDuplicate(r);
  const finalRegistro: Registro = winner
    ? {
        ...r,
        estado: "duplicado",
        matchPercentage: 100,
        matchWith: `Registrado primero por ${winner.id}`,
        matchCliente: { ...winner.cliente },
      }
    : r;
  const list = read();
  write([finalRegistro, ...list]);
}

export function removeCreatedRegistro(id: string) {
  write(read().filter((r) => r.id !== id));
}

export function useCreatedRegistros(): Registro[] {
  const [list, setList] = useState<Registro[]>(read);
  useEffect(() => {
    const cb = () => setList(read());
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return list;
}
