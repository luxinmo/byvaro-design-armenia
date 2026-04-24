# QA · Tester del Calendario

> Checklist manual para validar que todos los flujos del Calendario
> funcionan. Cada item tiene un **cómo probar**, un **resultado
> esperado** y la ruta/archivo relevante.
>
> Complementa el tester automático `scripts/verify-calendar-mocks.ts`
> (node scripts/verify-calendar-mocks.ts · valida integridad de los
> mocks antes del deploy).

## A · Vistas del calendario

### A.1 · Vista Semana (default desktop)
- [ ] Entro a `/calendario` con ancho ≥1024px → la vista por defecto es Semana.
- [ ] El título muestra el rango de la semana (ej. "21 – 27 abr 2026").
- [ ] Día de hoy resaltado con el número en pill negra.
- [ ] Los eventos aparecen en su columna/hora correcta.
- [ ] Eventos `cancelled` / `noshow` salen atenuados + line-through.
- [ ] Eventos `pending-confirmation` salen con borde punteado.
- [ ] Click en slot vacío → abre dialog Crear con fecha+hora prefill.
- [ ] Click en evento → abre dialog Editar con todos los campos cargados.

### A.2 · Vista Mes (desktop)
- [ ] Cambio a "Mes" · grid 7×6 con días del mes anterior/siguiente atenuados.
- [ ] Hoy con círculo negro en el número.
- [ ] Máximo 3 eventos por día · el resto se resume en "+ N más".
- [ ] Click en "+ N más" → pasa a vista Día de ese día.

### A.3 · Vista Día
- [ ] Cambio a "Día" · 1 columna con resolución 30min (80px por hora).
- [ ] Eventos muestran título + contacto + ubicación.
- [ ] Click en slot vacío → crear evento con ese agente/hora.

### A.4 · Vista Agenda
- [ ] Cambio a "Agenda" · lista cronológica agrupada por día.
- [ ] Agrupaciones "Hoy · ...", "Mañana · ..." · resto con título del día.
- [ ] Click en evento vinculado a oportunidad → navega a `/oportunidades/:leadId`.
- [ ] El avatar del agente se ve a la derecha con foto real si existe
      (no solo iniciales).

### A.5 · Vista Mobile (viewport <1024px)
- [ ] El segmented sólo muestra "Mes" y "Agenda".
- [ ] Vista Mes mobile: grid 7×6 con dots de color por tipo de evento.
- [ ] Al tap en un día, se marca y aparece debajo la lista
      cronológica del día.
- [ ] FAB flotante bottom-right para crear evento.
- [ ] Botón "Agentes (N)" abre drawer con la sidebar de calendarios.

## B · Multi-calendario (sidebar agentes)

- [ ] Sidebar izquierda en desktop (≥1024px) muestra todos los miembros
      activos con checkbox coloreado + avatar real.
- [ ] Click en miembro → se oculta/muestra su carril en todas las vistas.
- [ ] Contador de eventos visible baja cuando se apaga un miembro.
- [ ] "Todos / Ninguno" toggle funciona.
- [ ] Botón "Conectar Google Calendar" muestra toast informativo.

## C · Crear / editar evento (dialog)

### C.1 · Bloqueo duro por conflicto (ADR-056)
- [ ] Elijo fecha+hora+duración de un evento que solape con otro del
      mismo agente (no `cancelled`/`noshow`).
- [ ] Aparece banner rojo "Conflicto de agenda" con el evento
      existente.
- [ ] Botón "Guardar" queda **deshabilitado** hasta resolver.
- [ ] CTA "Ir al evento en conflicto" cierra el dialog y navega al
      evento problemático.

### C.2 · Tipos de evento (5 opciones)
- [ ] Icono + label de cada tipo se centra correctamente.
- [ ] Cambiar tipo actualiza el placeholder del título.
- [ ] Cambiar tipo cambia el label "Ubicación" → "Número" si
      type=call.
