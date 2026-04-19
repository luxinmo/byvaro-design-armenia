# Documentación · Byvaro v2

Guía para cualquier dev, IA o persona que retome este proyecto.

## Para empezar

Si nunca has tocado Byvaro, lee en este orden:

1. **`../CLAUDE.md`** (raíz) — reglas operativas y convenciones del sistema
2. **`product.md`** — **qué es Byvaro, modelo de negocio, precios,
   diferencial** (leer primero)
3. **`architecture.md`** — flujos técnicos (colaboración, onboarding, IA
   duplicados)
4. **`ia-menu.md`** — estructura del menú
5. **`design-system.md`** — tokens, componentes, patrones visuales

## Conceptos clave específicos del producto

- **`paywall.md`** — cómo funciona el modo difuminado para agencia sin plan
- **`data-model.md`** — entidades, tipos, relaciones, reglas de negocio

## Para conectar backend

1. **`services.md`** — servicios externos a instalar (DB, auth, storage,
   email, SMS, mapas, pagos…)
2. **`api-contract.md`** — endpoints esperados por el frontend

## Spec funcional por pantalla (`screens/`)

Cada archivo documenta una pantalla con: propósito, layout, acciones, API
contract, permisos, estados.

| Ruta | Archivo | Estado |
|---|---|---|
| `/inicio` | [`inicio.md`](screens/inicio.md) | ✅ |
| `/promociones` | [`promociones.md`](screens/promociones.md) | ✅ |
| `/crear-promocion` | [`crear-promocion.md`](screens/crear-promocion.md) | 🟡 Fase 1 |
| `/marketplace` (Agencia) | [`agencia-marketplace.md`](screens/agencia-marketplace.md) | ⬜ |
| Resto | — | 🎨 placeholders |

## Log y roadmap

- **`../DECISIONS.md`** — 29 ADRs con decisiones tomadas
- **`../ROADMAP.md`** — estado por fases, replanteado según valor de
  negocio (no según orden de pantallas)
