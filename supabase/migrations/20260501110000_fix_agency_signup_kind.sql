-- ═══════════════════════════════════════════════════════════════════
-- Migration · 20260501110000 · Fix signup_kind para agencias
-- ═══════════════════════════════════════════════════════════════════
--
-- BUG
-- ----
-- La migración 20260501100000 (`split_plan_packs`) derivaba el
-- `signup_kind` desde el `tier` legacy. Pero todos los workspaces
-- tenían `tier='trial'` por defecto · esto puso TODAS las agencias
-- también con `signup_kind='promoter'` (incorrecto).
--
-- FIX
-- ----
-- Cruza `organizations.kind` para deducir el `signup_kind` correcto:
--   · organizations.kind='agency'    → signup_kind='agency',
--                                       agency_pack='free',
--                                       promoter_pack='none'
--   · organizations.kind='developer' → signup_kind='promoter' (sin cambio)
--
-- Idempotente · UPDATE solo donde signup_kind diverge del kind real.
-- ═══════════════════════════════════════════════════════════════════

update public.workspace_plans p
set
  signup_kind = 'agency',
  agency_pack = 'free',
  promoter_pack = 'none',
  tier = 'agency_free',
  updated_at = now()
from public.organizations o
where o.id = p.organization_id
  and o.kind = 'agency'
  and p.signup_kind = 'promoter';

update public.workspace_plans p
set
  signup_kind = 'promoter',
  updated_at = now()
from public.organizations o
where o.id = p.organization_id
  and o.kind = 'developer'
  and p.signup_kind = 'agency';
