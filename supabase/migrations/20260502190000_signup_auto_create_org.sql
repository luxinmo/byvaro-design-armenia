/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Signup auto-create org · trigger sobre auth.users
 *
 * Bug · con `mailer_autoconfirm: false` (queremos confirmación email),
 * `supabase.auth.signUp()` no devuelve session hasta que el user
 * confirme su email. Sin session, las queries del cliente NO llevan
 * JWT · `auth.uid()` retorna NULL · las policies RLS rechazan el
 * INSERT en organizations + organization_members.
 *
 * Fix · trigger BEFORE/AFTER en auth.users que:
 *   1. Al INSERT de un user con metadata.org_kind y metadata.org_name,
 *      crea la organization + member admin automáticamente.
 *   2. Como el trigger corre con privilegios elevados (definer), no
 *      depende de auth.uid() · funciona aunque el user no tenga
 *      session todavía.
 *
 * Frontend · `/register` solo hace signUp() con metadata completa.
 * Si signUp success → toast 'revisa email' + redirect login. Cuando
 * el user click el magic link y confirma, ya tiene su org + member
 * creados de antemano (por trigger), así que entra directo al
 * workspace propio.
 *
 * Idempotencia · el trigger valida que NO existe ya org con el mismo
 * `id` antes de crear (por si se reintenta el signup).
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
begin
  /* Si el user no trae metadata de empresa, no creamos org · puede
   *  ser una invitación a workspace existente o un user de servicio. */
  v_kind := coalesce(NEW.raw_user_meta_data->>'org_kind', '');
  v_name := coalesce(NEW.raw_user_meta_data->>'org_name', '');
  if v_kind = '' or v_name = '' then
    return NEW;
  end if;

  /* Validar kind. */
  if v_kind not in ('developer', 'agency') then
    raise warning 'handle_new_user_signup · invalid kind: %', v_kind;
    return NEW;
  end if;

  /* Generar org id determinístico basado en user_id (parte) + timestamp. */
  v_org_id := v_kind || '-' || replace(NEW.id::text, '-', '');
  v_org_id := substring(v_org_id from 1 for 36);

  /* INSERT organization · idempotente. */
  insert into public.organizations (
    id, kind, legal_name, display_name, country, status
  ) values (
    v_org_id, v_kind::org_kind, v_name, v_name, 'ES', 'active'
  )
  on conflict (id) do nothing;

  /* INSERT membership como admin · idempotente. */
  insert into public.organization_members (
    organization_id, user_id, role, status
  ) values (
    v_org_id, NEW.id, 'admin', 'active'
  )
  on conflict do nothing;

  /* INSERT user_profile · el trigger gen_user_public_ref autogenera ref. */
  insert into public.user_profiles (
    user_id, full_name
  ) values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1))
  )
  on conflict (user_id) do nothing;

  return NEW;
exception when others then
  /* No bloquear el signup si falla algo · solo loggear. El user
   *  puede crear su org desde la app después. */
  raise warning 'handle_new_user_signup error: %', sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists trg_on_auth_user_signup on auth.users;
create trigger trg_on_auth_user_signup
  after insert on auth.users
  for each row execute function public.handle_new_user_signup();
