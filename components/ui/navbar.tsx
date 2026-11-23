import * as React from "react"
import { Slot } from "radix-ui"
import { MenuIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

/**
 * Header bar for marketing pages and app shells: a 56px pill.
 *
 *  - "solid": white panel on the page ground
 *  - "glass": translucent ink over a photo (the blur is there for legibility, not decoration)
 *  - "ink":   the rail colour
 *
 * Geometry: actions inside are 40px pills, so the bar's 8px inner padding keeps
 * every corner concentric (28 = 20 + 8).
 */
type Variant = "solid" | "glass" | "ink"
const NavbarContext = React.createContext<Variant>("solid")

function Navbar({ className, variant = "solid", ...props }: React.ComponentProps<"nav"> & { variant?: Variant }) {
  return (
    <NavbarContext.Provider value={variant}>
      <nav
        data-slot="navbar"
        data-variant={variant}
        className={cn(
          "flex h-14 w-full items-center gap-4 rounded-full py-2 pl-5 pr-2",
          variant === "solid" && "bg-card text-card-foreground shadow-panel ring-1 ring-border/60",
          variant === "glass" && "bg-[rgb(12_11_11/0.34)] text-white ring-1 ring-white/15 backdrop-blur-md backdrop-saturate-150",
          variant === "ink" && "bg-rail text-rail-foreground",
          className
        )}
        {...props}
      />
    </NavbarContext.Provider>
  )
}

function NavbarBrand({ className, asChild = false, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="navbar-brand"
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-full text-[15px] font-bold tracking-[-0.02em] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  )
}

function NavbarLinks({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="navbar-links" className={cn("mx-auto hidden items-center gap-1 md:flex", className)} {...props} />
}

function NavbarLink({
  className,
  active = false,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { active?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <li>
      <Comp
        data-slot="navbar-link"
        data-active={active}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative inline-flex h-10 items-center rounded-full px-3.5 text-sm font-medium opacity-70 transition-opacity outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:opacity-100",
          // active marker: a 16 × 2 bar centred under the label
          "after:absolute after:bottom-1.5 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-current after:opacity-0 data-[active=true]:after:opacity-100",
          className
        )}
        {...props}
      />
    </li>
  )
}

function NavbarActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navbar-actions" className={cn("ml-auto flex shrink-0 items-center gap-2 md:ml-0", className)} {...props} />
}

/** Below md the links collapse into this menu. Pass <DropdownMenuItem asChild><a/></DropdownMenuItem> children. */
function NavbarMenu({ children, label = "Open menu" }: { children: React.ReactNode; label?: string }) {
  const variant = React.useContext(NavbarContext)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          "grid size-10 place-content-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden [&_svg]:size-[18px]",
          variant === "solid" ? "hover:bg-accent" : "hover:bg-white/10"
        )}
      >
        <MenuIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { Navbar, NavbarBrand, NavbarLinks, NavbarLink, NavbarActions, NavbarMenu }
