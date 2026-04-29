/**
 * Contratos de colaboración entre un promotor y una agencia.
 *
 * MVP mock · el usuario sube un PDF desde su máquina, lo envía a
 * firmar (Firmafy) y aquí guardamos solo los metadatos. No parseamos
 * el PDF ni lo alojamos · cuando se conecte el backend real, el PDF
 * se sube a S3/Blob storage y Firmafy controla el documento firmable.
 *
 * Estados:
 *   · draft   → subido pero no enviado.
 *   · sent    → enviado a firmar (email a la agencia con link Firmafy).
 *   · viewed  → el firmante abrió el link (webhook Firmafy · futuro).
 *   · signed  → firmado por todas las partes.
 *   · expired → no firmado antes del plazo.
 *   · revoked → el promotor canceló antes de firmar.
 *
 * TODO(backend):
 *   · `GET /api/agencias/:id/contracts` → CollaborationContract[]
 *   · `POST /api/agencias/:id/contracts` (multipart PDF + metadata)
 *     → crea draft y devuelve `id`, `pdfUrl`.
 *   · `POST /api/contracts/:id/send-to-sign` → dispara Firmafy,
 *     devuelve `firmafyDocId` + `signUrl` para cada firmante.
 *   · `POST /api/webhooks/firmafy` → actualiza estado (viewed, signed,
 *     expired) y almacena el PDF firmado resultante.
 */

import { useCallback, useEffect, useState } from "react";

/**
 * Umbral canónico de "contrato próximo a vencer" · 60 días.
 *
 * REGLA DE ORO (CLAUDE.md "Contratos · alerta a 60 días"): toda UI
 * que muestre estado de contrato firmado con `expiresAt` debe avisar
 * cuando queden ≤ 60 días para que el promotor tenga margen para
 * renegociar/renovar. No usar 30 (no da tiempo a firmar uno nuevo) ni
 * 90 (alerta prematura · ruidoso). Cambiar este número aquí impacta
 * a TODOS los consumidores · es la fuente única de verdad.
 *
 * Consumidores actuales:
 *   · `getContractStatus()` en `src/data/agencies.ts` · chip global de
 *     la agencia (panel header, listado /colaboradores, AgenciasTabStats).
 *   · `ResumenTab.tsx` · chip por promoción ("Vence en Xd").
 */
export const CONTRACT_NEAR_EXPIRY_DAYS = 60;

/** Días hasta caducidad de un contrato firmado · null si no expira
 *  o no está firmado · negativo si ya caducó. */
export function daysUntilContractExpiry(
  c: Pick<CollaborationContract, "status" | "expiresAt" | "archived">,
  refDate: Date = new Date(),
): number | null {
  if (c.archived) return null;
  if (c.status !== "signed") return null;
  if (!c.expiresAt) return null;
  return Math.ceil((c.expiresAt - refDate.getTime()) / (24 * 60 * 60 * 1000));
}

export type ContractStatus =
  | "draft" | "sent" | "viewed" | "signed" | "expired" | "revoked";

export interface ContractEvent {
  id: string;
  type: "uploaded" | "sent" | "viewed" | "signed" | "expired" | "revoked" | "archived" | "unarchived";
  at: number;
  by?: { name: string; email?: string };
  /** Mensaje opcional (p. ej. motivo de revocación). */
  note?: string;
}

/** Firmante de un contrato · campos alineados con la API de Firmafy.
 *
 * Los nombres coinciden con el payload de `action=request`:
 * `nombre, nif, cargo, email, telefono, empresa, cif, type_notifications`.
 * Así el adapter que construye el request real a Firmafy es trivial
 * · no traducimos campos, solo transferimos.
 */
