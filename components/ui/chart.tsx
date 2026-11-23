import * as React from "react"
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Dens-UI charts: SVG, no chart library.
 *
 *   CandlestickChart  price over time: OHLC candles, volume, moving average
 *   AreaChart         change over time, one or more series
 *   BarChart          magnitude per category (columns)
 *   DonutChart        parts of a whole, with a centre total
 *   BarList           ranked shares, e.g. sales by channel
 *   SegmentedBar      one whole split into parts, shares printed inside
 *
 * Shared rules
 *   colour      series take --chart-1 … --chart-5 in that fixed order; never cycled
 *   marks       lines 2px, columns ≤ 24px with a 4px rounded end, 2px surface gaps
 *   text        axis, legend and values use text tokens, never the series colour
 *   hover       crosshair + one tooltip on line charts, per-mark tooltips on bars
 *   keyboard    every plot is focusable; ← → move the readout
 *   a11y        each chart carries a visually hidden data table
 */

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
/** text that sits inside a filled series colour (SegmentedBar) */
const INK_ON = ["text-[#04110f]", "text-[#1f1100]", "text-white", "text-[#1a1700]", "text-white dark:text-[#1d0614]"]

export type ChartSeries = { key: string; name: string; color?: string }
type Row = Record<string, string | number>
type Formatter = (n: number) => string

const defaultFormat: Formatter = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)
const compactFormat: Formatter = (n) =>
  Math.abs(n) >= 10_000 ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n) : new Intl.NumberFormat("en-US").format(n)

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** clean tick values covering [min, max] */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)))
  return { lo, hi, ticks }
}

/** room for the widest y tick label (11px tabular figures ≈ 6.6px per character) */
function axisWidth(labels: string[]) {
  return Math.ceil(Math.max(...labels.map((l) => l.length)) * 6.6) + 14
}

/** every k-th x label so labels never collide */
function labelEvery(n: number, plotWidth: number, minGap = 64) {
  return Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotWidth / minGap))))
}

function keyNav(e: React.KeyboardEvent, n: number, active: number | null, set: (i: number | null) => void) {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault()
    const cur = active ?? n - 1
    set(Math.min(n - 1, Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1))))
  } else if (e.key === "Home") set(0)
  else if (e.key === "End") set(n - 1)
  else if (e.key === "Escape") set(null)
}

