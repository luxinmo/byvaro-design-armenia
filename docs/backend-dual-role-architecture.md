# Backend dual-role architecture · definitive specification

> **Status · spec only.** This document defines the production backend
> for Byvaro's dual-role model. No code yet · the frontend mock has
> been refactored to anticipate this contract (scoped storage keys per
> organization, unified collaboration request adapter, derived business
> categories). Implement the schema, endpoints, and rules below
> exactly · any deviation is a regression.
>
> Companion documents:
> - `docs/dual-role-organization-model.md` · functional model
>   (UI flows, screens, banners, card markers).
> - `docs/backend-integration.md` · domain-by-domain UI ↔ API contracts.
> - `docs/permissions.md` · permission key catalogue and RLS strategy.

---

## 1 · Purpose

Byvaro is a multi-tenant SaaS that hosts two kinds of organizations
inside the same product, with the same user base and the same data
plane:

- **Developer / promotor** organizations · build and own real estate
  promotions, pay 249€/month, invite agencies as collaborators.
- **Agency / inmobiliaria** organizations · sell real estate on behalf
  of developers, free in Phase 1, can request collaborations.

A single organization may show **multiple derived business categories**
based on its activity:

- `inmobiliaria` · all `kind="agency"` orgs.
- `promotor` · any org with ≥1 active promotion where
  `promotion.owner_role = 'promotor'`.
- `comercializador` · any org with ≥1 active promotion where
  `promotion.owner_role = 'comercializador'`.

Categories are **always derived**, never persisted as flags on the
organization row.

This document defines the production backend (PostgreSQL + REST) that
replaces the current `localStorage` mock in `src/lib/empresa.ts`,
`src/lib/orgCollabRequests.ts`, `src/lib/solicitudesColaboracion.ts`,
`src/lib/invitaciones.ts`, and `src/lib/collabRequests.ts`. The
frontend already expects this shape · no UI changes are required for
the migration.

---

## 2 · Core principles

These are non-negotiable. Any feature request that contradicts them
must be rejected or escalated to product before implementation.

1. **Organization is the main tenant boundary.** Every business row
   carries an `organization_id`. RLS policies enforce isolation.
2. **Users belong to organizations through `organization_members`.**
   The same user may belong to several orgs; their effective role and
   permissions depend on the active organization in the session/JWT.
3. **A company can have multiple derived business categories.**
   Categories are computed from active promotions and `kind` · never
   stored on the organization row.
4. **`promotor` and `comercializador` are derived from active
   promotions, not from manual flags.** The `promotions.owner_role`
   column is per-promotion. A company can be both at once if it owns
   promotions of each kind.
5. **Cross-tenant reads/writes require an explicit collaboration row
   or a public endpoint.** No organization may read or write another
   organization's private data unless an `organization_collaborations`
   or `promotion_collaborations` row in `active` (or compatible) status
   exists, OR the data is exposed by a `/public` endpoint.
6. **Mock localStorage keys map 1:1 to database tables.** The frontend
   adapter layer translates current scoped keys (`byvaro-empresa:<orgId>`,
   `byvaro-oficinas:<orgId>`, `byvaro.org-collab-requests.v1`, etc.)
   to API calls. Do not invent new shapes during the migration.
7. **Never use the word "conflict" in UI/business copy.** Use
   `pending`, `accepted`, `rejected`, `cancelled` for collaboration
   requests and registrations. The word "conflict" is reserved for
   technical merge/concurrency contexts and never surfaces in user copy.
8. **Direction (`inbound`/`outbound`) is derived, never stored.** A
   `collab_requests` row has `from_organization_id` and
   `to_organization_id`. The API/UI computes direction from the
   current user's organization.
9. **Sensitive data is gated server-side.** Any field that the
   frontend hides via `RestrictedDetailsCard` (tax ID, fiscal address,
   contact, schedule) must be missing from `/public` endpoints and
   only present in `/sensitive` endpoints when the caller passes
   permission checks.
10. **Plan and billing live at the organization level.** The Stripe
    subscription, counters, and gates target `organizations.id`. See
    `CLAUDE.md §FASE 1 Backend real`.

---

## 3 · Database model

PostgreSQL ≥ 14. UUIDs everywhere unless noted. All timestamps are
`timestamptz`. Every table has RLS enabled with policies referencing
`current_setting('app.current_org')::uuid` and
`current_setting('app.current_user')::uuid` set per request.

### 3.1 · `organizations`

The tenant. One row per workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `kind` | `text` NOT NULL | enum: `developer`, `agency`. |
| `legal_name` | `text` | razón social. |
| `display_name` | `text` | nombre comercial. |
| `tax_id` | `text` | CIF/NIF/VAT. Unique-per-country if validated. |
| `email` | `text` | main contact. |
| `phone` | `text` | E.164. |
| `phone_prefix` | `text` | optional · `+34` etc. |
| `website` | `text` | |
| `logo_url` | `text` | private blob URL or CDN. |
| `cover_url` | `text` | hero cover. |
| `address_line` | `text` | one-line formatted address (Google Places). |
| `address_street` | `text` | structured fallback. |
| `address_postal_code` | `text` | |
| `address_city` | `text` | |
| `address_province` | `text` | |
| `country` | `text` | ISO 3166-1 alpha-2. |
| `status` | `text` NOT NULL DEFAULT `'active'` | enum: `active`, `inactive`, `suspended`. |
| `verified` | `boolean` NOT NULL DEFAULT `false` | KYC verified by Byvaro. |
| `verified_at` | `timestamptz` | nullable. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Indexes: `(kind, status)`, `(country)`, unique on `(tax_id, country)`
when `tax_id IS NOT NULL`.

