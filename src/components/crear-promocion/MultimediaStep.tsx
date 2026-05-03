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

import { Info } from "lucide-react";
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
    <div className="flex flex-col gap-4">
      {/* Aviso de scope · estas fotos son DE LA PROMOCIÓN · cada
          unidad las hereda automáticamente al generarse. Las fotos
          específicas de UNA unidad concreta se suben luego desde el
          modal de edición de esa unidad (paso 11/14). */}
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-3.5 py-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" strokeWidth={1.7} />
        <div className="text-[12.5px] leading-relaxed text-foreground/85">
          <span className="font-medium">Estas fotos son de la promoción.</span>{" "}
          Cada vivienda las hereda automáticamente al generarse. Si una
          vivienda concreta tiene fotos propias (ej. piloto, render
          específico), las añadirás más adelante desde la edición de esa
          unidad — y podrás excluir las heredadas que no apliquen.
        </div>
      </div>

      <MultimediaEditor
        fotos={state.fotos}
        videos={state.videos}
        onFotosChange={(next) => update("fotos", next)}
        onVideosChange={(next) => update("videos", next)}
        showCollaborationWarning={state.colaboracion}
        uploadScopeId={uploadScopeId}
      />
    </div>
  );
}
