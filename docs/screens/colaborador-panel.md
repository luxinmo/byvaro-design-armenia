# Pantalla · Panel operativo del colaborador (`/colaboradores/:id/panel`)

## Propósito

Pantalla dedicada al **vínculo operativo** entre el promotor y una
agencia concreta. Contraparte de la **ficha pública**
(`/colaboradores/:id` · `Empresa.tsx` modo visitor): aquí no hay
marketing, solo la operativa del día a día.

Regla de oro (ADR-057 · CLAUDE.md §"Ficha pública vs panel
operativo"): clicar una agencia **ya activa** lleva a este panel.
Agencias pending/inactive/marketplace llevan a la ficha pública. Todo
`navigate()` hacia una agencia pasa por `agencyHref(agency)` de
`src/lib/agencyNavigation.ts`.

**Audiencia:** solo Promotor. Tab Historial es admin-only (banner
explícito + `AdminOnly`).

---

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ ← Colaboradores                                             │
│ [logo]  Nombre agencia  [VerifiedBadge si verificada]       │
│         Ciudad · tipo · comisión media · desde fecha        │
│                                      [Email] [Compartir]    │
├────────────────────────────────────────────────────────────┤
│ Resumen · Datos · Visitas · Registros · Ventas ·            │
│ Documentación · Pagos · Facturas · Historial*               │
│ (* solo admin)                                              │
├────────────────────────────────────────────────────────────┤
│                                                             │
│                  Contenido del tab activo                   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

Tabs sincronizados con `useTabParam` (regla de oro URL·tabs). Navegar
a sub-pantallas y volver atrás restaura la tab.

---

## Tabs

### 1. Resumen (`?tab=resumen` · default)

Vista hero sin KPIs — todo son **señales accionables**.

- **Hero**: frase grande con el estado de la colaboración (activa /
  contrato pendiente / pausada).
- **En colaboración**: promociones que YA comparte. Cada card muestra
  contrato-en-vigor (badge verde), docs pendientes, registros 30d,
  próximas visitas.
- **Aún sin compartir**: promos activas del promotor donde la agencia
  aún no está. Filtro duro `status === "active" && canShareWithAgencies !== false`
  (idéntico a `ShareMultiPromosDialog`). Oportunidad para ampliar.
- **Próximas visitas**: si hay — línea por visita con cliente +
  promoción + hora + agente.

Endpoint: `GET /api/agencias/:id/panel/summary` (shape en
`docs/backend-integration.md §4.0`).

### 2. Datos (`?tab=datos`)

Vista **read-only** de la agencia. Los datos los mantiene la propia
agencia desde su workspace (`Empresa` en modo tenant). Aquí el
promotor solo lee.

Bloques: Identidad · Contacto empresa · Redes sociales · Contacto
asignado. Tick azul al lado del nombre si
`isAgencyVerified(getAgencyLicenses(a))`.

Fuente: `useEmpresa(agencyId)` + adapter `agencyToEmpresa`. Backend:
`GET /api/empresas/:id/public`.

### 3. Visitas (`?tab=visitas`)

Lista de visitas de clientes de esta agencia sobre tus promociones.
Filtros por estado (`scheduled | completed | cancelled`).

Endpoint: `GET /api/agencias/:id/visits?status=...`.

### 4. Registros (`?tab=registros`)

Registros de clientes que la agencia ha aportado. Cada registro es un
cliente que la agencia declara "suyo" · entra a validarse por el
detector de duplicados (cruce con contactos del promotor y registros
previos).

Filtros: `pending | approved | rejected | expired`.

Endpoint: `GET /api/agencias/:id/registrations?status=...`.

### 5. Ventas (`?tab=ventas`)

Pipeline de ventas iniciadas por clientes de esta agencia.

**Regla de oro ADR "venta cerrada vs terminada"**:
- Cerrada = `contratada ∨ escriturada`.
- Terminada = solo `escriturada`.

Filtros por etapa: `iniciada | reserva | contrato | escritura |
entregada | cancelada`.

Endpoint: `GET /api/agencias/:id/sales?stage=...`.

### 6. Documentación (`?tab=documentacion`)

**Dos bloques independientes** con permisos separados:

#### 6.1 Contratos de colaboración (per-promoción · Firmafy)

- Subir PDF + `scopePromotionIds[]` obligatorio.
- Enviar a firmar por Firmafy · signers promotor + agencia.
- Estados: `draft | sent | signed | revoked | expired`.
- Al firmar → se marca `contratoEnVigor: true` en cada promoción del
  scope. La UI lee ese flag en AgenciasTabStats, ResumenTab y badges
  del listado.

Permisos:
- `collaboration.contracts.view` → ver bloque.
- `collaboration.contracts.manage` → subir · enviar · marcar firmado
  manualmente · revocar.

Endpoints: `POST/PATCH /api/contracts` · webhook Firmafy en
`docs/backend/integrations/firmafy.md`.

#### 6.2 Documentos requeridos a la agencia

El promotor solicita papeles (factura, IBAN, certificado fiscal,
modelo trimestral, seguro, custom). La agencia sube desde su panel
(fase futura). El promotor aprueba/rechaza.

Permiso: `collaboration.documents.manage`.

Endpoints: `POST /api/agencias/:id/doc-requests` + `/approve` +
`/reject`.

### 7. Pagos (`?tab=pagos`)

Vista financiera. Secciones:

1. **KPIs**: Pagado · Pendiente · Bloqueado · Próximo.
2. **Urgentes**: vencidos + listos + bloqueados.
3. **Calendario de pagos** agrupado por estado.
4. **Facturas recibidas** (enlaza a doc-requests tipo invoice).

Permisos:
- `collaboration.payments.view` → ver todo.
- `collaboration.payments.manage` → marcar pagado · on-hold · liberar
  · cancelar · subir comprobante.

Endpoints: `GET /api/agencias/:id/payments` + mutaciones
`/mark-paid | /hold | /release | /cancel | /proof`.

### 8. Facturas (`?tab=facturas`)

Dos sub-secciones:
- **Emitidas**: el promotor → agencia (cargos de plataforma,
  servicios). Upload PDF o generar desde form.
- **Recibidas**: la agencia → promotor (comisiones, gastos).
  Upload PDF.

Permiso: `collaboration.payments.view` (consultar) ·
`collaboration.payments.manage` (generar/eliminar).

Endpoints: `GET/POST /api/agencias/:id/invoices` + `POST
/api/agencias/:id/invoices/generate`.

### 9. Historial (`?tab=historial`) — **admin-only**

Timeline cross-empresa (invitaciones, registros, visitas, contratos,
ventas, incidencias). Mismos datos que `/colaboradores/:id/historial`
stand-alone, integrados aquí.

REGLA DE ORO (CLAUDE.md §"Historial entre empresas"): **solo admins**
ven esta tab. `<AdminOnly>` wrapper + banner explícito "Confidencial
· solo admin". Agentes no ven la tab en la nav.

Fuente: `getCompanyEvents(agencyId)` de `src/lib/companyEvents.ts`.
Backend: `GET /api/agencias/:id/company-events`.

Alimentado por `recordCompanyEvent()` en cada handler que afecte al
vínculo (ver CLAUDE.md §"Historial entre empresas" para el catálogo
de helpers).

---

## Reglas de gate

Todo el panel requiere `collaboration.panel.view`. Sin esa key → empty
state "Sin acceso · este panel solo está disponible para
administradores del workspace".

Cada tab aplica su sub-permiso (ver tabla en
`docs/backend-integration.md §4.0`). El backend **debe** devolver 403
si falta la key · el frontend nunca es la única línea de defensa.

---

## Navegación hacia el panel

**Prohibido hardcodear `/colaboradores/:id/panel`.** Todo
`navigate()` hacia una agencia pasa por:

```ts
import { agencyHref } from "@/lib/agencyNavigation";

navigate(agencyHref(agency));
// opcional · preserva contexto de promoción para volver al listado
navigate(agencyHref(agency, { fromPromoId: p.id }));
```

`agencyHref` resuelve automáticamente:
- Agencia activa (`isActiveCollaborator`) → panel.
- Agencia no activa → ficha pública.

Sitios que ya usan el helper: `AgenciasTabStats`, `Contratos`,
`ResumenTab`, `Inicio`, `AccountSwitcher`, `Colaboradores`,
`AgenciaEntry`, `Empresa`, `AgenciasPendientesDialog`.

---

## Archivos

- `src/pages/ColaboracionPanel.tsx` — página contenedora con tabs.
- `src/components/collaborators/panel/*.tsx` — un archivo por tab:
  `ResumenTab`, `DatosTab`, `VisitasTab`, `RegistrosTab`, `VentasTab`,
  `DocumentacionTab`, `PagosTab`, `FacturasTab`, `HistorialTab`,
  `shared.tsx`.
- `src/lib/agencyNavigation.ts` — `agencyHref`, `isActiveCollaborator`.
- `src/lib/permissions.ts` — keys `collaboration.*`.
- `src/components/ui/VerifiedBadge.tsx` — tick azul canónico.

## Decisiones de producto

- **9 tabs en vez de sub-páginas separadas**: el promotor abre el
  panel una vez y encuentra todo el vínculo (contratos, pagos,
  visitas, registros, ventas, facturas, historial). Ir y volver entre
  `/colaboradores/:id/contratos`, `/colaboradores/:id/pagos`, etc.
  habría roto la percepción de "un solo sitio".
- **Datos de la agencia son read-only** · los mantiene la agencia en
  su workspace. El promotor nunca edita datos ajenos (`useEmpresa`
  con tenantId hace `update/patch` no-op).
- **Contratos per-promoción** (`scopePromotionIds`) · Firmafy-style.
  Un contrato puede cubrir N promociones. Al firmar, cada promoción
  en scope gana el badge "Contrato en vigor". Mejor que un único
  contrato global (granularidad comercial real) y mejor que un
  contrato por promoción (papeleo duplicado).
- **Tab Historial admin-only y declarado en banner**, no oculto
  silenciosamente. El agente que entre al panel ve las demás tabs,
  nunca ve Historial · cuando un admin entra, el banner le recuerda
  que esta información es confidencial cross-empresa.
- **Gate de compartibilidad duplicado en backend**. La UI filtra
  `canShareWithAgencies !== false` pero el backend debe replicar la
  regla en `POST /api/invitations` — es la única defensa contra
  datos corruptos que el self-heal de `invitaciones.ts` no puede
  resolver.
