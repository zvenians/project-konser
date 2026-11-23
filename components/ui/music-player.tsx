import * as React from "react"
import {
  LoaderCircleIcon,
  PauseIcon,
  PlayIcon,
  Repeat1Icon,
  RepeatIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"

/*
 * Music player: one <audio> element, a queue, and three faces for it.
 *
 *   card  the "now playing" card: cover on top, scrubber, full transport
 *   mini  a compact row: cover, title, progress and prev / play / next
 *   bar   the bottom bar of an app: track, transport with scrubber, volume
 *
 * <MusicPlayer tracks={…} /> is self-contained. To drive a playlist and a
 * player from the same queue, wrap both in <MusicPlayerProvider> and leave
 * tracks off the player.
 *
 * Another engine (a YouTube or streaming SDK) can drive the same faces: put a
 * MusicPlayerState into <MusicPlayerContext.Provider> instead of using
 * <MusicPlayerProvider>, which owns an <audio> element.
 *
 * Geometry (concentric): card radius 28 = cover 16 + padding 12.
 */

export type Track = {
  id?: string
  title: string
  artist: string
  src: string
  /** an image URL, or any node (an SVG, a gradient) drawn into the square */
  cover?: string | React.ReactNode
  /** seconds; shown in the playlist before the file has loaded */
  duration?: number
}

export type RepeatMode = "off" | "all" | "one"

type MusicPlayerState = {
  tracks: Track[]
  index: number
  track: Track | undefined
  playing: boolean
  loading: boolean
  error: boolean
  time: number
  duration: number
  buffered: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  play: (index?: number) => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (seconds: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

const MusicPlayerContext = React.createContext<MusicPlayerState | null>(null)

function useMusicPlayer() {
  const ctx = React.useContext(MusicPlayerContext)
  if (!ctx) throw new Error("useMusicPlayer must be used inside <MusicPlayerProvider> or <MusicPlayer tracks>")
  return ctx
}

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h ? String(m).padStart(2, "0") : String(m)
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`
}

function MusicPlayerProvider({
  tracks,
  initialIndex = 0,
  onTrackChange,
  children,
}: {
  tracks: Track[]
  initialIndex?: number
  onTrackChange?: (track: Track, index: number) => void
  children: React.ReactNode
}) {
  const audio = React.useRef<HTMLAudioElement>(null)
  const [index, setIndex] = React.useState(initialIndex)
  const [playing, setPlaying] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [time, setTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [buffered, setBuffered] = React.useState(0)
  const [volume, setVolumeState] = React.useState(0.8)
  const [muted, setMuted] = React.useState(false)
  const [shuffle, setShuffle] = React.useState(false)
  const [repeat, setRepeat] = React.useState<RepeatMode>("off")
  const wantsPlay = React.useRef(false)

  const track = tracks[index]

  // keep the element in step with volume and mute
  React.useEffect(() => {
    const el = audio.current
    if (!el) return
    el.volume = volume
    el.muted = muted
  }, [volume, muted])

  // a smooth playhead while playing; timeupdate alone ticks at ~4 Hz
  React.useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (audio.current) setTime(audio.current.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const go = React.useCallback(
    (i: number, autoplay: boolean) => {
      const n = tracks.length
      if (!n) return
      const next = ((i % n) + n) % n
      wantsPlay.current = autoplay
      setError(false)
      setTime(0)
      setBuffered(0)
      if (next === index) {
        const el = audio.current
        if (el) {
          el.currentTime = 0
          if (autoplay) void el.play().catch(() => {})
        }
      } else {
        setIndex(next)
        setDuration(tracks[next]?.duration ?? 0)
      }
    },
    [tracks, index]
  )

  // load the new source and play it if asked
  React.useEffect(() => {
    const el = audio.current
    if (!el || !track) return
    el.load()
    if (wantsPlay.current) void el.play().catch(() => setPlaying(false))
    if (track) onTrackChange?.(track, index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.src])

  const pick = React.useCallback(
    (dir: 1 | -1) => {
      if (shuffle && tracks.length > 1) {
        let r = index
        while (r === index) r = Math.floor(Math.random() * tracks.length)
        return r
      }
      return index + dir
    },
    [shuffle, tracks.length, index]
  )

  const state = React.useMemo<MusicPlayerState>(
    () => ({
      tracks,
      index,
      track,
      playing,
      loading,
      error,
      time,
      duration,
      buffered,
      volume,
      muted,
      shuffle,
      repeat,
      play: (i) => {
        if (i != null && i !== index) return go(i, true)
        wantsPlay.current = true
        void audio.current?.play().catch(() => setPlaying(false))
      },
      pause: () => audio.current?.pause(),
      toggle: () => {
        const el = audio.current
        if (!el) return
        if (el.paused) {
          wantsPlay.current = true
          void el.play().catch(() => setPlaying(false))
        } else el.pause()
      },
      next: () => go(pick(1), playing || wantsPlay.current),
      prev: () => {
        const el = audio.current
        if (el && el.currentTime > 3) {
          el.currentTime = 0
          setTime(0)
          return
        }
        go(pick(-1), playing || wantsPlay.current)
      },
      seek: (s) => {
        const el = audio.current
        if (!el) return
        el.currentTime = Math.max(0, Math.min(s, el.duration || s))
        setTime(el.currentTime)
      },
      setVolume: (v) => {
        setVolumeState(v)
        if (v > 0) setMuted(false)
      },
      toggleMute: () => setMuted((m) => !m),
      toggleShuffle: () => setShuffle((s) => !s),
      cycleRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    }),
    [tracks, index, track, playing, loading, error, time, duration, buffered, volume, muted, shuffle, repeat, go, pick]
  )

  // lock-screen and media-key controls where the browser supports them
  const latest = React.useRef(state)
  latest.current = state
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !track) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: typeof track.cover === "string" ? [{ src: track.cover }] : [],
    })
    const s = navigator.mediaSession
    s.setActionHandler("play", () => latest.current.play())
    s.setActionHandler("pause", () => latest.current.pause())
    s.setActionHandler("nexttrack", () => latest.current.next())
    s.setActionHandler("previoustrack", () => latest.current.prev())
  }, [track])

  const onEnded = () => {
    if (repeat === "one") return go(index, true)
    const last = index === tracks.length - 1
    if (last && repeat === "off" && !shuffle) {
      wantsPlay.current = false
      setPlaying(false)
      return
    }
    go(pick(1), true)
  }

  return (
    <MusicPlayerContext.Provider value={state}>
      {children}
      {track && (
        <audio
          ref={audio}
          src={track.src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onError={() => {
            setError(true)
            setLoading(false)
            setPlaying(false)
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onProgress={(e) => {
            const b = e.currentTarget.buffered
            if (b.length) setBuffered(b.end(b.length - 1))
          }}
          onEnded={onEnded}
        />
      )}
    </MusicPlayerContext.Provider>
  )
}

/* ---------------------------------------------------------------- pieces */

function Cover({ track, className }: { track: Track | undefined; className?: string }) {
  return (
    <div data-slot="music-cover" className={cn("relative shrink-0 overflow-hidden bg-muted [&>*]:size-full", className)}>
      {typeof track?.cover === "string" ? (
        <img src={track.cover} alt="" loading="lazy" decoding="async" className="object-cover" />
      ) : (
        track?.cover
      )}
    </div>
  )
}

/** Three bars that move while the track plays; still when paused or reduced motion. */
function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden data-slot="music-equalizer" className={cn("inline-flex h-3.5 items-end gap-[2px]", className)}>
      {[0, 0.25, 0.5].map((d) => (
        <span
          key={d}
          className={cn("h-full w-[3px] origin-bottom rounded-full bg-current", playing ? "animate-eq motion-reduce:animate-none" : "scale-y-[0.4]")}
          style={{ animationDelay: `-${d}s` }}
        />
      ))}
    </span>
  )
}

function Scrubber({ tone, className, label }: { tone: "primary" | "white"; className?: string; label: string }) {
  const p = useMusicPlayer()
  const [drag, setDrag] = React.useState<number | null>(null)
  const max = p.duration || p.track?.duration || 0
  return (
    <Slider
      size="sm"
      tone={tone}
      min={0}
      max={max || 1}
      step={1}
      disabled={!max}
      value={[drag ?? p.time]}
      buffered={p.buffered}
      onValueChange={([v]) => setDrag(v)}
      onValueCommit={([v]) => {
        p.seek(v)
        setDrag(null)
      }}
      aria-label={label}
      aria-valuetext={`${formatTime(drag ?? p.time)} of ${formatTime(max)}`}
      className={className}
    />
  )
}

type Tone = "default" | "ink"

const iconBtn =
  "inline-flex shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,transform] duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px]"

function ToolButton({ tone, active, className, ...props }: React.ComponentProps<"button"> & { tone: Tone; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        iconBtn,
        "relative size-9",
        tone === "ink"
          ? "text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-offset-[#0c0b0b]"
          : "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-offset-card",
        active && (tone === "ink" ? "text-white" : "text-primary hover:text-primary"),
        active &&
          "after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-current",
        className
      )}
      {...props}
    />
  )
}

function PlayButton({ tone, size = "lg", className }: { tone: Tone; size?: "sm" | "lg"; className?: string }) {
  const p = useMusicPlayer()
  const Icon = p.loading && p.playing ? LoaderCircleIcon : p.playing ? PauseIcon : PlayIcon
  return (
    <button
      type="button"
      onClick={p.toggle}
      disabled={!p.track || p.error}
      aria-label={p.playing ? "Pause" : "Play"}
      className={cn(
        iconBtn,
        size === "lg" ? "size-14 [&_svg]:size-6" : "size-10 [&_svg]:size-[18px]",
        tone === "ink"
          ? "bg-white text-[#0c0b0b] hover:bg-white/90 focus-visible:ring-offset-[#0c0b0b]"
          : "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_2px_6px_rgb(0_0_0/0.14)] hover:bg-primary/90 focus-visible:ring-offset-card",
        className
      )}
    >
      <Icon
        className={cn(
          Icon === LoaderCircleIcon ? "animate-spin motion-reduce:animate-none" : "fill-current",
          Icon === PlayIcon && "translate-x-px"
        )}
        strokeWidth={Icon === LoaderCircleIcon ? 2 : 1.5}
      />
    </button>
  )
}

function Transport({
  tone,
  compact = false,
  size = "lg",
  tight = false,
}: {
  tone: Tone
  compact?: boolean
  size?: "sm" | "lg"
  /** phones: drop Previous so the title keeps its room */
  tight?: boolean
}) {
  const p = useMusicPlayer()
  const RepeatGlyph = p.repeat === "one" ? Repeat1Icon : RepeatIcon
  return (
    <div data-slot="music-transport" className="flex items-center justify-center gap-1 sm:gap-2">
      {!compact && (
        <ToolButton tone={tone} active={p.shuffle} aria-pressed={p.shuffle} aria-label="Shuffle" onClick={p.toggleShuffle}>
          <ShuffleIcon />
        </ToolButton>
      )}
      <ToolButton tone={tone} aria-label="Previous track" onClick={p.prev} disabled={!p.track} className={cn(tight && "max-sm:hidden")}>
        <SkipBackIcon className="fill-current" />
      </ToolButton>
      <PlayButton tone={tone} size={size} />
      <ToolButton tone={tone} aria-label="Next track" onClick={p.next} disabled={!p.track}>
        <SkipForwardIcon className="fill-current" />
      </ToolButton>
      {!compact && (
        <ToolButton
          tone={tone}
          active={p.repeat !== "off"}
          aria-label={`Repeat: ${p.repeat === "off" ? "off" : p.repeat === "all" ? "all tracks" : "this track"}`}
          onClick={p.cycleRepeat}
        >
          <RepeatGlyph />
        </ToolButton>
      )}
    </div>
  )
}

function TrackText({ tone, className, size = "md" }: { tone: Tone; className?: string; size?: "md" | "lg" }) {
  const p = useMusicPlayer()
  return (
    <div className={cn("grid min-w-0 gap-0.5", className)}>
      <p
        className={cn(
          "truncate font-semibold tracking-[-0.01em]",
          size === "lg" ? "text-[19px] leading-tight" : "text-[15px] leading-snug"
        )}
      >
        {p.track?.title ?? "Nothing queued"}
      </p>
      <p
        className={cn(
          "truncate text-[13px]",
          p.error ? (tone === "ink" ? "text-[#ff9b8f]" : "text-destructive") : tone === "ink" ? "text-white/65" : "text-muted-foreground"
        )}
      >
        {p.error ? "This track could not be played" : p.track?.artist}
      </p>
    </div>
  )
}

function Times({ tone, className }: { tone: Tone; className?: string }) {
  const p = useMusicPlayer()
  return (
    <div
      className={cn(
        "flex justify-between text-[12px] tabular-nums",
        tone === "ink" ? "text-white/60" : "text-muted-foreground",
        className
      )}
    >
      <span>{formatTime(p.time)}</span>
      <span>{formatTime(p.duration || p.track?.duration || 0)}</span>
    </div>
  )
}

function Volume({ tone, className }: { tone: Tone; className?: string }) {
  const p = useMusicPlayer()
  const level = p.muted ? 0 : p.volume
  const Icon = level === 0 ? VolumeXIcon : level < 0.5 ? Volume1Icon : Volume2Icon
  return (
    <div data-slot="music-volume" className={cn("flex items-center gap-1", className)}>
      <ToolButton tone={tone} aria-label={p.muted ? "Unmute" : "Mute"} aria-pressed={p.muted} onClick={p.toggleMute}>
        <Icon />
      </ToolButton>
      <Slider
        size="sm"
        tone={tone === "ink" ? "white" : "ink"}
        min={0}
        max={1}
        step={0.01}
        value={[level]}
        onValueChange={([v]) => p.setVolume(v)}
        aria-label="Volume"
        aria-valuetext={`${Math.round(level * 100)}%`}
        className="w-24"
      />
    </div>
  )
}

/* ---------------------------------------------------------------- faces */

type Variant = "card" | "mini" | "bar"

function PlayerFace({ variant, tone, actions, className, ...props }: React.ComponentProps<"section"> & { variant: Variant; tone: Tone; actions?: React.ReactNode }) {
  const p = useMusicPlayer()
  const surface =
    tone === "ink"
      ? "bg-[#0c0b0b] text-white shadow-raised ring-1 ring-white/[0.06]"
      : "bg-card text-card-foreground shadow-panel ring-1 ring-border/60"
  const scrubTone = tone === "ink" ? "white" : "primary"

  if (variant === "card") {
    return (
      <section
        data-slot="music-player"
        data-variant="card"
        aria-label="Music player"
        className={cn("grid w-full max-w-[360px] gap-4 rounded-[28px] p-3 pb-5", surface, className)}
        {...props}
      >
        <Cover track={p.track} className="aspect-square w-full rounded-[16px]" />
        <div className="flex items-end justify-between gap-3 px-2">
          <TrackText tone={tone} size="lg" />
          {p.playing && <Equalizer playing className={cn("mb-1", tone === "ink" ? "text-white/70" : "text-primary")} />}
        </div>
        <div className="grid gap-1.5 px-2">
          <Scrubber tone={scrubTone} label="Seek" />
          <Times tone={tone} />
        </div>
        <Transport tone={tone} />
      </section>
    )
  }

  if (variant === "mini") {
    return (
      <section
        data-slot="music-player"
        data-variant="mini"
        aria-label="Music player"
        className={cn("flex w-full items-center gap-3 rounded-[22px] p-2 pr-2.5 sm:gap-4 sm:pr-3", surface, className)}
        {...props}
      >
        <Cover track={p.track} className="size-14 rounded-[14px] sm:size-20" />
        <div className="grid min-w-0 flex-1 gap-2">
          <TrackText tone={tone} />
          <div className="flex items-center gap-3">
            <Scrubber tone={scrubTone} label="Seek" className="flex-1" />
            <span className={cn("hidden shrink-0 text-[12px] tabular-nums sm:inline", tone === "ink" ? "text-white/60" : "text-muted-foreground")}>
              {formatTime(p.time)} / {formatTime(p.duration || p.track?.duration || 0)}
            </span>
          </div>
        </div>
        <Transport tone={tone} compact size="sm" tight />
      </section>
    )
  }

  // bar
  return (
    <section
      data-slot="music-player"
      data-variant="bar"
      aria-label="Music player"
      className={cn("w-full rounded-[22px] p-2", surface, className)}
      {...props}
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <Cover track={p.track} className="size-12 rounded-[14px]" />
          <TrackText tone={tone} />
        </div>
        <div className="grid gap-1 md:py-1">
          <div className="md:hidden">
            <Transport tone={tone} compact size="sm" tight />
          </div>
          <div className="hidden md:block">
            <Transport tone={tone} size="sm" />
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <span className={cn("w-10 text-right text-[12px] tabular-nums", tone === "ink" ? "text-white/60" : "text-muted-foreground")}>
              {formatTime(p.time)}
            </span>
            <Scrubber tone={scrubTone} label="Seek" className="flex-1" />
            <span className={cn("w-10 text-[12px] tabular-nums", tone === "ink" ? "text-white/60" : "text-muted-foreground")}>
              {formatTime(p.duration || p.track?.duration || 0)}
            </span>
          </div>
        </div>
        <div className="hidden items-center justify-end gap-1 md:flex">
          <Volume tone={tone} />
          {actions}
        </div>
      </div>
      {/* phones: the scrubber gets its own row under the track */}
      <div className="px-2 pb-1 pt-2 md:hidden">
        <Scrubber tone={scrubTone} label="Seek" />
      </div>
    </section>
  )
}

function MusicPlayer({
  tracks,
  variant = "card",
  tone = "default",
  actions,
  ...props
}: Omit<React.ComponentProps<"section">, "children"> & {
  /** pass tracks for a self-contained player; leave off inside <MusicPlayerProvider> */
  tracks?: Track[]
  variant?: Variant
  /** ink: the dark Now Playing surface */
  tone?: Tone
  /** bar only: extra buttons after the volume, e.g. a queue toggle */
  actions?: React.ReactNode
}) {
  const face = <PlayerFace variant={variant} tone={tone} actions={actions} {...props} />
  return tracks ? <MusicPlayerProvider tracks={tracks}>{face}</MusicPlayerProvider> : face
}

/**
 * The queue as a list. Click a row to play it; the playing row shows moving bars.
 * `filter` hides rows (a search box, say) without changing the queue or its indexes.
 */
function MusicPlaylist({
  className,
  filter,
  ...props
}: React.ComponentProps<"ol"> & { filter?: (track: Track, index: number) => boolean }) {
  const p = useMusicPlayer()
  return (
    <ol data-slot="music-playlist" aria-label="Playlist" className={cn("grid gap-1", className)} {...props}>
      {p.tracks.map((t, i) => {
        if (filter && !filter(t, i)) return null
        const current = i === p.index
        const len = current ? p.duration || t.duration || 0 : t.duration || 0
        return (
          <li key={t.id ?? t.src}>
            <button
              type="button"
              aria-current={current ? "true" : undefined}
              aria-label={`${current && p.playing ? "Pause" : "Play"} ${t.title} by ${t.artist}`}
              onClick={() => (current ? p.toggle() : p.play(i))}
              className={cn(
                "group/row flex w-full items-center gap-3 rounded-[14px] p-1.5 pr-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                current ? "bg-soft/60 dark:bg-soft/40" : "hover:bg-accent"
              )}
            >
              <span className="relative">
                <Cover track={t} className="size-11 rounded-[10px]" />
                <span
                  className={cn(
                    "absolute inset-0 grid place-items-center rounded-[10px] bg-black/45 text-white transition-opacity",
                    current ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
                  )}
                >
                  {current && p.playing ? (
                    <Equalizer playing />
                  ) : (
                    <PlayIcon className="size-4 translate-x-px fill-current" strokeWidth={1.5} />
                  )}
                </span>
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className={cn("truncate text-[14.5px] font-semibold", current && "text-soft-foreground dark:text-foreground")}>{t.title}</span>
                <span className="truncate text-[13px] text-muted-foreground">{t.artist}</span>
              </span>
              {len > 0 && <span className="text-[12.5px] tabular-nums text-muted-foreground">{formatTime(len)}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export { MusicPlayer, MusicPlayerProvider, MusicPlayerContext, MusicPlaylist, useMusicPlayer, formatTime }
export type { MusicPlayerState }
