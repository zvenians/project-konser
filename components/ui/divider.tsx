import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Divider: the break between two sections of a page.
 * Separator is the 1px rule inside a component; Divider carries the vertical
 * rhythm between sections, and can hold a label, an icon or a short mark.
 */

const dividerVariants = cva("flex w-full items-center text-muted-foreground", {
  variants: {
    variant: {
      /** a full hairline */
      line: "",
      /** a hairline that fades out at both ends */
      fade: "",
      /** three dots, centred */
      dots: "justify-center",
      /** a short Mars Green pill, centred: the brand's full stop */
      mark: "justify-center",
    },
    spacing: {
      none: "",
      sm: "my-6",
      md: "my-12",
      lg: "my-20",
    },
  },
  defaultVariants: { variant: "line", spacing: "md" },
})

function Rule({ fade, side }: { fade: boolean; side?: "start" | "end" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-px flex-1",
        !fade && "bg-border",
        fade && side === "start" && "bg-[linear-gradient(90deg,transparent,var(--border))]",
        fade && side === "end" && "bg-[linear-gradient(90deg,var(--border),transparent)]",
        fade && !side && "bg-[linear-gradient(90deg,transparent,var(--border)_20%,var(--border)_80%,transparent)]"
      )}
    />
  )
}

function Divider({
  className,
  variant = "line",
  spacing,
  align = "center",
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof dividerVariants> & {
    /** where the label sits on line and fade dividers */
    align?: "start" | "center" | "end"
  }) {
  const fade = variant === "fade"
  let body: React.ReactNode
  if (variant === "dots") {
    body = (
      <span aria-hidden className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1 rounded-full bg-current opacity-60" />
        ))}
      </span>
    )
  } else if (variant === "mark") {
    body = <span aria-hidden className="h-1 w-10 rounded-full bg-brand" />
  } else if (children) {
    body = (
      <>
        {align !== "start" && <Rule fade={fade} side="start" />}
        <span className="flex shrink-0 items-center gap-2 px-4 text-[13px] font-medium [&_svg]:size-4 [&_svg]:shrink-0 first:pl-0 last:pr-0">
          {children}
        </span>
        {align !== "end" && <Rule fade={fade} side="end" />}
      </>
    )
  } else {
    body = <Rule fade={fade} />
  }
  return (
    <div
      data-slot="divider"
      data-variant={variant}
      role="separator"
      aria-orientation="horizontal"
      aria-label={typeof children === "string" ? children : undefined}
      className={cn(dividerVariants({ variant, spacing }), className)}
      {...props}
    >
      {body}
    </div>
  )
}

export { Divider, dividerVariants }
