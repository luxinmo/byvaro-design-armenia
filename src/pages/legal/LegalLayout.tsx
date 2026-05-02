/**
 * Layout compartido por las páginas legales públicas
 * (`/legal/terminos` y `/legal/privacidad`).
 *
 * Render fuera de `<RequireAuth>` · accesible sin sesión para que
 * cualquier usuario pueda revisar T&C y privacidad antes de
 * registrarse o desde un email externo.
 */

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export function LegalLayout({
  title,
  version,
  updatedAt,
  children,
}: {
  title: string;
  version: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center">
            <BrandLogo variant="lockup" iconSize={32} wordmarkHeight={16} />
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al registro
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Documento legal · v{version} · Actualizado {updatedAt}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
            {title}
          </h1>
        </div>

        <article
          className={[
            "max-w-none",
            "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight",
            "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold",
            "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/85",
            "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5",
            "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5",
            "[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-foreground/85",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            "[&_a]:text-primary [&_a]:font-medium hover:[&_a]:underline",
            "[&_em]:italic",
          ].join(" ")}
        >
          {children}
        </article>

        <footer className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground">
          © {new Date().getFullYear()} Byvaro · Si tienes dudas legales,
          escríbenos a{" "}
          <a href="mailto:legal@byvaro.com" className="text-primary hover:underline">
            legal@byvaro.com
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
