/**
 * PresenciaOnlineCard · card compacta con website + redes sociales.
 * Reemplaza la antigua QuickActionsBar. Cada enlace es editable in
 * place con el icono correspondiente.
 */

import { useState } from "react";
import {
  Globe, Linkedin, Instagram, Facebook, Youtube, Music2,
  Edit, Check, X as XIcon, ExternalLink,
} from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

type SocialKey = "sitioWeb" | "linkedin" | "instagram" | "facebook" | "youtube" | "tiktok";

interface SocialDef {
  key: SocialKey;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
  prefix?: string; // para autocompletar
}

const SOCIALS: SocialDef[] = [
  { key: "sitioWeb",  icon: Globe,     label: "Web",       placeholder: "www.tuempresa.com" },
  { key: "linkedin",  icon: Linkedin,  label: "LinkedIn",  placeholder: "linkedin.com/company/…", prefix: "https://linkedin.com/company/" },
  { key: "instagram", icon: Instagram, label: "Instagram", placeholder: "instagram.com/…", prefix: "https://instagram.com/" },
  { key: "facebook",  icon: Facebook,  label: "Facebook",  placeholder: "facebook.com/…", prefix: "https://facebook.com/" },
  { key: "youtube",   icon: Youtube,   label: "YouTube",   placeholder: "youtube.com/@…", prefix: "https://youtube.com/@" },
  { key: "tiktok",    icon: Music2,    label: "TikTok",    placeholder: "tiktok.com/@…", prefix: "https://tiktok.com/@" },
];

function normalizeUrl(value: string, prefix?: string): string {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  if (prefix && !value.includes(prefix.replace(/^https?:\/\//, ""))) return prefix + value.replace(/^@/, "");
  return `https://${value}`;
}

export function PresenciaOnlineCard({
  viewMode, empresa, update,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  const [editingKey, setEditingKey] = useState<SocialKey | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (key: SocialKey) => {
    setEditingKey(key);
    setDraft(empresa[key] as string);
  };
  const commit = (key: SocialKey) => {
    update(key, draft.trim());
    setEditingKey(null);
    setDraft("");
  };
  const cancel = () => { setEditingKey(null); setDraft(""); };

  const activos = SOCIALS.filter(s => (empresa[s.key] as string).trim().length > 0);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13.5px] font-semibold text-foreground flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          Presencia online
        </h2>
        {viewMode === "preview" && activos.length === 0 && (
          <span className="text-[11.5px] text-muted-foreground italic">Sin enlaces</span>
        )}
      </div>

      <div className="px-5 pb-5">
        {viewMode === "edit" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SOCIALS.map((s) => {
              const Icon = s.icon;
              const value = empresa[s.key] as string;
              const isEditing = editingKey === s.key;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 h-10 transition-colors",
                    isEditing ? "border-primary bg-primary/5" : "border-border bg-card hover:border-foreground/30",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit(s.key);
                          if (e.key === "Escape") cancel();
                        }}
                        placeholder={s.placeholder}
                        className="flex-1 bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/50"
                      />
                      <button type="button" onClick={() => commit(s.key)} className="p-1 rounded-full text-primary hover:bg-primary/10" aria-label="Guardar">
                        <Check className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={cancel} className="p-1 rounded-full text-muted-foreground hover:bg-muted" aria-label="Cancelar">
                        <XIcon className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(s.key)}
                        className="flex-1 text-left text-[12px] truncate text-foreground min-w-0"
                      >
                        {value || <span className="text-muted-foreground/60">{s.label}</span>}
                      </button>
                      {value ? (
                        <>
                          <a
                            href={normalizeUrl(value, s.prefix)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            aria-label="Abrir enlace"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <button type="button" onClick={() => startEdit(s.key)} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Editar">
                            <Edit className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(s.key)}
                          className="text-[10.5px] font-medium text-muted-foreground hover:text-primary transition-colors shrink-0"
                        >
                          Añadir
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : activos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activos.map((s) => {
              const Icon = s.icon;
              const value = empresa[s.key] as string;
              return (
                <a
                  key={s.key}
                  href={normalizeUrl(value, s.prefix)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 h-9 text-[12px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
