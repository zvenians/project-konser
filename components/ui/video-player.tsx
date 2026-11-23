import * as React from "react"
import { DropdownMenu as Menu } from "radix-ui"
import {
  CaptionsIcon,
  CheckIcon,
  GaugeIcon,
  LoaderCircleIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PictureInPicture2Icon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
  TriangleAlertIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"

/*
 * Video player: the native <video> element under Dens-UI controls.
 *
 * Keys (when the player has focus): Space or K play / pause, J and L skip 10s,
 * ← → skip 5s, ↑ ↓ volume, M mute, F fullscreen, C captions.
 *
 * Controls stay up while paused, while the pointer moves over the player and
 * while focus is inside it; otherwise they fade out after 2.5s of playback.
 * The speed menu renders inside the player so it still shows in fullscreen.
 */

export type VideoCaption = { src: string; srclang: string; label: string; default?: boolean }

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h ? String(m).padStart(2, "0") : String(m)
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`
}

function Control({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/85 outline-none transition-[background-color,color,transform] duration-150 hover:bg-white/15 hover:text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-white/80 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5",
        className
      )}
      {...props}
    />
  )
}

function VideoPlayer({
  src,
  poster,
  title,
  captions,
  aspect = "16 / 9",
  autoPlay,
  loop,
  muted: initialMuted = false,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  src: string
  poster?: string
  /** shown top-left with the controls, and used as the accessible name */
  title?: string
  /** WebVTT tracks; adds a captions toggle */
  captions?: VideoCaption[]
  /** CSS aspect-ratio of the frame */
  aspect?: string
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
}) {
  const root = React.useRef<HTMLDivElement>(null)
  const video = React.useRef<HTMLVideoElement>(null)
  const hideTimer = React.useRef<number>(0)
  const pointerType = React.useRef("mouse")

  const [playing, setPlaying] = React.useState(false)
  const [started, setStarted] = React.useState(false)
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [time, setTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [buffered, setBuffered] = React.useState(0)
  const [volume, setVolumeState] = React.useState(1)
  const [muted, setMuted] = React.useState(initialMuted)
  const [rate, setRate] = React.useState(1)
  const [ccOn, setCcOn] = React.useState(() => !!captions?.some((c) => c.default))
  const [fullscreen, setFullscreen] = React.useState(false)
  const [idle, setIdle] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [drag, setDrag] = React.useState<number | null>(null)
  const [flash, setFlash] = React.useState<{ key: number; label: string } | null>(null)
  const [pipSupported, setPipSupported] = React.useState(false)

  React.useEffect(() => {
    setPipSupported(typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled)
    const onFs = () => setFullscreen(document.fullscreenElement === root.current)
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  React.useEffect(() => {
    const el = video.current
    if (!el) return
    el.volume = volume
    el.muted = muted
  }, [volume, muted])

  React.useEffect(() => {
    const el = video.current
    if (el) el.playbackRate = rate
  }, [rate])

  React.useEffect(() => {
    const tracks = video.current?.textTracks
    if (!tracks) return
    for (let i = 0; i < tracks.length; i++) tracks[i].mode = ccOn && i === 0 ? "showing" : "hidden"
  }, [ccOn, captions])

  // smooth playhead
  React.useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (video.current) setTime(video.current.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const wake = React.useCallback(() => {
    setIdle(false)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setIdle(true), 2500)
  }, [])
  React.useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const showControls = !playing || !idle || menuOpen || drag != null

  // lift captions above the controls while they are up
  React.useEffect(() => {
    const t = video.current?.textTracks[0]
    if (!t?.cues) return
    for (let i = 0; i < t.cues.length; i++) {
      const cue = t.cues[i] as VTTCue
      cue.line = showControls && started ? -4 : "auto"
    }
  }, [showControls, started, ccOn])

  const toggle = () => {
    const el = video.current
    if (!el) return
    if (el.paused) void el.play().catch(() => setPlaying(false))
    else el.pause()
  }
  const seek = (s: number) => {
    const el = video.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(s, el.duration || s))
    setTime(el.currentTime)
  }
  const skip = (d: number) => {
    seek((video.current?.currentTime ?? 0) + d)
    setFlash({ key: Date.now(), label: `${d > 0 ? "+" : "−"}${Math.abs(d)}s` })
  }
  const setVolume = (v: number) => {
    setVolumeState(v)
    if (v > 0) setMuted(false)
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void root.current?.requestFullscreen?.()
  }
  const togglePip = async () => {
    const el = video.current
    if (!el) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await el.requestPictureInPicture()
    } catch {
      /* the browser refused; nothing to undo */
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("[role=slider],[role=menu],[role=menuitemradio]")) return
    const k = e.key.toLowerCase()
    if (k === " " || k === "k") {
      if (e.target instanceof HTMLButtonElement && k === " ") return
      toggle()
    } else if (k === "j") skip(-10)
    else if (k === "l") skip(10)
    else if (k === "arrowleft") skip(-5)
    else if (k === "arrowright") skip(5)
    else if (k === "arrowup") setVolume(Math.min(1, (muted ? 0 : volume) + 0.1))
    else if (k === "arrowdown") setVolume(Math.max(0, volume - 0.1))
    else if (k === "m") setMuted((m) => !m)
    else if (k === "f") toggleFullscreen()
    else if (k === "c" && captions?.length) setCcOn((c) => !c)
    else return
    e.preventDefault()
    wake()
  }

  const level = muted ? 0 : volume
  const VolumeGlyph = level === 0 ? VolumeXIcon : level < 0.5 ? Volume1Icon : Volume2Icon
  const shown = drag ?? time

  return (
    <div
      ref={root}
      data-slot="video-player"
      data-state={playing ? "playing" : "paused"}
      role="group"
      aria-label={title ? `Video: ${title}` : "Video player"}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={wake}
      onPointerLeave={() => playing && setIdle(true)}
      onFocus={wake}
      className={cn(
        "group/video relative isolate w-full overflow-hidden rounded-[22px] bg-[#0c0b0b] text-white shadow-raised outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        fullscreen && "rounded-none",
        !showControls && "cursor-none",
        className
      )}
      style={{ aspectRatio: fullscreen ? undefined : aspect, ...style }}
      {...props}
    >
      <video
        ref={video}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={initialMuted}
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full object-contain [&::cue]:bg-black/70 [&::cue]:text-[0.95em]"
        onPointerDown={(e) => (pointerType.current = e.pointerType)}
        onClick={() => {
          // on touch, the first tap brings the controls back instead of pausing
          if (pointerType.current === "touch" && playing && !showControls) return wake()
          toggle()
          wake()
        }}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setPlaying(true)
          setStarted(true)
          wake()
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onError={() => setError(true)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered
          if (b.length) setBuffered(b.end(b.length - 1))
        }}
        onEnded={() => setIdle(false)}
      >
        {captions?.map((c) => (
          <track key={c.src} kind="captions" src={c.src} srcLang={c.srclang} label={c.label} default={c.default} />
        ))}
      </video>

      {/* centre: big play before the first frame and while paused, spinner while buffering */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {error ? (
          <div role="alert" className="grid justify-items-center gap-2 px-6 text-center">
            <TriangleAlertIcon className="size-7 text-[#ffb14a]" strokeWidth={1.75} />
            <p className="text-[15px] font-semibold">This video could not be loaded</p>
            <p className="text-[13px] text-white/70">Check the file or your connection, then reload the page.</p>
          </div>
        ) : waiting && playing ? (
          <LoaderCircleIcon className="size-10 animate-spin text-white/90 motion-reduce:animate-none" strokeWidth={1.75} aria-label="Loading" />
        ) : (
          !playing && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Play"
              className="pointer-events-auto grid size-16 place-items-center rounded-full bg-white text-[#0c0b0b] shadow-[0_6px_24px_rgb(0_0_0/0.35)] outline-none transition-transform duration-200 ease-out-expo hover:scale-105 active:scale-95 focus-visible:ring-4 focus-visible:ring-white/50 sm:size-[72px]"
            >
              <PlayIcon className="size-7 translate-x-0.5 fill-current" strokeWidth={1.5} />
            </button>
          )
        )}
        {flash && (
          <span
            key={flash.key}
            aria-hidden
            onAnimationEnd={() => setFlash(null)}
            className="absolute rounded-full bg-black/55 px-3.5 py-1.5 text-[14px] font-semibold tabular-nums animate-[dens-fade-out_700ms_ease-in_forwards]"
          >
            {flash.label}
          </span>
        )}
      </div>

      {/* title */}
      {title && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-[linear-gradient(180deg,rgb(12_11_11/0.7),rgb(12_11_11/0))] px-5 pb-10 pt-4 transition-opacity duration-300",
            showControls || !started ? "opacity-100" : "opacity-0"
          )}
        >
          <p className="truncate text-[15px] font-semibold [text-shadow:0_1px_2px_rgb(0_0_0/0.4)]">{title}</p>
        </div>
      )}

      {/* controls */}
      <div
        data-slot="video-controls"
        className={cn(
          "absolute inset-x-0 bottom-0 grid gap-1 bg-[linear-gradient(180deg,rgb(12_11_11/0),rgb(12_11_11/0.78))] px-3 pb-2 pt-12 transition-[opacity,transform] duration-300 ease-out-expo sm:px-4 sm:pb-3",
          showControls && started ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
          "focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100"
        )}
      >
        <Slider
          size="sm"
          tone="white"
          min={0}
          max={duration || 1}
          step={0.1}
          disabled={!duration}
          value={[shown]}
          buffered={buffered}
          onValueChange={([v]) => setDrag(v)}
          onValueCommit={([v]) => {
            seek(v)
            setDrag(null)
          }}
          aria-label="Seek"
          aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
          className="px-1"
        />
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Control onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <PauseIcon className="fill-current" strokeWidth={1.5} /> : <PlayIcon className="translate-x-px fill-current" strokeWidth={1.5} />}
          </Control>
          <Control onClick={() => skip(-10)} aria-label="Back 10 seconds" className="max-[420px]:hidden">
            <RotateCcwIcon />
          </Control>
          <Control onClick={() => skip(10)} aria-label="Forward 10 seconds" className="max-[420px]:hidden">
            <RotateCwIcon />
          </Control>
          <div className="group/vol flex items-center">
            <Control onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>
              <VolumeGlyph />
            </Control>
            <div className="hidden w-0 overflow-hidden transition-[width] duration-200 ease-out-expo group-hover/vol:w-20 group-focus-within/vol:w-20 sm:block">
              <Slider
                size="sm"
                tone="white"
                min={0}
                max={1}
                step={0.05}
                value={[level]}
                onValueChange={([v]) => setVolume(v)}
                aria-label="Volume"
                aria-valuetext={`${Math.round(level * 100)}%`}
                className="w-[72px] pl-1.5"
              />
            </div>
          </div>
          <span className="ml-1.5 text-[12.5px] tabular-nums text-white/85 sm:text-[13px]">
            {formatTime(shown)}
            <span className="text-white/55"> / {formatTime(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {!!captions?.length && (
              <Control
                onClick={() => setCcOn((c) => !c)}
                aria-label="Captions"
                aria-pressed={ccOn}
                className={cn(
                  ccOn && "text-white after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-3.5 after:-translate-x-1/2 after:rounded-full after:bg-[#ffb14a]"
                )}
              >
                <CaptionsIcon />
              </Control>
            )}
            <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
              <Menu.Trigger asChild><Control aria-label={`Playback speed, ${rate}×`}>{rate === 1 ? <GaugeIcon /> : <span className="text-[12.5px] font-semibold tabular-nums">{rate}×</span>}</Control></Menu.Trigger>
              <Menu.Portal container={root.current}>
                <Menu.Content
                  side="top"
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[9rem] origin-(--radix-dropdown-menu-content-transform-origin) rounded-xl bg-[#1d2120] p-1 text-white shadow-raised ring-1 ring-white/10 data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
                >
                  <Menu.Label className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-white/60">Playback speed</Menu.Label>
                  <Menu.RadioGroup value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
                    {SPEEDS.map((s) => (
                      <Menu.RadioItem
                        key={s}
                        value={String(s)}
                        className="relative flex cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-3 text-sm tabular-nums outline-none focus:bg-white/10"
                      >
                        <Menu.ItemIndicator className="absolute left-2.5">
                          <CheckIcon className="size-4 text-[#ffb14a]" />
                        </Menu.ItemIndicator>
                        {s === 1 ? "Normal" : `${s}×`}
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
            {pipSupported && (
              <Control onClick={togglePip} aria-label="Picture in picture" className="max-sm:hidden">
                <PictureInPicture2Icon />
              </Control>
            )}
            <Control onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
              {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
            </Control>
          </div>
        </div>
      </div>
    </div>
  )
}

export { VideoPlayer }
