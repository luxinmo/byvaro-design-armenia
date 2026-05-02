/* ════════════════════════════════════════════════════════════════════
 * 20260502 · RPC api.list_workspace_members(p_org_id)
 *
 * El frontend necesita la lista de miembros del workspace para
 * poblar `useWorkspaceMembers()`, que alimenta:
 *   · /equipo y /ajustes/usuarios/miembros (gestión).
 *   · UserSelect (asignación de leads, registros, visitas).
 *   · Calendario (asignación de eventos a miembros).
 *   · Dashboard del equipo / KPIs por miembro.
 *
 * Necesitamos JOIN entre organization_members + user_profiles +
 * auth.users (para email · auth schema NO está expuesto a anon).
 *
 * Solución · RPC SECURITY DEFINER que valida `is_org_member` antes
 * de devolver datos · evita exponer auth.users a authenticated.
 *
 * Returns una fila por miembro con todos los campos usables por el
 * frontend (TeamMember type en src/lib/team.ts).
 * ════════════════════════════════════════════════════════════════════ */

create schema if not exists api;

create or replace function api.list_workspace_members(p_org_id text)
returns table (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  job_title text,
  department text,
  languages text[],
  bio text,
  phone text,
  role text,
  status text,
  joined_at timestamptz,
  public_ref text
)
security definer
set search_path = public, pg_catalog
language plpgsql
as $$
begin
  /* Solo los miembros del workspace pueden listar a sus
   *  compañeros · evita filtración cross-tenant. */
  if not public.is_org_member(p_org_id) then
    raise exception 'access denied · not a member of this workspace';
  end if;

  return query
  select
    om.user_id,
    au.email::text,
    up.full_name,
    up.avatar_url,
    up.job_title,
    up.department,
    up.languages,
    up.bio,
    (up.metadata->>'phone')::text as phone,
    om.role::text,
    om.status::text,
    om.created_at as joined_at,
    up.public_ref
  from public.organization_members om
  left join public.user_profiles up on up.user_id = om.user_id
  left join auth.users au on au.id = om.user_id
  where om.organization_id = p_org_id;
end;
$$;

revoke all on function api.list_workspace_members(text) from public;
grant execute on function api.list_workspace_members(text) to authenticated;

/* Alias en `public` · `supabase.rpc("...")` busca por defecto en
 *  el schema public · sin este alias el cliente JS no encuentra la
 *  función. Mismo patrón que `list_promotion_private_metadata`. */
create or replace function public.list_workspace_members(p_org_id text)
returns table (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  job_title text,
  department text,
  languages text[],
  bio text,
  phone text,
  role text,
  status text,
  joined_at timestamptz,
  public_ref text
)
security definer
set search_path = public, pg_catalog
language sql
as $$
  select * from api.list_workspace_members(p_org_id);
$$;

revoke all on function public.list_workspace_members(text) from public;
grant execute on function public.list_workspace_members(text) to authenticated;
