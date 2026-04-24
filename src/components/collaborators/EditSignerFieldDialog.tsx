/**
 * EditSignerFieldDialog · editar email o teléfono de un firmante de
 * un contrato en curso. Firmafy permite cambiar estos campos antes
 * de la firma · al guardar, el backend re-sincroniza con Firmafy
 * (`action=editar_firmante` o equivalente).
 */

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AtSign, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { updateContractSigner } from "@/lib/collaborationContracts";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
function isValidPhone(s: string) {
  const v = s.replace(/[\s-]/g, "");
  return /^\+?[0-9]{9,15}$/.test(v);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  signerIndex: number;
  field: "email" | "telefono";
  currentValue: string;
  onSaved?: () => void;
}

export function EditSignerFieldDialog({
  open, onOpenChange, contractId, signerIndex, field, currentValue, onSaved,
}: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const [value, setValue] = useState(currentValue);

  useEffect(() => { if (open) setValue(currentValue); }, [open, currentValue]);

  const isEmail = field === "email";
  const Icon = isEmail ? AtSign : Phone;
  const title = isEmail ? "Editar email del firmante" : "Editar móvil del firmante";
  const valid = isEmail ? isValidEmail(value) : isValidPhone(value);
  const changed = value.trim() !== currentValue.trim();

  const handleSubmit = () => {
    if (!valid || !changed) return;
    updateContractSigner(contractId, signerIndex, { [field]: value.trim() } as any, actor);
    toast.success(
      isEmail ? "Email actualizado" : "Móvil actualizado",
      { description: "La próxima notificación se enviará al nuevo valor." },
    );
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            El cambio se sincroniza con Firmafy · el firmante recibirá los próximos
            avisos al nuevo {isEmail ? "email" : "teléfono"}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="relative">
            <Icon className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              type={isEmail ? "email" : "tel"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              placeholder={isEmail ? "nuevo@email.com" : "+34 600 000 000"}
              className={cn(
                "w-full h-10 pl-8 pr-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
                value.length > 0 && !valid ? "border-destructive/40" : "border-border",
              )}
            />
          </div>
          {value.length > 0 && !valid && (
            <p className="text-[11px] text-destructive mt-1">
              {isEmail ? "Formato de email no válido." : "Formato de teléfono no válido."}
            </p>
          )}
          {changed && valid && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Antes: <span className="line-through">{currentValue}</span>
              {" → "}<span className="text-foreground font-medium">{value.trim()}</span>
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!valid || !changed} className="rounded-full">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