### 3.2 · `organization_profiles`

One-to-one with `organizations`. Holds rich profile fields that vary
fast and don't belong on the core row.

| Column | Type | Notes |
|---|---|---|
| `organization_id` | `uuid` PK / FK organizations.id | |
| `description` | `text` | overview short. |
| `public_description` | `text` | aboutOverview long. |
| `tagline` | `text` | hero slogan. |
| `quote` | `text` | brand quote. |
| `quote_description` | `text` | |
| `founded_year` | `int` | yyyy. |
| `license_number` | `text` | primary license (RAICV, AICAT, …). |
| `licenses` | `jsonb` | array of `{ tipo, numero, etiqueta?, verificada }`. |
| `corporate_color` | `text` | hex. |
| `default_currency` | `text` | EUR/USD/GBP. |
| `default_language` | `text` | ISO. |
| `timezone` | `text` | Europe/Madrid. |
| `attention_languages` | `text[]` | derived from members but cacheable. |
| `commission_national_default` | `numeric(5,2)` | %. |
| `commission_international_default` | `numeric(5,2)` | %. |
| `commission_payment_term_days` | `int` | |
| `main_contact_name` | `text` | sensitive · `/sensitive` only. |
| `main_contact_email` | `text` | sensitive. |
| `main_contact_phone` | `text` | sensitive. |
| `schedule` | `text` | "L-V 9:30-19:00" · sensitive. |
| `linkedin` | `text` | |
| `instagram` | `text` | |
| `facebook` | `text` | |
| `youtube` | `text` | |
| `tiktok` | `text` | |
| `marketing_top_nationalities` | `jsonb` | array of `{countryIso, pct}`. |
| `marketing_product_types` | `jsonb` | array of `{tipo, precioDesde}`. |
| `marketing_client_sources` | `jsonb` | array of `{fuente, pct}`. |
| `marketing_portals` | `text[]` | ids of channels. |
| `google_place_id` | `text` | |
| `google_rating` | `numeric(3,2)` | |
| `google_ratings_total` | `int` | |
| `google_fetched_at` | `timestamptz` | |
| `google_maps_url` | `text` | |
| `visibility_status` | `text` NOT NULL DEFAULT `'visible'` | enum: `visible`, `incomplete`, `hidden`. Derived from min identity check; cached for query performance. |
| `metadata` | `jsonb` | overflow for non-canonical fields. |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Indexes: `(visibility_status)`.

### 3.3 · `organization_members`

Bridge table between users and organizations. Defines effective role.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK organizations.id NOT NULL | |
| `user_id` | `uuid` FK users.id NOT NULL | |
| `role` | `text` NOT NULL | enum: `admin`, `member`. |
| `status` | `text` NOT NULL DEFAULT `'active'` | enum: `active`, `invited`, `deactivated`. |
| `job_title` | `text` | nullable. |
| `department` | `text` | nullable. |
| `languages` | `text[]` | |
| `bio` | `text` | nullable. |
| `phone` | `text` | nullable. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `deactivated_at` | `timestamptz` | when `status='deactivated'`. |

Constraints: unique on `(organization_id, user_id)`. At least one
`role='admin' AND status='active'` row per organization (enforced via
trigger before delete/update).

### 3.4 · `offices`

