/**
 * DefaultCoverPattern · fallback visual cuando una empresa todavía no
 * ha subido portada. Composición sobria sin elementos infantiles —
 * gradiente sutil + una línea fina diagonal para dar profundidad sin
 * cargar la composición. Inspirado en defaults corporate (LinkedIn,
 * Stripe, Linear) · NUNCA círculos / patrones lúdicos.
 *
 * Usa los tokens HSL del sistema · NO hardcodear colores.
 */
export function DefaultCoverPattern() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--foreground) / 0.18) 0%, hsl(var(--foreground) / 0.08) 45%, hsl(var(--muted)) 100%)",
      }}
    >
      {/* Líneas diagonales finas · ahora más visibles · dan textura
          sin recargar la composición. */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line x1="0" y1="320" x2="1200" y2="80"  stroke="hsl(var(--foreground))" strokeOpacity="0.10" strokeWidth="1" />
        <line x1="0" y1="370" x2="1200" y2="130" stroke="hsl(var(--foreground))" strokeOpacity="0.08" strokeWidth="1" />
        <line x1="0" y1="270" x2="1200" y2="30"  stroke="hsl(var(--foreground))" strokeOpacity="0.06" strokeWidth="1" />
      </svg>
    </div>
  );
}
