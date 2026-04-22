# ui-helpers.md · catálogo de helpers transversales

> Helpers puros y componentes reutilizables que **no** están atados a
> una pantalla concreta. Si usas uno en una feature nueva, no lo copies
> — impórtalo.
>
> Al añadir un helper genérico, registrarlo aquí. Si un helper vive solo
> dentro de una pantalla (es card-internal), documentarlo en la spec de
> esa pantalla, no aquí.

Última actualización: 2026-04-22.

---

## Formateo

### `formatEuro(n: number): string`

EUR con separadores es-ES, sin decimales. `1200000` → `"1.200.000 €"`.

Usado por: `Empresa`, cards de Colaboradores, ventas, tickets.

### `formatEuroCompact(n: number): string`

Versión compacta. `1_200_000` → `"1.2M €"`; `45000` → `"45k €"`.
Pensado para etiquetas pequeñas (mini-stats, chips).

Archivo actual: duplicado en `ColaboradoresV2/V3.tsx`. TODO: extraer a
`src/lib/format.ts` cuando se use en un 3º sitio.

---

## Dominio

### `slugify(s: string): string`

ASCII lower-case sin símbolos. `"Prime & Belgian"` → `"primebelgian"`.
Usado para: match de dominio de email vs nombre de agencia, generación
de URLs y placeholder emails.

Archivo: `SharePromotionDialog.tsx`, `ColaboradoresV2/V3.tsx`
(duplicado). TODO: extraer a `src/lib/strings.ts`.

### `maskEmail(email: string): string`

`"arman@luxinmo.com"` → `"a***n@luxinmo.com"`. Mantiene primera y
última letra del local; rellena con asteriscos (mínimo 3 · máximo
length-2).

Archivo: `SharePromotionDialog.tsx`. Único uso: banner del paso
"matched" para confirmar la dirección sin exponerla.

### `flagOf(code: string): string`

ISO-3166-1 alpha-2 → emoji bandera. `"GB"` → `"🇬🇧"`. Código inválido
devuelve `"🏳️"`.

Archivo: `ColaboradoresV3.tsx`. Uso: `MercadosFlags`.

### `nameSimilarity(a: string, b: string): number`

Retorna 0-1 usando Dice coefficient sobre tokens ≥2 chars. Base del
detector de duplicados en `ClientRegistrationDialog`.

### `relativeActivity(iso: string | undefined)`

`iso` ISO date → `{ label: "Hoy" | "Ayer" | "Hace N días" | "Hace N
sem" | "Hace N meses" | "Hace +1 año", tone: "fresh" | "ok" | "stale"
}`. `fresh` si ≤7d, `ok` si ≤30d, `stale` si más.

Archivo: `ColaboradoresV3.tsx`. No montado en UI (chip quitado por
decisión de producto), pero el helper se queda disponible.

### `getContractStatus(a: Agency, ref = new Date())`

`src/data/agencies.ts`. Retorna
`{ state: "vigente" | "por-expirar" (≤30d) | "expirado" |
"sin-contrato"; daysLeft? }`.

Canónico para todas las UIs que muestren estado del contrato.

---

## Componentes UI reutilizables

### `<InlineEditNumber value onChange suffix min max step size>`

Número editable con patrón **reposo → hover (lápiz) → click (input)**.
`Enter` commits, `Escape` descarta, `Blur` commits. `size="sm" | "md"`.

Archivo: `SharePromotionDialog.tsx`. Uso: comisión, duración
personalizada, tramos de pago. Candidato a extraer a
`src/components/ui/InlineEditNumber.tsx` cuando se use fuera de Share.

### `<Highlight text query>`

Resalta coincidencias case-insensitive de `query` dentro de `text` con
`<mark class="bg-amber-200 text-foreground rounded-sm px-0.5">`.
Escapa regex chars peligrosos.

Archivo: `ColaboradoresV3.tsx`. Uso: nombre + ubicación en cards con
buscador. Extraer a `src/components/ui/Highlight.tsx` cuando aparezca
un buscador en otra pantalla.

