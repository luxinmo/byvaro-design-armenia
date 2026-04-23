# oportunidad-detalle.md · ficha de oportunidad

> Ruta: `/oportunidades/:id`.
> Archivo: `src/pages/OportunidadDetalle.tsx`.

## Propósito

Pantalla de trabajo del comercial para llevar una oportunidad
adelante. Concentra **todo** lo necesario para cerrar la venta sin
tener que saltar entre pantallas:

- Interés declarado del cliente (editable inline).
- Matching de IA (promociones + propiedades recomendadas).
- Registros asociados (colapsables).
- Timeline de actividad.
- Emails + comentarios internos.
- 5 acciones primarias visibles + secundarias en "Ver más opciones".

## Layout

Reutiliza el patrón canónico de detalle de Byvaro (igual que
`ContactoDetalle` y `LeadDetalle`): header sticky + pipeline bar +
grid `1fr 320px` con sidebar a la derecha.

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Oportunidades                                                 │  back
│ [Avatar] Ahmed Al Rashid 🇦🇪 [Negociación][Caliente][REG pdte]  │  sticky
│ Idealista · creada hace 12d · última actividad hace 3h          │
│                    [Comentar][Email][Registrar][Visita][Mover→]│  5 CTAs
│                                                          [⋮]   │  + "más"
├─────────────────────────────────────────────────────────────────┤
│ [Interés]→[Visita ✓]→[Evaluación ✓]→[Negociación (actual)]→…    │  pipeline
├─────────────────────────────┬───────────────────────────────────┤
│ COLUMNA PRINCIPAL           │  SIDEBAR 320px                    │
│  · Interés declarado        │  · Identidad (contacto, origen)   │
│  · Matching IA              │  · Asignación                     │
│  · Registros (colapsable)   │  · Etiquetas                      │
│  · Actividad timeline       │  · Motivo de pérdida (si perdida) │
│  · Comunicación             │                                    │
│    (email + comentarios)    │                                    │
└─────────────────────────────┴───────────────────────────────────┘
```

## Bloques

### 1. Header sticky

- Avatar circular con iniciales.
- Nombre + `<Flag iso>` + badge de etapa + badge de temperatura +
  badge "Registro pendiente" si aplica.
- Meta: fuente · fecha creación · última actividad.
- **CTAs principales** (solo 5 para no saturar):
  1. Comentar
  2. Enviar email
  3. Registrar cliente
  4. Programar visita
  5. **Mover a [siguiente etapa]** (primary negro)
- **Ver más opciones** (icono ⋮) expone: Editar interés · Ver
  historial completo · Mostrar/ocultar registros · Reasignar
  responsable · Marcar perdida · Archivar · Vincular otra
  propiedad/promoción · Crear tarea · Ver eventos completos de email.

### 2. Pipeline bar

Fija bajo el header. Muestra las 5 etapas del pipeline (**fijo en V1**):
`Interés → Visita → Evaluación → Negociación → Ganada`.

- Etapa actual: pill negra.
- Etapas pasadas: pill verde con ✓.
- Etapas futuras: pill gris.
- Si `stage === "perdida"`: pills grises + chip rojo "Perdida" al
  final.

La customización de etapas queda **fuera de alcance** en V1
(`CLAUDE.md §Pipeline · V1 fijo`).

### 3. Interés declarado

Bloque estructurado editable (mock, UI pendiente backend):
- Tipología · Dormitorios · Zona · Presupuesto (rango).
- Promoción origen con link a `/promociones/:id`.
- Extras (chips libres).

Si venía de un lead (`sourceLeadId`), este bloque llega **prefijado**
desde la conversión.

### 4. Matching · recomendadas

2 secciones:

- **Promociones recomendadas** (grid 2 columnas).
- **Propiedades recomendadas**.

Cada tarjeta:
- Foto (o icono de fallback).
- Nombre + score de match (%).
- Ubicación + precio.
- Motivo del match (generado por IA o editado por el comercial).
- 3 acciones: **Enviar** · **Ver ficha** · **Registrar** (primary).

### 5. Registros (colapsable)

Cabecera clicable con contador + badge "N pendientes" (amarillo si
hay). Click → toggle mostrar/ocultar.

Cada registro muestra:
- Promoción (con icono Building2).
- Badge de estado: Pendiente · Aceptado · Rechazado · Cancelado.
- Agencia + agente (nombre vía `findTeamMember()`).
- Fecha relativa.
- Nota si existe.
- Línea "Decidido por X" si ya se resolvió.

Empty state propio con CTA "Registrar cliente".

### 6. Actividad (timeline)

Iconos semánticos por tipo de evento:
- `email-bounced` / `lost` / `registration-rejected` → icono rojo.
- `won` / `registration-accepted` / `email-opened` → icono verde.
- Resto → icono gris.

Toggle "Ver resumen / Ver todo" para limitar a 6 eventos o mostrar
todo.

Los eventos vienen del backend — en mock los traemos prefijados en el
seed.

### 7. Comunicación

- **Mini-stats**: Enviados · Recibidos · Abiertos · Respondidos · Rebotados.
- **Lista compacta** de los últimos 4 emails (con badge de estado).
- **Comentarios internos** con textarea inline + botón Enviar.

## Conversión desde Lead

El CTA "Convertir a oportunidad" vive en `/leads/:id` (ficha del
lead). Abre un diálogo de confirmación (mock) que lista lo que se
preservará:

- Historial y timeline del lead.
- Emails enviados y recibidos.
- Comentarios internos.
- Promoción/propiedad de origen.
- Interés declarado (prefija en la oportunidad).

Al confirmar:
1. TODO(backend) `POST /api/leads/:id/convert-to-opportunity`
   - Crea `Opportunity` con `stage = settings.defaultInitialStage`.
   - Copia `lead.interest` → `opportunity.interest`.
   - Preserva timeline, emails, comentarios.
   - Marca `lead.status = "converted"`.
   - Emite `opportunity-created` en el timeline de la nueva oportunidad.
2. Navega a `/oportunidades/:nuevoId`.

## Estados a diseñar (cubiertos)

| Estado | Oportunidad en el seed |
|---|---|
| Todos los paneles con datos | `opp-1` |
| Matching vacío | `opp-3`, `opp-4`, `opp-5` |
| Sin registros | `opp-2`, `opp-4`, `opp-6`, `opp-7` |
| Registro pendiente | `opp-1` (con banner en header) |
| Email rebotado en timeline | `opp-4` |
| Oportunidad ganada (pipeline bar con todos ✓) | `opp-5` |
| Oportunidad perdida (con `lostReason` en sidebar) | `opp-7` |
| Sin matching / sin actividad | `opp-4` |
| Comentarios vacíos | `opp-3`, `opp-5`, `opp-7` |
| Sin tags | `opp-2`, `opp-3`, `opp-4`, `opp-6`, `opp-7` |

## TODOs al conectar backend

Ver `docs/backend-integration.md §7.3`. Endpoints concretos marcados
como `TODO(backend)` dentro de cada handler:

- `/api/opportunities/:id`
- `/api/opportunities/:id/stage` → al mover etapa
- `/api/opportunities/:id/comments` → al añadir comentario
- `/api/opportunities/:id/emails` → al enviar email
- `/api/opportunities/:id/visits`
- `/api/opportunities/:id/matches` (IA)
- `/api/opportunities/:id/registrations`
- `/api/leads/:id/convert-to-opportunity` (conversión)

Regla: cada mutación escribe en **dos** historiales — el de la
oportunidad y el del contacto.