Sales/operations offices owned by an organization. Multi-tenant scoped
via `organization_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK organizations.id NOT NULL | |
| `name` | `text` NOT NULL | |
| `address` | `text` | one-line. |
| `city` | `text` | |
| `province` | `text` | |
| `postal_code` | `text` | |
| `country` | `text` | ISO. |
| `phone` | `text` | |
| `phone_prefix` | `text` | |
| `email` | `text` | |
| `whatsapp` | `text` | |
| `schedule` | `text` | free text. |
| `logo_url` | `text` | |
| `cover_url` | `text` | |
| `is_main` | `boolean` NOT NULL DEFAULT `false` | exactly one per org. |
| `status` | `text` NOT NULL DEFAULT `'active'` | enum: `active`, `archived`. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Constraints: partial unique index on `(organization_id) WHERE is_main`
to enforce single main office per org.

### 3.5 · `promotions`

Real-estate developments. The single source of truth · the dual mock
arrays (`promotions.ts` + `EXTERNAL_PROMOTOR_PORTFOLIO`) merge into
this one table.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `owner_organization_id` | `uuid` FK organizations.id NOT NULL | THE isolation column. |
| `owner_role` | `text` NOT NULL | enum: `promotor`, `comercializador`. |
| `name` | `text` NOT NULL | |
| `reference` | `text` | internal SKU. |
| `description` | `text` | |
| `address` | `text` | |
| `city` | `text` | |
| `province` | `text` | |
| `country` | `text` | ISO. |
| `lat` | `numeric(9,6)` | |
| `lng` | `numeric(9,6)` | |
| `status` | `text` NOT NULL | enum: `incomplete`, `active`, `paused`, `sold_out`, `archived`. |
| `total_units` | `int` NOT NULL DEFAULT `0` | |
| `available_units` | `int` NOT NULL DEFAULT `0` | |
| `price_from` | `numeric(12,2)` | |
| `price_to` | `numeric(12,2)` | |
| `delivery` | `text` | "Q4 2026". |
| `image_url` | `text` | hero. |
| `gallery` | `jsonb` | array of urls. |
| `can_share_with_agencies` | `boolean` NOT NULL DEFAULT `true` | |
| `marketing_prohibitions` | `text[]` | channel ids prohibited. |
| `metadata` | `jsonb` | overflow (units, plans, brochure links). |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Indexes: `(owner_organization_id, status)`, `(country, city)`,
`(status) WHERE status='active'`.

### 3.6 · `collab_requests`

The unified, **single** table for all collaboration requests. Replaces
the three localStorage stores (`byvaro-invitaciones`,
`byvaro.agency.collab-requests.v1`, `byvaro.org-collab-requests.v1`).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `from_organization_id` | `uuid` FK organizations.id NOT NULL | sender. |
| `to_organization_id` | `uuid` FK organizations.id NOT NULL | receiver. |
| `promotion_id` | `uuid` FK promotions.id NULLABLE | only for `promotion_request` and optional for `invitation`. |
| `kind` | `text` NOT NULL | enum: `invitation`, `org_request`, `promotion_request`. |
| `status` | `text` NOT NULL DEFAULT `'pending'` | enum: `pending`, `accepted`, `rejected`, `cancelled`. |
| `created_by_user_id` | `uuid` FK users.id NOT NULL | |
| `responded_by_user_id` | `uuid` FK users.id NULLABLE | who accepted/rejected. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | this is the canonical "request date" · UI must read from here, never from `lastActivityAt` or any proxy. |
| `responded_at` | `timestamptz` NULLABLE | |
| `expires_at` | `timestamptz` NULLABLE | only for invitations (default `now() + 30 days`). |
| `message` | `text` NULLABLE | personalized message from sender. |
| `metadata` | `jsonb` | per-kind extras: invitation token, contract terms, commission, payment splits. |

Indexes: `(to_organization_id, status, kind)`,
`(from_organization_id, status, kind)`, `(promotion_id)`,
`(status, kind, expires_at) WHERE status='pending' AND expires_at IS NOT NULL`
(cron deactivates expired invitations).

Constraints:
- `CHECK (from_organization_id <> to_organization_id)` · cannot self-request.
- `CHECK (kind <> 'promotion_request' OR promotion_id IS NOT NULL)`.

Idempotency: a pending request between `(from, to, kind, promotion_id)`
is unique. New POST returns existing row instead of duplicating.

### 3.7 · `organization_collaborations`

Materialized B2B link between two organizations after a successful
request. Stable identity for the life of the relationship.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_a_id` | `uuid` FK organizations.id NOT NULL | sorted lexicographically: `a_id < b_id`. |
| `organization_b_id` | `uuid` FK organizations.id NOT NULL | |
| `status` | `text` NOT NULL DEFAULT `'active'` | enum: `active`, `paused`, `ended`. |
| `started_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `paused_at` | `timestamptz` | nullable. |
| `paused_reason` | `text` | nullable. |
| `ended_at` | `timestamptz` | nullable. |
| `ended_reason` | `text` | nullable. |
| `source_request_id` | `uuid` FK collab_requests.id NULLABLE | which request created the link. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Constraints: unique on `(organization_a_id, organization_b_id)`. Trigger
ensures `a_id < b_id` ordering (commutative pair).

Note: this table is the **org-level** link. The mock currently has no
agency↔agency model · this table covers all directions
(developer↔agency, agency↔agency, developer↔developer) once enabled.

### 3.8 · `promotion_collaborations`

Per-promotion collaboration between a developer (owner) and an agency
(commercializing partner).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `promotion_id` | `uuid` FK promotions.id NOT NULL | |
| `agency_organization_id` | `uuid` FK organizations.id NOT NULL | the agency. |
| `developer_organization_id` | `uuid` FK organizations.id NOT NULL | the owner. Must equal `promotions.owner_organization_id`. |
| `status` | `text` NOT NULL | enum: `pending_contract`, `active`, `paused`, `ended`. |
| `commission_percentage` | `numeric(5,2)` | nullable until contract signed. |
| `commission_payment_plan` | `jsonb` | array of `{tramo, completado, colaborador}`. |
| `contract_status` | `text` | enum: `none`, `draft`, `sent`, `viewed`, `signed`, `revoked`, `expired`. |
| `started_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `paused_at` | `timestamptz` | nullable. |
| `ended_at` | `timestamptz` | nullable. |
| `source_request_id` | `uuid` FK collab_requests.id NULLABLE | |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Indexes: `(agency_organization_id, status)`,
`(developer_organization_id, status)`, `(promotion_id, status)`.
Unique on `(promotion_id, agency_organization_id)` partial WHERE
`status IN ('pending_contract','active','paused')`.

### 3.9 · `collaboration_documents`

Contracts and other legal documents tied to either an org-level or
promotion-level collaboration.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `collaboration_id` | `uuid` FK organization_collaborations.id NULLABLE | |
| `promotion_collaboration_id` | `uuid` FK promotion_collaborations.id NULLABLE | |
| `document_type` | `text` NOT NULL | enum: `collaboration_contract`, `commission_agreement`, `nda`, `other`. |
| `file_url` | `text` NOT NULL | private blob URL. |
| `signed_file_url` | `text` | URL of signed PDF (Firmafy output). |
| `audit_file_url` | `text` | URL of audit trail PDF. |
| `status` | `text` NOT NULL | enum: `draft`, `sent`, `viewed`, `signed`, `revoked`, `expired`. |
| `signed_at` | `timestamptz` | nullable. |
| `expires_at` | `timestamptz` | nullable. |
| `provider` | `text` NOT NULL DEFAULT `'manual'` | enum: `firmafy`, `manual`, `other`. |
| `provider_external_id` | `text` | Firmafy reference. |
| `signers` | `jsonb` | array of `{user_id?, name, email, phone, status, sign_url?}` |
| `metadata` | `jsonb` | shipment type, language, replaces_contract_ids, etc. |
| `uploaded_by_user_id` | `uuid` FK users.id | |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Constraints: `CHECK (collaboration_id IS NOT NULL OR promotion_collaboration_id IS NOT NULL)`.

