/**
 * empresaStats.ts · contadores derivados del estado real del workspace.
 *
 * Reemplaza los antiguos campos manuales del tipo `Empresa`
 * (`promocionesCount`, `agenciasColaboradoras`, `unidadesVendidas`,
 * `oficinasCount`, `agentesCount`, `aniosOperando`) — eran strings
 * editables a mano que se desincronizaban del sistema. Ahora se
 * computan en runtime desde los datasets reales:
 *
 *   - Promociones        → `developerOnlyPromotions` (status="active")
 *   - Unidades vendidas  → `sales` (estado="escriturada", regla de oro
 *                          "ventas terminadas" · CLAUDE.md)
 *   - Agencias colaboran → `agencies` (status="active" + estado="activa")
 *   - Oficinas           → `useOficinas()` del workspace (pasado por prop)
 *   - Agentes            → `TEAM_MEMBERS` (status="active")
 *   - Años activos       → derivado de `empresa.fundadaEn`
 *
 * Visitor mode · cuando se ve la ficha pública de OTRO tenant
 * (`tenantId` set), los conteos se leen del seed de la agencia
 * (`offices`, `teamSize`, `ventasCerradas`) en vez del workspace
 * propio. La agencia visitada no expone "promociones propias" ni
 * "agencias colaboradoras" a terceros — esos campos quedan a 0.
 *
 * TODO(backend): cuando exista API, sustituir los datasets mock por
 *   `GET /api/workspace/:id/stats` que devuelva el shape `EmpresaStats`
 *   ya agregado por SQL (counts indexados, no joins en cliente).
 */

import { useMemo } from "react";
import { agencies } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { sales } from "@/data/sales";
import { unitsByPromotion } from "@/data/units";
import { useWorkspaceMembers, tenantToWorkspaceKey } from "./useWorkspaceMembers";
import { sortLanguagesByImportance } from "./languages";
import type { Empresa } from "./empresa";

export interface EmpresaStats {
  aniosOperando: number;
  promociones: number;
  /** Unidades disponibles a la venta · suma de `availableUnits` cruzada
   *  con el detalle de `unitsByPromotion[promo.id]` cuando existe.
   *  Para el workspace promotor/comercializador es la métrica clave de
   *  cartera viva. */
  unidadesEnVenta: number;
  /** Importe en venta · suma del precio de las unidades disponibles
   *  (status="available"). Si no hay desglose unit-level cae a un
   *  estimado `((priceMin+priceMax)/2) * availableUnits` por promo. */
  importeEnVenta: number;
  /** Unidades cerradas (escrituradas) · histórico de ventas terminadas. */
  unidadesVendidas: number;
  agencias: number;
  oficinas: number;
  agentes: number;
  idiomas: string[];
}

/** Años desde `empresa.fundadaEn` (formato "YYYY"). 0 si no hay dato. */
function yearsSince(fundadaEn: string | undefined): number {
  if (!fundadaEn) return 0;
  const year = parseInt(fundadaEn.trim(), 10);
  if (!Number.isFinite(year) || year <= 0) return 0;
  const diff = new Date().getFullYear() - year;
  return diff > 0 ? diff : 0;
}

export function useEmpresaStats(
  empresa: Empresa,
  oficinasCount: number,
  tenantId?: string,
): EmpresaStats {
  /* Equipo del TENANT MOSTRADO (no del usuario logueado).
   *   · sin tenantId → workspace del usuario (ficha propia).
   *   · tenantId="developer-default" → equipo del promotor.
   *   · tenantId="ag-X"             → equipo de la agencia X. */
  const tenantWsKey = tenantToWorkspaceKey(tenantId) ?? undefined;
  const { members } = useWorkspaceMembers(tenantWsKey);
  return useMemo(() => {
    const aniosOperando = yearsSince(empresa.fundadaEn);

    /* Miembros visibles en la ficha pública · mismo filtro que los
     * avatares (`active && visibleOnProfile`). Cualquier KPI de
     * equipo en la ficha pública debe usar este conjunto · NUNCA
     * `members.filter(active)` a secas, porque los miembros marcados
     * como "no visibles en perfil" son metadata interna que el
     * visitor no ve. Antes había un desfase clásico "5 agentes" pero
     * solo 4 avatares · fuente única ahora. */
    const publicMembers = members.filter(
      (m) => m.status === "active" && m.visibleOnProfile,
    );

    /* Helper · idiomas únicos · UNION de:
     *   1. `empresa.idiomasAtencion` (declarados manualmente desde
     *      "Datos de empresa" · permite anunciar idiomas que el equipo
     *      cubre aunque no haya un miembro con ese idioma todavía).
     *   2. Idiomas de los miembros públicos.
     * El campo manual NO sustituye a los del equipo · los amplía. */
    const collectLangs = (): string[] => {
      const set = new Set<string>();
      for (const code of empresa.idiomasAtencion ?? []) set.add(code.toUpperCase());
      for (const m of publicMembers) {
        for (const code of m.languages ?? []) set.add(code.toUpperCase());
      }
      return sortLanguagesByImportance(Array.from(set));
    };

    /* Visitor de AGENCIA · cualquier tenantId que NO sea developer-*.
     * Antes los stats de equipo/idiomas salían de los stubs en
     * `agencies.ts` (`teamSize: 12`, `idiomasAtencion: [...]`) que no
     * coincidían con los miembros reales de la agencia · "5/12 vs 2".
     * Ahora derivan de los mismos `members` que pinta la ficha. */
    if (tenantId && !tenantId.startsWith("developer-")) {
      const a = agencies.find((x) => x.id === tenantId);
      return {
        aniosOperando: yearsSince(a?.fundadaEn),
        promociones: 0,
        unidadesEnVenta: 0,
        importeEnVenta: 0,
        unidadesVendidas: a?.ventasCerradas ?? 0,
        agencias: 0,
        oficinas: a?.offices?.length ?? 0,
        agentes: publicMembers.length,
        idiomas: collectLangs(),
      };
    }
    /* Visitor de PROMOTOR (`developer-*`) o ficha propia · ambos
     * computan los mismos stats del workspace · single-tenant mock,
     * en backend será GET /api/promotor/:id/stats con la misma shape. */

    // Idiomas y agentes derivados de los mismos `members` que pinta
    // la ficha · evita "X agentes" vs M avatares.
    const idiomas = collectLangs();

    // Promociones activas y su cartera viva (unidades disponibles).
    const activas = developerOnlyPromotions.filter((p) => p.status === "active");
    let unidadesEnVenta = 0;
    let importeEnVenta = 0;
    for (const p of activas) {
      const units = unitsByPromotion[p.id];
      if (units && units.length > 0) {
        const available = units.filter((u) => u.status === "available");
        unidadesEnVenta += available.length;
        importeEnVenta += available.reduce((acc, u) => acc + (u.price ?? 0), 0);
      } else {
        // Sin desglose unit-level · estimado por precio medio.
        unidadesEnVenta += p.availableUnits;
        const avg = ((p.priceMin ?? 0) + (p.priceMax ?? 0)) / 2;
        importeEnVenta += avg * p.availableUnits;
      }
    }

    return {
      aniosOperando,
      promociones: activas.length,
      unidadesEnVenta,
      importeEnVenta,
      unidadesVendidas: sales.filter((s) => s.estado === "escriturada").length,
      agencias: agencies.filter(
        (a) => a.status === "active" && a.estadoColaboracion === "activa",
      ).length,
      oficinas: oficinasCount,
      agentes: publicMembers.length,
      idiomas,
    };
  }, [empresa.fundadaEn, oficinasCount, tenantId, members]);
}
