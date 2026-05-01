/**
 * /ajustes/facturacion/pago — Métodos de pago.
 * Lista de tarjetas/SEPA + añadir nueva (mock).
 */

import { useEffect, useState } from "react";
import { CreditCard, Plus, Trash2, Star } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgSetting } from "@/lib/orgSettings";

const SETTING_KEY = "organization.paymentMethods";

type PayMethod = {
  id: string;
  type: "card" | "sepa";
  brand?: "visa" | "mastercard" | "amex";
  last4: string;
  expiry?: string;
  holderName: string;
  primary: boolean;
};

const DEFAULT: PayMethod[] = [
  { id: "pm1", type: "card", brand: "visa", last4: "4242", expiry: "08/27", holderName: "Arman Rahmanov", primary: true },
];

const BRAND_LABELS = { visa: "Visa", mastercard: "MasterCard", amex: "Amex" } as const;

export default function AjustesFacturacionPago() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [persisted, setPersisted] = useOrgSetting<PayMethod[]>(SETTING_KEY, DEFAULT);
  const [methods, setMethods] = useState<PayMethod[]>(persisted);
  const confirm = useConfirm();

  useEffect(() => {
    setMethods(persisted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persisted)]);

  const update = (next: PayMethod[]) => {
    setMethods(next);
    setPersisted(next);
  };

  const remove = async (id: string) => {
    const m = methods.find((x) => x.id === id);
    if (!m) return;
    const ok = await confirm({
      title: `¿Eliminar tarjeta •••• ${m.last4}?`,
      description: m.primary ? "Es tu tarjeta primaria. Necesitarás añadir otra antes de eliminarla." : "Se eliminará permanentemente.",
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    if (m.primary && methods.length > 1) { toast.error("Marca otra como primaria primero"); return; }
    update(methods.filter((x) => x.id !== id));
    toast.success("Método de pago eliminado");
  };

  const setPrimary = (id: string) => {
    update(methods.map((m) => ({ ...m, primary: m.id === id })));
    toast.success("Método primario actualizado");
  };

  const addCard = () => {
    /* En producción → redirect a Stripe Setup Intent */
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const next: PayMethod = {
      id: `pm${Date.now()}`, type: "card", brand: "mastercard",
      last4, expiry: "12/28", holderName: user.name, primary: methods.length === 0,
    };
    update([...methods, next]);
    toast.success(`Tarjeta •••• ${last4} añadida (mock)`);
  };

  return (
    <SettingsScreen
      title="Método de pago"
      description="Tarjetas y métodos asociados a la facturación. La tarjeta primaria se cobra automáticamente cada mes."
    >
      <SettingsCard
        footer={canEdit ? (
          <Button variant="outline" size="sm" onClick={addCard} className="rounded-full">
            <Plus className="h-4 w-4" />
            Añadir tarjeta
          </Button>
        ) : null}
      >
        <div className="divide-y divide-border/40 -my-3">
          {methods.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground text-center italic">Sin métodos de pago</p>
          )}
          {methods.map((m) => (
            <div key={m.id} className="py-3 flex items-center gap-3">
              <div className="h-10 w-14 rounded-lg bg-foreground text-background grid place-items-center text-[10px] font-bold uppercase tracking-wider shrink-0">
                {m.brand && BRAND_LABELS[m.brand]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  •••• •••• •••• {m.last4}
                  {m.primary && <span className="ml-2 text-[10px] font-semibold text-warning inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning" /> Primaria</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">{m.holderName} · Caduca {m.expiry}</p>
              </div>
              {canEdit && (
                <>
                  <button
                    onClick={() => setPrimary(m.id)}
                    disabled={m.primary}
                    className={cn("text-xs px-3 h-7 rounded-full transition-colors",
                      m.primary ? "text-muted-foreground cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                  >
                    {m.primary ? "Primaria" : "Hacer primaria"}
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    className="h-8 w-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Datos de facturación">
        <p className="text-sm text-muted-foreground">
          Las facturas se emiten a nombre de tu empresa con los datos en{" "}
          <span className="text-foreground font-medium">Empresa › Datos de la empresa</span>.
        </p>
      </SettingsCard>
    </SettingsScreen>
  );
}