function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  const flip = x > width / 2
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-[140px] rounded-xl bg-popover px-3 py-2 text-[12.5px] text-popover-foreground shadow-raised ring-1 ring-border/70"
      style={{ left: x, top: y, transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)` }}
    >
      {children}
    </div>
  )
}

/** value first, series second; a short line key carries identity */
function TooltipRow({ color, name, value, shape = "line" }: { color: string; name: string; value: string; shape?: "line" | "rect" }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap py-0.5">
      <span aria-hidden className={shape === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]"} style={{ background: color }} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{name}</span>
    </div>
  )
}

export function ChartLegend({ items, shape = "rect", className }: { items: { name: string; color: string }[]; shape?: "line" | "rect"; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground", className)}>
      {items.map((it) => (
        <li key={it.name} className="flex items-center gap-1.5">
          <span aria-hidden className={shape === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]"} style={{ background: it.color }} />
          {it.name}
        </li>
      ))}
    </ul>
  )
}

function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
        ))}
      </tbody>
    </table>
  )
}

const axisText = "fill-muted-foreground text-[11px] tabular-nums"

/* ------------------------------------------------------------------ */
/* CandlestickChart                                                    */
/* ------------------------------------------------------------------ */

export type Candle = { time: string; open: number; high: number; low: number; close: number; volume?: number }

function movingAverage(data: Candle[], period: number) {
  return data.map((_, i) => {
    if (i < period - 1) return null
    let s = 0
    for (let j = i - period + 1; j <= i; j++) s += data[j].close
    return s / period
  })
}

export function CandlestickChart({
  data,
  label = "Price",
  height = 360,
  priceFormatter = defaultFormat,
  volumeFormatter = compactFormat,
  showVolume = true,
  movingAveragePeriod,
  className,
}: {
  data: Candle[]
  /** accessible name and table caption, e.g. "LMBG / IDR, daily" */
  label?: string
  height?: number
  priceFormatter?: Formatter
  volumeFormatter?: Formatter
  showVolume?: boolean
  /** draw a simple moving average of the close, e.g. 20 */
  movingAveragePeriod?: number
  className?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = React.useState<number | null>(null)
  const [pointerY, setPointerY] = React.useState<number | null>(null)

  const axisW = Math.max(56, axisWidth(data.map((d) => priceFormatter(d.high))) + 4)
  const top = 12
  const bottom = 26
  const plotW = Math.max(0, width - axisW)
  const plotH = height - top - bottom
  const volH = showVolume ? Math.round(plotH * 0.2) : 0
  const priceH = plotH - (showVolume ? volH + 12 : 0)

  const n = data.length
  const step = plotW / Math.max(1, n)
  const bodyW = Math.max(3, Math.min(12, step * 0.64))
  const xOf = (i: number) => i * step + step / 2

  const lows = data.map((d) => d.low)
  const highs = data.map((d) => d.high)
  const pad = (Math.max(...highs) - Math.min(...lows)) * 0.06
  const { lo, hi, ticks } = niceTicks(Math.min(...lows) - pad, Math.max(...highs) + pad, 5)
  const yOf = (v: number) => top + ((hi - v) / (hi - lo)) * priceH
  const vOf = (y: number) => hi - ((y - top) / priceH) * (hi - lo)
  const maxVol = Math.max(1, ...data.map((d) => d.volume ?? 0))
  const volTop = top + priceH + 12
  const ma = movingAveragePeriod ? movingAverage(data, movingAveragePeriod) : null

  const last = data[n - 1]
  const prev = data[n - 2] ?? last
  const shown = active != null ? data[active] : last
  const shownPrev = active != null ? data[active - 1] ?? data[active] : prev
  const change = shown.close - shownPrev.close
  const changePct = (change / shownPrev.close) * 100
  const up = (d: Candle) => d.close >= d.open
  const every = labelEvery(n, plotW, 72)

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    if (x > plotW) return
    setActive(Math.min(n - 1, Math.max(0, Math.floor(x / step))))
    setPointerY(y >= top && y <= top + priceH ? y : null)
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* readout: values lead */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px]">
        <span className="flex items-baseline gap-2">
          <span className="text-[22px] font-bold tracking-[-0.02em]">{priceFormatter(shown.close)}</span>
          <span className={cn("flex items-center gap-1 self-center font-semibold tabular-nums", change >= 0 ? "text-chart-up" : "text-chart-down")}>
            {change >= 0 ? <ArrowUpRightIcon className="size-3.5" aria-label="up" /> : <ArrowDownRightIcon className="size-3.5" aria-label="down" />}
            {priceFormatter(Math.abs(change))} ({changePct >= 0 ? "+" : "−"}
            {Math.abs(changePct).toFixed(2)}%)
          </span>
        </span>
        <span className="flex flex-wrap gap-x-3 text-muted-foreground tabular-nums">
          <span>{shown.time}</span>
          <span>O <b className="font-semibold text-foreground">{priceFormatter(shown.open)}</b></span>
          <span>H <b className="font-semibold text-foreground">{priceFormatter(shown.high)}</b></span>
          <span>L <b className="font-semibold text-foreground">{priceFormatter(shown.low)}</b></span>
          <span>C <b className="font-semibold text-foreground">{priceFormatter(shown.close)}</b></span>
          {shown.volume != null && <span>Vol <b className="font-semibold text-foreground">{volumeFormatter(shown.volume)}</b></span>}
        </span>
      </div>

      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${label}. Last close ${priceFormatter(last.close)}. Use the left and right arrow keys to read each candle.`}
            tabIndex={0}
            className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setActive(null)
              setPointerY(null)
            }}
            onKeyDown={(e) => keyNav(e, n, active, setActive)}
          >
            {/* grid + price axis on the right, the trading convention */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotW} y1={yOf(t)} y2={yOf(t)} className="stroke-border" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={plotW + 10} y={yOf(t)} dy="0.32em" className={axisText}>
                  {priceFormatter(t)}
                </text>
              </g>
            ))}
            {showVolume && <line x1={0} x2={plotW} y1={volTop + volH} y2={volTop + volH} className="stroke-border" shapeRendering="crispEdges" />}

            {/* time labels */}
            {data.map((d, i) =>
              i % every === 0 ? (
                <text key={d.time} x={i === 0 ? 0 : xOf(i)} y={height - 8} textAnchor={i === 0 ? "start" : "middle"} className={axisText}>
                  {d.time}
                </text>
              ) : null
            )}

            {/* volume */}
            {showVolume &&
              data.map((d, i) => {
                const h = ((d.volume ?? 0) / maxVol) * volH
                return (
                  <rect
                    key={`v${i}`}
                    x={xOf(i) - bodyW / 2}
                    y={volTop + volH - h}
                    width={bodyW}
                    height={h}
                    rx={Math.min(2, bodyW / 4)}
                    fill={up(d) ? "var(--chart-up)" : "var(--chart-down)"}
                    opacity={active == null || active === i ? 0.32 : 0.16}
                  />
                )
              })}

            {/* candles: up hollow, down filled, so direction never rests on colour alone */}
            {data.map((d, i) => {
              const isUp = up(d)
              const color = isUp ? "var(--chart-up)" : "var(--chart-down)"
              const yO = yOf(d.open)
              const yC = yOf(d.close)
              const bodyTop = Math.min(yO, yC)
              const bodyH = Math.max(1, Math.abs(yC - yO))
              const x = Math.round(xOf(i)) + 0.5
              const dim = active != null && active !== i
              return (
                <g key={d.time} opacity={dim ? 0.55 : 1}>
                  <line x1={x} x2={x} y1={yOf(d.high)} y2={bodyTop} stroke={color} strokeWidth={1} />
                  <line x1={x} x2={x} y1={bodyTop + bodyH} y2={yOf(d.low)} stroke={color} strokeWidth={1} />
                  <rect
                    x={x - bodyW / 2 + (isUp ? 0.75 : 0)}
                    y={bodyTop + (isUp ? 0.75 : 0)}
                    width={bodyW - (isUp ? 1.5 : 0)}
                    height={Math.max(1, bodyH - (isUp ? 1.5 : 0))}
                    rx={1.5}
                    fill={isUp ? "var(--card)" : color}
                    stroke={isUp ? color : "none"}
                    strokeWidth={isUp ? 1.5 : 0}
                  />
                </g>
              )
            })}

            {/* moving average */}
            {ma && (
              <path
                d={ma
                  .map((v, i) => (v == null ? null : `${xOf(i)},${yOf(v)}`))
                  .filter(Boolean)
                  .map((p, i) => `${i ? "L" : "M"}${p}`)
                  .join("")}
                fill="none"
                stroke="var(--chart-3)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* last price */}
            <line
              x1={0}
              x2={plotW}
              y1={Math.round(yOf(last.close)) + 0.5}
              y2={Math.round(yOf(last.close)) + 0.5}
              stroke={up(last) ? "var(--chart-up)" : "var(--chart-down)"}
              strokeWidth={1}
              opacity={0.7}
            />
            <g transform={`translate(${plotW + 4} ${yOf(last.close)})`}>
              <rect x={0} y={-10} width={axisW - 6} height={20} rx={10} className="fill-popover" stroke={up(last) ? "var(--chart-up)" : "var(--chart-down)"} strokeWidth={1.5} />
              <text x={(axisW - 6) / 2} dy="0.34em" textAnchor="middle" className="fill-foreground text-[11px] font-semibold tabular-nums">
                {priceFormatter(last.close)}
              </text>
            </g>

            {/* crosshair */}
            {active != null && (
              <g pointerEvents="none">
                <line x1={xOf(active)} x2={xOf(active)} y1={top} y2={volTop + volH} className="stroke-muted-foreground" strokeWidth={1} opacity={0.5} />
                {pointerY != null && (
                  <>
                    <line x1={0} x2={plotW} y1={pointerY} y2={pointerY} className="stroke-muted-foreground" strokeWidth={1} opacity={0.5} />
                    <g transform={`translate(${plotW + 4} ${pointerY})`}>
                      <rect x={0} y={-10} width={axisW - 6} height={20} rx={10} className="fill-foreground" />
                      <text x={(axisW - 6) / 2} dy="0.34em" textAnchor="middle" className="fill-background text-[11px] font-semibold tabular-nums">
                        {priceFormatter(vOf(pointerY))}
                      </text>
                    </g>
                  </>
                )}
              </g>
            )}
          </svg>
        )}
      </div>
      <ChartLegend
        className="mt-3"
        shape="line"
        items={[
          { name: "Up: hollow", color: "var(--chart-up)" },
          { name: "Down: filled", color: "var(--chart-down)" },
          ...(movingAveragePeriod ? [{ name: `MA ${movingAveragePeriod}`, color: "var(--chart-3)" }] : []),
        ]}
      />
      <SrTable
        caption={label}
        head={["Time", "Open", "High", "Low", "Close", "Volume"]}
        rows={data.map((d) => [d.time, priceFormatter(d.open), priceFormatter(d.high), priceFormatter(d.low), priceFormatter(d.close), d.volume != null ? volumeFormatter(d.volume) : ""])}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AreaChart                                                           */
