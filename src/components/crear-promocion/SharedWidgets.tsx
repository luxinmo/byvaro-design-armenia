import { Minus, Plus } from "lucide-react";
import type { CardOption } from "./types";

/* ───── selectable card ───── */
export function OptionCard<T extends string>({
  option,
  selected,
  onSelect,
}: {
  option: CardOption<T>;
  selected: boolean;
  onSelect: (v: T) => void;
}) {
  const Icon = option.icon;
  return (
    <button
      onClick={() => onSelect(option.value)}
      className={`group relative flex flex-col items-center gap-2.5 rounded-2xl border p-4 sm:p-5 text-center shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer
        ${selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/30"
        }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors
        ${selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground group-hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{option.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{option.description}</p>
      </div>
      <span
        className={`absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full border transition-colors
        ${selected ? "border-primary bg-primary" : "border-border"}`}
      />
    </button>
  );
}

/* ───── numeric stepper ───── */
export function NumericStepper({
  label,
  value,
  min = 0,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <span className="w-7 text-center text-sm font-semibold text-foreground tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        {suffix && <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

/* ───── compact inline stepper ───── */
export function InlineStepper({
  value,
  min = 0,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Minus className="h-3 w-3" strokeWidth={1.5} />
      </button>
      <span className="w-6 text-center text-xs font-semibold text-foreground tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground active:scale-95"
      >
        <Plus className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* ───── total summary ───── */
export function TotalSummary({ items }: { items: { label: string; count: number }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">Total de propiedades</span>
        <span className="text-lg font-bold text-primary tabular-nums">{total}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.filter(i => i.count > 0).map((item) => (
          <span key={item.label} className="rounded-md bg-card border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {item.count} {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
