/**
 * contactAvatarStorage.ts · persistir foto del contacto (mock).
 *
 * El admin puede subir una foto para cada cliente desde la ficha del
 * contacto. Se guarda como data URL (JPEG) producido por PhotoCropModal
 * en `localStorage` con clave por contacto.
 *
 * TODO(backend): PATCH /api/contacts/:id { avatarUrl } subido a
 *   storage (Vercel Blob / S3) y devuelto como URL firmada.
 */

import { useEffect, useState } from "react";
import { memCache } from "@/lib/memCache";

const EVENT = "byvaro:contact-avatar-change";

function keyFor(contactId: string): string {
  return `byvaro.contact.${contactId}.avatar.v1`;
}

export function getContactAvatar(contactId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return memCache.getItem(keyFor(contactId));
  } catch {
    return null;
  }
}

export function saveContactAvatar(contactId: string, dataUrl: string | null): void {
  if (typeof window === "undefined") return;
  const key = keyFor(contactId);
  if (dataUrl) {
    memCache.setItem(key, dataUrl);
  } else {
    memCache.removeItem(key);
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { contactId } }));
  /* Write-through · contacts.metadata.avatarUrl */
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    await mergeContactMetadata(contactId, { avatarUrl: dataUrl });
  })();
}

/** Hook reactivo · se re-renderiza cuando el avatar de este contacto cambia. */
export function useContactAvatar(contactId: string): string | null {
  const [avatar, setAvatar] = useState<string | null>(() => getContactAvatar(contactId));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ contactId: string }>;
      if (ce.detail?.contactId === contactId) setAvatar(getContactAvatar(contactId));
    };
    const storageHandler = () => setAvatar(getContactAvatar(contactId));
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [contactId]);
  return avatar;
}
