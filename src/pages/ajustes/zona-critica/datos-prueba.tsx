/**
 * /ajustes/zona-critica/datos-prueba · utilidad SOLO del prototipo.
 *
 * Resuelve el caso de uso "quiero testear Byvaro con tres cuentas
 * distintas a la vez (promotor + agencia admin + agencia member)
 * sin abrir DevTools cada vez para resetear el localStorage".
 *
 * Dos acciones:
 *   1. Cargar demo Luxinmo · escribe el fixture canónico
 *      `LUXINMO_PROFILE` en `byvaro-empresa`. Las tres pestañas
 *      ven datos coherentes inmediatamente.
 *   2. Limpiar datos del promotor · borra `byvaro-empresa`. La
 *      ficha propia del promotor vuelve al onboarding vacío y las
 *      agencias en `/promotor/developer-default` cae al fallback
 *      del fixture (idéntico al paso 1 · pero el promotor verá
 *      "Tu empresa" en su /empresa hasta que rellene).
 *
 * Ambas acciones disparan `byvaro:empresa-changed` (mismo tab) y el
 * evento nativo `storage` (cross-tab) → refresco en vivo de las tres
 * pestañas sin recargar.
 *
 * TODO(backend): borrar este archivo cuando aterrice multi-tenant ·
 * el reset/seed ocurrirá vía endpoint admin o variable de entorno.
 */

import { useMemo } from "react";
import { Database, RotateCcw, Sparkles } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useCurrentUser } from "@/lib/currentUser";
import { LUXINMO_PROFILE, useEmpresa, defaultEmpresa } from "@/lib/empresa";
import { toast } from "sonner";

export default function AjustesZonaCriticaDatosPrueba() {
  const user = useCurrentUser();
  const { empresa, patch: patchEmpresa } = useEmpresa();
  const confirm = useConfirm();

  /* Solo aplica al lado promotor · `byvaro-empresa` representa al
   *  promotor. Una agencia entrando aquí no debe ver estas acciones. */
  const isDeveloper = user.accountType === "developer";

  /* Estado actual · resumen de qué hay guardado para que el usuario
   *  sepa qué va a sustituir. */
  const status = useMemo(() => {
    if (!empresa.nombreComercial?.trim() && !empresa.razonSocial?.trim()) {
      return { label: "Sin datos guardados", tone: "muted" as const };
    }
    return {
      label: empresa.nombreComercial?.trim() || empresa.razonSocial?.trim() || "Empresa sin nombre",
      tone: "active" as const,
    };
  }, [empresa]);

  const cargarLuxinmo = async () => {
    const ok = await confirm({
      title: "¿Cargar datos demo de Luxinmo?",
      description: "Sustituye lo que tengas guardado en /empresa por el fixture canónico de Luxinmo (logo dicebear azul, razón social Luxinmo Inversiones SL, CIF B98765432, dirección Alicante, idiomas ES/EN/FR/DE/RU, etc.). Las tres pestañas verán los mismos datos al instante.",
      confirmLabel: "Cargar Luxinmo",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    /* Patch via canonical helper · saveEmpresaForOrg hace write-through
     *  a Supabase + emite el evento de cambio · ya no tocamos
     *  localStorage directo. */
    patchEmpresa({ ...LUXINMO_PROFILE, updatedAt: Date.now() });
    toast.success("Datos demo de Luxinmo cargados · pestañas refrescadas");
  };

  const limpiarDatos = async () => {
    const ok = await confirm({
      title: "¿Limpiar datos del promotor?",
      description:
        "Borra byvaro-empresa del localStorage. Tu /empresa vuelve a estado de onboarding (campos vacíos). Las agencias mirando /promotor/developer-default verán el fixture Luxinmo automáticamente como fallback (no aparecerá 'Promotor no encontrado').",
      confirmLabel: "Limpiar",
      cancelLabel: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    /* Reset via patch · vacía los campos clave · saveEmpresaForOrg
     *  hace write-through a Supabase. */
    patchEmpresa({
      nombreComercial: "",
      razonSocial: "",
      cif: "",
      onboardingCompleto: false,
      updatedAt: Date.now(),
    });
    toast.success("Datos del promotor limpiados");
  };

  if (!isDeveloper) {
    return (
      <SettingsScreen
        title="Datos de prueba"
        description="Esta utilidad solo está disponible desde una cuenta de promotor. Cambia a una cuenta promotora desde el selector arriba a la derecha."
      >
        <SettingsCard>
          <p className="text-[13px] text-muted-foreground">
            Las acciones de reset y seed afectan a <code>byvaro-empresa</code> ·
            la fuente de los datos del promotor en el mock single-tenant.
            Una agencia no las dispara · sus datos viven en otra clave por
            workspace.
          </p>
        </SettingsCard>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen
      title="Datos de prueba"
      description="Atajos para preparar el escenario de testing con varias cuentas a la vez. Solo prototipo · estos botones desaparecen cuando aterrice el backend real."
    >
      {/* Estado actual */}
      <SettingsCard>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted/50 grid place-items-center text-muted-foreground shrink-0">
            <Database className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Estado actual de byvaro-empresa
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
              {status.label}
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Acción 1 · Cargar Luxinmo */}
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-foreground">
              Cargar datos demo · Luxinmo
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Escribe el fixture canónico <code>LUXINMO_PROFILE</code> en{" "}
              <code>byvaro-empresa</code>. Las tres vistas se rellenan con
              datos coherentes inmediatamente.
            </p>
            <ul className="mt-3 space-y-1 text-[12.5px] text-muted-foreground">
              <li>· Tu /empresa muestra Luxinmo · logo dicebear · Alicante.</li>
              <li>· Agencia admin en /promotor/developer-default ve lo mismo.</li>
              <li>· Agencia member en el panel también.</li>
            </ul>
            <div className="mt-4">
              <Button onClick={cargarLuxinmo}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                Cargar Luxinmo
              </Button>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Acción 2 · Limpiar */}
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center text-destructive shrink-0">
            <RotateCcw className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-foreground">
              Limpiar datos del promotor
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Borra <code>byvaro-empresa</code> de localStorage. Útil para
              testear el flujo de onboarding desde cero.
            </p>
            <ul className="mt-3 space-y-1 text-[12.5px] text-muted-foreground">
              <li>· Tu /empresa vuelve a "Tu empresa" · todos los campos vacíos.</li>
              <li>· Agencia admin sigue viendo Luxinmo (fallback al fixture).</li>
              <li>· Agencia member igual · fallback al fixture.</li>
              <li>· No borra promociones, agencias, registros ni equipo.</li>
            </ul>
            <div className="mt-4">
              <Button variant="destructive" onClick={limpiarDatos}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                Limpiar datos del promotor
              </Button>
            </div>
          </div>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}

/* Re-export defensivo · si alguien importa `defaultEmpresa` desde aquí
 * (por error), que falle alto y no silencioso. */
void defaultEmpresa;
