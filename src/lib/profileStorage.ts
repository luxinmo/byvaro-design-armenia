/**
 * profileStorage.ts · fachada legacy sobre `meStorage`.
 *
 * ⚠️ Este módulo existía como store separado del perfil del usuario,
 * pero a partir de ADR-050 todos los datos del usuario actual viven
 * en la entrada del `TeamMember` correspondiente (gestionada por
 * `src/lib/meStorage.ts`). Se mantiene este archivo como fachada para
 * no romper los 10+ consumers existentes · todas las funciones
 * delegan en `meStorage`.
 *
 * No añadir más campos aquí · añadir directamente al tipo `TeamMember`
 * en `src/lib/team.ts` y editar desde `meStorage.updateMe()`.
 */

import { useMemo } from "react";
import { getMe, updateMe, useMe } from "@/lib/meStorage";

export type UserProfile = {
  fullName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  languages?: string[];
  bio?: string;
  avatar?: string;
  phone?: string;
};

/** Convierte TeamMember → shape legacy del perfil. */
function memberToProfile(m: ReturnType<typeof getMe>): Partial<UserProfile> | null {
  if (!m) return null;
  return {
    fullName: m.name,
    email: m.email,
    jobTitle: m.jobTitle,
    department: m.department,
    languages: m.languages,
    bio: m.bio,
    avatar: m.avatarUrl,
    phone: m.phone,
  };
}

/** Shape legacy · lo siguen usando formularios antiguos. */
export function getStoredProfile(): Partial<UserProfile> | null {
  return memberToProfile(getMe());
}

export function saveStoredProfile(p: Partial<UserProfile>): void {
  updateMe({
    name: p.fullName,
    email: p.email,
    jobTitle: p.jobTitle,
    department: p.department,
    languages: p.languages,
    bio: p.bio,
    avatarUrl: p.avatar,
    phone: p.phone,
  });
}

/** Hook reactivo · se actualiza cuando cambia el miembro actual o la
 *  lista global (admin editando desde /equipo). */
export function usePersistedProfile(): Partial<UserProfile> | null {
  const me = useMe();
  return useMemo(() => memberToProfile(me), [me]);
}
