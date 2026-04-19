import { useState } from "react";
import { Search, Check, X, AlertTriangle, ChevronDown, ChevronUp, Clock, User, Building2, Home, Calendar, Eye, Ban, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface MatchDetail {
  label: string;
  match: boolean;
  value: string;
}

interface RegistrationRecord {
  id: string;
  type: "registration" | "registration_visit";
  contactName: string;
  contactFlag?: string;
  promotion: string;
  company: string;
  status: "pending" | "approved" | "declined";
  date: string;
  relativeDate: string;
  matchPercentage?: number;
  matchDetails?: MatchDetail[];
  recommendation?: string;
  comment?: string;
  registeredBy?: string;
}

/* ── Mock data ── */
const pendingRecords: RegistrationRecord[] = [
  {
    id: "p1",
    type: "registration",
    contactName: "TestCliente",
    contactFlag: "🇪🇸",
    promotion: "Villa Azahar",
    company: "Luximno Real Estate",
    status: "pending",
    date: "21/01/26",
    relativeDate: "Hace 1 mes",
    matchPercentage: 100,
    matchDetails: [
      { label: "Possible match with contact", match: true, value: "TestCliente" },
      { label: "Origin", match: true, value: "registered_agency" },
      { label: "Phone number last 4 digits match", match: true, value: "6666" },
      { label: "Name match percentage", match: true, value: "100%" },
      { label: "Nationality match", match: true, value: "No" },
    ],
    recommendation: "No registrar, es muy probable que este contacto ya esté registrado.",
    comment: "No Comments",
    registeredBy: "Arman Yeghiazaryan",
  },
  {
    id: "p2",
    type: "registration_visit",
    contactName: "TestCliente n234",
    contactFlag: "🇬🇧",
    promotion: "new promotion",
    company: "Luximno Real Estate",
    status: "pending",
    date: "12/01/26",
    relativeDate: "Hace 1 mes",
    matchPercentage: 30,
    matchDetails: [
      { label: "Possible match with contact", match: true, value: "Lucas Test" },
      { label: "Origin", match: true, value: "unknown" },
      { label: "Phone number last 4 digits match", match: false, value: "6666" },
      { label: "Name match percentage", match: true, value: "30%" },
      { label: "Nationality match", match: true, value: "No" },
    ],
    recommendation: "Antes de registrar, asegúrate de que el contacto no sea un duplicado.",
    comment: "dfsdf",
    registeredBy: "Arman Yeghiazaryan",
  },
  {
    id: "p3",
    type: "registration",
    contactName: "'N/A'",
    promotion: "Villa Azahar",
    company: "Urban Level Master Agent",
    status: "pending",
    date: "09/01/26",
    relativeDate: "Hace 2 meses",
  },
];

const processedRecords: RegistrationRecord[] = [
  { id: "h1", type: "registration", contactName: "TestArman", contactFlag: "🇪🇸", promotion: "Villa Azahar", company: "JustRent - Spain Rentales", status: "approved", date: "15/01/26", relativeDate: "" },
  { id: "h2", type: "registration_visit", contactName: "Arman 6789", contactFlag: "🇬🇧", promotion: "new promotion", company: "Luximno Real Estate", status: "approved", date: "12/01/26", relativeDate: "" },
  { id: "h3", type: "registration_visit", contactName: "TestCliente 78901233", contactFlag: "🇫🇷", promotion: "new promotion 3", company: "Luximno Real Estate", status: "approved", date: "12/01/26", relativeDate: "" },
  { id: "h4", type: "registration_visit", contactName: "TestCliente", contactFlag: "🇪🇸", promotion: "Villa Azahar", company: "Luximno Real Estate", status: "approved", date: "12/01/26", relativeDate: "" },
  { id: "h5", type: "registration", contactName: "'N/A'", promotion: "new promotion test 432", company: "", status: "declined", date: "12/01/26", relativeDate: "" },
  { id: "h6", type: "registration", contactName: "'N/A'", promotion: "Villa Azahar", company: "", status: "declined", date: "09/01/26", relativeDate: "" },
  { id: "h7", type: "registration", contactName: "'N/A'", promotion: "Villa Azahar", company: "", status: "declined", date: "16/11/25", relativeDate: "" },
  { id: "h8", type: "registration", contactName: "'N/A'", promotion: "Villa Azahar", company: "", status: "approved", date: "13/09/25", relativeDate: "" },
  { id: "h9", type: "registration", contactName: "Florence Fernandez", contactFlag: "🇪🇸", promotion: "Villa Azahar", company: "", status: "approved", date: "13/09/25", relativeDate: "" },
];

/* ── Status badge ── */
function StatusBadge({ status }: { status: RegistrationRecord["status"] }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <Ban className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
      <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-amber-400" />
      pending
    </span>
  );
}

