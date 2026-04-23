# Plan · Equipo, estadísticas y análisis IA

> Cómo Byvaro ayuda al dueño de una agencia a entender qué hace cada
> miembro de su equipo, medir su eficacia y usar IA para detectar
> patrones de buen/mal comportamiento. Diseñado para dar recomendaciones
> accionables al admin.

---

## 1 · Flujos de alta de usuarios

Un mismo email no puede pertenecer a dos organizaciones. El backend valida
con error `409 EMAIL_TAKEN` y devuelve el nombre de la empresa a la que
ya pertenece.

### Flow A · **Invitar** (recomendado)

1. Admin abre **Añadir miembro** → tab "Invitar por email".
2. Introduce email + rol inicial (admin / member).
3. Sistema envía email con link de activación (token expira 7 días).
4. Usuario click link → define contraseña, rellena su propio perfil.
5. `status` pasa de `invited` → `active` al activar. `joinedAt` se
   marca al activar, no al invitar.
6. Opcional · admin puede pre-rellenar cargo, departamento, permisos —
   el usuario puede modificar su identidad pero no los permisos.

### Flow B · **Crear cuenta directa** (onboarding rápido)

1. Admin abre **Añadir miembro** → tab "Crear cuenta".
2. Admin rellena **todos** los datos del miembro: nombre, email, cargo,
   departamento, idiomas, teléfono, permisos.
3. Sistema **genera contraseña temporal** (12 chars, alfanumérica + símbolo,
   legible · sin caracteres ambiguos `0O1lI`).
4. Admin copia la contraseña y la comparte por WhatsApp/presencialmente.
5. `status = active` directamente · al primer login se fuerza cambio de
   contraseña (`mustChangePassword = true`).
6. Si el email ya existe en el sistema → muestra error con nombre de la
   empresa a la que pertenece + CTA "Solicitar transferir" (fuera de
   scope para v1).

### Validaciones compartidas

- Email formato + dominio válido (no permitir `.test`, `.local`).
- Si el email comparte dominio con la empresa → sugerencia "¿quieres
  convertirlo en solicitud de unión por dominio?" (ver §Solicitudes
  pendientes en `ajustes-miembros.md`).
- Máx 50 miembros por organización en plan actual (soft limit · UI
  muestra contador).

---

## 2 · Plan comercial · KPIs del trabajador

Cuatro bloques de métricas, ordenados por valor para el dueño de la
agencia:

### 2.1 · **Resultados comerciales** (lo que genera dinero)

| Métrica | Por qué importa | Fórmula / fuente |
|---|---|---|
| **Ventas cerradas (€)** | Ingresos atribuibles al agente | `SUM(sale.price)` donde `sale.agent = u` |
| **Ventas cerradas (count)** | Volumen independiente del ticket | `COUNT(sale)` |
| **Comisión generada (€)** | Coste/beneficio real | `SUM(sale.commission)` |
| **Registros aprobados** | Filtro de calidad de leads | `COUNT(registro WHERE estado="aprobado")` |
| **Tasa de aprobación propia** | Qué % de sus registros pasan | `aprobados / total` |
| **Visitas realizadas** | Actividad comercial efectiva | `COUNT(visit WHERE status="done")` |
| **Tasa conversión visita → venta** | Eficacia en cerrar | `ventas / visitas_realizadas` |

### 2.2 · **Funnel y pipeline** (qué tiene entre manos)

| Métrica | Señal |
|---|---|
| Leads asignados | Carga actual |
| Oportunidades abiertas | Pipeline |
| Visitas programadas (próximas 7d) | Actividad inmediata |
| Registros pendientes de aprobar | Cuello de botella |
| Promociones asignadas | Diversificación |

### 2.3 · **Comunicación** (actividad con cliente)

| Métrica | Señal |
|---|---|
| Emails enviados (30d) | Engagement outbound |
| % apertura de emails enviados | Calidad del copy/timing |
| Mensajes WhatsApp enviados | Preferencia multicanal |
| Llamadas registradas | Contacto proactivo |
| Tiempo medio de respuesta a lead | Responsividad |

### 2.4 · **Actividad en CRM y señales de comportamiento** (para IA)