### `<ConfirmDialog>` + `useConfirm()`

Reemplazo del `window.confirm()` nativo. Dialog controlado por event
bus que devuelve `Promise<boolean>`.

Archivo: `src/components/ui/ConfirmDialog.tsx`. Montar
`<ConfirmDialogHost />` una sola vez en `App.tsx`.

Uso:
```ts
const confirm = useConfirm();
const ok = await confirm({
  title: "¿Eliminar borrador?",
  description: "Esta acción no se puede deshacer.",
  destructive: true,
});
if (ok) deleteDraft();
```

### `<MinimalSort value options onChange label>`

Dropdown discreto de texto (`src/components/ui/MinimalSort.tsx`).
Patrón: "Ordenar por **{valor}** ⌄" + popover con opciones y check.
Usado en `Promociones`, `Disponibilidad`, `ColaboradoresV3`.

### `<Tag variant size>`

`src/components/ui/Tag.tsx`. Pills de categoría. Variantes:
`default | success | warning | destructive | overlay`.

### `<FilterBar>` / `<MultiSelectDropdown>` / `<SearchableFilterGroup>`

Pertenecientes a Promociones — ver `docs/screens/promociones.md`. Si
otra pantalla necesita filtros iguales, reutilizarlos antes que
clonar.

---

## Stores con hook + localStorage

Patrón común: `load/save` + `window.dispatchEvent(CustomEvent)` +
listener en `useEffect` al `storage` event.

| Hook | Archivo | Storage key | Doc |
|---|---|---|---|
| `useEmpresa()` | `src/lib/empresa.ts` | `byvaro-empresa` | data-model §Empresa |
| `useOficinas()` | `src/lib/empresa.ts` | `byvaro-oficinas` | data-model §Empresa |
| `useInvitaciones()` | `src/lib/invitaciones.ts` | `byvaro-invitaciones` | data-model §Invitación |
| `useFavoriteAgencies()` | `src/lib/favoriteAgencies.ts` | `byvaro-favoritos-agencias` | data-model §Favoritos |
| `listDrafts()` (promos) | `src/lib/promotionDrafts.ts` | `byvaro-promotion-drafts` | — |
| `useConfirm()` | `src/components/ui/ConfirmDialog.tsx` | — (sin storage) | este archivo |

Todos tienen `TODO(backend)` apuntando a `docs/backend-integration.md`.

---

## Componentes card-internal (no extraer)

Estos son subcomponentes de una pantalla concreta; si los necesitas en
otra, probablemente convenga rediseñarlos caso a caso antes de
extraerlos:

| Componente | Vive en | Propósito |
|---|---|---|
| `ContractChip` | `ColaboradoresV3` | Estado contrato (vigente/por-expirar/expirado) |
| `GoogleRatingBadge` | `ColaboradoresV3` | "G" Google + rating + estrella + (reseñas) |
| `MercadosFlags` | `ColaboradoresV3` | Stack de banderas con `+N` overflow |
| `IncidenciasChip` | `ColaboradoresV3` | Rojo si `duplicados+canc+recl>0` |
| `ActivityChip` | `ColaboradoresV3` (sin uso actual) | Freshness última actividad |
| `EspecialidadChip` | `ColaboradoresV3` (sin uso actual) | Lujo/Residencial/... |
| `RatingStars` | `ColaboradoresV3` (sin uso actual) | Estrellas 1-5 |
| `ChipGroup` | `ColaboradoresV3` (filter drawer) | Chips multiselect |
| `MetricBlock` / `MiniStat` | `ColaboradoresV3` | Stat block con valor + label |
| `KebabMenu` | `ColaboradoresV3` | Menu contextual pausar/email/eliminar |

---

## Dead code aceptable

Componentes definidos en `ColaboradoresV3` pero no referenciados
actualmente (preservados para posible re-incorporación):

- `ActivityChip` — quitado del card por decisión UX.
- `EspecialidadChip` — idem.
- `RatingStars` — reemplazado por `GoogleRatingBadge` externo.

Si al revisitar el archivo siguen sin uso tras 3 meses, borrar.
