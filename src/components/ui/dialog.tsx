/**
 * dialog.tsx — Dialog/Sheet auf Basis der Base-UI-Dialog-Primitive (Root/
 * Trigger/Portal/Backdrop/Popup/Title/Description/Close). ESC-, Fokus- und
 * Scroll-Handling übernimmt Base UI. Die side-Prop steuert die Darstellung:
 * "center" = klassischer zentrierter Dialog, "right" = Sheet (mobil von unten,
 * ab sm von rechts), "bottom" = Sheet immer von unten. Backdrop mit
 * backdrop-blur; Ein-/Ausblendung über data-starting-style/data-ending-style.
 */
import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const dialogPopupVariants = cva(
  "fixed z-50 flex flex-col gap-4 bg-background p-6 shadow-[var(--elevation-3)] outline-none transition-[transform,opacity,translate] duration-[var(--motion-duration-base)] ease-[var(--motion-ease)]",
  {
    variants: {
      side: {
        center:
          "top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
        right:
          "inset-x-0 bottom-0 max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border data-starting-style:translate-y-full data-ending-style:translate-y-full sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-t-none sm:rounded-l-2xl sm:border-t-0 sm:border-l sm:data-starting-style:translate-x-full sm:data-starting-style:translate-y-0 sm:data-ending-style:translate-x-full sm:data-ending-style:translate-y-0",
        bottom:
          "inset-x-0 bottom-0 max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border data-starting-style:translate-y-full data-ending-style:translate-y-full",
      },
    },
    defaultVariants: {
      side: "center",
    },
  }
)

function DialogContent({
  className,
  children,
  side = "center",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props &
  VariantProps<typeof dialogPopupVariants> & {
    showCloseButton?: boolean
  }) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-[var(--motion-duration-base)] ease-[var(--motion-ease)] data-starting-style:opacity-0 data-ending-style:opacity-0"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(dialogPopupVariants({ side, className }))}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close-button"
            className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  dialogPopupVariants,
}