| Métrica | Señal interpretable |
|---|---|
| Tiempo activo diario (min) | Dedicación |
| Tiempo medio por sesión | Foco o dispersión |
| Horas pico de actividad | Patrón diario |
| Heatmap día×hora | Cuándo trabaja realmente |
| Días sin conectarse | Ausencia |
| Streak de días activos | Constancia |
| Acciones por sesión | Velocidad de ejecución |
| Tareas pendientes vencidas | Disciplina |
| Contactos duplicados creados | Calidad de datos |
| Visitas realizadas sin evaluar | Cierre incompleto de ciclo |

---

## 3 · IA · Detector de patrones de eficacia

El admin pulsa **Análisis IA** en la pantalla de estadísticas del miembro.
El sistema genera un informe corto con:

### 3.1 · Output del informe (JSON)

```ts
interface AIMemberReport {
  memberId: string;
  generatedAt: string;
  window: "7d" | "30d" | "90d";

  /** 0-100 · cuán efectivo es vs la media del equipo + contexto. */
  effectivenessScore: number;

  /** Semáforo general. */
  status: "green" | "amber" | "red";

  /** 3-5 fortalezas detectadas (datos concretos). */
  strengths: string[];

  /** 3-5 áreas de mejora con acción sugerida. */
  areasForImprovement: Array<{
    signal: string;                 // qué se detectó
    impact: string;                 // consecuencia de negocio
    suggestion: string;             // acción concreta para el admin
  }>;

  /** Patrones de comportamiento interesantes. */
  patterns: Array<{
    label: string;                  // ej. "Convierte mejor con clientes francófonos"
    confidence: number;             // 0-1
    evidence: string;               // datos que lo justifican
  }>;

  /** Recomendaciones al admin (acciones concretas de gestión). */
  adminActions: string[];
}
```

### 3.2 · Ejemplos de salida realistas

**Fortalezas:**
- "Cierra ventas un 34% más rápido que la media del equipo (16 días vs 24)."
- "98% de visitas realizadas se evalúan en las 24h siguientes."
- "Tasa de aprobación de registros del 87% — detecta bien a sus leads."

**Áreas de mejora:**
- `signal`: "12 visitas realizadas sin evaluar en los últimos 30 días."
  - `impact`: "Ciclo de venta sin cierre · IA no aprende del resultado."
  - `suggestion`: "Bloquea 15 min diarios para evaluar visitas del día anterior."

**Patrones:**
- "Mejor conversión con clientes de Europa del Norte (SE, NO, DK) — 42% vs 18% media del equipo."
- "Pico de actividad 10-12h y 16-18h · bajo rendimiento después de 19h."
- "Zero actividad de viernes tarde a lunes mañana."

**Acciones al admin:**
- "Asignar más leads SE/NO/DK a este miembro."
- "Considerar pair-up con agente junior para transferencia de técnica con nórdicos."
- "Revisar si las 12 visitas sin evaluar son por falta de tiempo o desinterés."

### 3.3 · Stack

- **Modelo**: Claude Haiku 4.5 o GPT-4o-mini (latencia <2s, coste
  ~$0.01 por informe).
- **Prompt**: construye un `AI_MEMBER_ANALYSIS_PROMPT` en
  `src/lib/prompts/memberAnalysis.ts` que reciba `MemberStats` + stats
  agregadas del equipo.
- **Endpoint**: `POST /api/ai/analyze-member/:id?window=30d`.
- **Caché**: 24h · el admin fuerza refresh con botón.
- **Coste/seguridad**: solo llama admins · rate limit 5/día/admin.

---

## 4 · Plan técnico · fases de implementación

### Fase 1 · Modelo de datos (solo frontend, con mocks)

**Nuevos archivos:**

- `src/data/memberStats.ts` — tipo `MemberStats` + mocks realistas para
  los 6 miembros activos.
- `src/lib/memberStatsStorage.ts` — hook `useMemberStats(id)` mock.

**Tipo:**

