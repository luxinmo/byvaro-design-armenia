/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Signup · persistir aceptación de términos + teléfono
 *
 * Extiende `handle_new_user_signup` para que copie a
 * `user_profiles.metadata` los datos legales y personales que vienen
 * en `auth.users.raw_user_meta_data` desde el formulario `/register`:
 *
 *   - `terms_accepted: { version, accepted_at }` · prueba RGPD de
 *     aceptación de Términos y Condiciones + Política de Privacidad.
 *     Versión canónica en `src/lib/legalVersion.ts`.
 *   - `phone` · teléfono profesional · útil para 2FA y para que el
 *     equipo del workspace pueda contactar al miembro.
 *   - `sub_role: "director" | "employee"` · rol declarado en el alta ·
 *     hoy es informativo, en el futuro puede mapearse a permisos.
 *
 * El campo `metadata` ya existe en `user_profiles` (jsonb default
 * '{}') · solo lo poblamos con merge no destructivo en el INSERT.
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

  /* Build metadata jsonb · solo incluye claves con valor para no
   *  guardar nulls que ensucien el documento. */
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

  return NEW;
exception when others then
  raise warning 'handle_new_user_signup error: %', sqlerrm;
  return NEW;
end;
$$;
