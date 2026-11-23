import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * PostCard: a card led by an image, for blog posts, articles and case studies.
 *
 * Geometry (concentric): card radius 22 = image radius 14 + padding 8.
 * The overlay layout drops the padding, so its image takes the card's 22.
 *
 * The title link stretches over the whole card (::after), so the card is one
 * click target with one accessible name, and the author or tag links inside
 * still work because they sit above it (relative z-10).
 */

type Layout = "stacked" | "horizontal" | "overlay"

const LayoutContext = React.createContext<Layout>("stacked")

function PostCard({
  layout = "stacked",
  className,
  ...props
}: React.ComponentProps<"article"> & {
  /** stacked: image on top · horizontal: image beside the text from sm up · overlay: text on the image */
  layout?: Layout
}) {
  return (
    <LayoutContext.Provider value={layout}>
      <article
        data-slot="post-card"
        data-layout={layout}
        className={cn(
          "group/post relative isolate flex overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60 transition-shadow duration-200 has-[a[data-slot=post-card-link]:focus-visible]:ring-2 has-[a[data-slot=post-card-link]:focus-visible]:ring-ring hover:shadow-raised",
          layout === "stacked" && "flex-col gap-1 p-2",
          layout === "horizontal" && "flex-col gap-1 p-2 sm:flex-row sm:gap-2",
          layout === "overlay" && "min-h-[360px] flex-col justify-end bg-[#0c0b0b] text-white ring-0",
          className
        )}
        {...props}
      />
    </LayoutContext.Provider>
  )
}

function PostCardMedia({
  className,
  ratio = "16 / 10",
  style,
  ...props
}: React.ComponentProps<"div"> & {
  /** CSS aspect-ratio for stacked cards; horizontal and overlay cards stretch instead */
  ratio?: string
}) {
  const layout = React.useContext(LayoutContext)
  return (
    <div
      data-slot="post-card-media"
      className={cn(
        "relative overflow-hidden bg-muted [&>img]:size-full [&>img]:object-cover [&>img]:transition-transform [&>img]:duration-500 [&>img]:ease-out-expo group-hover/post:[&>img]:scale-[1.03] motion-reduce:[&>img]:transition-none",
        layout !== "overlay" && "aspect-(--post-ratio) rounded-lg",
        layout === "horizontal" && "sm:w-[42%] sm:shrink-0 sm:self-stretch sm:aspect-auto",
        layout === "overlay" &&
          "absolute inset-0 -z-10 after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgb(12_11_11/0)_0%,rgb(12_11_11/0.6)_40%,rgb(12_11_11/0.9)_100%)]",
        className
      )}
      style={{ "--post-ratio": ratio, ...style } as React.CSSProperties}
      {...props}
    />
  )
}

function PostCardBody({ className, ...props }: React.ComponentProps<"div">) {
  const layout = React.useContext(LayoutContext)
  return (
    <div
      data-slot="post-card-body"
      className={cn("flex flex-1 flex-col gap-3", layout === "overlay" ? "p-6" : "p-3 sm:p-4", className)}
      {...props}
    />
  )
}

/** Category, date, reading time. Separate items with <PostCardDot />. */
function PostCardMeta({ className, ...props }: React.ComponentProps<"div">) {
  const layout = React.useContext(LayoutContext)
  return (
    <div
      data-slot="post-card-meta"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]",
        layout === "overlay" ? "text-white/80" : "text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function PostCardDot({ className, ...props }: React.ComponentProps<"span">) {
  return <span aria-hidden className={cn("size-[3px] rounded-full bg-current opacity-60", className)} {...props} />
}

/** A small pill for the category. Put it in PostCardMeta or above the title. */
function PostCardTag({ className, asChild, ...props }: React.ComponentProps<"span"> & { asChild?: boolean }) {
  const layout = React.useContext(LayoutContext)
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="post-card-tag"
      className={cn(
        "relative z-10 inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold",
        layout === "overlay" ? "bg-white/15 text-white backdrop-blur-sm" : "bg-soft text-soft-foreground",
        className
      )}
      {...props}
    />
  )
}

function PostCardTitle({
  className,
  href,
  children,
  as: Heading = "h3",
  ...props
}: React.ComponentProps<"h3"> & {
  /** the post URL; the link covers the whole card */
  href?: string
  as?: "h2" | "h3" | "h4"
}) {
  const layout = React.useContext(LayoutContext)
  return (
    <Heading
      data-slot="post-card-title"
      className={cn(
        "font-bold leading-[1.15] tracking-[-0.02em] text-balance",
        layout === "overlay" ? "text-[clamp(22px,3vw,30px)]" : "text-[19px]",
        className
      )}
      {...props}
    >
      {href ? (
        <a
          data-slot="post-card-link"
          href={href}
          className="outline-none decoration-2 underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover/post:underline"
        >
          {children}
        </a>
      ) : (
        children
      )}
    </Heading>
  )
}

function PostCardExcerpt({ className, ...props }: React.ComponentProps<"p">) {
  const layout = React.useContext(LayoutContext)
  return (
    <p
      data-slot="post-card-excerpt"
      className={cn(
        "line-clamp-3 text-[14.5px] leading-relaxed",
        layout === "overlay" ? "text-white/85" : "text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Author row: avatar, name and a second line (date or role). */
function PostCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  const layout = React.useContext(LayoutContext)
  return (
    <div
      data-slot="post-card-footer"
      className={cn(
        "mt-auto flex items-center gap-3 pt-1 text-[13px]",
        layout === "overlay" ? "text-white/80 [&_strong]:text-white" : "text-muted-foreground [&_strong]:text-foreground",
        "[&_strong]:font-semibold",
        className
      )}
      {...props}
    />
  )
}

export { PostCard, PostCardMedia, PostCardBody, PostCardMeta, PostCardDot, PostCardTag, PostCardTitle, PostCardExcerpt, PostCardFooter }