```ts
export interface MemberStats {
  memberId: string;
  window: "7d" | "30d" | "90d" | "year";
  // Resultados
  salesCount: number;
  salesValue: number;
  commissionValue: number;
  recordsApproved: number;
  recordsTotal: number;
  visitsDone: number;
  visitsScheduled: number;
  conversionRate: number;       // 0-1
  // Funnel
  openOpportunities: number;
  assignedLeads: number;
  pendingRecords: number;
  assignedPromotions: number;
  // Comunicación
  emailsSent: number;
  emailsOpened: number;
  whatsappSent: number;
  callsLogged: number;
  avgLeadResponseMin: number;
  // Actividad CRM
  avgDailyActiveMin: number;
  avgSessionMin: number;
  peakHour: number;             // 0-23
  hourlyHeatmap: number[];      // 168 celdas (día*hora)
  daysWithoutLogin: number;
  activeStreakDays: number;
  actionsPerSession: number;
  overduePendingTasks: number;
  duplicatesCreated: number;
  visitsUnevaluated: number;
}
```

### Fase 2 · Resumen en `MemberFormDialog`

- Ampliar `max-w-[560px]` → `max-w-[760px]`.
- Añadir sección colapsable "Rendimiento del miembro" después de
  "Estado de cuenta":
  - 6 tiles TOP: Ventas € · Registros aprobados · Visitas realizadas ·
    Tasa conversión · Tiempo activo/día · Ratio aprobación.
  - Link "Ver estadísticas completas →" que navega a
    `/equipo/:id/estadisticas`.
- Mock-friendly: si no hay stats, ocultar la sección.

### Fase 3 · Página `/equipo/:id/estadisticas`

**Nuevo archivo:** `src/pages/EquipoMiembroEstadisticas.tsx`

**Layout:**

1. Header con foto + nombre + role + CTA "Análisis IA".
2. Filtro temporal (7d / 30d / 90d / año).
3. Grid 3×2 de KPI cards principales (§2.1).
4. Funnel visualization (§2.2) · barra horizontal con números.
5. Panel comunicación (§2.3).
6. Heatmap día×hora de actividad (§2.4).
7. Panel "Patrones detectados" — salida del informe IA resumida.
8. Tabla cronológica de actividad reciente.

### Fase 4 · Flujos de alta (popup `InviteMemberDialog`)

**Nuevo archivo:** `src/components/team/InviteMemberDialog.tsx`

**Structure:**

- Dos tabs con ViewToggle: **Invitar** / **Crear cuenta**.
- Tab invitar: email + rol + preview del email enviado.
- Tab crear cuenta: formulario completo + botón "Generar contraseña"
  que produce `Ab3$kL9mZp2q`.
- Click en contraseña → copia al portapapeles con toast.
- Validación inline si el email ya existe (simulado con mock de otros
  workspace ids).

### Fase 5 · Integración backend

Documentar en `docs/backend-integration.md §1.9`:

```http
POST   /api/organization/members
  body: { email, fullName, jobTitle?, department?, languages?, role,
          phone?, visibleOnProfile?, canSign?, canAcceptRegistrations?,
          sendInvitation?: boolean, generateTempPassword?: boolean }
  409 EMAIL_TAKEN → { existingWorkspace: string }
  201 Created   → { member, tempPassword?: string }

GET    /api/members/:id/stats?window=30d → MemberStats

POST   /api/ai/analyze-member/:id?window=30d → AIMemberReport
```

### Fase 6 · Regla de oro en CLAUDE.md

Añadir bloque "🥇 REGLA DE ORO · KPIs en el dashboard del miembro".

---

## 5 · Prioridades sugeridas

Dos vías posibles:

**A · Rápido y visible (4-6h)**
1. `MemberStats` type + mocks.
2. Sección "Rendimiento" en dialog con 6 tiles.
3. Link a `/equipo/:id/estadisticas` (placeholder stub).
4. InviteMemberDialog con los dos flows (solo frontend mock).
5. Golden rule en CLAUDE.md.

**B · Ambicioso (2-3 días)**
Lo anterior + página de estadísticas completa con heatmap, funnel,
gráficos y análisis IA conectado (aunque sea con response mock
predeterminado).

---

## 6 · Preguntas abiertas para Arman

1. **Ventana temporal default** · ¿30 días? ¿O semanal?
2. **Benchmark** · ¿los KPIs se comparan contra media del equipo, contra
   el propio histórico del miembro, o ambos?
3. **Privacidad interna** · ¿el miembro puede ver sus propias stats o
   sólo el admin?
4. **IA · modelo concreto** · Claude Haiku 4.5 vs GPT-4o-mini (ver
   `docs/open-questions.md Q1` — decisión similar para duplicados).
5. **Tiempo activo en CRM** · ¿lo medimos con heartbeat cada X min o
   con eventos de acción?
