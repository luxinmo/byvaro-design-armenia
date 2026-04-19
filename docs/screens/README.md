# Pantallas · Spec funcional

Cada archivo `.md` documenta una pantalla (o grupo de pantallas relacionadas)
con todo lo necesario para implementarla: propósito, layout, acciones, API
contract, permisos, estados, enlaces salientes.

## Índice

### Vista Promotor

| Pantalla | Ruta | Archivo | Estado |
|---|---|---|---|
| Inicio | `/inicio` | [`inicio.md`](inicio.md) | ✅ diseñada |
| Promociones | `/promociones` | [`promociones.md`](promociones.md) | ✅ diseñada |
| Crear promoción | `/crear-promocion` | [`crear-promocion.md`](crear-promocion.md) | ✅ diseñada (15 pasos) |
| Promoción · detalle | `/promociones/:id` | [`promocion-detalle.md`](promocion-detalle.md) | ✅ diseñada |
| Registros | `/registros` | (pendiente) | 🎨 placeholder |
| Ventas | `/ventas` | (pendiente) | 🎨 placeholder |
| Calendario | `/calendario` | (pendiente) | 🎨 placeholder |
| Colaboradores | `/colaboradores` | (pendiente) | 🎨 placeholder |
| Contactos | `/contactos` | (pendiente) | 🎨 placeholder |
| Microsites | `/microsites` | (pendiente) | 🎨 placeholder |
| Emails | `/emails` | (pendiente) | 🎨 placeholder |
| Ajustes | `/ajustes` | (pendiente) | 🎨 placeholder |

### Auth & Onboarding

| Pantalla | Ruta | Archivo |
|---|---|---|
| Login | `/login` | [`auth.md`](auth.md) |
| Registro | `/register` | [`auth.md`](auth.md) |
| Forgot password | `/forgot-password` | (pendiente) |
| Reset password | `/reset-password` | (pendiente) |
| Verify code | `/verify-code` | (pendiente) |
| Onboarding | `/onboarding` | (pendiente) |

### Vista Agencia (pendiente de diseño)

Las rutas se solapan con las de Promotor usando lógica dual-mode
(`agentMode` prop o lectura del rol del usuario).

## Plantilla para nuevas pantallas

Al crear una nueva pantalla, copia esta estructura:

```markdown
# Pantalla · {Nombre} (`/ruta`)

## Propósito
## Layout (ascii art o descripción)
## Componentes
## Acciones del usuario (tabla)
## Validaciones
## API endpoints esperados
## Permisos (Promotor vs Agencia)
## Estados (loading, empty, error)
## Enlaces salientes (tabla)
## Responsive
## Notas de implementación
## TODOs al conectar backend
```
