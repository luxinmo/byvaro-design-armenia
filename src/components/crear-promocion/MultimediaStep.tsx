/**
 * MultimediaStep · Paso "Fotografías + Vídeos" del wizard.
 *
 * Delgado wrapper sobre `MultimediaEditor` (componente compartido con la
 * ficha de promoción). Aquí sólo puenteamos el estado del wizard.
 */

import { MultimediaEditor } from "@/components/shared/MultimediaEditor";
import type { WizardState } from "./types";

export function MultimediaStep({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  return (
    <MultimediaEditor
      fotos={state.fotos}
      videos={state.videos}
      onFotosChange={(next) => update("fotos", next)}
      onVideosChange={(next) => update("videos", next)}
      showCollaborationWarning={state.colaboracion}
    />
  );
}
