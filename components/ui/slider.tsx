import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Slider: pick a value on a range. Also the scrubber and volume control of the
 * media players. Arrow keys step, Page Up / Down take big steps, Home / End jump.
 *
 * size "sm" is the media track (4px) whose thumb grows in on hover or focus;
 * size "default" is the form control (6px) with the thumb always shown.
 */

function Slider({
  className,
  size = "default",
  tone = "primary",
  buffered,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-valuetext": valueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  size?: "sm" | "default"
  tone?: "primary" | "highlight" | "ink" | "white"
  /** media only: how much has loaded, in the same units as value */
  buffered?: number
}) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min]
  )
  const span = max - min || 1
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      data-size={size}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "group/slider relative flex w-full touch-none items-center select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        size === "sm" ? "h-4" : "h-5",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full transition-[height] duration-150",
          size === "sm" ? "h-1 group-hover/slider:h-1.5 group-has-[:focus-visible]/slider:h-1.5" : "h-1.5",
          tone === "white" ? "bg-white/25" : "bg-muted"
        )}
      >
        {buffered != null && (
          <span
            aria-hidden
            data-slot="slider-buffered"
            className={cn("absolute inset-y-0 left-0 rounded-full", tone === "white" ? "bg-white/35" : "bg-foreground/15")}
            style={{ width: `${Math.max(0, Math.min(100, ((buffered - min) / span) * 100))}%` }}
          />
        )}
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute h-full rounded-full",
            tone === "primary" && "bg-primary",
            tone === "highlight" && "bg-highlight",
            tone === "ink" && "bg-foreground",
            tone === "white" && "bg-white"
          )}
        />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-slot="slider-thumb"
          // the name belongs on the thumb, which is the element with role="slider"
          aria-label={ariaLabel && values.length > 1 ? `${ariaLabel}, ${i === 0 ? "minimum" : "maximum"}` : ariaLabel}
          aria-labelledby={labelledBy}
          aria-valuetext={values.length === 1 ? valueText : undefined}
          className={cn(
            "block rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] ring-1 ring-black/10 outline-none transition-[transform,box-shadow] duration-150 ease-out-expo focus-visible:ring-4 focus-visible:ring-ring/40",
            size === "sm"
              ? "size-3.5 scale-0 group-hover/slider:scale-100 focus-visible:scale-100"
              : "size-[18px] hover:scale-110"
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
