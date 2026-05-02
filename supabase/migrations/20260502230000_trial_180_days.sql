/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Trial · 180 días exactos · alineado con TRIAL_DURATION_DAYS
 *
 * Antes el trigger usaba `interval '6 months'` (≈182 días variables ·
 * meses son 28-31 días). Para que el contador "días restantes" en UI
 * sea preciso y reproducible, fijamos a 180 días exactos.
 *
 * Filosofía · ver `src/lib/plan.ts::TRIAL_DURATION_DAYS`:
 *   - El plan Gratis es el plan canónico de un promotor.
 *   - El trial NO es un plan distinto · es una ventana de 180 días
 *     de bonus encima del plan Gratis · durante esos días el
 *     promotor tiene acceso completo (mismas capacidades que el
 *     plan de pago).
 *   - Cuando se acaba la ventana, el promotor sigue en el plan
 *     Gratis · acceso a sus datos · sin crear promociones nuevas
 *     hasta que decida pasar al plan de pago.
 * ════════════════════════════════════════════════════════════════════ */

create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_kind text;
  v_name text;
  v_org_id text;
  v_meta jsonb;
  v_signup_kind text;
  v_promoter_pack text;
  v_agency_pack text;
  v_trial_ends timestamptz;
begin
  v_kind := coalesce(NEW.raw_user_meta_data->>'org_kind', '');
  v_name := coalesce(NEW.raw_user_meta_data->>'org_name', '');
  if v_kind = '' or v_name = '' then
    return NEW;
  end if;

  if v_kind not in ('developer', 'agency') then
    raise warning 'handle_new_user_signup · invalid kind: %', v_kind;
    return NEW;
  end if;

  v_org_id := v_kind || '-' || replace(NEW.id::text, '-', '');
  v_org_id := substring(v_org_id from 1 for 36);

  insert into public.organizations (
    id, kind, legal_name, display_name, country, status
  ) values (
    v_org_id, v_kind::org_kind, v_name, v_name, 'ES', 'active'
  )
  on conflict (id) do nothing;

  insert into public.organization_members (
    organization_id, user_id, role, status
  ) values (
    v_org_id, NEW.id, 'admin', 'active'
  )
  on conflict do nothing;

  v_meta := '{}'::jsonb;
  if NEW.raw_user_meta_data ? 'phone'
     and NEW.raw_user_meta_data->>'phone' <> '' then
    v_meta := v_meta || jsonb_build_object('phone', NEW.raw_user_meta_data->>'phone');
  end if;
  if NEW.raw_user_meta_data ? 'sub_role'
     and NEW.raw_user_meta_data->>'sub_role' <> '' then
    v_meta := v_meta || jsonb_build_object('sub_role', NEW.raw_user_meta_data->>'sub_role');
  end if;
  if NEW.raw_user_meta_data ? 'terms_accepted' then
    v_meta := v_meta || jsonb_build_object('terms_accepted', NEW.raw_user_meta_data->'terms_accepted');
  end if;

  insert into public.user_profiles (
    user_id, full_name, metadata
  ) values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    v_meta
  )
  on conflict (user_id) do nothing;

  if v_kind = 'developer' then
    v_signup_kind := 'promoter';
    v_promoter_pack := 'trial';
    v_agency_pack := 'none';
    /* 180 días exactos · alineado con frontend
     *  src/lib/plan.ts::TRIAL_DURATION_DAYS · evita la variabilidad
     *  de "6 months" (28-31 días por mes). */
    v_trial_ends := now() + interval '180 days';
  else
    v_signup_kind := 'agency';
    v_promoter_pack := 'none';
    v_agency_pack := 'free';
    v_trial_ends := null;
  end if;

  insert into public.workspace_plans (
    organization_id, tier,
    signup_kind, agency_pack, promoter_pack,
    trial_started_at, trial_ends_at
  ) values (
    v_org_id,
    case
      when v_kind = 'developer' then 'trial'::plan_tier
      else 'agency_free'::plan_tier
    end,
    v_signup_kind, v_agency_pack, v_promoter_pack,
    case when v_kind = 'developer' then now() else null end,
    v_trial_ends
  )
  on conflict (organization_id) do nothing;

  return NEW;
exception when others then
  raise warning 'handle_new_user_signup error: %', sqlerrm;
  return NEW;
end;
$$;
