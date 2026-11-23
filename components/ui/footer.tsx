import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Site footer.
 *  - "default": a panel on the page ground
 *  - "ink":     near-black, the palette sheet's frame colour, in both themes
 */
type Variant = "default" | "ink"
const FooterContext = React.createContext<Variant>("default")

function Footer({ className, variant = "default", ...props }: React.ComponentProps<"footer"> & { variant?: Variant }) {
  return (
    <FooterContext.Provider value={variant}>
      <footer
        data-slot="footer"
        data-variant={variant}
        className={cn(
          "group/footer flex flex-col gap-12 rounded-[40px] p-8 sm:p-12",
          variant === "default" && "bg-card text-card-foreground ring-1 ring-border/60",
          variant === "ink" && "bg-[#0c0b0b] text-[#ecf2f0] ring-1 ring-white/8",
          className
        )}
        {...props}
      />
    </FooterContext.Provider>
  )
}

function FooterTop({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="footer-top"
      className={cn("grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16", className)}
      {...props}
    />
  )
}

function FooterBrand({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="footer-brand" className={cn("flex max-w-sm flex-col gap-5", className)} {...props} />
}

function FooterColumns({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="footer-columns" className={cn("grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4", className)} {...props} />
}

function FooterColumn({ title, className, children, ...props }: React.ComponentProps<"div"> & { title: string }) {
  const id = React.useId()
  return (
    <div data-slot="footer-column" className={cn("flex flex-col gap-3.5", className)} {...props}>
      <h3 id={id} className="text-[13px] font-semibold">
        {title}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col gap-2.5">
        {children}
      </ul>
    </div>
  )
}

function FooterLink({ className, asChild = false, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const variant = React.useContext(FooterContext)
  const Comp = asChild ? Slot.Root : "a"
  return (
    <li>
      <Comp
        data-slot="footer-link"
        className={cn(
          "rounded-sm text-sm underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring",
          variant === "ink" ? "text-[#ecf2f0]/70 hover:text-[#ecf2f0]" : "text-muted-foreground hover:text-foreground",
          className
        )}
        {...props}
      />
    </li>
  )
}

function FooterBottom({ className, ...props }: React.ComponentProps<"div">) {
  const variant = React.useContext(FooterContext)
  return (
    <div
      data-slot="footer-bottom"
      className={cn(
        "flex flex-col gap-4 border-t pt-6 text-[13px] sm:flex-row sm:items-center sm:justify-between",
        variant === "ink" ? "border-white/10 text-[#ecf2f0]/70" : "border-border text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Footer, FooterTop, FooterBrand, FooterColumns, FooterColumn, FooterLink, FooterBottom }
