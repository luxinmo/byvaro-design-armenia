# oportunidades-ficha.md · ficha interior de la oportunidad

> Ruta: `/oportunidades/:id`.
> Archivo: `src/pages/LeadDetalle.tsx` (nombre histórico · concepto
> actual = "Oportunidad" · ADR-053).
> Spec del listado: `docs/screens/oportunidades.md`.

## Propósito

Pantalla de trabajo del comercial sobre UNA oportunidad: ver el
mensaje original del cliente, cualificarla con los 3 botones del
sistema, escalar etapa, comunicarse por email/WhatsApp, y consultar
toda la actividad en un solo sitio.

## Layout

Header sticky + tabs del cuerpo + sidebar derecha **siempre visible**.

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Oportunidades                                                    │
│ [Avatar] 🇫🇷 Sophie Martin [EnVisita][DUP?]              [Descartar]│
│ OPP-0007 · Idealista · hace 3h · Responsable: Laura                │
│ [Email sophie@…] [Tel +33 6…] [🟢 WhatsApp]                        │
├──────────────────────────┬─────────────────────────────────────────┤
│ [Actividad][Emails]...   │  SIDEBAR 320px                          │
│                          │  · Interés declarado                    │
│ LeadEntryEvent           │  · Identidad                            │
│  ┌ 📸 125×85 promo ────┐ │  · Asignación (UserSelect)              │
│  │ Mensaje cliente    │ │  · Origen                               │
│  │ [No·Es·Interés]    │ │  · Etiquetas                            │
│  └────────────────────┘ │                                         │
│                          │                                         │
│ Timeline (resto)         │                                         │
└──────────────────────────┴─────────────────────────────────────────┘
```

## Header

Sticky con fondo `bg-background/95 backdrop-blur`. Contiene:

1. **Back** link a `/oportunidades`.
2. **Avatar 56×56** con iniciales (2 letras del nombre).
3. **Bandera + Nombre** + **Pill de etapa** (badge con color
   semántico) + **Chip DUP** si `duplicateScore ≥ 70`.
4. **Meta-línea**: `OPP-0001 · Fuente · hace Xh · Responsable: Nombre`.
5. **3 accesos rápidos** (bajo el nombre, misma fila):
   - **Email** → `<Link to="/emails?compose=1&to=...">` (mismo patrón
     que ContactSummaryTab).
   - **Teléfono** → `<a href="tel:...">`.
   - **WhatsApp** → abre `ContactWhatsAppDialog` (modal lateral con
     backdrop · mismo componente canónico que el contacto). Shim del
     lead con campos mínimos: `id`, `name`, `flag`, `phones[]`.
6. **CTA "Descartar"** (destructivo · derecha del header). Los otros
   CTAs de la antigua versión (Llamar/Email/WhatsApp como pills
   grandes) se quitaron → ya están bajo el nombre.

## Tabs del cuerpo

Deep-linkables vía `?tab=`. Valor por defecto: `actividad`.

- **Actividad** (default)
- **Emails** (placeholder con `TODO(backend)`)
- **Documentos** (placeholder)
- **Registros** (placeholder)

Pipeline "Resumen" se **eliminó** — aportaba poco, `actividad` trae
toda la info relevante.

### Tab · Actividad

Si `lead.duplicateScore ≥ 70`: bloque rojo de IA de duplicados
arriba del todo con DupMatchCell por campo y CTAs "Ver contacto
existente" · "No es duplicado".

Luego la `Section` "Actividad" con dos partes:

#### 1. `LeadEntryEvent` (primera tarjeta)

Dos estados según cualificación del comercial:

**Sin responder** (`qualif === null`):
- Borde primary + bg primary/5.
- Icon Sparkles + "Ha entrado un lead" + fuente/fecha.
- Foto de la promoción **125×85 px** (click → `/promociones/:id`).
- Link a la promoción con su nombre.
- Blockquote con el mensaje del cliente (italic, border-l primary).
- 3 botones del sistema en grid-cols-3:
  - **No es lead** (outline · hover rojo)
  - **Es lead** (outline · neutral)
  - **Tiene interés** (primary negro · icon Flame)

**Respondida** (`qualif !== null`):
- Borde neutro + bg muted/20.
- Línea "Ha entrado un lead · fuente · hace Xh".
- "Tú consideraste que: **[decisión]**".
- El **mensaje sigue visible** (blockquote más pequeño pero presente
  siempre — era un requisito del producto).

#### 2. Timeline normal

Eventos derivados del `lead` (lead recibido · primer contacto ·
etapa ganada/perdida · etc.). Renderiza iconos semánticos (rojo para
negativos, verde para ganada/abierto, gris para neutros).

## Sidebar derecha (siempre visible)

Fuera del área de tabs · se mantiene constante al cambiar de tab.

1. **Interés declarado**: promoción (link) · tipología · dormitorios
   · presupuesto · zona. **Movido aquí** desde el cuerpo a petición
   del usuario.
2. **Identidad**: email (mailto), teléfono (tel), nacionalidad,
   idioma.
3. **Asignación**: miembro responsable con avatar + nombre + cargo.
   Botón "Cambiar" · UserSelect canónico.
4. **Origen**: fuente de entrada.
5. **Etiquetas**: tags libres.

## Pipeline interno

Avanzar/retroceder etapa cambia `lead.status`. Colores por etapa en
`leadStatusConfig` de `src/data/leads.ts`. Las 8 etapas se pueden
elegir desde el header (pendiente de diseñar el selector — iteración
siguiente).

## Cosas deliberadamente fuera del scope

- **No hay entidad "Oportunidad" separada**. Todo vive dentro del
  Lead. Revierte el diseño anterior (ADR-052 → ADR-053).
- No hay pipeline bar visual con las 5 etapas en línea · se planteó
  pero se sacó para mantener la ficha limpia. Se puede añadir si
  resulta útil en prod.
- Matching IA con promociones/propiedades queda fuera de V1.

## TODOs al conectar backend

Ver `docs/backend-integration.md §7.1 Leads`.

- `GET /api/opportunities/:id` → Oportunidad completa.
- `PATCH /api/opportunities/:id { status }` → avanzar etapa.
- `PATCH /api/opportunities/:id/assignee { userId | null }` → reasignar.
- `PATCH /api/opportunities/:id/qualify { qualification: "no"|"yes"|"interest" }`
  → decisión de cualificación (hoy solo UI/localState).
