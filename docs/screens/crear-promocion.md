# Pantalla · Crear promoción (`/crear-promocion`) — REDISEÑO v3

> **Versión v3** — completo rediseño de la UX manteniendo el modelo de
> datos y la ramificación lógica del original Lovable. Punto de retorno
> en el tag git `v1-pre-wizard-redesign` si hace falta revertir.

## Propósito

Flujo guiado para crear una promoción inmobiliaria. El promotor entra,
rellena los datos necesarios, y sale con una promoción activa (o
borrador) lista para compartir con agencias. Objetivo de UX: **clase
"100 M€"**, intuitivo, rápido, sin fricción innecesaria.

**Audiencia:** Solo Promotor. Las agencias no crean promociones.

## Principios del rediseño

1. **14 pasos, 6 fases** — el número de pasos no cambia, pero el
   timeline los agrupa en 6 fases colapsables para no abrumar
2. **Preview lateral en vivo** (desktop) — card miniatura + microsite
   se actualizan mientras rellenas. El "wow" visual del producto
3. **Autoguardado visible** — indicador discreto arriba con timestamp
4. **Botón "Omitir"** en pasos NO esenciales (guarda null + warning
   amarillo en revisión final)
5. **Botón "Publicar rápido"** — cualquier momento que se cumpla el
   mínimo de publicación, el usuario puede publicar sin terminar todo
6. **Smart defaults** según selecciones previas (zona → amenities
   típicas, tipo → certificado energético esperado, etc.)
7. **Revisión final nueva** — paso 15 nuevo con resumen + warnings +
   dos CTAs (Publicar / Guardar borrador)
8. **Generación automática con preview editable** — no "magia" IA,
   sino borrador inicial que el usuario refina
9. **Micro-patrones reutilizados** — 7 patrones UX identificados del
   original (master switch + expansion, inline array editor, pill
   multi-select, etc.)
10. **Sin pérdidas funcionales** — TODO lo que el original hace,
    Byvaro v3 lo hace igual o mejor

## Estructura del timeline (6 fases)

```
┌───────────────────────────────────────────┐
│ ◉ 1. Tipología           (4 pasos)  ✓    │
│   ├ Rol                  ✓ Promotor       │
│   ├ Tipo                 ✓ Unifamiliar    │
│   ├ Vivienda             ✓ Una sola       │
│   └ Tipología + estilo   ✓ Villa · Med.  │
│                                            │
│ ◉ 2. Estructura          (2 pasos)  ─    │
│   ├ Configuración edificio                │
│   └ Extras                                │
│                                            │
│ ● 3. Comercialización    (3 pasos)  0/3  │
│   ├ Estado                                │
│   ├ Detalles finales                      │
│   └ Información básica                    │
│                                            │
│ ○ 4. Marketing           (2 pasos)  0/2  │
│   ├ Multimedia                            │
│   └ Descripción                           │
│                                            │
│ ○ 5. Operativa           (3 pasos)  0/3  │
│   ├ Crear unidades                        │
│   ├ Colaboradores                         │
│   └ Plan de pagos                         │
│                                            │
│ ○ 6. Revisión            (1 paso)   0/1  │
│   └ Publicar promoción                    │
└───────────────────────────────────────────┘
```

**Estados visuales:**
- `◉ done` — fase completada, summary visible en cada sub-paso
- `● current` — fase actual con contador `N/M completados`
- `○ upcoming` — fases futuras
- **Click** en fase completada o sub-paso done → navegar a editar

**Ramificación:** Fase 2 (Estructura) solo aparece si tipo=plurifamiliar
o mixto. Pasos sub_uni/sub_varias solo si tipo=unifamiliar (ya existente).

## Layout del wizard

```
┌────────────────┬─────────────────────────────┬──────────────────┐
│ SIDEBAR        │ TOPBAR                      │ PREVIEW LATERAL │
│  Logo Byvaro   │ Paso 3 · Tipología          │  (desktop xl+)  │
│                │ Guardado hace 2s ✓          │                  │
│  6 FASES       │                        [X]  │ Card mini       │
│   colapsable   ├─────────────────────────────┤   nombre        │
│                │                             │   imagen        │
│                │ CONTENIDO DEL PASO          │   precio        │
│                │                             │   ubicación     │
│                │                             │                  │
│                │                             │ Microsite mini  │
│                │                             │   vista pública │
│                │                             │   con branding  │
│                │                             │                  │
├────────────────┤                             │                  │
│  User          │                             │                  │
│  Descartar     │                             │                  │
├────────────────┴─────────────────────────────┴──────────────────┤
│ FOOTER                                                           │
│  ← Atrás       [Omitir]    Guardar borrador   Siguiente →       │
│                [Publicar ahora] (si mínimos cumplidos)          │
└──────────────────────────────────────────────────────────────────┘
```

## Validación mínima para "Publicar ahora"