### 3.10 · `audit_events`

Append-only event log of every state-changing action across orgs.
Powers `/colaboradores/:id?tab=historial` and per-contact history.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` FK organizations.id NOT NULL | the workspace where the event lives. For cross-org events (e.g. invitation accepted), one row per org affected. |
| `actor_user_id` | `uuid` FK users.id NULLABLE | NULL when the event is system-generated (cron, webhook). |
| `entity_type` | `text` NOT NULL | enum: `organization`, `promotion`, `collab_request`, `organization_collaboration`, `promotion_collaboration`, `collaboration_document`, `office`, `member`, `registration`, `visit`, `sale`, `contact`. |
| `entity_id` | `uuid` NOT NULL | |
| `action` | `text` NOT NULL | enum: `created`, `updated`, `deleted`, `accepted`, `rejected`, `paused`, `resumed`, `ended`, `signed`, `sent`, `restored`, `cancelled`. Extensible but keep enum tight. |
| `before` | `jsonb` | snapshot before change (relevant fields only). |
| `after` | `jsonb` | snapshot after change. |
| `ip_address` | `inet` NULLABLE | |
| `user_agent` | `text` NULLABLE | |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Indexes: `(organization_id, created_at DESC)`,
`(entity_type, entity_id, created_at DESC)`,
`(actor_user_id, created_at DESC)`.

Retention: indefinite for now. Once volume justifies it, partition by
month and ship cold partitions to cheaper storage.

---

## 4 · Mapping from current frontend mock

The frontend has been refactored (see `src/lib/empresa.ts`,
`src/lib/collabRequests.ts`, `src/lib/orgCollabRequests.ts`) to use
**scoped storage keys** that anticipate the database. Each key maps
1:1 to a backend table:

| localStorage / mock key | Backend table | Notes |
|---|---|---|
| `byvaro-empresa:<orgId>` | `organizations` + `organization_profiles` | Scoped per org. The legacy `byvaro-empresa` (no suffix) is a fallback only for `developer-default` and disappears post-migration. |
| `byvaro-oficinas:<orgId>` | `offices` | Scoped per org. Legacy `byvaro-oficinas` is the same fallback story. |
| `byvaro.organization.members.v4:<workspaceKey>` | `organization_members` | Already scoped via workspace suffix. |
| `byvaro-invitaciones` | `collab_requests` WHERE `kind='invitation'` | Token, expiry, message all in `metadata`. |
| `byvaro.agency.collab-requests.v1` | `collab_requests` WHERE `kind='promotion_request'` | `promotion_id` is required for this kind. |
| `byvaro.org-collab-requests.v1` | `collab_requests` WHERE `kind='org_request'` | No `promotion_id`. |
| `promotions.ts` (Luxinmo seed) | `promotions` WHERE `owner_organization_id = <luxinmo>` | |
| `developerOnlyPromotions.ts` | `promotions` WHERE `owner_organization_id = <luxinmo>` | Merged into single table; the artificial split disappears. |
| `EXTERNAL_PROMOTOR_PORTFOLIO[orgId]` | `promotions` WHERE `owner_organization_id = orgId` | Same table; mock divergence in shape (`ExternalPortfolioEntry` vs `Promotion`) collapses to one row shape. |
| `agencies.ts` seed (status, estadoColaboracion, etc.) | `organization_collaborations` (paired with developer) + `organizations` (the row itself) | The `Agency.status` and `Agency.estadoColaboracion` fields collapse into the corresponding `organization_collaborations.status` row. |
| `byvaro.workspace.developerPack.v1:<wsKey>` | `workspace_features` (new table, not detailed here) or column on `organizations`. | Pack flag for agency that wants to publish own promotions. |
| `byvaro-favoritas-agencias` | `user_favorites(user_id, organization_id)` | Per-user, not per-org. |
| `byvaro.contracts.v1` | `collaboration_documents` | Already shaped close to the table. |
| `lastActivityAt` (Agency seed) | NOT a request date · do **not** use as proxy for `collab_requests.created_at`. Used only for "last activity" UI. |

The frontend adapter (`src/lib/collabRequests.ts`) merges the three
request stores into a unified `CollabRequest` shape that already
matches the table. Once endpoints exist, that adapter swaps its data
source from localStorage to fetch · the consumer hooks
(`useInboundPendingByOrgId`, `useOutboundPendingByOrgId`,
`usePendingCollabRequestsForWorkspace`) keep their signature.

---

## 5 · Collaboration request lifecycle

A single state machine governs all three kinds of requests
(`invitation`, `org_request`, `promotion_request`). The lifecycle is
identical · the differences are in side effects on accept and in the
permission checks on create.

### 5.1 · States

```
            ┌───────────┐
   create → │  pending  │ ──── responded_at IS NULL
            └─────┬─────┘
                  │
        ┌─────────┼─────────┬──────────┐
        ▼         ▼         ▼          ▼
   accepted   rejected   cancelled   (expired)
