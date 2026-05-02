/**
 * Versión canónica de los documentos legales (T&C + Privacidad).
 *
 * Cada vez que se modifique sustancialmente el contenido de las
 * páginas `/legal/terminos` o `/legal/privacidad`, **bumpear**
 * `LEGAL_VERSION` y actualizar `LEGAL_UPDATED_AT`. El registro guarda
 * en `user_profiles.metadata.terms_accepted` el snapshot
 * `{ version, acceptedAt }` para auditoría legal · si subes la
 * versión, los users existentes verán un re-consent al hacer login.
 *
 * Formato semver light: `MAJOR.MINOR` · solo incrementar MAJOR cuando
 * el cambio afecte derechos del usuario (no para typos).
 */

export const LEGAL_VERSION = "1.0";
export const LEGAL_UPDATED_AT = "2026-05-02";
