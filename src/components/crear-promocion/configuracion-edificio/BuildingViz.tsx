/**
 * BuildingViz · grid columnar (1 columna por escalera + rail labels).
 *
 * Cada escalera es una COLUMNA del CSS Grid · todas las plantas (filas)
 * tienen la misma altura · la PB (última fila) tiene su propia altura.
 * Esto garantiza que:
 *   - Los labels P1, P2 ... PB del rail izquierdo se alinean
 *     pixel-perfect con su fila correspondiente.
 *   - Las puertas / locales / bajos de la PB se alinean exactamente
 *     bajo su columna de escalera.
 *   - Añadir escaleras / plantas no deforma el resto · el grid mantiene
 *     proporciones uniformes.
 *
 * Auto-fit con `transform: scale` · NUNCA scroll. Cap 0.25-2.8x.
 *
 * Compresión · plantas > 6 → top 3 + "···" + planta 1 + PB.
 */

import { Fragment, useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ModeloSimple } from "./types";

const COMPRESS_THRESHOLD = 6;

const C_GLASS = "#E4EEF8";
const C_FACADE = "#FFFFFF";
const C_BORDER = "rgba(0,0,0,0.055)";
const C_INNER = "rgba(0,0,0,0.07)"; // tabique entre escaleras
const C_LOCAL = "#F6DDA8";
const C_DOOR = "#6B655F";

/* Dimensiones constantes · garantizan consistencia visual cuando se
 * añaden plantas/escaleras · el auto-scale del wrapper exterior se
 * encarga de hacer caber todo. */
const WINDOW_W = 12;
const WINDOW_H = 14;
const WINDOW_GAP = 4;     // entre ventanas dentro de una escalera
const ESC_PAD_X = 10;      // padding lateral de cada escalera
const ROW_H = 24;          // altura de una fila de planta
const COLLAPSED_H = 18;    // altura de la banda comprimida
const PB_H = 30;           // altura de la planta baja

export function BuildingViz({ modelo }: { modelo: ModeloSimple }) {
  const { plantas, viviendas, escaleras, bloques, plantaBaja } = modelo;

  type Row = { kind: "floor"; n: number } | { kind: "collapsed" };
  const rows: Row[] = (() => {
    if (plantas <= COMPRESS_THRESHOLD) {
      return Array.from({ length: plantas }, (_, i) => ({ kind: "floor" as const, n: plantas - i }));
    }
    return [
      { kind: "floor" as const, n: plantas },
      { kind: "floor" as const, n: plantas - 1 },
      { kind: "floor" as const, n: plantas - 2 },
      { kind: "collapsed" as const },
      { kind: "floor" as const, n: 1 },
    ];
  })();

  /* Auto-fit · ResizeObserver mide y aplica scale para evitar scroll. */
  const containerRef = useRef<HTMLDivElement>(null);
  const buildingRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const building = buildingRef.current;
    if (!container || !building) return;
    const compute = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const bw = building.scrollWidth;
      const bh = building.scrollHeight;
      if (bw === 0 || bh === 0 || cw === 0 || ch === 0) return;
      const safeW = cw - 12;
      const safeH = ch - 12;
      const s = Math.min(safeW / bw, safeH / bh, 2.8);
      setScale(Math.max(0.25, Number.isFinite(s) ? s : 1));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    ro.observe(building);
    return () => ro.disconnect();
  }, [plantas, viviendas, escaleras, bloques, plantaBaja]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div
        ref={buildingRef}
        style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
        className="flex items-end justify-center gap-5 transition-transform duration-200"
      >
        {Array.from({ length: bloques }, (_, b) => (
          <Bloque
            key={b}
            blockNum={b + 1}
            showBlockLabel={bloques > 1}
            escaleras={escaleras}
            viviendas={viviendas}
            rows={rows}
            plantaBaja={plantaBaja}
          />
        ))}
      </div>
    </div>
  );
}

type Row = { kind: "floor"; n: number } | { kind: "collapsed" };