- [ ] Si type=block/reminder, el campo Cliente se oculta.

### C.3 · Cliente/contacto con buscador
- [ ] Popover abre con los contactos existentes.
- [ ] Buscar por nombre filtra en vivo.
- [ ] Si el nombre tecleado NO existe como contacto, aparece opción
      "Crear cliente nuevo: X".
- [ ] Al elegir contacto existente, el selector muestra el nombre +
      bandera + email.
- [ ] Cambiar cliente resetea la promoción elegida (type=visit).

### C.4 · Selector de promoción (solo type=visit)
- [ ] Sección 1: **"Con registro aceptado · N"** (solo si el cliente
      tiene registros aprobados).
  - [ ] Chip verde "Registrado" junto al nombre.
- [ ] Sección 2: **"Otras promociones"** con el resto del catálogo.
  - [ ] Si el cliente tiene registro pendiente en alguna, aparece
        chip naranja "Registro pendiente".
- [ ] Selector está deshabilitado hasta que se elija cliente.

### C.5 · Flujo "Visita sin registro aceptado"
- [ ] Elijo un cliente y una promoción donde NO tiene registro
      aceptado.
- [ ] Aparece banner amarillo "El cliente aún no está registrado en
      esta promoción. Al crear la visita se enviará también el
      registro."
- [ ] Select "Estado" queda deshabilitado (forzado a
      `pending-confirmation`).
- [ ] Botón primario cambia a **"Enviar registro + programar visita"**.
- [ ] Al confirmar, toast "Registro enviado + visita programada" con
      descripción explicando que la visita está pendiente hasta
      aprobación.

### C.6 · Flujo "Cliente ya registrado pide solo visita"
- [ ] Elijo un cliente y una promoción donde SÍ tiene registro
      aprobado.
- [ ] NO aparece banner amarillo.
- [ ] Select "Estado" editable (default "Confirmado").
- [ ] Botón primario dice "Crear evento".
- [ ] Al confirmar, toast "Evento creado".

### C.7 · Edición
- [ ] Click en evento existente → dialog en modo edit con todos los
      campos pre-cargados.
- [ ] Si cambio fecha/hora, se re-ejecuta el chequeo de conflicto.
- [ ] Botón primario dice "Guardar cambios".

### C.8 · Responsive mobile
- [ ] Dialog respeta `95vw max-h-90vh` con scroll interno.
- [ ] Tipos en 3 columnas (mobile) / 5 (desktop).
- [ ] Fecha/Hora/Duración en 1 columna (mobile) / 3 (desktop).
- [ ] Footer con botón primary arriba del Cancelar (pulgar en mobile).

## D · Flujos Registro ↔ Visita (ADR-057)

### D.1 · Registro + visita desde agencia / microsite
- [ ] Un registro con `tipo: "registration_visit"` incluye fecha+hora
      de visita propuesta.
- [ ] Al entrar, se crea automáticamente un `CalendarEvent` con:
      - `type: "visit"`
      - `status: "pending-confirmation"`
      - `registroId: <id del registro>`
- [ ] En `/calendario`, esa visita aparece con borde punteado + chip
      "Pendiente de confirmación".

### D.2 · Promotor aprueba el registro
- [ ] Voy a `/registros` · acepto el registro.
- [ ] La visita asociada pasa automáticamente a
      `status: "confirmed"`.
- [ ] En el calendario la visita queda con estilo normal (sin
      borde punteado).
- [ ] Toast: "Registro aprobado · visita confirmada".

### D.3 · Promotor rechaza el registro
- [ ] Voy a `/registros` · rechazo el registro.
- [ ] La visita asociada pasa a `status: "cancelled"` con motivo.
- [ ] En el calendario la visita aparece con opacidad 0.4 y
      line-through.
- [ ] Toast: "Registro rechazado · visita cancelada".

### D.4 · Cliente ya registrado solicita solo visita
- [ ] Desde `/oportunidades/:id` (cliente con registro aprobado) →
      CTA "Programar visita" → dialog.
