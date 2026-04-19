# Documentación · Byvaro v2

Guía para cualquier dev, IA o persona que retome este proyecto.

## Para empezar

Si nunca has tocado Byvaro, lee en este orden:

1. **`../CLAUDE.md`** (raíz) — reglas operativas y convenciones del sistema
2. **`architecture.md`** — qué es Byvaro, personas, flujos
3. **`ia-menu.md`** — estructura del menú (nueva IA v2)
4. **`design-system.md`** — tokens, componentes, patrones visuales

## Para entender los datos

- **`data-model.md`** — entidades, tipos, relaciones, reglas de negocio
- El código vive en `src/data/*.ts` y `src/components/crear-promocion/types.ts`

## Para conectar backend

1. **`services.md`** — **servicios externos a instalar** (DB, auth, storage,
   email, SMS, etc.). **Lee esto primero** antes de empezar.
2. **`api-contract.md`** — endpoints esperados por el frontend

## Spec funcional por pantalla

`screens/` contiene un archivo por pantalla con:
- Propósito y audiencia
- Layout y componentes usados
- Acciones del usuario
- Validaciones
- API contract (endpoints + payloads)
- Permisos Promotor vs Agencia
- Estados (loading, empty, error)
- Cross-links con otras pantallas

Pantallas documentadas:

| Ruta | Archivo | Estado |
|---|---|---|
| `/inicio` | `screens/inicio.md` | ✅ diseñada |
| `/promociones` | `screens/promociones.md` | ✅ diseñada |
| `/crear-promocion` | `screens/crear-promocion.md` | 🟡 shell + pasos 1-2 |
| Resto | `screens/` (pendientes) | 🎨 placeholders |

## Log y roadmap

- **`../DECISIONS.md`** — log cronológico de decisiones tomadas
- **`../ROADMAP.md`** — qué está hecho, qué falta, prioridades
