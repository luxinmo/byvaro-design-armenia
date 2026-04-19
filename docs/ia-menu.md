# IA del menú · Byvaro v2

## Principios

1. **Agrupar por actividad**, no por feature técnica
2. **Todo en español**
3. **Nombres por comportamiento del usuario**: Colaboradores (no Agencies),
   Registros (no Records), Microsites (no Websites)
4. **Sin aspiracional**: no hay items del menú que apunten a páginas vacías
5. **Admin separada** del flujo comercial diario

## Estructura (Vista Promotor)

```
GENERAL
  ├─ Inicio                  /inicio             dashboard global con KPIs
                                                 y accesos rápidos

COMERCIAL
  ├─ Promociones             /promociones        listado + detalle + crear
  ├─ Registros               /registros          aprobación de solicitudes
  │                                              de captación de agencias
  ├─ Ventas                  /ventas             pipeline comercial
  └─ Calendario              /calendario         visitas + reuniones

RED
  ├─ Colaboradores           /colaboradores      agencias + analítica
  │                                              Agencia×Nacionalidad
  └─ Contactos               /contactos          CRM de clientes/leads

CONTENIDO
  ├─ Microsites              /microsites         webs públicas por promoción
  └─ Emails                  /emails             plantillas + campañas

ADMIN (pie del sidebar)
  └─ Ajustes                 /ajustes            empresa, equipo, integraciones
```

## Rutas especiales (fuera del AppLayout)

| Ruta | Pantalla | Notas |
|---|---|---|
| `/crear-promocion` | Wizard multi-paso | Fullscreen, sin sidebar |
| `/login`, `/register`, etc. | Auth | Sin AppLayout (planeadas) |
| `/onboarding` | Setup inicial | Planeada |
| `/preview/*` | Diseños alternativos | Solo accesibles por URL directa |

## Estructura (Vista Agencia, planeada)

Esta vista aún no está implementada en v2, pero se adaptará de forma
simétrica con permisos reducidos:

```
GENERAL
  ├─ Inicio                  /inicio             dashboard simplificado

COMERCIAL
  ├─ Promociones             /promociones        solo colaborables, read-only
  ├─ Promotores              /promotores         directorio de promotores
  ├─ Mis registros           /mis-registros      estado de sus solicitudes
  └─ Agenda                  /agenda             visitas propias

CRM
  └─ Mis contactos           /mis-contactos      clientes propios

ADMIN
  └─ Ajustes                 /ajustes
```

Notas clave de la Vista Agencia:
- **Sin `/ventas`** (no ve ventas de otras agencias)
- **Sin `/colaboradores`** (no ve la red del promotor)
- **Sin `/microsites`, `/emails`** (son del promotor)

## Mobile Bottom Nav

5 tabs visibles en móvil, con FAB central para acción rápida:

```
  Inicio    Promos    (+)     Red      Yo
```

El FAB abre un action sheet con: Nueva promoción · Registrar cliente ·
Programar visita · Enviar campaña.

Configurable por persona (diferente para Promotor vs Agencia).

## Comparativa con IA anterior (v1)

| v1 (antes) | v2 (ahora) | Razón |
|---|---|---|
| "Promotions" | "Promociones" | Español |
| "Dashboard" (link roto) | "Inicio" | Pasó a ser el home real |
| "Websites" (link roto) | "Microsites" | Mejor nombre |
| "Agencies" | "Colaboradores" | Más correcto comercialmente |
| "Records" | "Registros" | Español |
| "Correos electrónicos" | "Emails" | Más corto, igualmente claro |
| "My Files" (link roto) | — | Eliminado (los docs viven dentro de cada Promoción) |
| "Operations" (link roto) | — | Eliminado (confuso, no hacía nada) |
| "Sales" (link roto) | "Ventas" | Implementada |
| "Calendar" | "Calendario" | Español |

v1 tenía 11 items planos con 7 links rotos. v2 tiene 10 items agrupados en
4 secciones + Ajustes, todos funcionales.

Ver auditoría completa de pantallas v1: `byvaro-auditoria.html` (en
`design/`).
