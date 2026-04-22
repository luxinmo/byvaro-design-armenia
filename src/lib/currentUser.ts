/**
 * currentUser.ts — Mock del usuario logueado.
 *
 * Hoy es estático (Arman Rahmanov, admin). En producción vendrá
 * de un AuthProvider que envuelva la app y lea el JWT/cookie de
 * sesión. Cualquier UI que necesite saber quién es o qué puede
 * hacer importa este helper — al portar al backend, solo cambia
 * la implementación de `useCurrentUser()`.
 */

export type UserRole = "admin" | "member";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
};

const MOCK_CURRENT_USER: CurrentUser = {
  id: "u1",
  name: "Arman Rahmanov",
  email: "arman@byvaro.com",
  role: "admin",
  organizationId: "org1",
};

export function useCurrentUser(): CurrentUser {
  // TODO(auth): leer del AuthContext / SWR `/api/me` en producción.
  return MOCK_CURRENT_USER;
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}
