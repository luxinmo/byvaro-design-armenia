/**
 * HeroSocialIcons · fila discreta de iconos (web + redes) en el hero.
 *
 * Preview: solo iconos de los enlaces activos.
 * Edit: todos los iconos, los no configurados en gris tenue, los
 * activos en color normal. Click abre popover (renderizado vía
 * Portal para no ser cortado por cards inferiores) con el input
 * de URL + botón guardar + botón quitar si ya hay valor.
 */

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Globe, Linkedin, Instagram, Facebook, Youtube, Music2,
  X as XIcon, Check, ExternalLink,
} from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

type SocialKey = "sitioWeb" | "linkedin" | "instagram" | "facebook" | "youtube" | "tiktok";

const SOCIALS: Array<{
  key: SocialKey;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
  prefix?: string;
}> = [
  { key: "sitioWeb",  icon: Globe,     label: "Web",       placeholder: "www.tuempresa.com" },
  { key: "linkedin",  icon: Linkedin,  label: "LinkedIn",  placeholder: "linkedin.com/company/…", prefix: "https://linkedin.com/company/" },
  { key: "instagram", icon: Instagram, label: "Instagram", placeholder: "@tu_instagram",           prefix: "https://instagram.com/" },
  { key: "facebook",  icon: Facebook,  label: "Facebook",  placeholder: "facebook.com/…",          prefix: "https://facebook.com/" },
  { key: "youtube",   icon: Youtube,   label: "YouTube",   placeholder: "youtube.com/@…",          prefix: "https://youtube.com/@" },
  { key: "tiktok",    icon: Music2,    label: "TikTok",    placeholder: "@tu_tiktok",              prefix: "https://tiktok.com/@" },
];

function normalizeUrl(value: string, prefix?: string): string {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  if (prefix && !value.includes(prefix.replace(/^https?:\/\//, ""))) return prefix + value.replace(/^@/, "");
  return `https://${value}`;
}

export function HeroSocialIcons({
  empresa, update, viewMode,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  viewMode: "edit" | "preview";
}) {
  const [openKey, setOpenKey] = useState<SocialKey | null>(null);
  const [draft, setDraft] = useState("");
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  /* Posicionar el popover bajo el botón trigger */
  useLayoutEffect(() => {
    if (!openKey) { setPopoverPos(null); return; }
    const btn = triggerRefs.current[openKey];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    // Alineamos el popover a la derecha del trigger y bajo él
    const popW = 280;
    let left = r.left + window.scrollX;
    if (left + popW > window.innerWidth - 16) left = window.innerWidth - popW - 16;
    if (left < 16) left = 16;
    setPopoverPos({ top: r.bottom + window.scrollY + 6, left });
  }, [openKey]);

  /* Cerrar al hacer click fuera */
  useEffect(() => {
    if (!openKey) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (Object.values(triggerRefs.current).some(b => b?.contains(target))) return;
      setOpenKey(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openKey]);

  const startEdit = (k: SocialKey) => {
    setOpenKey(prev => prev === k ? null : k);
    setDraft(empresa[k] as string);
  };
  const commit = (k: SocialKey) => {
    update(k, draft.trim());
    setOpenKey(null);
  };
  const remove = (k: SocialKey) => {
    update(k, "");
    setOpenKey(null);
  };

  /* Preview: solo iconos activos */
  if (viewMode === "preview") {
    const activos = SOCIALS.filter(s => (empresa[s.key] as string).trim());
    if (activos.length === 0) return null;
    return (
      <div className="flex items-center gap-1">
        {activos.map((s) => {
          const Icon = s.icon;
          return (
            <a
              key={s.key}
              href={normalizeUrl(empresa[s.key] as string, s.prefix)}
              target="_blank"
              rel="noreferrer"
              className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={s.label}
              aria-label={s.label}
            >
              <Icon className="h-4 w-4" />
            </a>
          );
        })}
      </div>
    );
  }

  /* Edit: todos los iconos, sin badges ni ruido */
  const openSocial = openKey ? SOCIALS.find(s => s.key === openKey) : null;
  const openValue = openKey ? (empresa[openKey] as string) : "";

  return (
    <>
      <div className="flex items-center gap-0.5">
        {SOCIALS.map((s) => {
          const Icon = s.icon;
          const value = empresa[s.key] as string;
          const isActive = !!value.trim();
          const isOpen = openKey === s.key;

          return (
            <button
              key={s.key}
              ref={(el) => { triggerRefs.current[s.key] = el; }}
              type="button"
              onClick={() => startEdit(s.key)}
              className={cn(
                "h-8 w-8 rounded-full grid place-items-center transition-colors",
                isOpen
                  ? "bg-primary/10 text-primary"
                  : isActive
                    ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground/35 hover:text-muted-foreground hover:bg-muted",
              )}
              title={isActive ? `${s.label} · ${value}` : `Añadir ${s.label}`}
              aria-label={isActive ? `Editar ${s.label}` : `Añadir ${s.label}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {/* Popover flotante via Portal */}
      {openKey && openSocial && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] w-[280px] bg-card border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {openSocial.label}
          </p>
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit(openKey);
                if (e.key === "Escape") setOpenKey(null);
              }}
              placeholder={openSocial.placeholder}
              className="flex-1 h-8 px-2 text-[12.5px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={() => commit(openKey)}
              className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center hover:bg-primary/90"
              aria-label="Guardar"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
          {openValue && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
              <a
                href={normalizeUrl(openValue, openSocial.prefix)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="h-2.5 w-2.5" /> Abrir
              </a>
              <button
                type="button"
                onClick={() => remove(openKey)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <XIcon className="h-2.5 w-2.5" /> Quitar
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
