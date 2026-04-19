import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Check, User, Phone, Globe, ArrowLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionName: string;
  validezDias?: number; // 0 or undefined = no expira
}

const registrationConditions = [
  "Nombre y apellidos",
  "Nacionalidad",
  "Últimos 4 dígitos del teléfono",
];

/* Mock clients for search */
const mockClients = [
  { id: "1", name: "Carlos García López", phone: "+34 612 345 678", nationality: "Española", email: "carlos@email.com" },
  { id: "2", name: "Sarah Johnson", phone: "+34 698 112 233", nationality: "Británica", email: "sarah.j@email.com" },
  { id: "3", name: "Hans Müller", phone: "+49 170 555 1234", nationality: "Alemana", email: "hans.m@email.com" },
  { id: "4", name: "Marie Dupont", phone: "+33 6 12 34 56 78", nationality: "Francesa", email: "marie.d@email.com" },
  { id: "5", name: "Ahmed Al-Farsi", phone: "+971 50 123 4567", nationality: "Emiratí", email: "ahmed@email.com" },
];

type View = "search" | "create" | "confirm";

export function ClientRegistrationDialog({ open, onOpenChange, promotionName, validezDias = 0 }: Props) {
  const [view, setView] = useState<View>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<typeof mockClients[0] | null>(null);

  /* Create form state */
  const [newClient, setNewClient] = useState({ name: "", surname: "", phone: "", nationality: "", email: "" });

  const filteredClients = searchQuery.length > 1
    ? mockClients.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectClient = (client: typeof mockClients[0]) => {
    setSelectedClient(client);
    setView("confirm");
  };

  const handleCreateSubmit = () => {
    setSelectedClient({
      id: "new",
      name: `${newClient.name} ${newClient.surname}`,
      phone: newClient.phone,
      nationality: newClient.nationality,
      email: newClient.email,
    });
    setView("confirm");
  };

  const handleConfirm = () => {
    // Here would go the actual registration logic
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setView("search");
    setSearchQuery("");
    setSelectedClient(null);
    setNewClient({ name: "", surname: "", phone: "", nationality: "", email: "" });
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold">Registrar cliente</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {promotionName}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Search view ─── */}
        {view === "search" && (
          <div className="p-6 space-y-4">
            {/* Registration conditions */}
            <div className="rounded-lg bg-muted/40 border border-border/50 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Condiciones de registro</p>
              <div className="space-y-2">
                {registrationConditions.map((c) => (
                  <div key={c} className="flex items-center gap-2.5">
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground">{c}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Validez del registro: {validezDias === 0 ? "no expira" : `${validezDias} días`}</span>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, teléfono o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Results */}
            {searchQuery.length > 1 && (
              <div className="space-y-1 max-h-[240px] overflow-auto">
                {filteredClients.length > 0 ? (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectClient(c)}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone} · {c.nationality}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-1">No se encontraron clientes</p>
                    <p className="text-xs text-muted-foreground">Puedes crear uno nuevo</p>
                  </div>
                )}
              </div>
            )}

            {searchQuery.length <= 1 && (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Escribe para buscar un cliente existente</p>
              </div>
            )}

            <div className="border-t border-border/50 pt-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setView("create")}
              >
                <UserPlus className="h-4 w-4" />
                Crear nuevo cliente
              </Button>
            </div>
          </div>
        )}

        {/* ─── Create view ─── */}
        {view === "create" && (
          <div className="p-6 space-y-4">
            <button
              onClick={() => setView("search")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a búsqueda
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre</Label>
                <Input
                  placeholder="Nombre"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Apellidos</Label>
                <Input
                  placeholder="Apellidos"
                  value={newClient.surname}
                  onChange={(e) => setNewClient({ ...newClient, surname: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="+34 600 000 000"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nacionalidad</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ej: Española, Británica..."
                  value={newClient.nationality}
                  onChange={(e) => setNewClient({ ...newClient, nationality: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                className="w-full"
                disabled={!newClient.name || !newClient.surname || !newClient.phone}
                onClick={handleCreateSubmit}
              >
                Continuar con registro
              </Button>
            </div>
          </div>
        )}

        {/* ─── Confirm view ─── */}
        {view === "confirm" && selectedClient && (
          <div className="p-6 space-y-5">
            <button
              onClick={() => { setView("search"); setSelectedClient(null); }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Cambiar cliente
            </button>

            {/* Client summary */}
            <div className="rounded-xl bg-muted/30 border border-border/50 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedClient.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Teléfono</p>
                  <p className="font-medium text-foreground">{selectedClient.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Nacionalidad</p>
                  <p className="font-medium text-foreground">{selectedClient.nationality}</p>
                </div>
              </div>
            </div>

            {/* Registration conditions */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Datos de registro requeridos</p>
              <div className="space-y-2">
                {["Nombre y apellidos", "Nacionalidad", "Últimos 4 dígitos del teléfono"].map((c) => (
                  <div key={c} className="flex items-center gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span className="text-sm text-foreground">{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={handleConfirm}>
              Confirmar registro
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