Se habilita el botón si TODO esto está completado:
- `role` ≠ null
- `tipo` ≠ null
- Si tipo=unifamiliar: `subUni` ≠ null, tipología+estilo resueltos
- Si plurifamiliar/mixto: `numBloques ≥ 1`
- `estado` ≠ null
- `nombrePromocion` no vacío
- Al menos 1 foto en `fotos`
- `metodoPago` ≠ null (con plan de pagos básico)
- Si `colaboracion` activa: comisión definida

Los campos NO incluidos en el mínimo se marcan como "Por completar
después" en la revisión final, con warnings amarillos no bloqueantes.

## Botones "Omitir" por paso

| Paso | Omitir permitido | Qué hace al omitir |
|---|---|---|
| role | ❌ | esencial |
| tipo | ❌ | esencial |
| sub_uni / sub_varias | ❌ | define unidades |
| config_edificio | ❌ | define unidades |
| extras | ✅ | trasteros/parkings=0 |
| estado | ❌ | esencial comercial |
| detalles | ✅ | sin piso piloto / oficina |
| info_basica | parcial | certificado energético opcional, amenities opcionales |
| multimedia | ⚠️ (mín. 1 foto) | si ya hay ≥1 foto, omitir el resto |
| descripcion | ✅ | se genera auto |
| crear_unidades | ✅ | auto-generadas, editas después |
| colaboradores | master switch OFF | no acepta colaboradores |
| plan_pagos | si método=contrato | ya tiene info suficiente |

## Smart defaults inteligentes

- **Al elegir zona "Marbella"**: sugerir amenities costa (piscina, beach
  club, seguridad, conserje) con toast "¿Aplicar sugeridas?"
- **Al elegir tipo unifamiliar**: certificado energético sugerido A/B
- **Al elegir plurifamiliar**: certificado energético sugerido B/C
- **Al activar colaboradores**: comisión sugerida 5% (internacional)
- **Al activar trasteros**: 1 incluido por vivienda por defecto
- **Al elegir metodoPago=manual**: 3 presets clicables:
  - Proporcional simple (5% + 95%)
  - Estándar (10% + 30% + 60%)
  - Llaves (5% + 20% + 75%)

## Preview lateral en vivo (desktop xl+)

Panel derecho de ~320px ancho, sticky. Muestra dos cards:

### Card "Cómo se verá en el listado"
- Cover (si hay imagen, el placeholder si no)
- Nombre · Código
- Ubicación con MapPin
- Precio desde · fecha entrega
- KPIs (disponibles / comisión / obra)
- Se actualiza con cada edición

### Card "Cómo se verá en el microsite"
- Mini preview del microsite (simplificado):
  - Hero con cover + nombre
  - "Desde X €"
  - Botón "Solicitar info"
- Enlace "Ver microsite completo" (abre Fase 4 de docs)

En viewport < xl, este panel no aparece. Solo sidebar timeline a la
izquierda y contenido central.

## Revisión final (paso 15 nuevo)

Pantalla de resumen antes de publicar:

```
┌────────────────────────────────────────────┐
│ Todo listo. Revisa antes de publicar.     │
│                                            │
│ ▸ Villa Serena                             │
│   Marbella, Costa del Sol · Unifamiliar   │
│                                            │
│ ✓ Tipología y estilo                       │
│ ✓ Estado: Proyecto (con licencia)         │
│ ✓ Info básica (nombre, dirección, E-cert) │
│ ✓ 12 fotos · 1 video                       │
│ ⚠ Descripción omitida (se generará auto)  │
│ ✓ 1 unidad creada                          │
│ ⚠ Sin colaboradores (puedes añadir después)│
│ ✓ Plan de pagos: Contrato                  │
│                                            │
│ [Editar este bloque →] junto a cada item  │
├────────────────────────────────────────────┤
│ [Guardar borrador]  [Publicar promoción]  │
└────────────────────────────────────────────┘
```

Click en `✓` o `⚠` → navega al paso correspondiente.

## Reutilizables del sistema de diseño

### Patterns que se aplicarán:

| Pattern | Usos | Componente propuesto |
|---|---|---|
| Master Switch + expansion | extras (trasteros/parkings), detalles (oficinas), colaboradores | `<CollapsibleCard>` |
| Inline Array Editor | hitos comisión, hitos pago manual, certificaciones | `<ArrayEditor>` |
| Pill Multi-Select | amenities, características, zonas, vistas, estilos | `<PillMultiSelect>` |
| Total Checker | % hitos con color rojo/verde/gris | `<PercentageTotalChecker>` |
| Info Box contextual | alerts amber/primary/muted | `<InfoBox variant>` |
| Preset Selector | comisión estándar, plan de pagos estándar | `<PresetChips>` |

### Nuevos componentes UI (commits siguientes):

- `<PhaseTimeline>` — sidebar colapsable por fases
- `<AutoSaveIndicator>` — badge "Guardado hace N segundos"
- `<QuickPublishButton>` — aparece cuando se cumple mínimo
- `<WizardPreviewPanel>` — card miniatura + microsite mini
- `<CollapsibleCard>` — reemplaza los patterns de master switch
- `<PresetChips>` — chips con presets rápidos