/* ------------------------------------------------------------------ */

export function AreaChart({
  data,
  index,
  series,
  label = "Chart",
  height = 260,
  valueFormatter = compactFormat,
  area,
  className,
}: {
  data: Row[]
  /** key of the x value in each row, e.g. "month" */
  index: string
  series: ChartSeries[]
  label?: string
  height?: number
  valueFormatter?: Formatter
  /** fill under the line; on by default for a single series */
  area?: boolean
  className?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = React.useState<number | null>(null)
  const colors = series.map((s, i) => s.color ?? CHART_COLORS[i % CHART_COLORS.length])
  const fill = area ?? series.length === 1

  const n = data.length
  const values = data.flatMap((d) => series.map((s) => Number(d[s.key])))
  const { lo, hi, ticks } = niceTicks(Math.min(0, ...values), Math.max(...values), 4)
  const left = axisWidth(ticks.map(valueFormatter))
  const right = 16
  const top = 12
  const bottom = 28
  const plotW = Math.max(0, width - left - right)
  const plotH = height - top - bottom
  const xOf = (i: number) => left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yOf = (v: number) => top + ((hi - v) / (hi - lo)) * plotH
  const every = labelEvery(n, plotW)

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left - left
    setActive(Math.min(n - 1, Math.max(0, Math.round((x / plotW) * (n - 1)))))
  }

  return (
    <div className={cn("relative w-full", className)}>
      {series.length > 1 && <ChartLegend className="mb-3" shape="line" items={series.map((s, i) => ({ name: s.name, color: colors[i] }))} />}
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${label}. Use the left and right arrow keys to read each point.`}
            tabIndex={0}
            className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onKeyDown={(e) => keyNav(e, n, active, setActive)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={yOf(t)} y2={yOf(t)} className="stroke-border" shapeRendering="crispEdges" />
                <text x={left - 10} y={yOf(t)} dy="0.32em" textAnchor="end" className={axisText}>
                  {valueFormatter(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % every === 0 || i === n - 1 ? (
                <text key={i} x={xOf(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className={axisText}>
                  {String(d[index])}
                </text>
              ) : null
            )}
            {series.map((s, si) => {
              const pts = data.map((d, i) => [xOf(i), yOf(Number(d[s.key]))] as const)
              const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("")
              return (
                <g key={s.key}>
                  {fill && <path d={`${line}L${xOf(n - 1)},${yOf(lo)}L${xOf(0)},${yOf(lo)}Z`} fill={colors[si]} opacity={0.1} />}
                  <path d={line} fill="none" stroke={colors[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              )
            })}
            {/* end markers carry a 2px surface ring */}
            {series.map((s, si) => (
              <circle key={s.key} cx={xOf(n - 1)} cy={yOf(Number(data[n - 1][s.key]))} r={4} fill={colors[si]} className="stroke-card" strokeWidth={2} />
            ))}
            {active != null && (
              <g pointerEvents="none">
                <line x1={xOf(active)} x2={xOf(active)} y1={top} y2={top + plotH} className="stroke-muted-foreground" opacity={0.5} />
                {series.map((s, si) => (
                  <circle key={s.key} cx={xOf(active)} cy={yOf(Number(data[active][s.key]))} r={4.5} fill={colors[si]} className="stroke-card" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {active != null && width > 0 && (
          <ChartTooltip x={xOf(active)} y={top + plotH / 2} width={width}>
            <div className="mb-1 text-muted-foreground">{String(data[active][index])}</div>
            {series.map((s, si) => (
              <TooltipRow key={s.key} color={colors[si]} name={s.name} value={valueFormatter(Number(data[active][s.key]))} />
            ))}
          </ChartTooltip>
        )}
      </div>
      <SrTable
        caption={label}
        head={[index, ...series.map((s) => s.name)]}
        rows={data.map((d) => [String(d[index]), ...series.map((s) => valueFormatter(Number(d[s.key])))])}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BarChart                                                            */
/* ------------------------------------------------------------------ */

export function BarChart({
  data,
  index,
  series,
  label = "Chart",
  height = 260,
  valueFormatter = compactFormat,
  className,
}: {
  data: Row[]
  index: string
  /** one series, or a few grouped side by side */
  series: ChartSeries[]
  label?: string
  height?: number
  valueFormatter?: Formatter
  className?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = React.useState<number | null>(null)
  const colors = series.map((s, i) => s.color ?? CHART_COLORS[i % CHART_COLORS.length])

  const n = data.length
  const values = data.flatMap((d) => series.map((s) => Number(d[s.key])))
  const { lo, hi, ticks } = niceTicks(0, Math.max(...values), 4)
  const left = axisWidth(ticks.map(valueFormatter))
  const right = 8
  const top = 12
  const bottom = 28
  const plotW = Math.max(0, width - left - right)
  const plotH = height - top - bottom
  const band = plotW / Math.max(1, n)
  const gap = 2
  const barW = Math.min(24, (band * 0.7 - gap * (series.length - 1)) / series.length)
  const groupW = barW * series.length + gap * (series.length - 1)
  const yOf = (v: number) => top + ((hi - v) / (hi - lo)) * plotH
  const every = labelEvery(n, plotW, 48)

  return (
    <div className={cn("relative w-full", className)}>
      {series.length > 1 && <ChartLegend className="mb-3" items={series.map((s, i) => ({ name: s.name, color: colors[i] }))} />}
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${label}. Use the left and right arrow keys to read each bar.`}
            tabIndex={0}
            className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerLeave={() => setActive(null)}
            onKeyDown={(e) => keyNav(e, n, active, setActive)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={yOf(t)} y2={yOf(t)} className="stroke-border" shapeRendering="crispEdges" />
                <text x={left - 10} y={yOf(t)} dy="0.32em" textAnchor="end" className={axisText}>
                  {valueFormatter(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x0 = left + i * band + (band - groupW) / 2
              return (
                <g key={i} opacity={active != null && active !== i ? 0.45 : 1} onPointerEnter={() => setActive(i)}>
                  {/* the hit target is the whole band, not the painted bar */}
                  <rect x={left + i * band} y={top} width={band} height={plotH} fill="transparent" />
                  {series.map((s, si) => {
                    const v = Number(d[s.key])
                    const y = yOf(v)
                    const h = yOf(lo) - y
                    const x = x0 + si * (barW + gap)
                    const r = Math.min(4, barW / 2, h)
                    // 4px rounded data end, square at the baseline
                    return (
                      <path
                        key={s.key}
                        d={`M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${y + h}Z`}
                        fill={colors[si]}
                      />
                    )
                  })}
                  {i % every === 0 && (
                    <text x={left + i * band + band / 2} y={height - 8} textAnchor="middle" className={axisText}>
                      {String(d[index])}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
        {active != null && width > 0 && (
          <ChartTooltip x={left + active * band + band / 2} y={top + plotH / 2} width={width}>
            <div className="mb-1 text-muted-foreground">{String(data[active][index])}</div>
            {series.map((s, si) => (
              <TooltipRow key={s.key} shape="rect" color={colors[si]} name={s.name} value={valueFormatter(Number(data[active][s.key]))} />
            ))}
          </ChartTooltip>
        )}
      </div>
      <SrTable
        caption={label}
        head={[index, ...series.map((s) => s.name)]}
        rows={data.map((d) => [String(d[index]), ...series.map((s) => valueFormatter(Number(d[s.key])))])}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* DonutChart                                                          */
/* ------------------------------------------------------------------ */

export type Slice = { name: string; value: number; color?: string }

export function DonutChart({
  data,
  label = "Share",
  size = 200,
  thickness = 26,
  centerLabel = "Total",
  valueFormatter = compactFormat,
  showLegend = true,
  className,
}: {
  data: Slice[]
  label?: string
  size?: number
  thickness?: number
  /** caption under the total in the middle */
  centerLabel?: string
  valueFormatter?: Formatter
  showLegend?: boolean
  className?: string
}) {
  const [active, setActive] = React.useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  const colors = data.map((d, i) => d.color ?? CHART_COLORS[i % CHART_COLORS.length])
  const r = size / 2
  const rOut = r - 2
  const rIn = rOut - thickness
  const gapAngle = 2 / ((rOut + rIn) / 2) // a 2px surface gap at the ring's middle
  const pct = (v: number) => (total ? (v / total) * 100 : 0)

  let a0 = -Math.PI / 2
  const arcs = data.map((d) => {
    const sweep = total ? (d.value / total) * Math.PI * 2 : 0
    const start = a0 + (data.length > 1 ? gapAngle / 2 : 0)
    const end = a0 + sweep - (data.length > 1 ? gapAngle / 2 : 0)
    a0 += sweep
    return { start, end: Math.max(start, end) }
  })
  const pt = (rad: number, a: number) => `${r + rad * Math.cos(a)},${r + rad * Math.sin(a)}`
  const arcPath = (s: number, e: number) => {
    if (e - s >= Math.PI * 2 - 1e-6) e = s + Math.PI * 2 - 1e-4
    const large = e - s > Math.PI ? 1 : 0
    return `M${pt(rOut, s)}A${rOut},${rOut} 0 ${large} 1 ${pt(rOut, e)}L${pt(rIn, e)}A${rIn},${rIn} 0 ${large} 0 ${pt(rIn, s)}Z`
  }
  const shown = active != null ? data[active] : null

  return (
    <div className={cn("flex flex-wrap items-center gap-x-8 gap-y-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`${label}. ${data.map((d) => `${d.name} ${pct(d.value).toFixed(1)}%`).join(", ")}.`}
          tabIndex={0}
          className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerLeave={() => setActive(null)}
          onKeyDown={(e) => keyNav(e, data.length, active, setActive)}
        >
          {arcs.map((a, i) => (
            <path
              key={data[i].name}
              d={arcPath(a.start, a.end)}
              fill={colors[i]}
              opacity={active != null && active !== i ? 0.3 : 1}
              className="transition-opacity duration-150"
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="font-bold leading-none tracking-[-0.02em]" style={{ fontSize: Math.round(Math.min(28, Math.max(18, size * 0.13))) }}>
            {shown ? `${pct(shown.value).toFixed(1)}%` : valueFormatter(total)}
          </span>
          <span className="mt-1 max-w-[12ch] truncate text-[12px] text-muted-foreground">{shown ? shown.name : centerLabel}</span>
        </div>
      </div>
      {showLegend && (
        <ul className="grid min-w-[200px] flex-1 gap-1 text-[13px]">
          {data.map((d, i) => (
            <li
              key={d.name}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              className={cn(
                "grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 transition-colors",
                active === i && "bg-muted"
              )}
            >
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: colors[i] }} />
              <span className="truncate">{d.name}</span>
              <span className="font-semibold tabular-nums">{valueFormatter(d.value)}</span>
              <span className="w-12 text-right tabular-nums text-muted-foreground">{pct(d.value).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
      <SrTable caption={label} head={["Part", "Value", "Share"]} rows={data.map((d) => [d.name, valueFormatter(d.value), `${pct(d.value).toFixed(1)}%`])} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BarList                                                             */
/* ------------------------------------------------------------------ */

export function BarList({
  data,
  label = "Ranking",
  valueFormatter = compactFormat,
  showShare = true,
  color = "var(--chart-1)",
  className,
}: {
  data: { name: string; value: number; href?: string }[]
  label?: string
  valueFormatter?: Formatter
  /** print each row's share of the total */
  showShare?: boolean
  color?: string
  className?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul aria-label={label} className={cn("grid gap-3.5", className)}>
      {data.map((d) => {
        const share = total ? (d.value / total) * 100 : 0
        return (
          <li key={d.name} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              {d.href ? (
                <a href={d.href} className="truncate hover:underline">
                  {d.name}
                </a>
              ) : (
                <span className="truncate">{d.name}</span>
              )}
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="font-semibold">{valueFormatter(d.value)}</span>
                {showShare && <span className="w-11 text-right text-[12.5px] text-muted-foreground">{share.toFixed(1)}%</span>}
              </span>
            </div>
            {/* track is a lighter step of the same hue */}
            <div className="h-2 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
              <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* SegmentedBar                                                        */
/* ------------------------------------------------------------------ */

export function SegmentedBar({
  data,
  label = "Share",
  valueFormatter = compactFormat,
  className,
}: {
  data: Slice[]
  label?: string
  valueFormatter?: Formatter
  className?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = React.useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  const colors = data.map((d, i) => d.color ?? CHART_COLORS[i % CHART_COLORS.length])
  const parts = data.filter((d) => d.value > 0)
  const gaps = (parts.length - 1) * 2
  return (
    <div className={cn("relative grid gap-3", className)}>
      <div
        ref={ref}
        role="img"
        aria-label={`${label}. ${data.map((d) => `${d.name} ${((d.value / total) * 100).toFixed(1)}%`).join(", ")}.`}
        className="relative flex h-7 w-full gap-0.5"
        onPointerLeave={() => setActive(null)}
      >
        {data.map((d, i) => {
          if (d.value <= 0) return null
          const share = (d.value / total) * 100
          const px = ((width - gaps) * d.value) / total
          return (
            <div
              key={d.name}
              className={cn("flex h-full items-center overflow-hidden rounded-[4px] px-2 text-[12px] font-semibold tabular-nums transition-opacity", INK_ON[i % INK_ON.length])}
              style={{ flex: `${d.value} 1 0`, background: colors[i], opacity: active != null && active !== i ? 0.45 : 1 }}
              onPointerEnter={() => setActive(i)}
            >
              {/* print the share only when it fits */}
              {px >= 44 ? `${Math.round(share)}%` : null}
            </div>
          )
        })}
      </div>
      <ChartLegend items={data.map((d, i) => ({ name: d.name, color: colors[i] }))} />
      {active != null && (
        <div className="pointer-events-none absolute -top-2 left-0 -translate-y-full rounded-xl bg-popover px-3 py-2 text-[12.5px] shadow-raised ring-1 ring-border/70">
          <TooltipRow shape="rect" color={colors[active]} name={data[active].name} value={`${valueFormatter(data[active].value)} · ${((data[active].value / total) * 100).toFixed(1)}%`} />
        </div>
      )}
      <SrTable caption={label} head={["Part", "Value", "Share"]} rows={data.map((d) => [d.name, valueFormatter(d.value), `${((d.value / total) * 100).toFixed(1)}%`])} />
    </div>
  )
}
