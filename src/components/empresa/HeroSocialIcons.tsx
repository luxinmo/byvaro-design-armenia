/**
 * HeroSocialIcons · fila discreta de iconos (web + redes) en el hero.
 *
 * Modo preview: solo iconos de los enlaces activos, clicables.
 * Modo edit: icono con "+" en los no configurados → abre popover
 * pequeño con input para URL. Click en icono activo → popover
 * para editar o quitar.
 */

import { useState, useRef, useEffect } from "react";
import {
  Globe, Linkedin, Instagram, Facebook, Youtube, Music2,
  X as XIcon, Check, ExternalLink, Plus,
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
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openKey) return;
    const handler = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setOpenKey(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openKey]);

  const activos = SOCIALS.filter(s => (empresa[s.key] as string).trim());

  const startEdit = (k: SocialKey) => {
    setOpenKey(k);
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

  // En modo preview: solo mostramos los activos, como iconos limpios
  if (viewMode === "preview") {
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

  // Modo edit: mostramos TODOS, los no configurados más tenues
  return (
    <div className="flex items-center gap-0.5">
      {SOCIALS.map((s) => {
        const Icon = s.icon;
        const value = empresa[s.key] as string;
        const isActive = !!value.trim();
        const isOpen = openKey === s.key;

        return (
          <div key={s.key} className="relative">
            <button
              type="button"
              onClick={() => isOpen ? setOpenKey(null) : startEdit(s.key)}
              className={cn(
                "h-8 w-8 rounded-full grid place-items-center transition-colors relative",
                isActive
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50",
                isOpen && "bg-primary/10 text-primary",
              )}
              title={isActive ? `${s.label} · ${value}` : `Añadir ${s.label}`}
              aria-label={isActive ? `Editar ${s.label}` : `Añadir ${s.label}`}
            >
              <Icon className="h-4 w-4" />
              {!isActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-card border border-border grid place-items-center">
                  <Plus className="h-1.5 w-1.5 text-muted-foreground" strokeWidth={3} />
                </span>
              )}
            </button>

            {isOpen && (
              <div
                ref={popoverRef}
                className="absolute top-full mt-1 left-0 z-50 w-[260px] bg-card border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
              >
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit(s.key);
                      if (e.key === "Escape") setOpenKey(null);
                    }}
                    placeholder={s.placeholder}
                    className="flex-1 h-8 px-2 text-[12.5px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => commit(s.key)}
                    className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center hover:bg-primary/90"
                    aria-label="Guardar"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
                {isActive && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                    <a
                      href={normalizeUrl(value, s.prefix)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-2.5 w-2.5" /> Abrir
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(s.key)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      <XIcon className="h-2.5 w-2.5" /> Quitar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
