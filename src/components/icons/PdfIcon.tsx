/**
 * PdfIcon · ilustración SVG de un documento PDF con esquina plegada
 * y badge rojo con las letras "PDF". Diseño "marca" consistente en
 * todo el producto · más reconocible que el `FileText` genérico de
 * Lucide.
 *
 * Usa `currentColor` para los trazos del documento · se hereda del
 * componente padre. El badge rojo es fijo (rojo PDF canonical).
 */

interface Props {
  className?: string;
  /** Etiqueta del badge · default "PDF". Útil para "DOC", "JPG", etc. */
  label?: string;
}

export function PdfIcon({ className, label = "PDF" }: Props) {
  return (
    <svg
      viewBox="0 0 32 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Cuerpo del documento · fondo ligeramente cálido para diferenciarlo del card. */}
      <path
        d="M4 2h17.17a2 2 0 0 1 1.41.59l7.83 7.83A2 2 0 0 1 31 11.83V36a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
        fill="#FFFFFF"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Doblez de la esquina superior derecha. */}
      <path
        d="M21 2v8a2 2 0 0 0 2 2h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Sombra del doblez · crea profundidad. */}
      <path
        d="M21 2l10 10h-8a2 2 0 0 1-2-2V2z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* Badge rojo PDF. */}
      <rect x="5" y="22" width="22" height="10" rx="2" fill="#DC2626" />
      <text
        x="16"
        y="29.25"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        letterSpacing="0.6"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
