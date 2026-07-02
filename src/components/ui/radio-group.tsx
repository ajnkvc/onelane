/**
 * radio-group.tsx — Radiogruppe auf Basis der Base-UI-Primitives radio-group
 * (Gruppe, Pfeiltasten-Navigation) und radio (Root + Indicator, Punkt als
 * Inline-SVG). Sichtbar 20px, unsichtbares Touch-Ziel ≥44px über ::after;
 * Fokus-/Invalid-Stile wie button.tsx.
 */
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "relative flex size-5 shrink-0 items-center justify-center rounded-full border border-input bg-background text-primary transition-[color,box-shadow] outline-none dark:bg-input/30",
        "after:absolute after:-inset-3 after:content-['']",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-checked:border-primary",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <svg
          className="size-2.5 fill-current"
          viewBox="0 0 8 8"
          aria-hidden="true"
        >
          <circle cx="4" cy="4" r="4" />
        </svg>
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
