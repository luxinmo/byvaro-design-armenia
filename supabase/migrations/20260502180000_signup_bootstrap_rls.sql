/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Signup bootstrap RLS · permitir crear org + primer admin
 *
 * Bug · al registrarse en /register fallaba con:
 *   "new row violates row-level security policy for table 'organizations'"
 *
 * Causa · public.organizations no tenía policy de INSERT (RLS niega
 * por default). Y public.organization_members.INSERT requería ser
 * admin (catch-22 · para añadir el primer admin de una org nueva
 * necesitas ya ser admin · imposible).
 *
 * Fix · 2 policies de bootstrap:
 *   1. organizations.INSERT · cualquier authenticated user puede
 *      crear una org nueva. El display_name/legal_name vienen del
 *      formulario de signup · el orgId se genera client-side con un
 *      pattern `<kind>-<timestamp>-<rand>`.
 *   2. organization_members.INSERT · self-bootstrap · si el user_id
 *      coincide con auth.uid() Y NO existe ningún miembro previo en
 *      esa org, se permite. Esto permite al primer user de cada org
 *      crearse a sí mismo como admin. Después la policy
 *      members_write_admin sigue restringiendo INSERTs adicionales
 *      solo para admins.
 *
 * Seguridad · el flujo de signup en frontend hace:
 *   supabase.auth.signUp(email, password)  → crea auth.users + JWT
 *   INSERT organizations (con id único)    → policy 1 deja pasar
 *   INSERT organization_members (admin)    → policy 2 deja pasar
 *
 * Una vez creada la org, ya hay un admin · INSERT subsiguientes
 * pasan por members_write_admin (solo admin del propio org).
 * ════════════════════════════════════════════════════════════════════ */

/* ─── 1. organizations.INSERT ──────────────────────────────────── */
drop policy if exists "orgs_insert_signup_bootstrap" on public.organizations;
create policy "orgs_insert_signup_bootstrap"
  on public.organizations for insert
  with check (auth.uid() is not null);

/* ─── 2. organization_members.INSERT (bootstrap) ───────────────── */
drop policy if exists "members_self_bootstrap_first_admin" on public.organization_members;
create policy "members_self_bootstrap_first_admin"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and role = 'admin'
    and not exists (
      select 1 from public.organization_members existing
      where existing.organization_id = organization_members.organization_id
    )
  );
