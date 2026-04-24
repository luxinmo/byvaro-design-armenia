import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

/**
 * Wrapper del PopoverContent de Radix con fixes globales:
 *
 * 1. `onWheel` / `onTouchMove` hacen `stopPropagation` — cuando el
 *    popover se renderiza dentro de un Dialog (que aplica scroll-lock
 *    global con `react-remove-scroll`), los wheel/touch events no
 *    llegan al contenedor scrollable del popover. Esta propagación se
 *    detiene aquí para que TODOS los popovers de la app tengan scroll
 *    interno que funcione siempre, aunque el body esté bloqueado.
 *    Si el caller pasa sus propios handlers, se encadenan.
 * 2. `overscroll-contain` evita que llegar al final de la lista del
 *    popover haga scroll del viewport padre.
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, onWheel, onTouchMove, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      onWheel={(e) => {
        e.stopPropagation();
        onWheel?.(e);
      }}
      onTouchMove={(e) => {
        e.stopPropagation();
        onTouchMove?.(e);
      }}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
