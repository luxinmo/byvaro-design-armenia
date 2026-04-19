# Producto · Byvaro

Qué es, para quién, qué resuelve, cómo gana dinero.

## Propuesta de valor (en una frase)

> **Byvaro es el sistema operativo del promotor inmobiliario**: le da la web
> lista para vender y le resuelve el caos de los registros entre agencias
> con IA de duplicados.

## El problema que ataca

Un promotor inmobiliario empezando con una nueva promoción hoy tiene dos
dolores de cabeza que Byvaro resuelve de raíz:

### 1. La página web de la promoción

Cada nueva promoción "necesita" una web propia para generar leads (SEO,
marketing, portales). Hoy el promotor:

- Contrata a un freelance o agencia → 1.500-5.000€ + tiempo de coordinación
- Acaba con webs inconsistentes entre promociones
- No tiene forma de capturar leads directo a su CRM

**Byvaro entrega la web funcional lista** — un microsite por promoción con
plantilla profesional, formulario de captación que escribe directo en el
flujo de registros, SEO básico, dominio gratuito `byvaro.com/...` o custom.

### 2. Los registros entre agencias (el caos)

En obra nueva, las agencias "apartan" clientes ante el promotor para
proteger su comisión si el cliente termina comprando. El problema:

- Varias agencias pueden registrar al **mismo cliente** → lío de comisiones
- El promotor revisa manualmente si ya conoce al cliente, pierde horas al día
- Si apruebá mal, **disputas legales por la comisión**
- Si tarda en responder, la agencia se enfada y no le trae más clientes

**Byvaro automatiza esto con IA**: cada registro entrante se compara
contra los contactos propios del promotor + registros previos de otras
agencias al mismo promotor, y el sistema **recomienda aprobar o rechazar**
con un score de confianza y las coincidencias concretas.

## A quién va dirigido

Persona primaria: **promotor inmobiliario** (dueño del proyecto). El
comprador del SaaS.

Personas secundarias:

- **Agencia invitada** — usa Byvaro gratis para registrar clientes al
  promotor que la invitó. No paga.
- **Agencia marketplace** — la que quiere descubrir promotores y
  promociones nuevas para colaborar. Paga para acceder al catálogo completo.
- **Equipo del promotor** — comerciales, asistentes. Acceso según rol.

## Modelo de negocio

Tres tiers, dos lados del marketplace:

| Tier | Persona | Precio | Qué obtiene |
|---|---|---|---|
| **Promotor** | Dueño del proyecto | **249€ / mes** | Sistema completo: crear promociones ilimitadas, invitar agencias, IA duplicados, microsites, CRM, analítica |
| **Agencia invitada** | Agencia que recibe invitación del promotor | **0€ · gratis** | Acceso completo a las promociones donde colabora. Puede registrar clientes, ver unidades disponibles, programar visitas |
| **Agencia marketplace** | Agencia que quiere descubrir promotores nuevos | **99€ / mes** | Acceso al catálogo completo de promotores/promociones + posibilidad de pedir colaboración a los que le interesen |

Flujo económico:
```
Promotor paga 249€/mes → Byvaro
Agencia invitada → usa gratis (la trae el promotor)
Agencia marketplace paga 99€/mes → Byvaro
```

No hay fee por venta. No hay split de comisiones. Byvaro es puro SaaS
suscripción.

## El marketplace y la vista difuminada

**Crítico**: Byvaro es a la vez un CRM y un **marketplace bidireccional**.

- Un promotor puede descubrir agencias potenciales (parte de su vista
  Colaboradores)
- Una agencia puede descubrir promotores/promociones (parte de su vista)

Cuando una agencia **no tiene plan** entra al marketplace, ve que hay
promociones pero **no accede a ningún detalle**:

| Se oculta (blur / ausente) | Se muestra |
|---|---|
| Precios | Contador total de promociones disponibles |
| Fotos de la promoción | CTA "Upgrade a 99€/mes para acceder" |
| Nombre del promotor | Filtros funcionales (zona general, tipo, entrega) |
| Nombre de agencias colaboradoras | — |
| Ubicación exacta | — |
| Unidades disponibles | — |
| Datos de contacto | — |
| Botón "Colaborar" | — |

No es un preview parcial: es un **paywall total** que solo comunica que
existen promociones interesantes sin revelar nada de su contenido.

## Diferencial real frente a competidores

Competencia principal en España: **Witei, Inmoweb, Mundo Inmo, Arbitria**.
Todas buenas en CRM tradicional pero:

| Feature | Competidores | Byvaro |
|---|---|---|
| CRM inmobiliario | ✅ | ✅ |
| Web por promoción lista | ❌ (contrata aparte) | ✅ incluida |
| IA de duplicados de registros | ❌ (manual) | ✅ automática |
| Marketplace bidireccional (descubrimiento promotores↔agencias) | ❌ | ✅ |
| Multi-idioma nativo (compradores internacionales) | Parcial | ✅ (planeado) |
| Analítica Agencia × Nacionalidad | ❌ | ✅ |

El **"magic moment"** del producto: un promotor sube su primera promoción,
**tiene su web pública y su primer registro aprobado por IA en menos de 15
minutos**. Eso no lo hace nadie más en España.

## Flujos críticos (para priorizar en diseño)

### Flujo 1 · Promotor crea su primera promoción

1. Registro / login
2. Onboarding (datos de empresa → página de Empresa)
3. "+ Nueva promoción" → wizard 14 pasos (ver `screens/crear-promocion.md`)
4. Al completar todo + añadir comisión y sin warnings → promoción **activa**
5. Microsite auto-generado en `byvaro.com/<slug>` o `<promocion>.byvaro.app`
6. Invita a sus agencias de confianza

### Flujo 2 · Agencia recibe invitación y registra su primer cliente

1. Email con magic link → entra
2. Crea contraseña en primera pantalla
3. Ve la promoción donde colabora
4. Click "Registrar cliente" → mini-formulario (nombre, teléfono, email,
   nacionalidad)
5. Envío → el promotor recibe notificación

### Flujo 3 · IA de duplicados (la magia)

1. Llega registro nuevo al promotor
2. Sistema compara contra:
   - Contactos propios del promotor
   - Registros previos de otras agencias a esa misma promoción
3. IA devuelve: `{ matchPercentage, matchDetails[], recommendation }`
4. Promotor ve modal con "Aprobar / Rechazar" pre-sugerido
5. Click → respuesta automática al agente + al cliente

### Flujo 4 · Agencia marketplace upgradea

1. Agencia gratis navega marketplace → ve promociones difuminadas
2. Click → paywall "Upgrade para acceder"
3. Pago 99€/mes
4. Desbloquea todo el catálogo

## Roadmap de valor (qué construir primero, según impacto)

**P0 — El núcleo diferencial:**
1. Wizard crear promoción (ya 🟡) — crítico para onboarding
2. Microsites auto-generados — **30% del valor del producto**
3. IA de duplicados en registros — **40% del valor del producto**

**P1 — El marketplace:**
4. Vista Agencia con acceso a promociones donde colabora
5. Marketplace con paywall difuminado
6. Flujo de invitación con magic link

**P2 — Operativa diaria:**
7. Promociones listado (ya ✅)
8. Registros (aprobar/rechazar con IA)
9. Contactos / CRM

**P3 — Analítica y extras:**
10. Colaboradores + dashboard Agencia × Nacionalidad
11. Ventas (pipeline)
12. Calendario

**P4 — Integraciones (se decidirá más adelante):**
WhatsApp, n8n, S3, feeds de portales.

---

**Última actualización:** 19 abril 2026 · Tras conversación con Arman con el
contexto real del producto.