```

- `pending` · initial state · `responded_at IS NULL`.
- `accepted` · receiver approved · triggers side effects (see §5.4).
- `rejected` · receiver declined · no side effects beyond the row.
- `cancelled` · sender retracted (only allowed before `responded_at`).
- `expired` · only invitations · cron flips `pending → cancelled` when
  `expires_at < now()`. We model expired as `cancelled` with a
  metadata flag rather than a separate enum value · simpler queries.

Transitions are append-only on `responded_at` and `responded_by_user_id`.
We never re-open a closed request · the sender creates a new one.

### 5.2 · Direction is derived

The API returns `collab_requests` rows with their literal
`from_organization_id` and `to_organization_id`. The frontend (or the
`/me/...` endpoint variants below) computes:

- `direction = "inbound"` when `to_organization_id = current_org_id`.
- `direction = "outbound"` when `from_organization_id = current_org_id`.

Direction is never persisted. RLS ensures the caller only sees rows
where their org participates as either side.

### 5.3 · Per-kind creation rules

| Kind | Sender constraints | Receiver constraints | Required fields |
|---|---|---|---|
| `invitation` | `from_organization` must have `kind='developer'`. | `to_organization` may be any. | `metadata.token`, `expires_at`. Optional `promotion_id`. |
| `org_request` | Sender's `organization_profile` must pass `min_identity` check (legal_name, tax_id, fiscal address, contact). | Receiver may be any other org. | None beyond core. |
| `promotion_request` | Sender must be `kind='agency'`. Receiver must be `promotions.owner_organization_id`. Promotion must have `status='active'` and `can_share_with_agencies=true`. | Receiver is the developer. | `promotion_id` REQUIRED. |

The `min_identity` check (§6) applies only to `org_request`. Invitations
bypass it · an empty workspace can still accept an incoming
invitation. `promotion_request` does not require it either · the
agency's identity is not yet exposed cross-tenant.

### 5.4 · Accept side effects

| Kind | On accept |
|---|---|
| `invitation` | If `promotion_id` is set: insert `promotion_collaborations` row with `status='pending_contract'`. Always: insert `organization_collaborations` row with `status='active'` (developer↔agency), idempotent. |
| `org_request` | Insert `organization_collaborations` row with `status='active'`, idempotent. |
| `promotion_request` | Insert `promotion_collaborations` row with `status='pending_contract'`. Insert/update `organization_collaborations` row to `status='active'` if missing. |

The accept transaction must be atomic: a) update `collab_requests.status`,
b) upsert the materialized collaboration rows, c) emit an `audit_events`
row for each affected organization.

### 5.5 · Reject

Rejecting only updates `collab_requests` (`status='rejected'`,
`responded_at`, `responded_by_user_id`). For `promotion_request`,
rejection is **silent** · the agency does not see the rejection in
the UI; their card keeps showing the request as "outbound pending"
until the developer either accepts or sends an invitation that
overrides it (see `acceptInvitationOverride` in
`src/lib/solicitudesColaboracion.ts`). The doc-level mirror of this
rule lives in `CLAUDE.md §Solicitud de colaboración por promoción`.

### 5.6 · Cancel

Sender-side withdrawal. Allowed only while `status='pending'` and
`responded_at IS NULL`. Sets `status='cancelled'` and writes an audit
event in the sender's org log only.

---

## 6 · Permission rules

These are server-enforced. The frontend already mirrors them via
`useHasPermission()` and inline checks · the backend must replicate
each rule independently.

### 6.1 · Membership-based

- `organization_members.role='admin'` can:
  - PATCH `organizations` and `organization_profiles`.
  - CRUD `offices`.
  - Manage `organization_members` (invite, remove, change role).
  - Send `org_request` and accept/reject any inbound request.
  - Approve/reject `promotion_request` for promotions where their org
    is `owner_organization_id`.
  - Pause/resume/end `organization_collaborations` and
    `promotion_collaborations` they own.
  - Upload `collaboration_documents` for the developer side
    (agencies cannot upload; they sign via Firmafy email/SMS OTP).
- `organization_members.role='member'` can:
  - GET own organization's data (`/organizations/me/*`).
  - View public profiles of other organizations (`/organizations/:id/public`).
  - Use the operational features (registrations, visits, contacts) on
    promotions they have been assigned via `promotion_collaborations`.
  - Cannot edit organization profile, invite members, or send
    org-level collaboration requests unless granted via
    `permission_grants` (future · see §10).

### 6.2 · Cross-organization

- An organization can read another's `/sensitive` profile (tax id,
  fiscal address, schedule, contacts) only if:
  1. Caller is admin of an organization that has an active
     `organization_collaborations` row paired with the target, OR
  2. Caller is admin of an organization that has at least one
     `promotion_collaborations` in `active` or `pending_contract`
     status with the target.
- Public profile (`/organizations/:id/public`) is unrestricted but
  excludes `tax_id`, `address_*` fields, and `main_contact_*`.
- Bulk actions (selection + email send) restricted to organizations
  in `organization_collaborations.status='active'` with the caller's
  org. Frontend mirrors this via `canInteract`. Backend enforces by
  refusing email-send POST when targets fall outside that set.

### 6.3 · Min identity check (sending org_request)

Server validates before `INSERT INTO collab_requests (kind='org_request', ...)`:

```sql
SELECT
  o.legal_name IS NOT NULL AND o.legal_name <> '' AS has_legal_name,
  o.tax_id IS NOT NULL AND o.tax_id <> ''         AS has_tax_id,
  (o.address_line IS NOT NULL AND o.address_line <> '')
    OR (o.country IS NOT NULL AND o.address_city IS NOT NULL) AS has_fiscal,
  (o.email IS NOT NULL AND o.email <> '')
    OR (o.phone IS NOT NULL AND o.phone <> '')   AS has_contact
FROM organizations o
WHERE o.id = :sender_org_id;
```

If any column is `false`, return `422 missing_identity` with the list
of missing fields. Frontend already shows the toast.

### 6.4 · Promotion ownership

Only the `owner_organization_id` of a promotion can:
- PATCH the promotion.
- Approve/reject/restore `promotion_request` for that promotion.
- Send `invitation` with that `promotion_id`.
- Upload contract documents for `promotion_collaborations` involving
  that promotion.

### 6.5 · Self-protection

- A user cannot send a request to their own org
  (`from_organization_id <> to_organization_id` enforced at DB level).
- A user cannot accept/reject a request where their org is not
  `to_organization_id`.
- A user cannot cancel a request where their org is not
  `from_organization_id`.

---

## 7 · API endpoints proposal

REST · JSON · cookie or bearer JWT. All endpoints scoped by the
session JWT's `organization_id` (the active workspace). The JWT also
carries `user_id` and `role`; never trust org identity sent in the
body.

### 7.1 · Organization

| Method | Path | Description |
|---|---|---|
| GET | `/organizations/me` | Full profile of caller's organization (sensitive fields included). |
| PATCH | `/organizations/me` | Update fields. Admin only. Triggers `audit_events`. |
| GET | `/organizations/:id/public` | Public profile (no sensitive fields). Available to any authenticated user. |
| GET | `/organizations/:id/sensitive` | Sensitive profile. Permission gate per §6.2. |
| GET | `/organizations/me/categories` | Returns derived categories `["inmobiliaria","promotor","comercializador"]` based on `kind` and active promotions' `owner_role`. |
| POST | `/organizations/me/verification` | Initiates KYC (Firmafy). |

### 7.2 · Members

| Method | Path | Description |
|---|---|---|
| GET | `/organizations/me/members` | List members. Members visible: admin sees all; member sees self + visible peers per role. |
| POST | `/organizations/me/members` | Invite member by email. Admin only. |
| PATCH | `/members/:id` | Update role / job title / status. Admin only. |
| POST | `/members/:id/handover` | Asset reassignment before deactivation (see CLAUDE.md handover rule). |
| DELETE | `/members/:id` | Soft delete (sets `status='deactivated'`). Requires handover. |

### 7.3 · Offices

| Method | Path | Description |
|---|---|---|
| GET | `/organizations/me/offices` | Caller's offices. |
| GET | `/organizations/:id/offices` | Other org's offices · public-safe subset (no internal phone/email if not collaborator). |
| POST | `/organizations/me/offices` | Create office. Admin only. |
| PATCH | `/offices/:id` | Update. Admin only. |
| DELETE | `/offices/:id` | Soft delete (sets `status='archived'`). Cannot delete the main office without promoting another first. |

### 7.4 · Promotions

| Method | Path | Description |
|---|---|---|
| GET | `/promotions` | Caller's own promotions (filtered by `owner_organization_id = current_org`). Supports `?status=`, `?owner_role=`. |
| GET | `/promotions/marketplace` | Public promotions (subset of fields), filterable for agency discovery. |
| GET | `/promotions/:id` | Detail. Caller must own the promotion OR be in an active `promotion_collaboration` for it. |
| POST | `/promotions` | Create. Caller's org must be `developer` or have the developer pack. Counts toward plan gate (`createPromotion`). |
| PATCH | `/promotions/:id` | Update. Owner admin only. Status transitions to `active` are gated (`createPromotion`). |
| DELETE | `/promotions/:id` | Soft archive. |

### 7.5 · Collaboration requests

| Method | Path | Description |
|---|---|---|
| GET | `/collab-requests` | Caller-relevant rows. Query params: `?direction=inbound\|outbound`, `?status=pending\|...`, `?kind=invitation\|org_request\|promotion_request`. Direction computed from JWT. |
| GET | `/collab-requests/:id` | Single row. RLS allows only sender or receiver. |
| POST | `/collab-requests` | Body: `{kind, to_organization_id, promotion_id?, message?, metadata?}`. Sender computed from JWT. Idempotent on `(from, to, kind, promotion_id)` while pending. Validates per-kind rules from §5.3. Validates min_identity for `org_request`. |
| POST | `/collab-requests/:id/accept` | Receiver only. Atomic accept + side effects (§5.4). |
| POST | `/collab-requests/:id/reject` | Receiver only. Reason in body optional. |
| POST | `/collab-requests/:id/cancel` | Sender only, while `pending`. |
| POST | `/collab-requests/:id/restore` | Receiver only · moves `rejected → pending` for `promotion_request` reconsideration. |

### 7.6 · Org-level collaborations

| Method | Path | Description |
|---|---|---|
| GET | `/collaborations` | Caller-relevant org-level collaborations. |
| GET | `/collaborations/:id` | Detail. Caller must be on either side. |
| PATCH | `/collaborations/:id/pause` | Either side admin can pause. |
| PATCH | `/collaborations/:id/resume` | Either side admin can resume. |
| PATCH | `/collaborations/:id/end` | Either side admin can end. Audit event in both org logs. |

### 7.7 · Promotion collaborations

| Method | Path | Description |
|---|---|---|
| GET | `/promotion-collaborations` | Caller-relevant rows. Filters: `?promotion_id=`, `?agency_id=`, `?status=`. |
| GET | `/promotion-collaborations/:id` | Detail. Caller must be agency or developer side. |
| POST | `/promotion-collaborations/:id/approve` | Developer admin only. Used when collaboration was `pending_contract` and contract gets signed. Promotes to `active`. |
| POST | `/promotion-collaborations/:id/reject` | Developer admin only. Sets `status='ended'` if not yet started; otherwise blocked (use `/end`). |
| PATCH | `/promotion-collaborations/:id/pause` | Developer admin only · agency cannot operate while paused. |
| PATCH | `/promotion-collaborations/:id/resume` | Developer admin only. |
| PATCH | `/promotion-collaborations/:id/end` | Developer admin only · per-promo end. |

### 7.8 · Documents

| Method | Path | Description |
|---|---|---|
| GET | `/promotion-collaborations/:id/documents` | List. Both sides admin can read. |
| POST | `/promotion-collaborations/:id/documents` | Upload. Developer admin only (agency cannot upload). |
| POST | `/documents/:id/send-to-sign` | Trigger Firmafy. Developer admin only. |
| POST | `/documents/:id/revoke` | Developer admin only. |

### 7.9 · Audit log

| Method | Path | Description |
|---|---|---|
| GET | `/organizations/me/audit` | Paginated, filterable by `entity_type`, `entity_id`, `action`, date range. |
| GET | `/organizations/:id/audit` | Cross-org log (e.g. for the historical tab on a collaborator's profile). Permission: caller must be admin of an org with active collaboration. |

### 7.10 · Response shape · 422 missing identity

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json
```
```json
{
  "code": "missing_identity",
  "missing": ["legal_name", "tax_id"]
}
```

The frontend already handles this code · do not invent a new shape.

### 7.11 · Response shape · 402 plan gate

(Documented in `CLAUDE.md §FASE 1`, repeated here for completeness.)

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```
```json
{
  "code": "limit_exceeded",
  "trigger": "createPromotion" | "inviteAgency" | "acceptRegistro",
  "tier": "trial" | "promoter_249",
  "used": 2,
  "limit": 2
}
```

---

## 8 · Data access validation

These rules are non-negotiable. The agent implementing the backend
must add a regression test for each one before shipping.

1. **Every business query must filter by `organization_id` or pass
   through an explicit collaboration check.** No exceptions.
2. **`promotions` queries must filter by `owner_organization_id`**
   except for `/promotions/marketplace` which exposes a curated
   public subset.
3. **No cross-tenant local/global reads in application code.** RLS
   should make this physically impossible · the code must not
   `SET LOCAL ROW SECURITY OFF` outside of admin migration scripts.
4. **Never trust `organization_id` from the request body or query
   string.** Always read from the JWT's `organization_id` claim.
5. **`from_organization_id` on `collab_requests` is set from the JWT,
   never from the body.** The body provides `to_organization_id`,
   `kind`, `promotion_id`, `message`. The server fills `from`.
6. **Sensitive fields are returned only by `/sensitive` endpoints**
   guarded by §6.2 checks. Public endpoints must omit them at the
   serializer layer · removing them in tests passes the case where
   a developer accidentally adds the field to the public schema.
7. **`responded_by_user_id` is set from the JWT.** Body cannot specify
   it.
8. **Bulk endpoints (e.g. send-email-to-collaborators) must validate
   each recipient against `organization_collaborations.status='active'`**
   before dispatching, not just check that the targets exist.
9. **Accept transactions must be ATOMIC** (status update + side
   effects + audit events) · use `BEGIN ... COMMIT` and either
   `SERIALIZABLE` isolation or per-pair advisory locks to prevent
   double-accept races.

---

## 9 · Migration strategy from mock to backend

Five phases. Each phase is independently shippable to production.

### Phase 1 · Document and freeze the contract (this PR)

- This document.
- Frontend mock already refactored to scoped storage and unified
  request adapter (see commits on `feat/leads-oportunidades`).
- No backend code yet.

### Phase 2 · Add API layer alongside the mock

- Create the schema in a new Postgres database.
- Implement read endpoints first (`GET /organizations/me`,
  `GET /collab-requests`, `GET /promotions`, `GET /offices`).
- Frontend adapter (`src/lib/empresa.ts`,
  `src/lib/collabRequests.ts`) gains a feature flag
  `BYVARO_USE_REMOTE_PROFILES=1` that swaps `loadEmpresaForOrg`
  from localStorage to fetch · same shape.
- Mock localStorage remains the canonical source until Phase 3.

### Phase 3 · Cut over writes

- Implement `POST`, `PATCH`, `DELETE` endpoints with full validation,
  RLS, and audit emission.
- Frontend swaps mutating helpers
  (`saveEmpresaForOrg`, `crearOrgCollabRequest`, `crearSolicitud`,
  `useInvitaciones().invitar`, `aceptarOrgCollabRequest`,
  `rechazarOrgCollabRequest`, etc.) to the API.
- Remove the dual-write to legacy keys
  (`byvaro-empresa`, `byvaro-oficinas`).

### Phase 4 · Remove legacy keys and seed fallbacks

- Delete the legacy fallbacks in `loadEmpresaForOrg` and
  `loadOficinasForOrg` (the `EMPRESA_KEY_LEGACY` /
  `OFICINAS_KEY_LEGACY` branches).
- Delete `LUXINMO_PROFILE` fixture, `EXTERNAL_PROMOTOR_PORTFOLIO`,
  `agencies.ts` seed.
- Replace with backend seed scripts (`seed-data.sql`) that bootstrap
  a demo workspace for sales demos only.

### Phase 5 · Audit and event history

- Wire `audit_events` writes into every state-changing endpoint.
- Surface them in the `/colaboradores/:id?tab=historial` view via
  `GET /organizations/:id/audit`.
- Add the Stripe webhook handler that activates `promoter_249` on
  `customer.subscription.created` (covered in
  `docs/backend-integration.md §12`).

---

## 10 · Open questions

These decisions affect the schema and must be resolved with product
before Phase 2.

1. **Agency↔agency collaborations from day one?** The schema
   supports it (`organization_collaborations` is symmetric), but the
   UI for it is incomplete (no Resumen tab for agency↔agency
   collaboration). Default: enabled at DB level, hidden in UI until
   product validates.
2. **Must promotion-level collaboration require an active org-level
   collaboration first?** Today the mock does not enforce this. Schema
   allows decoupling. Recommendation: yes for Phase 2 (cleaner audit
   trail), but accepting an `invitation` with `promotion_id` should
   auto-create the org-level row idempotently.
3. **Is contract signing required before `promotion_collaborations.status='active'`?**
   Currently `pending_contract` is the gate. Product must decide
   whether to allow operational activity (registrations, visits)
   before the contract is signed. Default proposal: registrations
   allowed in `pending_contract`, sales (commission accrual) require
   `active`.
4. **Should `organization_profiles.visibility_status` block inbound
   request creation (not just outbound)?** Today only outbound
   `org_request` validates min_identity. Inbound (someone reaches
   us) does not. Question: if my profile is incomplete, should
   peers still be able to find and request me, or am I "invisible"?
5. **Granular member permissions beyond `admin`/`member`?** Phase 1
   sticks to two roles. Schema-level: add a `permission_grants`
   table later (`member_id`, `permission_key`, `granted_by`,
   `granted_at`). Resolve when first concrete demand appears
   (e.g. "billing-only viewer", "registrations-only operator").
6. **Hard-delete vs soft-delete on `collab_requests`?** Spec is
   append-only with status changes. Confirm GDPR retention policy ·
   if a user requests erasure, what happens to their `created_by_user_id`?
   Recommend: anonymize (set to NULL or a tombstone user), do not
   physically delete the row · audit integrity requires it.
7. **Should `collab_requests.metadata` be JSONB or split into
   per-kind columns?** JSONB keeps the schema lean but loses
   indexability. Recommend JSONB for now; promote to columns when a
   query becomes slow.

---

## 11 · Non-negotiable rules

A short version of §2 + §8, intended as the "lint" pass for any PR
touching collaboration logic. Memorize.

1. Do **not** use a global `organizations` storage key. Always
   scoped by `organization_id` (in DB: RLS column; in mock: key
   suffix).
2. Do **not** derive collaboration state from UI-only flags.
   Collaboration lives in `organization_collaborations` and
   `promotion_collaborations` rows; the frontend reads from there.
3. Do **not** use `lastActivityAt` (or any other proxy) as the
   "request date". The canonical timestamp is `collab_requests.created_at`.
4. Do **not** manually assign `promotor` or `comercializador`
   categories. They are derived from `promotions.owner_role` of
   active rows.
5. Do **not** show an organization as an external visitor on its
   own profile. Compare `to_organization_id` (or `tenantId`) against
   the JWT's `organization_id`; if equal, render owner mode.
6. Do **not** expose sensitive company data (tax id, fiscal address,
   schedule, contacts) without permission. Public endpoint must
   omit them at the serializer.
7. Do **not** use the word "conflict" in UI/business copy. Use
   `pending`, `accepted`, `rejected`, `cancelled`.
8. Do **not** trust `organization_id` from the client. Always read
   from the JWT.
9. Do **not** physically delete `collab_requests` rows · they are
   audit material. Anonymize `created_by_user_id` if GDPR requires.
10. Do **not** allow agencies to upload contracts. Agencies sign via
    Firmafy email + SMS OTP; only the developer side uploads.

---

## 12 · References

- `docs/dual-role-organization-model.md` · functional model.
- `docs/backend-integration.md` · domain-by-domain UI ↔ API
  contracts (most domains already documented; this doc consolidates
  the dual-role specifics).
- `docs/permissions.md` · permission keys and RLS strategy.
- `docs/backend/integrations/firmafy.md` · contract signing flow.
- `docs/backend/domains/collaboration.md` · prior collaboration
  notes (now superseded by §3-§7 here).
- `CLAUDE.md` · project rules of thumb (multi-tenant per workspace,
  paywall enforcement, etc.).
- Frontend anchors:
  - `src/lib/empresa.ts` · scoped storage with fallback chain.
  - `src/lib/collabRequests.ts` · unified adapter.
  - `src/lib/orgCollabRequests.ts` · per-store helpers and `currentOrgIdentity()`.
  - `src/pages/Empresa.tsx` · own/visitor branching.
  - `src/pages/Colaboradores.tsx`, `src/pages/Promotores.tsx` ·
    listings consume the adapter.