export interface ContractSigner {
  /** Nombre completo del firmante (Firmafy: `nombre`). */
  nombre: string;
  /** DNI / NIE / Pasaporte (Firmafy: `nif` · obligatorio). */
  nif: string;
  /** Email del firmante (Firmafy: `email`). */
  email: string;
  /** Teléfono con prefijo internacional · Firmafy usa SMS para el
   *  OTP de firma (`telefono`). */
  telefono: string;
  /** Rol en la agencia (Firmafy: `cargo` · ej. "Apoderado", "Socio"). */
  cargo?: string;
  /** Persona jurídica · razón social si aplica (Firmafy: `empresa`). */
  empresa?: string;
  /** CIF de la empresa firmante (Firmafy: `cif`). */
  cif?: string;
  /** Canales de notificación para invitar a firmar.
   *  · `email`       → solo email.
   *  · `sms`         → solo SMS (sigue requiriendo tel).
   *  · `email,sms`   → ambos (recomendado · el OTP siempre va por SMS). */
  notifications: "email" | "sms" | "email,sms";
  /** Orden de firma si `CollaborationContract.signerPriority=true` ·
   *  lower number = firma antes. */
  orderIndex?: number;
  /** URL de firma única que Firmafy devuelve al crear el proceso ·
   *  se guarda para poder copiarla/abrirla desde la UI. */
  signUrl?: string;
  /** Estado individual del firmante (en contraste con el estado
   *  global del contrato). `pending` hasta firmar · `signed` tras
   *  completar · `rejected` si rechaza. */
  signerStatus?: "pending" | "delivered" | "read" | "signed" | "rejected";
  /** Timeline de tracking · viene de webhooks de Firmafy `type=2`.
   *  Todos los campos son timestamps. */
  tracking?: {
    /** Momento del envío inicial (email o SMS). */
    sentAt?: number;
    /** Entregado en bandeja del destinatario. */
    deliveredAt?: number;
    /** El firmante abrió el email. */
    openedAt?: number;
    /** El firmante abrió el documento dentro del flujo de firma. */
    documentReadAt?: number;
  };
  /** Se rellena desde el webhook de Firmafy al completar la firma. */
  signedAt?: number;
}

export interface CollaborationContract {
  id: string;
  agencyId: string;
  /** Nombre descriptivo dado por el promotor (p.ej. "Contrato 2026 –
   *  Villa Serena"). */
  title: string;
  /** Nombre del archivo original. Mock · en producción sería objectKey. */
  pdfFilename: string;
  /** Tamaño en bytes (para mostrar en UI). */
  pdfSize?: number;
  status: ContractStatus;
  /** ISO date del envío a firma. */
  sentAt?: number;
  /** ISO date de firma por todas las partes. */
  signedAt?: number;
  /** ISO date de caducidad del contrato (cuando `status === "signed"`). */
  expiresAt?: number;
  /** Firmantes · shape Firmafy. */
  signers: ContractSigner[];
  /** Comisión pactada en este contrato (% sobre precio). */
  comision?: number;
  /** Duración pactada en meses (0 = indefinida). */
  duracionMeses?: number;
  /** Promociones cubiertas (vacío = todas las del promotor). */
  scopePromotionIds?: string[];
  createdBy?: { name: string; email?: string };
  createdAt: number;
  events: ContractEvent[];

  /* ─── Campos específicos de Firmafy ─── */
  /** CSV identificador de Firmafy · se rellena al enviar a firma
   *  (Firmafy lo devuelve en `data` de `action=request`). Sustituye
   *  al viejo `firmafyDocId` — mantenemos compat renombrando internamente. */
  csv?: string;
  /** Email que recibe avisos del estado del contrato. Por defecto es
   *  el del `createdBy.email`, pero el promotor puede cambiarlo
   *  (p. ej. cuentas de operaciones en vez de la del creador). */
  notificationEmail?: string;
  /** Modo de envío del contrato al firmante. Firmafy distingue:
   *  - `form`    → Firma con Formulario (default) · el firmante abre
   *                un form con sus datos pre-rellenos.
   *  - `link`    → Link directo de firma.
   *  - `email`   → Email con el PDF adjunto.
   *  - `sms`     → SMS con link corto. */
  shipmentType?: "form" | "link" | "email" | "sms";
  /** Asunto del email que reciben los firmantes. Si vacío, Firmafy usa
   *  su plantilla por defecto del tenant. */
  subject?: string;
  /** Cuerpo del email que reciben los firmantes. Si vacío → default. */
  message?: string;
  /** Idioma de la comunicación · Firmafy soporta ES/EN/IT/FR/CA. */
  language?: "es" | "en" | "fr" | "it" | "ca";
  /** Firma secuencial · respeta `signers[].orderIndex` (Firmafy:
   *  `signer_priority=true`). Si `false`, todos reciben a la vez. */
  signerPriority?: boolean;
  /** URLs que devuelve Firmafy en el webhook al firmar · guardamos
   *  para descargar desde la UI sin re-consultar. */
  docSignedUrl?: string;
  docAuditUrl?: string;
  /** Archivado · sale del listado principal y va a la sub-sección
   *  "Archivados" al pie. No se borra · recuperable con "Desarchivar". */
  archived?: boolean;
  archivedAt?: number;