- [ ] Selector de promoción muestra sus promociones aprobadas
      primero (chip "Registrado").
- [ ] Al elegir una promoción aprobada, NO se exige crear nuevo
      registro.
- [ ] Visita creada va directamente a `status: "confirmed"` (si
      es el admin quien la crea) o `pending-confirmation` si la
      crea una agencia colaboradora.

### D.5 · Visita desde agencia llega al promotor
- [ ] La visita llega con `status: "pending-confirmation"` y el
      `assigneeUserId` del agente que la propuso.
- [ ] El promotor ve en su dashboard una "Actividad pendiente".
- [ ] Acepta → puede **reasignar** el agente (otro miembro del
      equipo) desde el mismo dialog.
- [ ] Tras aceptar, visita queda `confirmed` y aparece en el
      carril del agente asignado.

## E · Integraciones cross-pantalla

### E.1 · CTA "Programar visita" en ficha de oportunidad
- [ ] Desde `/oportunidades/:id` → botón primary "Programar visita".
- [ ] Deshabilitado si la oportunidad está `ganada`/`perdida`/
      `duplicate`.
- [ ] Al abrir, dialog pre-fillea type="visit" + lead + promoción
      origen + título "Visita · <nombre promoción>".

### E.2 · Widget "Hoy" en /inicio
- [ ] Muestra hasta 5 eventos del día actual (excluyendo
      cancelados).
- [ ] Ordenados por hora.
- [ ] Evento en curso marcado con "AHORA" en lugar de la hora.
- [ ] Click navega al evento o al calendario.
- [ ] Link "Calendario" en la esquina lleva a `/calendario`.
- [ ] Empty state si no hay eventos hoy.

### E.3 · Settings sincronización
- [ ] `/ajustes/calendario/sync` lista todos los miembros activos.
- [ ] "Conectar" → toast "Google Calendar conectado" · el estado
      cambia a conectado con email + hora de última sync.
- [ ] "Desconectar" → toast "Desconectado" · vuelve al estado
      inicial.
- [ ] Outlook / Apple iCal como placeholders "Pendiente".

## F · Filtros y búsqueda

- [ ] Segmented Semana/Mes/Día/Agenda recuerda la selección al
      navegar (session).
- [ ] Botón "Filtros" abre panel con chips por tipo y estado.
- [ ] Seleccionar un tipo filtra eventos en todas las vistas.
- [ ] Badge numérico en el botón "Filtros" con la cantidad activa.
- [ ] "Limpiar filtros" reset completo.

## G · Invariantes (nunca deben romperse)

- [ ] Un evento NO puede tener un `assigneeUserId` inexistente en
      TEAM_MEMBERS.
- [ ] `end >= start` siempre (duración ≥ 0).
- [ ] Dos eventos activos del mismo agente NUNCA solapan (salvo
      cancelados/noshow).
- [ ] Un `CalendarVisitEvent` con `registroId` debe apuntar a un
      registro que exista.
- [ ] Un evento con `leadId` debe apuntar a un lead que exista.

## H · Conocidos · cosas fuera de V1

- [ ] Multi-asignee (2+ agentes por evento) · se diseña en V2.
- [ ] Pipeline bar en ficha de oportunidad para mover etapa · TODO.
- [ ] Recordatorios automáticos (push/email/SMS) · TODO backend.
- [ ] Export `.ics` + envío al cliente por email/WhatsApp · TODO
      backend.
- [ ] Vista de "disponibilidad del equipo" (todos los agentes en
      columnas simultáneas) · pendiente.

---

**Cómo usar este checklist**:

1. `npm run dev` · `http://localhost:8080/calendario`.
2. Ir bloque por bloque marcando ✅ / ❌.
3. Cualquier ❌ → abrir ticket con referencia al doc (ej. "QA §D.2 ·
   aprobar registro no actualiza visita").
4. Antes del merge del PR, el checklist debe estar verde.