/* ── Type badge ── */
function TypeBadge({ type }: { type: RegistrationRecord["type"] }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
      <User className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold text-foreground">Registration</span>
      {type === "registration_visit" && (
        <>
          <span className="text-muted-foreground/40 font-light">·</span>
          <Calendar className="h-3 w-3 text-primary" />
          <span className="text-xs font-semibold text-primary">Visit</span>
        </>
      )}
    </div>
  );
}

/* ── Match percentage circle ── */
function MatchCircle({ percentage }: { percentage: number }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? "text-destructive" : percentage >= 50 ? "text-amber-500" : "text-emerald-500";
  const bgColor = percentage >= 80 ? "bg-destructive/10" : percentage >= 50 ? "bg-amber-50" : "bg-emerald-50";

  return (
    <div className={cn("relative h-16 w-16 shrink-0 rounded-full flex items-center justify-center", bgColor)}>
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-border/30" />
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={color} />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-bold", color)}>
        {percentage}%
      </span>
    </div>
  );
}

/* ── Table header ── */
function TableHeader({ showCheckbox }: { showCheckbox: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30">
      {showCheckbox && <div className="w-5 shrink-0" />}
      <span className="w-[170px] shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Type</span>
      <span className="w-[180px] shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact</span>
      <span className="w-[150px] shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Home className="h-3 w-3" /> Promotion</span>
      <span className="w-[180px] shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Building2 className="h-3 w-3" /> Company</span>
      <span className="w-[80px] shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
      <span className="w-[80px] shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</span>
      <span className="flex-1" />
    </div>
  );
}

