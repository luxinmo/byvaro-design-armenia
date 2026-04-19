# Pantalla · Crear promoción (`/crear-promocion`)

## Propósito

Wizard multi-paso para crear una nueva promoción. Recorre todas las
configuraciones necesarias (tipo, estado, info, multimedia, unidades,
colaboradores, plan de pagos) con auto-save del borrador.

**Audiencia**: Promotor. La Agencia no crea promociones.

## Flujo conceptual

El wizard tiene **14 pasos**, algunos condicionales según decisiones previas
(ver ramificación abajo). Todos los datos se agregan a un objeto
`WizardState` que se persiste en localStorage en cada cambio.

### Árbol de pasos

```
1. role                — ¿Promotor o Comercializador?
2. tipo                — ¿Unifamiliar / Plurifamiliar / Mixto?
3. sub_uni             — [solo si unifamiliar] ¿una sola / varias?
4. sub_varias          — [solo si unifamiliar] tipología + estilo
5. config_edificio     — [solo si plurifamiliar/mixto] bloques, plantas, aptos
6. extras              — [solo si plurifamiliar/mixto] trasteros, parkings, locales
7. estado              — ¿proyecto / en_construccion / terminado?
8. detalles            — tipo entrega, piso piloto, oficinas venta
9. info_basica         — nombre, ubicación, fotos portada
10. multimedia         — fotos + videos por categoría
11. descripcion        — texto descriptivo (IA o manual)
12. crear_unidades     — listado editable de cada unidad
13. colaboradores      — comisiones, condiciones, forma de pago
14. plan_pagos         — hitos de pago del comprador
```

### Ramificación condicional

```
tipo === "unifamiliar"
  → sub_uni === "una_sola"
    → sub_varias (tipología + estilo único) → estado
  → sub_uni === "varias"
    → sub_varias (multi tipologías con cantidades + estilos) → estado

tipo === "plurifamiliar" o "mixto"
  → config_edificio (bloques × escaleras × plantas × aptos)
  → extras (trasteros, parkings, locales)
  → estado
```

A partir de `estado`, el flujo es lineal para todos.

## Estado (`WizardState`)

Tipo completo en `src/components/crear-promocion/types.ts` (copiado 1:1 del
repo original). Resumen de campos principales:

```ts
interface WizardState {
  // Step 1: role
  role: "promotor" | "comercializador" | null;

  // Step 2: tipo
  tipo: "unifamiliar" | "plurifamiliar" | "mixto" | null;

  // Step 3: sub_uni (solo unifamiliar)
  subUni: "una_sola" | "varias" | null;

  // Step 4: sub_varias
  subVarias: "independiente" | "adosados" | "pareados" | null;
  estiloVivienda: EstiloVivienda | null;
  tipologiasSeleccionadas: { tipo: SubVarias; cantidad: number }[];
  estilosSeleccionados: EstiloVivienda[];

  // Step 5: config_edificio
  numBloques: number;
  escalerasPorBloque: number[];
  plantas: number;
  aptosPorPlanta: number;
  tieneLocales: boolean;
  locales: number;
  // ... más campos de configuración

  // Step 6: extras
  trasteros: number;
  parkings: number;

  // Step 7: estado
  estado: "proyecto" | "en_construccion" | "terminado" | null;
  faseConstruccion: FaseConstruccion | null;
  trimestreEntrega: string | null;
  tieneLicencia: boolean | null;
  fechaEntrega: Date | null;
  fechaTerminacion: Date | null;

  // Step 8: detalles
  tipoEntrega: TipoEntrega | null;
  pisoPiloto: boolean;
  oficinaVentas: boolean;
  oficinasVentaSeleccionadas: OficinaVenta[];

  // Step 9: info_basica
  nombrePromocion: string;
  direccion: DireccionPromocion | null;
  // precios, ...

  // Step 10: multimedia
  fotos: FotoItem[];
  videos: VideoItem[];

  // Step 11: descripcion
  descripcionMode: "ai" | "manual" | null;
  descripcion: string;

  // Step 12: crear_unidades
  unidades: UnitData[];

  // Step 13: colaboradores
  colaboracion: boolean;
  comisionInternacional: number;
  comisionNacional: number;
  diferenciarComisiones: boolean;
  // ...

  // Step 14: plan_pagos
  metodoPago: "contrato" | "manual" | "certificaciones" | null;
  hitosPago: HitoPago[];
  hitosCertificacion: HitoCertificacion[];
}
```

