/**
 * MultimediaStep · Paso "Fotografías + Vídeos" del wizard.
 *
 * Delgado wrapper sobre `MultimediaEditor` (componente compartido con la
 * ficha de promoción). Aquí sólo puenteamos el estado del wizard.
 *
 * `uploadScopeId` es el namespace para los paths de Storage. En el
 * wizard pasamos el draftId (o promotionId si se está editando una
 * promo existente). Sin él, el editor deshabilita la subida.
 */

import { MultimediaEditor } from "@/components/shared/MultimediaEditor";
import type { WizardState } from "./types";

export function MultimediaStep({
  state,
  update,
  uploadScopeId,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  uploadScopeId?: string;
}) {
  return (
    <MultimediaEditor
      fotos={state.fotos}
      videos={state.videos}
      onFotosChange={(next) => update("fotos", next)}
      onVideosChange={(next) => update("videos", next)}
      showCollaborationWarning={state.colaboracion}
      uploadScopeId={uploadScopeId}
    />
  );
}
