/**
 * Highlight · resalta en amarillo coincidencias del query dentro de
 * un texto. Case-insensitive, regex-safe (escapa meta-chars), soporta
 * múltiples ocurrencias.
 *
 * Uso:
 *   <Highlight text="Iberia Homes" query="iberia" />
 *
 * Reusable en cualquier listado con search (Contactos, Ajustes,
 * Promociones, etc.).
 */

interface Props {
  text: string;
  query: string;
  /** Clases custom para el <mark>; default: amber-200 + semibold. */
  className?: string;
}

export function Highlight({
  text,
  query,
  className = "bg-amber-200 text-foreground rounded-sm px-0.5 font-semibold",
}: Props) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  const qLower = q.toLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === qLower ? (
          <mark key={i} className={className}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