  /* ─── Renovación / sustitución ───
   * Cuando un contrato se sube como RENOVACIÓN del/los contrato(s)
   * anteriores que cubrían la misma promoción, guardamos la cadena
   * de cambio para que la UI de Documentación pueda mostrar el
   * cross-reference: "Sustituye a {contrato X} por renovación" en
   * el nuevo y "Sustituido por {contrato Y} por renovación · fecha"
   * en el antiguo (que queda archivado automáticamente). */

  /** IDs de contratos a los que sustituye este (los antiguos quedaron
   *  archivados con `replacedByContractId === this.id`). */
  replacesContractIds?: string[];
  /** ID del contrato que sustituyó a este (ya archivado). */
  replacedByContractId?: string;
}

const STORAGE_KEY = "byvaro.collaborationContracts.v1";
const CHANGE_EVENT = "byvaro:collab-contracts-changed";

function readStore(): CollaborationContract[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeStore(list: CollaborationContract[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getContractsForAgency(agencyId: string): CollaborationContract[] {
  return readStore().filter((c) => c.agencyId === agencyId);
}

/** Devuelve TODOS los contratos del workspace (cruzando agencias). */
export function getAllContracts(): CollaborationContract[] {
  return readStore();
}

/** Subir un contrato como borrador. El PDF vive solo por su nombre
 *  (mock). Devuelve el contrato creado. */
export function uploadContract(data: {
  agencyId: string;
  title: string;
  pdfFilename: string;
  pdfSize?: number;
  signers: ContractSigner[];
  comision?: number;
  duracionMeses?: number;
  scopePromotionIds?: string[];
  subject?: string;
  message?: string;
  language?: CollaborationContract["language"];
  signerPriority?: boolean;
  /** Fecha hasta la que los firmantes pueden firmar. Si se omite,
   *  `sendContractToSign` le asigna 30 días por defecto. */
  expiresAt?: number;
  /** Si se indica, el contrato se sube ya firmado (PDF firmado fuera
   *  de Byvaro) · status inicial = "signed", sin pasar por Firmafy.
   *  Es una vía para archivar contratos históricos. */
  alreadySignedAt?: number;
  /** Si `alreadySignedAt`, índices de firmantes que efectivamente
   *  firmaron. Si vacío/undefined, se asume que todos. */
  alreadySignedSignerIndices?: number[];
  /** Si se indica, este contrato sustituye al/los listados (renovación).
   *  Cada antiguo queda archivado automáticamente con
   *  `replacedByContractId = newId` + evento "Sustituido por
   *  renovación · contrato {newId}". */
  replacesContractIds?: string[];
  actor?: { name: string; email?: string };
}): CollaborationContract {
  const now = Date.now();
  const isPreSigned = !!data.alreadySignedAt;
  const signedAt = data.alreadySignedAt ?? null;
  const signedIdxSet = new Set(data.alreadySignedSignerIndices ?? data.signers.map((_, i) => i));

  const contract: CollaborationContract = {
    id: `ctr-${now}-${Math.random().toString(36).slice(2, 6)}`,
    agencyId: data.agencyId,
    title: data.title,
    pdfFilename: data.pdfFilename,
    pdfSize: data.pdfSize,
    status: isPreSigned ? "signed" : "draft",
    signedAt: isPreSigned ? (signedAt ?? now) : undefined,
    signers: data.signers.map((s, i) => ({
      ...s,
      orderIndex: data.signerPriority ? (s.orderIndex ?? i) : undefined,
      /* Si el contrato se sube ya firmado, marcamos los firmantes
         indicados como firmados en la misma fecha. */
      signerStatus: isPreSigned && signedIdxSet.has(i) ? "signed" as const : undefined,
      signedAt: isPreSigned && signedIdxSet.has(i) ? (signedAt ?? now) : undefined,
    })),
    comision: data.comision,
    duracionMeses: data.duracionMeses,
    scopePromotionIds: data.scopePromotionIds,
    subject: data.subject,
    message: data.message,
    language: data.language ?? "es",
    signerPriority: data.signerPriority,
    expiresAt: data.expiresAt,
    replacesContractIds: data.replacesContractIds && data.replacesContractIds.length > 0
      ? data.replacesContractIds
      : undefined,
    createdBy: data.actor,
    createdAt: now,
    events: isPreSigned
      ? [
          { id: `ev-${now}-up`,     type: "uploaded", at: now, by: data.actor,
            note: `Subido ya firmado · ${data.pdfFilename}` },
          { id: `ev-${now}-signed`, type: "signed",   at: signedAt ?? now,
            by: data.actor ?? { name: "Fuera de Byvaro" },
            note: "Contrato firmado fuera de Byvaro · archivado como firmado" },
        ]
      : [{
          id: `ev-${now}-up`,
          type: "uploaded",
          at: now,
          by: data.actor,
          note: `Subido ${data.pdfFilename}`,
        }],
  };
  /* Si es renovación · auto-archiva los contratos sustituidos con
     cross-reference + evento explicativo. La UI de Documentación lee
     `replacedByContractId` y `replacesContractIds` para pintar el
     "Sustituido por renovación · contrato {X}" / "Sustituye al
     contrato {Y} por renovación". */
  let store = [contract, ...readStore()];
  if (data.replacesContractIds && data.replacesContractIds.length > 0) {
    const replaceSet = new Set(data.replacesContractIds);
    store = store.map((c) =>
      replaceSet.has(c.id)
        ? {
            ...c,
            archived: true,
            archivedAt: now,
            replacedByContractId: contract.id,
            events: [
              ...c.events,
              {
                id: `ev-${now}-renew-arch`,
                type: "archived" as const,
                at: now,
                by: data.actor,
                note: `Sustituido por renovación · contrato "${contract.title}"`,
              },
            ],
          }
        : c,
    );
  }
  writeStore(store);
  return contract;
}

/** Envía el contrato a firmar. En mock solo cambia estado y registra
 *  evento simulando la llamada a Firmafy. En producción, este helper
 *  llamará al backend (`POST /api/contracts/:id/send-to-sign`) que a
 *  su vez hace `action=request` contra Firmafy y guarda el `csv`
 *  devuelto. */
export function sendContractToSign(
  contractId: string,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  const list = readStore().map((c) => {
    if (c.id !== contractId) return c;
    /* Mock del csv + URL de firma por firmante. En producción viene
       del backend que invoca Firmafy. */
    const csv = `CSVMOCK-${now}`;
    return {
      ...c,
      status: "sent" as ContractStatus,
      sentAt: now,
      csv,
      /* Si no se fijó expiración en el upload, asignar 30 días por
         defecto al enviar (alineado con Firmafy). */
      expiresAt: c.expiresAt ?? (now + 30 * 24 * 60 * 60 * 1000),
      notificationEmail: c.notificationEmail ?? c.createdBy?.email,
      shipmentType: c.shipmentType ?? "form",
      signers: c.signers.map((s, i) => ({
        ...s,
        signerStatus: "pending" as const,
        signUrl: s.signUrl ?? `https://app.firmafy.com/firmar/?c=${csv}-${i}`,
        tracking: { sentAt: now, ...s.tracking },
      })),
      events: [
        ...c.events,
        { id: `ev-${now}-sent`, type: "sent" as const, at: now, by: actor,
          note: `Enviado a ${c.signers.map((s) => s.email).join(", ")}` },
      ],
    };
  });
  writeStore(list);
}

/** Simula lo que hará el webhook de Firmafy al firmar todas las
 *  partes · en prod el endpoint `/api/webhooks/firmafy` actualiza
 *  estado + URLs de docsigned/docaudit + events. */
export function markContractSigned(
  contractId: string,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  const list = readStore().map((c) => {
    if (c.id !== contractId) return c;
    return {
      ...c,
      status: "signed" as ContractStatus,
      signedAt: now,
      signers: c.signers.map((s) => ({
        ...s,
        signerStatus: "signed" as const,
        signedAt: now,
        tracking: {
          /* Si alguno de los pasos intermedios no se rellenó, se
             asume que pasó · solo para que la timeline muestre coherencia. */
          sentAt:         s.tracking?.sentAt         ?? s.signedAt ?? now - 3600_000,
          deliveredAt:    s.tracking?.deliveredAt    ?? now - 3500_000,
          openedAt:       s.tracking?.openedAt       ?? now - 1800_000,
          documentReadAt: s.tracking?.documentReadAt ?? now - 900_000,
        },
      })),
      docSignedUrl: `mock://firmafy/${c.csv ?? c.id}/signed.pdf`,
      docAuditUrl:  `mock://firmafy/${c.csv ?? c.id}/audit.pdf`,
      events: [
        ...c.events,
        { id: `ev-${now}-signed`, type: "signed" as const, at: now, by: actor ?? { name: "Firmafy" } },
      ],
    };
  });
  writeStore(list);
}

export function revokeContract(
  contractId: string,
  actor?: { name: string; email?: string },
  reason?: string,
) {
  const now = Date.now();
  const list = readStore().map((c) => {
    if (c.id !== contractId) return c;
    return {
      ...c,
      status: "revoked" as ContractStatus,
      events: [
        ...c.events,
        { id: `ev-${now}-rev`, type: "revoked" as const, at: now, by: actor, note: reason },
      ],
    };
  });
  writeStore(list);
}

export function deleteContract(contractId: string) {
  writeStore(readStore().filter((c) => c.id !== contractId));
}

/** Mueve el contrato a la sub-sección "Archivados" · no se borra. */
export function archiveContract(
  contractId: string,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  writeStore(readStore().map((c) =>
    c.id === contractId
      ? {
          ...c,
          archived: true,
          archivedAt: now,
          events: [
            ...c.events,
            { id: `ev-${now}-arch`, type: "archived" as const, at: now, by: actor,
              note: "Contrato archivado" },
          ],
        }
      : c,
  ));
}

/** Devuelve el contrato archivado al listado principal. */
export function unarchiveContract(
  contractId: string,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  writeStore(readStore().map((c) =>
    c.id === contractId
      ? {
          ...c,
          archived: false,
          archivedAt: undefined,
          events: [
            ...c.events,
            { id: `ev-${now}-unarch`, type: "unarchived" as const, at: now, by: actor,
              note: "Contrato desarchivado" },
          ],
        }
      : c,
  ));
}

/** Editar datos de un firmante (email / teléfono / etc) entre el
 *  momento del envío y la firma. Firmafy permite mutar estos campos
 *  antes de que firme. */
export function updateContractSigner(
  contractId: string,
  signerIndex: number,
  patch: Partial<ContractSigner>,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  writeStore(readStore().map((c) => {
    if (c.id !== contractId) return c;
    const signers = c.signers.map((s, i) => i === signerIndex ? { ...s, ...patch } : s);
    const changedFields = Object.keys(patch).join(", ");
    return {
      ...c,
      signers,
      events: [
        ...c.events,
        { id: `ev-${now}-edit`, type: "sent" as const /* placeholder */, at: now, by: actor,
          note: `Firmante actualizado (${changedFields})` },
      ],
    };
  }));
}

/** Reenvía el aviso al firmante por un canal concreto · mock simula
 *  que Firmafy reenvía el email/SMS/WhatsApp/OTP. */
export function resendToSigner(
  contractId: string,
  signerIndex: number,
  channel: "email" | "sms" | "whatsapp" | "otp",
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  writeStore(readStore().map((c) => {
    if (c.id !== contractId) return c;
    const signers = c.signers.map((s, i) => {
      if (i !== signerIndex) return s;
      const tracking = { ...(s.tracking ?? {}) };
      if (channel === "email" || channel === "sms") tracking.sentAt = now;
      return { ...s, tracking };
    });
    return {
      ...c,
      signers,
      events: [
        ...c.events,
        { id: `ev-${now}-resend`, type: "sent" as const, at: now, by: actor,
          note: `Reenvío por ${channel} a ${c.signers[signerIndex]?.email ?? ""}` },
      ],
    };
  }));
}

/** Extender la fecha de vencimiento. Firmafy permite mutarla antes
 *  de que el contrato caduque. */
export function extendContractExpiration(
  contractId: string,
  newExpiresAt: number,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  writeStore(readStore().map((c) => {
    if (c.id !== contractId) return c;
    const prevDate = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("es-ES") : "—";
    const nextDate = new Date(newExpiresAt).toLocaleDateString("es-ES");
    return {
      ...c,
      expiresAt: newExpiresAt,
      events: [
        ...c.events,
        { id: `ev-${now}-expext`, type: "sent" as const, at: now, by: actor,
          note: `Vencimiento extendido: ${prevDate} → ${nextDate}` },
      ],
    };
  }));
}

/** Cambio directo de estado por admin · útil para casos edge
 *  (ej. confirmar que se firmó offline). En prod estaría muy
 *  restringido · aquí registramos el cambio con trazabilidad. */
export function forceContractStatus(
  contractId: string,
  newStatus: ContractStatus,
  actor?: { name: string; email?: string },
  reason?: string,
) {
  const now = Date.now();
  writeStore(readStore().map((c) => {
    if (c.id !== contractId) return c;
    return {
      ...c,
      status: newStatus,
      signedAt: newStatus === "signed" ? now : c.signedAt,
      events: [
        ...c.events,
        { id: `ev-${now}-force`, type: newStatus as any, at: now, by: actor,
          note: `Estado forzado a "${newStatus}"${reason ? ` · ${reason}` : ""}` },
      ],
    };
  }));
}

/** Hook reactivo. */
export function useContractsForAgency(agencyId: string): CollaborationContract[] {
  const [list, setList] = useState<CollaborationContract[]>(() => getContractsForAgency(agencyId));
  useEffect(() => {
    const cb = () => setList(getContractsForAgency(agencyId));
    cb();
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, [agencyId]);
  return list;
}

/** Hook reactivo · todos los contratos del workspace (cruzando
 *  agencias). Usado en la página global `/contratos`. */
export function useAllContracts(): CollaborationContract[] {
  const [list, setList] = useState<CollaborationContract[]>(() => getAllContracts());
  useEffect(() => {
    const cb = () => setList(getAllContracts());
    cb();
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return list;
}

/** Config de labels y clases por estado. */
export const CONTRACT_STATUS: Record<ContractStatus, {
  label: string;
  tone: "muted" | "primary" | "success" | "warning" | "destructive";
}> = {
  draft:   { label: "Borrador",         tone: "muted" },
  sent:    { label: "Enviado a firmar", tone: "primary" },
  viewed:  { label: "Visto",            tone: "primary" },
  signed:  { label: "Firmado",          tone: "success" },
  expired: { label: "Expirado",         tone: "warning" },
  revoked: { label: "Revocado",         tone: "destructive" },
};

/** Estado derivado para mostrar en UI · distingue "parcialmente
 *  firmado" cuando algunos firmantes han firmado y otros no. */
export function getDerivedStatus(c: CollaborationContract): {
  label: string;
  tone: "muted" | "primary" | "success" | "warning" | "destructive";
} {
  if (c.status === "signed" || c.status === "draft" || c.status === "expired" || c.status === "revoked") {
    return CONTRACT_STATUS[c.status];
  }
  /* sent/viewed · revisar si hay firmas parciales. */
  const total = c.signers.length;
  const signed = c.signers.filter((s) => !!s.signedAt).length;
  if (signed > 0 && signed < total) {
    return { label: `Parcialmente firmado (${signed}/${total})`, tone: "primary" };
  }
  return CONTRACT_STATUS[c.status];
}