`defaultWizardState` está en el mismo archivo.

## Layout

```
┌──────────────┬──────────────────────────────────────────┐
│   Byvaro     │ Paso 3 de 14                   [X cerrar]│
│              │                                          │
│   CREAR      │  Título del paso                         │
│   PROMOCIÓN  │  Subtítulo                               │
│              │                                          │
│ ● Rol ✓      │  ┌────────┬────────┬────────┐            │
│ ● Tipo ✓     │  │ Card 1 │ Card 2 │ Card 3 │            │
│ ● Vivienda   │  └────────┴────────┴────────┘            │
│ ○ Tipología  │                                          │
│ ○ Estado     │                                          │
│ ○ Detalles   │                                          │
│ ○ Info       │                                          │
│ ○ Multimedia │                                          │
│ ○ Descripción│                                          │
│ ○ Unidades   │                                          │
│ ○ Colaborad. │                                          │
│ ○ Plan pagos │                                          │
│              │                                          │
├──────────────┼──────────────────────────────────────────┤
│  ← Atrás     │          Guardar borrador    Siguiente → │
└──────────────┴──────────────────────────────────────────┘
```

## Acciones del usuario

| Acción | Resultado |
|---|---|
| Click card de paso Role/Tipo | Selecciona opción + habilita Siguiente |
| Click Siguiente | Valida paso → avanza al siguiente |
| Click Atrás (primer paso) | Diálogo "¿Cancelar?" → `/promociones` |
| Click Atrás (otros pasos) | Retrocede un paso |
| Click Guardar borrador | Guarda localStorage + toast "Borrador guardado" |
| Click X | Diálogo "¿Salir? El borrador se conserva" → `/promociones` |
| Click paso completado en timeline | Salta directamente a ese paso |
| Click paso futuro en timeline | No hace nada (disabled) |
| Publicar (último paso) | Valida todo → POST `/promotions` → redirect a `/promociones/:id` con toast "Promoción creada" |

## Validaciones

Cada paso tiene su `canContinue()`:

| Paso | Validación |
|---|---|
| role | `state.role !== null` |
| tipo | `state.tipo !== null` |
| sub_uni | `state.subUni !== null` |
| sub_varias (una_sola) | `state.subVarias && state.estiloVivienda` |
| sub_varias (varias) | `state.tipologiasSeleccionadas.length > 0 && state.estilosSeleccionados.length > 0` |
| config_edificio | `state.numBloques >= 1` |
| extras | siempre válido |
| estado | `state.estado !== null` |
| detalles | siempre válido |
| info_basica | `state.nombrePromocion` |
| multimedia | siempre válido |
| descripcion | siempre válido |
| crear_unidades | siempre válido |
| colaboradores | siempre válido |
| plan_pagos | `state.metodoPago !== null` |

## Persistencia local

- Key: `byvaro-crear-promocion-draft`
- Se guarda en cada cambio de `state`
- Se carga al abrir `/crear-promocion` si existe
- Se borra en: Publicar exitoso, Cancelar confirmado

## API endpoints esperados

### Crear (publicación final)

```
POST /api/v1/promotions
body: WizardState
→ 201 { id, code, ...Promotion }
```

