# Pantalla · Ficha de agencia (`/colaboradores/:id`)

## Propósito

Vista del **promotor** sobre la ficha de una agencia. Es **literalmente
la misma pantalla que `/empresa`** renderizada con un `tenantId`
distinto. Una sola implementación; dos usos.

**Audiencia:** solo Promotor.

---

## Arquitectura · una sola vista

```
┌─────────────────────────────────────────────────────┐
│ /empresa                    → <Empresa />           │
│   useEmpresa()              → mi empresa (edit)     │
├─────────────────────────────────────────────────────┤
│ /colaboradores/:id          → <AgenciaDetalle />    │
│   └── <Empresa tenantId={id}                        │
│         visitorSlot={...}                           │
│         visitorFooter={...} />                      │
│   useEmpresa(id)            → empresa del tenant    │
│                               agencia (read-only)   │
└─────────────────────────────────────────────────────┘
```

Componentes implicados:

- **`src/pages/Empresa.tsx`** — el único componente de ficha de empresa.
  Acepta props opcionales:
  - `tenantId?: string` — si viene, modo **visitor** (carga el perfil
    público del tenant con ese id).
  - `visitorSlot?: ReactNode` — bloque que se inyecta sobre el hero (solo
    en visitor). Lo usa `AgenciaDetalle` para poner el overlay promotor:
    contrato, métricas con tu red, incidencias, mensaje solicitud.
  - `visitorFooter?: ReactNode` — barra sticky inferior con acciones
    (aprobar, pausar, eliminar, compartir).
- **`src/lib/empresa.ts · useEmpresa(tenantId?)`** — carga correcta:
  - Sin id → `localStorage` del tenant logueado. `update/patch` persisten.
  - Con id → `agencyToEmpresa(agencies.find)` (mock). `update/patch` NO-OP.
- **`src/lib/agencyEmpresaAdapter.ts · agencyToEmpresa(a)`** — mapea la
  shape `Agency` a la shape `Empresa`. Cuando exista backend, este
  adapter se sustituye por `GET /api/empresas/:id/public`.
- **`src/pages/AgenciaDetalle.tsx`** — thin wrapper:
  `<Empresa tenantId={id} visitorSlot={...} visitorFooter={...} />`.

---

## Comportamiento en modo visitor

Cuando `tenantId` está presente, `Empresa.tsx` cambia:

| Elemento | Owner (sin id) | Visitor (con id) |
|---|---|---|
| Banner onboarding | Si perfil <100% | Oculto |
| Header | "Mi empresa · Nombre" | "← Colaboradores" + "Ficha de agencia" + Nombre |
| Botón "Previsualizar como agencia" | Visible | Oculto |
| `viewMode` | Arranca en "edit" | Forzado a "preview" |
| Overlays de editar imagen (cover/logo) | Visibles en edit | Ocultos |
| ImageCropModal | Activo | No se monta |
| Sidebar (KPIs, zonas) | Visible en edit | Oculto |
| `visitorSlot` | — | Renderizado sobre el hero |
| `visitorFooter` | — | Renderizado sticky al pie |
| `update/patch` del hook | Persiste a localStorage | NO-OP |

---

## Overlay del promotor (`visitorSlot`)

Lo inyecta `AgenciaDetalle` — son los bloques que **no pertenecen al
perfil público del tenant agencia** sino a la relación promotor↔agencia:

Grid de 3 cards compactas:

1. **Contrato firmado** — fechas firma/caducidad, estado vigente/por-expirar/expirado con tone (emerald/amber/red), link al PDF si existe.
2. **Métricas con tu red** — mini-stats Registros · Ventas · Volumen + línea de conversión.
3. **Incidencias** — duplicados · cancelaciones · reclamaciones (tone rojo si hay alguna).

Si `isPending && mensajeSolicitud`, se añade una card ámbar de ancho
completo con el mensaje de la solicitud.

---

## Footer sticky (`visitorFooter`)

Barra inferior con acciones únicas:

| Estado | Hint | Acciones |
|---|---|---|
| Pending | "Revisa la solicitud y decide:" | Descartar · **Aprobar colaboración** |
| Activa | "Colaboración activa:" | Eliminar · Pausar · Email · **Compartir promoción** |
| Pausada | "Colaboración en pausa:" | Eliminar · Reanudar · Email · **Compartir promoción** |

Acciones destructivas pasan por `useConfirm()`.

---

## Endpoints backend

Ver `docs/backend-integration.md` §2, §4:

- `GET /api/empresas/:id/public` → `Empresa` shape del tenant agencia
  (sustituye al `agencyToEmpresa` mock).
- `GET /api/colaboradores/:id` → extra fields de la `Collaboration`
  (contrato, métricas con tu red, incidencias).
- `POST /api/collaborators/:id/approve | /reject | /pause | /resume`.

---

## Decisiones de producto

- **Una sola vista** de ficha de empresa. El mismo `<Empresa>` renderiza
  `/empresa` (dueño editando) y `/colaboradores/:id` (visitor). Cualquier
  mejora en Empresa se refleja automáticamente.
- **`useEmpresa(tenantId?)`** es el punto único de ownership del estado.
  `update/patch` son no-op en visitor. No hay forma de editar una empresa
  ajena por accidente.
- **Overlay promotor vía slots** (`visitorSlot`, `visitorFooter`). Los
  datos de la relación (contrato, métricas, acciones) no viven en el
  componente `Empresa` — los inyecta `AgenciaDetalle` como `ReactNode`.
  Así Empresa no sabe nada de colaboradores; queda acoplamiento cero.
- **Acciones destructivas solo aquí**. Listados y drawers no aprueban/
  rechazan/pausan directamente — fuerzan al promotor a revisar la ficha.
