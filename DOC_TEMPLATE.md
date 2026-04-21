# DOC_TEMPLATE.md — Guía para documentar módulos

> Estructura y proceso que debe seguir cualquier módulo nuevo al ser
> documentado en `docs/screens/<nombre>.md` o en un `ARCHITECTURE_*.md` de
> raíz. Importado del repo de referencia (`figgy-friend-forge`) y adaptado
> al estilo de este proyecto.

---

## Proceso de documentación

### 1. Antes de empezar

- [ ] Identifica todas las **rutas** del módulo (Promotor y Agencia si aplica)
- [ ] Lista todos los **archivos** involucrados (tipos, datos, páginas, componentes)
- [ ] Verifica que los **tipos TypeScript** estén definidos en archivos separados
  (no inline dentro de componentes)
- [ ] Confirma con el responsable qué campos y reglas están **autorizados**
  para documentar

### 2. Estructura obligatoria

Cada módulo debe tener exactamente estas secciones, en este orden:

```
# Módulo [Nombre]

[Descripción de 1-2 líneas del propósito del módulo]

## Rutas
Tabla con: Ruta | Vista (Promotor/Agencia) | Descripción

## Modelo de datos
### [TipoRaíz]
Bloque TypeScript con TODOS los campos del tipo principal.
Copiar exactamente de los archivos .ts — NO inventar campos.

### [TiposSecundarios]
Cada sub-tipo referenciado en el tipo raíz.

### Estados
Tabla con: Estado | Label | Descripción
Indicar cuáles son definitivos y cuáles reversibles.

## Flujo del proceso
### Flujo principal
Pasos numerados: Quién → Qué → Resultado
### Variantes del flujo (si las hay)
Pasos adicionales según condiciones.

## Vista Promotor — Detalle
### Layout
Descripción de la estructura: master-detail, sidebar, tabs, etc.
### Componentes/secciones en orden
Lista numerada de cada sección visual.

## Vista Agencia — Detalle
### Diferencias con vista Promotor
Tabla comparativa: Característica | Promotor | Agencia

## Acciones
Cada acción (aprobar, rechazar, revertir, etc.) documentada con:
1. Qué abre (dialog, panel, etc.)
2. Campos del formulario en orden
3. Validaciones (qué es obligatorio, qué deshabilita el botón)
4. Resultado de la acción

## Reglas de negocio clave
Lista numerada de reglas que afectan el comportamiento.
Solo las que ya están implementadas.

## Escenarios que deben cubrirse
Tabla: Escenario | Condición que lo activa

## Archivos del módulo
Tabla: Archivo | Descripción
```

### 3. Reglas de contenido

#### ✅ SÍ hacer

- **Copiar tipos exactos** de los archivos `.ts` del proyecto
- **Documentar solo lo implementado**: si no existe en el código, no se
  documenta (salvo que esté marcado `TODO(…)` explícito)
- **Incluir comparativas Promotor vs Agencia** siempre que haya dos vistas
- **Referenciar archivos reales** con rutas completas desde `src/`
- **Indicar qué es obligatorio vs opcional** en cada acción/formulario
- **Describir estados visuales** usando tokens semánticos (`primary`,
  `emerald`, `amber`, `destructive`), nunca hex

#### ❌ NO hacer

- **NO inventar campos** que no estén en los tipos TypeScript
- **NO añadir funcionalidad no implementada** ("podría tener...", "en el
  futuro..."). Si falta, márcalo como `TODO(...)` y explica qué falta
- **NO documentar detalles de implementación interna** (nombres de
  variables locales, hooks privados)
- **NO incluir código de componentes React** — solo tipos de datos y props
  de componentes compartidos
- **NO usar colores hardcoded** en las descripciones (usar nombres
  semánticos, no `#FF0000`)
- **NO duplicar info** que ya esté en otro módulo — referenciar con
  "Ver Módulo X"

### 4. Formato de tipos TypeScript

```typescript
// Usar esta estructura exacta:
type NombreTipo = {
  campo: tipo;             // Descripción breve
  campoOpcional?: tipo;    // Indicar con ? los opcionales
};
```

- Copiar los campos tal cual están en el archivo fuente
- Añadir comentarios inline solo si el nombre del campo no es autoexplicativo
- Incluir los valores posibles de los union types (ej: `"active" | "inactive"`)

### 5. Formato de tablas comparativas

```
| Característica | Promotor | Agencia |
|---|---|---|
| [Nombre claro] | ✅ Descripción o ❌ No disponible | ✅/❌ |
```

- Usar ✅ y ❌ para claridad visual rápida
- Si la diferencia es sutil, describir en ambas columnas

### 6. Checklist de revisión

Antes de dar por terminada la documentación de un módulo:

- [ ] ¿Todos los tipos coinciden exactamente con los archivos `.ts`?
- [ ] ¿La tabla de rutas incluye TODAS las rutas del módulo?
- [ ] ¿Las diferencias Promotor/Agencia están en tabla comparativa?
- [ ] ¿Cada acción tiene sus campos, validaciones y resultado?
- [ ] ¿Los escenarios cubren todos los estados posibles?
- [ ] ¿La tabla de archivos incluye TODOS los archivos del módulo?
- [ ] ¿No se ha inventado ningún campo ni funcionalidad?
- [ ] ¿Se referencian los componentes compartidos?

---

## Módulos ya documentados (en este repo)

Ver índice completo en [`docs/screens/README.md`](docs/screens/README.md).

- Inicio — `docs/screens/inicio.md`
- Promociones (listado + filtros) — `docs/screens/promociones.md`,
  `promociones-filtros.md`
- Promoción · detalle — `docs/screens/promocion-detalle.md`
- Crear promoción · wizard — `docs/screens/crear-promocion.md`
- Colaboradores — `docs/screens/colaboradores.md`
- Agencia marketplace — `docs/screens/agencia-marketplace.md`
- Microsites — `docs/screens/microsites.md`
- Ventas — `docs/screens/ventas.md`
- Registros — `docs/screens/registros.md`
- Auth — `docs/screens/auth.md`

## Módulos pendientes

- [ ] Emails (`/emails`, `/ajustes/email/*`) — 🟡 **en curso**
- [ ] Contactos (`/contactos`, `/contactos/:id`)
- [ ] Calendario (`/calendario`)
- [ ] Ajustes (`/ajustes/*` shell + sub-páginas)

---

## Ejemplo: añadir el módulo Contactos

Si se quiere documentar Contactos, el proceso sería:

1. Leer `src/pages/Contactos.tsx` y `src/pages/ContactoDetalle.tsx`
2. Identificar los tipos en `src/types/` o `src/data/`
3. Listar las rutas: `/contactos`, `/contactos/:id`
4. Documentar las secciones del detalle en orden visual
5. Identificar qué acciones tiene (llamar, email, historial, etc.)
6. Comparar vistas si hay diferencias por rol
7. Listar los archivos involucrados
8. Validar con el checklist de revisión
