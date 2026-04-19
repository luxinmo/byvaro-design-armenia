import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "active"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "overlay"
  | "trending"
  | "dot";
type Size = "sm" | "default" | "md";
type Shape = "rounded" | "pill";

const variantClass: Record<Variant, string> = {
  default: "bg-secondary/80 text-foreground border border-border/30",
  active: "bg-primary/10 text-primary border border-primary/20",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  warning: "bg-amber-50 text-amber-700 border border-amber-200/50",
  danger: "bg-red-50 text-red-700 border border-red-200/50",
  muted: "bg-muted/40 text-muted-foreground border border-transparent",
  overlay: "bg-white/90 text-foreground backdrop-blur-sm border border-white/20",
  trending:
    "bg-gradient-to-r from-orange-400 to-pink-500 text-white border border-transparent shadow-[0_2px_8px_-2px_rgba(249,115,22,0.4)]",
  dot: "border border-border/50",
};

const sizeClass: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[10px]",
  default: "px-3 py-1.5 text-xs",
  md: "px-3.5 py-1.5 text-xs",
};

const shapeClass: Record<Shape, string> = {
  rounded: "rounded-2xl",
  pill: "rounded-full",
};

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  icon?: ReactNode;
  dot?: string;
}

export function Tag({
  className,
  variant = "default",
  size = "default",
  shape = "rounded",
  icon,
  dot,
  children,
  ...props
}: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold whitespace-nowrap transition-all duration-200",
        variantClass[variant],
        sizeClass[size],
        shapeClass[shape],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {icon}
      {children}
    </span>
  );
}
