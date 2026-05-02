/**
 * contactLanguagesStorage.ts · idiomas que habla cada contacto.
 *
 * Pequeño override local que permite añadir / quitar idiomas a un
 * contacto desde la propia ficha (chips + popover inline) sin tener
 * que abrir "Editar contacto". Persistido por contactId.
 *
 * Los códigos guardados son ISO 639 + región simplificada (ES, EN,
 * FR, DE, RU…) · consistentes con `src/lib/languages.ts`.
 *
 * TODO(backend): PATCH /api/contacts/:id { languages: string[] }.
 */

import { useEffect, useState } from "react";
import { memCache } from "@/lib/memCache";

const EVENT = "byvaro:contact-languages-change";

function keyFor(contactId: string): string {
  return `byvaro.contact.${contactId}.languages.v1`;
}

export function getContactLanguages(contactId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem(keyFor(contactId));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function saveContactLanguages(contactId: string, languages: string[]): void {
  if (typeof window === "undefined") return;
  memCache.setItem(keyFor(contactId), JSON.stringify(languages));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { contactId } }));
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    await mergeContactMetadata(contactId, { languages });
  })();
}

/** Hook reactivo · devuelve `null` cuando no hay override (usa el
 *  valor del seed del contacto) o el array editado por el admin. */
export function useContactLanguages(contactId: string): string[] | null {
  const [langs, setLangs] = useState<string[] | null>(() => getContactLanguages(contactId));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ contactId: string }>;
      if (ce.detail?.contactId === contactId) setLangs(getContactLanguages(contactId));
    };
    const storageHandler = () => setLangs(getContactLanguages(contactId));
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [contactId]);
  return langs;
}