/* ── Expandable record row ── */
function RecordRow({ record, isPending }: { record: RegistrationRecord; isPending: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = isPending && record.matchPercentage !== undefined;

  return (
    <div className={cn(
      "border-b border-border/20 last:border-b-0 transition-all",
      expanded && "bg-muted/5",
    )}>
      {/* Row */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3.5 transition-colors",
          hasDetails && "cursor-pointer hover:bg-muted/30",
          isPending && "bg-card",
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {isPending && (
          <Checkbox className="shrink-0" onClick={(e) => e.stopPropagation()} />
        )}
        <div className="w-[170px] shrink-0">
          <TypeBadge type={record.type} />
        </div>
        <div className="w-[180px] shrink-0 flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">{record.contactName}</span>
          {record.contactFlag && <span className="text-sm leading-none">{record.contactFlag}</span>}
        </div>
        <div className="w-[150px] shrink-0 text-xs text-muted-foreground truncate">
          {record.promotion}
        </div>
        <div className="w-[180px] shrink-0 text-xs text-muted-foreground truncate">
          {record.company || "—"}
        </div>
        <div className="w-[80px] shrink-0">
          <StatusBadge status={record.status} />
        </div>
        <div className="w-[80px] shrink-0 text-xs text-muted-foreground">{record.date}</div>
        <div className="flex-1 flex items-center justify-end gap-2">
          {isPending ? (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 px-3 rounded-full border-primary/30 text-primary hover:bg-primary/5">
                <Settings className="h-3 w-3" /> Manage
              </Button>
              {record.relativeDate && (
                <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{record.relativeDate}</span>
              )}
            </>
          ) : (
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 px-3">
              <Eye className="h-3 w-3" /> Edit
            </Button>
          )}
          {hasDetails && (
            expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetails && (
        <div className="px-6 py-6 bg-muted/10 border-t border-border/20 space-y-5">
          {/* Match check result header */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-foreground">Resultado de Comprobación de Cliente</h4>
            <span className="text-[10px] text-muted-foreground ml-1">{record.date}</span>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-6 space-y-5">
            <p className="text-xs text-muted-foreground">
              A possible match was found in the database for the client you are trying to register.
            </p>

            <div className="border-t border-border/30" />

            <div className="flex items-start gap-5">
              <MatchCircle percentage={record.matchPercentage!} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-foreground">Name match percentage</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {record.matchPercentage! >= 80
                    ? "Do not register, this contact is most likely already registered."
                    : "Before registering, make sure the contact is not a duplicate."}
                </p>
              </div>
            </div>

            {record.matchDetails && (
              <div className="space-y-3 pt-2">
                {record.matchDetails.map((d) => (
                  <div key={d.label} className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground w-[240px] shrink-0">{d.label}:</span>
                    {d.match
                      ? <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <X className="h-4 w-4 text-destructive shrink-0" />}
                    <span className={cn(
                      "font-medium text-sm",
                      d.value.includes("Test") || d.value.includes("Lucas") ? "text-primary cursor-pointer hover:underline" : "text-foreground"
                    )}>{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {record.recommendation && (
              <div className="flex items-start gap-2.5 pt-3 border-t border-border/30">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-600">Suggested recommendation:</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{record.recommendation}</p>
                </div>
              </div>
            )}

            <div className="border-t border-border/30" />

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2 text-xs h-9 px-4 rounded-full">
                <Ban className="h-3.5 w-3.5" /> Decline
              </Button>
              <Button size="sm" className="gap-2 text-xs h-9 px-5 rounded-full">
                <Check className="h-3.5 w-3.5" /> Register
              </Button>
            </div>
          </div>

          {/* Application info */}
          {record.comment && (
            <div className="rounded-xl border border-border/40 bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">Registration application</h4>
                <span className="text-[10px] text-muted-foreground ml-1">{record.date}</span>
              </div>

              <div className="border-t border-border/30" />

              <div>
                <p className="text-xs font-semibold text-foreground">Comment:</p>
                <p className="text-xs text-muted-foreground mt-0.5">{record.comment}</p>
              </div>

              <div className="border-t border-border/30" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{record.company}</span>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground">{record.contactName}</p>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Registration pending
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{record.registeredBy}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════ */
/* ── Main component ── */
/* ══════════════════════════════════════════ */
export function PromotionRecords({ embedded = false }: { embedded?: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPending = searchQuery
    ? pendingRecords.filter(r =>
        r.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.promotion.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingRecords;

  const filteredProcessed = searchQuery
    ? processedRecords.filter(r =>
        r.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.promotion.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : processedRecords;

  return (
    <div className={cn("space-y-8", embedded ? "p-5 sm:p-8" : "px-5 sm:px-8 lg:px-10 pt-6 pb-10")}>
      {/* Page header (only in standalone mode) */}
      {!embedded && (
        <div>
          <h1 className="text-xl font-bold text-foreground">Records</h1>
          <p className="text-sm text-muted-foreground mt-1">Solicitudes de registro y visitas de agencias</p>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center justify-between">
        {embedded && (
          <div>
            <h2 className="text-sm font-semibold text-foreground">Registros</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Solicitudes de registro y visitas de agencias</p>
          </div>
        )}
        <div className={cn("relative", embedded ? "w-[260px]" : "w-[300px]")}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search record..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 text-xs"
          />
        </div>
      </div>

      {/* Pending section */}
      {filteredPending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-foreground">
              {filteredPending.length} new registration and/or visit requests
            </h3>
          </div>
          <div className="rounded-xl border border-border/40 bg-card overflow-hidden shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
            <TableHeader showCheckbox />
            {filteredPending.map((r) => (
              <RecordRow key={r.id} record={r} isPending />
            ))}
          </div>
        </div>
      )}

      {/* Processed section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Processed requests</h3>
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
          <TableHeader showCheckbox={false} />
          {filteredProcessed.map((r) => (
            <RecordRow key={r.id} record={r} isPending={false} />
          ))}
          {filteredProcessed.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">No records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