## API contract (cuando haya backend)

### Crear promoción (mismo que v2)

```
POST /api/v1/promotions
body: WizardState
→ 201 { id, code, ...Promotion }
```

### Sincronización de borrador remoto (nuevo)

```
PATCH /api/v1/promotions/drafts/:draftId
body: { state: WizardState }
→ 204 updated
```

El borrador se sincroniza al backend con debounce de 2s. Permite
continuar en otro dispositivo. Si no hay conexión, cae al localStorage.

### Smart defaults contextuales (nuevo)

```
GET /api/v1/promotions/suggestions
  ?location=Marbella
  &tipo=plurifamiliar
→ {
    amenities: ["piscina", "beach_club", "seguridad", "conserje"],
    certificadoEnergetico: "B",
    priceRange: { min: 400000, max: 1500000 },
    commissionTypical: 5
  }
```

El backend analiza qué promociones similares hay en la misma zona y
sugiere rangos. Se muestran al usuario con toast "¿Aplicar sugeridas?"
opcional, nunca se aplican automático.

### IA descripción (Q1 pendiente — ver open-questions.md)

```
POST /api/v1/promotions/generate-description
body: { state: WizardState, language: "es" }
→ { description: "...", suggestedHashtags: [...] }
```

## Estado persistente

- **localStorage**: `byvaro-crear-promocion-draft` (igual que v2)
- **Debounced autosave** cada 2s de inactividad
- **Toast "Borrador guardado"** solo si el usuario pulsa manualmente
- Auto-indicator en top bar: "Guardado hace Xs" (visible siempre)

## Publicación

Al pulsar "Publicar promoción":

1. Cliente: validar canPublish()
2. POST `/api/v1/promotions`
3. Si éxito:
   - `clearDraft()`
   - Toast "Promoción creada correctamente"
   - Redirect a `/promociones/:id`
4. Si error validación 422:
   - Mostrar errores inline en los pasos correspondientes
   - Resaltar la fase del timeline con error
5. Si error de red:
   - Toast error + botón "Reintentar"
   - Borrador persiste

## Diferencias clave vs v2 (original Lovable)

| Aspecto | v2 Lovable | v3 Byvaro |
|---|---|---|
| Timeline | 14 items planos | 6 fases colapsables |
| Autosave | invisible | badge visible con timestamp |
| Preview | no existe | panel lateral card + microsite |
| "Omitir" | no existe | botón en pasos no-esenciales |
| "Publicar rápido" | no existe | desde cualquier punto si mínimo |
| Revisión final | no existe | nueva pantalla 15 con warnings |
| Smart defaults | no existe | sugerencias por zona/tipo |
| Presets | no existe | comisión, plan de pagos con presets |
| Descripción IA | botón mock | borrador editable pre-rellenado |

## Hoja de ruta del rediseño (commits)

- ✅ **C1** Docs + Shell nuevo (PhaseTimeline, autoguardado, preview placeholder)
- ⏳ **C2** Migrar pasos 1-8 ya existentes al shell nuevo + botón Omitir
- ⏳ **C3** Implementar info_basica con autocomplete + smart defaults
- ⏳ **C4** Implementar multimedia (drag&drop, categorías, bloqueo, reorder)
- ⏳ **C5** Implementar descripcion (IA mock + traducciones 8 idiomas)
- ⏳ **C6** Implementar crear_unidades con auto-generación
- ⏳ **C7** Implementar colaboradores (5 cards + presets)
- ⏳ **C8** Implementar plan_pagos (3 métodos + reserva + presets)
- ⏳ **C9** Revisión final + publicar rápido
- ⏳ **C10** Polish + docs finales

## Punto de retorno

Tag git `v1-pre-wizard-redesign` apunta al commit anterior al rediseño.

Para revertir:
```bash
git reset --hard v1-pre-wizard-redesign
git push --force-with-lease
```

Vercel vuelve al estado anterior en ~60s.

## TODOs al conectar backend (adicionales al original)

- [ ] `TODO(backend)`: endpoint `/promotions/suggestions?location&tipo` para smart defaults
- [ ] `TODO(backend)`: endpoint `/promotions/drafts` para sync remoto del borrador
- [ ] `TODO(backend)`: endpoint `/promotions/generate-description` (IA — Q1)
- [ ] `TODO(ui)`: implementar PhaseTimeline con expand/collapse
- [ ] `TODO(ui)`: WizardPreviewPanel con mock data inicial, conectar a state real
- [ ] `TODO(ui)`: validación `canPublish()` con lista de warnings
- [ ] `TODO(ui)`: Revisar paso con iconos check/warning y navegación
- [ ] `TODO(ui)`: AutoSaveIndicator con debounce + status (saving/saved/error)
- [ ] `TODO(tests)`: E2E completo del wizard con todos los caminos (Playwright)