Backend responsabilidades:
- Validar todos los campos requeridos
- Calcular `totalUnits` a partir de config del edificio + unidades
- Generar código `PRM-xxxx` secuencial por empresa
- Crear las `unidades` individuales como filas separadas
- Si hay fotos en storage, confirmar que existen
- Marcar `missingSteps` si faltase algo (aunque el wizard debería prevenirlo)

### Guardar borrador (opcional, además de localStorage)

Opción para sincronizar el borrador al backend (para cambiar de dispositivo):

```
POST /api/v1/promotions/drafts
body: { state: WizardState }
→ { id, updatedAt }

GET /api/v1/promotions/drafts/latest
→ { id, state, updatedAt } | null
```

### Multimedia

Los uploads de fotos/videos del paso `multimedia` usan el flujo de
`/uploads/presign` descrito en `api-contract.md`.

## Permisos

Todo el wizard es **solo Promotor**. Las agencias no acceden a este flujo.

La ruta `/crear-promocion` debería tener guard de ruta:
```tsx
if (user.role !== "promotor") return <Navigate to="/promociones" />;
```

## Estados

- **Loading inicial** — Si hay borrador remoto, skeleton mientras se carga
- **Submitting (publicar)** — Botón "Publicar" con spinner, deshabilitar
  Atrás
- **Error de validación** — Highlight campo + mensaje bajo cada input
- **Error de red al guardar** — Toast rojo con "Reintentar"
- **Éxito** — Toast verde + redirect a detalle

## Implementación actual (fases)

### ✅ Fase 1 — Shell + pasos 1-2 (implementada)

- Timeline sidebar con todos los pasos visibles
- Shell con animaciones de transición (`fade + slide 12px`)
- Paso 1 (role) y paso 2 (tipo) portados 1:1 con OptionCard rediseñado
- Auto-save localStorage
- Footer con Atrás / Guardar borrador / Siguiente
- Placeholder "próximamente" para los 12 pasos restantes

### 🎨 Fase 2 — Pasos básicos (pendiente)

- sub_uni, sub_varias (ambas variantes)
- estado, detalles

### 🎨 Fase 3 — Pasos complejos (pendiente)

- info_basica (nombre + dirección con Google Places / MapBox)
- multimedia (drag & drop + categorización)
- descripcion (editor + sugerencia IA)

### 🎨 Fase 4 — Pasos avanzados (pendiente)

- crear_unidades (tabla editable)
- colaboradores (comisiones, condiciones)
- plan_pagos (hitos)

## Responsive

- **Móvil**: sidebar timeline oculto (`hidden lg:flex`), solo aparece
  "Paso N de M" en el header. El footer con Atrás / Borrador / Siguiente
  se adapta colapsando "Guardar borrador" en móvil
- **Desktop**: sidebar 280px + main area (max-w-580px por defecto, max-w-720
  en pasos "crear_unidades" y "colaboradores")

## Notas de implementación

- Usar **Framer Motion** para la animación entre pasos
  (`AnimatePresence mode="wait"`)
- Sonner para toasts (`position="top-center" richColors`)
- El timeline actualiza el `summary` bajo cada paso completado con un
  resumen del valor elegido (ej. "Unifamiliar · Villa Contemporáneo")

## TODOs al conectar backend

- [ ] `TODO(backend)`: endpoint POST `/promotions` que acepte `WizardState`
      y retorne la Promoción creada
- [ ] `TODO(backend)`: endpoint POST/GET `/promotions/drafts` para sync de
      borradores entre dispositivos
- [ ] `TODO(ui)`: implementar los 12 pasos restantes (Fases 2-4)
- [ ] `TODO(ui)`: integración con MapBox Places para el campo dirección
- [ ] `TODO(ui)`: drag & drop de fotos con react-dropzone + upload
      pre-firmado
- [ ] `TODO(ui)`: editor de descripción con generación IA (OpenAI o Claude
      API)
- [ ] `TODO(logic)`: guard `/crear-promocion` por rol
- [ ] `TODO(tests)`: tests E2E del flujo completo (Playwright)