function Bloque({
  blockNum,
  showBlockLabel,
  escaleras,
  viviendas,
  rows,
  plantaBaja,
}: {
  blockNum: number;
  showBlockLabel: boolean;
  escaleras: number;
  viviendas: number;
  rows: Row[];
  plantaBaja: ModeloSimple["plantaBaja"];
}) {
  /* Grid template · 1 col para labels + N cols (una por escalera).
   * Las cells de la fachada llevan estilos de borde para simular un
   * único box (cornisa + paredes laterales + tabique interior). */
  const gridCols = `auto repeat(${escaleras}, auto)`;

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      {showBlockLabel && (
        <p className="text-[9.5px] font-medium text-foreground/55 tracking-tight">
          Bloque {blockNum}
        </p>
      )}

      <div
        className="grid items-stretch"
        style={{ gridTemplateColumns: gridCols, columnGap: 0, rowGap: 0 }}
      >
        <AnimatePresence initial={false}>
          {rows.map((row, idx) => {
            const isFirst = idx === 0;
            const h = row.kind === "collapsed" ? COLLAPSED_H : ROW_H;
            const labelKey = row.kind === "collapsed" ? `lbl-c-${idx}` : `lbl-p-${row.n}`;
            const cellsKey = row.kind === "collapsed" ? `cells-c-${idx}` : `cells-p-${row.n}`;

            return (
              <Fragment key={`row-${idx}`}>
                {/* Label · columna 1 · alineado al centro de su fila */}
                <motion.span
                  key={labelKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-[8.5px] font-medium tnum text-foreground/30 flex items-center justify-end pr-1.5"
                  style={{ height: h }}
                >
                  {row.kind === "collapsed" ? "···" : `P${row.n}`}
                </motion.span>

                {/* Si es banda comprimida · UNA celda que ocupa todas
                   las columnas de escaleras. Si es floor · N celdas
                   normales (una por escalera). */}
                {row.kind === "collapsed" ? (
                  <motion.div
                    key={`${cellsKey}-band`}
                    initial={{ opacity: 0, scaleY: 0.5 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0.5 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                      originY: 1,
                      height: h,
                      backgroundColor: C_FACADE,
                      borderLeft: `1px solid ${C_BORDER}`,
                      borderRight: `1px solid ${C_BORDER}`,
                      gridColumn: `span ${escaleras}`,
                    }}
                    className="flex items-center justify-center"
                  >
                    <span className="text-[10px] tnum text-foreground/40 tracking-wider">
                      ···
                    </span>
                  </motion.div>
                ) : (
                  Array.from({ length: escaleras }, (_, e) => {
                    const isLeftMost = e === 0;
                    const isRightMost = e === escaleras - 1;
                    return (
                      <motion.div
                        key={`${cellsKey}-e${e}`}
                        initial={{ opacity: 0, scaleY: 0.5 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.5 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                          originY: 1,
                          height: h,
                          backgroundColor: C_FACADE,
                          borderLeft: isLeftMost ? `1px solid ${C_BORDER}` : `1px solid ${C_INNER}`,
                          ...(isRightMost && { borderRight: `1px solid ${C_BORDER}` }),
                          ...(isFirst && {
                            borderTop: `1px solid ${C_BORDER}`,
                            ...(isLeftMost && { borderTopLeftRadius: 6 }),
                            ...(isRightMost && { borderTopRightRadius: 6 }),
                          }),
                        }}
                        className="flex items-center justify-center"
                      >
                        <FloorWindows viviendas={viviendas} />
                      </motion.div>
                    );
                  })
                )}
              </Fragment>
            );
          })}
        </AnimatePresence>

        {/* Fila PB · label + N cells (una por escalera) */}
        <span
          className="text-[8.5px] font-medium tnum text-foreground/35 flex items-center justify-end pr-1.5"
          style={{ height: PB_H }}
        >
          PB
        </span>
        {Array.from({ length: escaleras }, (_, e) => {
          const isLeftMost = e === 0;
          const isRightMost = e === escaleras - 1;
          return (
            <div
              key={`pb-e${e}`}
              className="flex items-end justify-center pt-2 pb-1.5"
              style={{
                height: PB_H,
                backgroundColor: "rgba(0,0,0,0.012)",
                borderLeft: isLeftMost ? `1px solid ${C_BORDER}` : `1px solid ${C_INNER}`,
                ...(isRightMost && { borderRight: `1px solid ${C_BORDER}` }),
                borderTop: `1px solid ${C_BORDER}`,
                borderBottom: `1px solid ${C_BORDER}`,
                ...(isLeftMost && { borderBottomLeftRadius: 6 }),
                ...(isRightMost && { borderBottomRightRadius: 6 }),
              }}
            >
              <PBCell tipo={plantaBaja} viviendas={viviendas} />
            </div>
          );
        })}
      </div>

      {/* Etiquetas ESC debajo (solo si > 1) · línea informativa */}
      {escaleras > 1 && (
        <p className={cn("text-[9px] tnum mt-0.5 text-foreground/30")}>
          {escaleras} escaleras
        </p>
      )}
    </div>
  );
}

/* ── Ventanas de UNA escalera (fila de viviendas) ── */
function FloorWindows({ viviendas }: { viviendas: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ paddingLeft: ESC_PAD_X, paddingRight: ESC_PAD_X, gap: WINDOW_GAP }}
    >
      {Array.from({ length: viviendas }, (_, i) => (
        <span
          key={i}
          className="shrink-0 rounded-[2px]"
          style={{
            width: WINDOW_W,
            height: WINDOW_H,
            backgroundColor: C_GLASS,
          }}
        />
      ))}
    </div>
  );
}

/* ── Contenido de UNA escalera en PB · door / locales / windows ── */
function PBCell({
  tipo,
  viviendas,
}: {
  tipo: ModeloSimple["plantaBaja"];
  viviendas: number;
}) {
  if (tipo === "viviendas") {
    return <FloorWindows viviendas={viviendas} />;
  }
  if (tipo === "locales") {
    /* Banda local que ocupa el ancho de los viviendas. */
    const w = viviendas * WINDOW_W + (viviendas - 1) * WINDOW_GAP;
    return (
      <div
        className="rounded-[2px]"
        style={{
          width: w,
          height: 14,
          backgroundColor: C_LOCAL,
        }}
        title="Local comercial"
      />
    );
  }
  /* "Sin uso" · puerta de portal centrada */
  return (
    <span
      className="rounded-t-[2px]"
      style={{ width: 11, height: 20, backgroundColor: C_DOOR }}
      title="Entrada al portal"
    />
  );
}
