import { useEffect, useMemo, useRef, useState } from 'react'
import { interpolatePose, resolvePoses } from '../lib/poses'
import type { InterpolatedPose, Pose, Scene } from '../lib/poses'

const SCENE_PROPS: Record<Scene, { ground: boolean; wall: boolean; pullBar: boolean; lowBar: boolean; dipBars: boolean; rings: boolean; bench: boolean; box: boolean; chair: boolean; pole: boolean }> = {
  floor: { ground: true, wall: false, pullBar: false, lowBar: false, dipBars: false, rings: false, bench: false, box: false, chair: false, pole: false },
  wall: { ground: true, wall: true, pullBar: false, lowBar: false, dipBars: false, rings: false, bench: false, box: false, chair: false, pole: false },
  'pull-bar': { ground: true, wall: false, pullBar: true, lowBar: false, dipBars: false, rings: false, bench: false, box: false, chair: false, pole: false },
  'wall-pull-bar': { ground: true, wall: true, pullBar: true, lowBar: false, dipBars: false, rings: false, bench: false, box: false, chair: false, pole: false },
  'low-bar': { ground: true, wall: false, pullBar: false, lowBar: true, dipBars: false, rings: false, bench: false, box: false, chair: false, pole: false },
  'dip-bars': { ground: true, wall: false, pullBar: false, lowBar: false, dipBars: true, rings: false, bench: false, box: false, chair: false, pole: false },
  rings: { ground: true, wall: false, pullBar: false, lowBar: false, dipBars: false, rings: true, bench: false, box: false, chair: false, pole: false },
  bench: { ground: true, wall: false, pullBar: false, lowBar: false, dipBars: false, rings: false, bench: true, box: false, chair: false, pole: false },
  box: { ground: true, wall: false, pullBar: false, lowBar: false, dipBars: false, rings: false, bench: false, box: true, chair: false, pole: false },
  chair: { ground: true, wall: false, pullBar: false, lowBar: false, dipBars: false, rings: false, bench: false, box: false, chair: true, pole: false },
  pole: { ground: true, wall: false, pullBar: false, lowBar: false, dipBars: false, rings: false, bench: false, box: false, chair: false, pole: true },
}

const PROPS = '#4b5768'
const BONE = '#7dd3fc'
const SECONDARY = 'rgb(125 211 252 / 0.32)'

function limb(x1: number, y1: number, x2: number, y2: number, strokeWidth: number, colour: string) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={colour}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  )
}

function SceneProps({ scene }: { scene: Scene }) {
  const props = SCENE_PROPS[scene]
  return (
    <g aria-hidden="true">
      {props.ground && <line x1="8" y1="172" x2="192" y2="172" stroke={PROPS} strokeWidth="2" strokeLinecap="round" opacity="0.55" />}
      {props.wall && (
        <g>
          <line x1="16" y1="14" x2="16" y2="172" stroke={PROPS} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          <line x1="10" y1="14" x2="10" y2="172" stroke={PROPS} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
        </g>
      )}
      {props.pullBar && (
        <g>
          <line x1="30" y1="26" x2="170" y2="26" stroke={PROPS} strokeWidth="3.5" strokeLinecap="round" />
          <line x1="30" y1="20" x2="170" y2="20" stroke={PROPS} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </g>
      )}
      {props.lowBar && (
        <g>
          <line x1="96" y1="136" x2="186" y2="136" stroke={PROPS} strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="143" x2="190" y2="143" stroke={PROPS} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </g>
      )}
      {props.dipBars && (
        <g>
          <line x1="40" y1="90" x2="40" y2="172" stroke={PROPS} strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          <line x1="40" y1="98" x2="116" y2="98" stroke={PROPS} strokeWidth="4" strokeLinecap="round" />
          <line x1="116" y1="98" x2="116" y2="172" stroke={PROPS} strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          <line x1="40" y1="91" x2="116" y2="91" stroke={PROPS} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
        </g>
      )}
      {props.rings && (
        <g>
          <line x1="30" y1="14" x2="56" y2="40" stroke={PROPS} strokeWidth="1.5" opacity="0.6" />
          <line x1="170" y1="14" x2="144" y2="40" stroke={PROPS} strokeWidth="1.5" opacity="0.6" />
          <circle cx="56" cy="44" r="4.5" fill="none" stroke={PROPS} strokeWidth="3" />
          <circle cx="144" cy="44" r="4.5" fill="none" stroke={PROPS} strokeWidth="3" />
        </g>
      )}
      {props.bench && (
        <g>
          <rect x="34" y="118" width="106" height="9" rx="3" fill={PROPS} opacity="0.75" />
          <rect x="40" y="127" width="7" height="45" rx="2" fill={PROPS} opacity="0.4" />
          <rect x="128" y="127" width="7" height="45" rx="2" fill={PROPS} opacity="0.4" />
        </g>
      )}
      {props.box && (
        <g>
          <rect x="128" y="110" width="52" height="62" rx="4" fill={PROPS} opacity="0.55" />
          <line x1="128" y1="110" x2="180" y2="110" stroke={PROPS} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {props.chair && (
        <g>
          <rect x="24" y="100" width="44" height="7" rx="3" fill={PROPS} opacity="0.75" />
          <rect x="26" y="107" width="6" height="65" rx="2" fill={PROPS} opacity="0.4" />
          <rect x="60" y="107" width="6" height="65" rx="2" fill={PROPS} opacity="0.4" />
        </g>
      )}
      {props.pole && (
        <line x1="30" y1="26" x2="30" y2="172" stroke={PROPS} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      )}
    </g>
  )
}

function Figure({ pose }: { pose: InterpolatedPose }) {
  const { head, neck, hip, elbow, hand, knee, foot, arm2, leg2 } = pose
  return (
    <g>
      {arm2 && (
        <g>
          {limb(neck[0], neck[1], arm2.elbow[0], arm2.elbow[1], 5, SECONDARY)}
          {limb(arm2.elbow[0], arm2.elbow[1], arm2.hand[0], arm2.hand[1], 4.5, SECONDARY)}
          <circle cx={arm2.hand[0]} cy={arm2.hand[1]} r="3.4" fill={SECONDARY} />
        </g>
      )}
      {leg2 && (
        <g>
          {limb(hip[0], hip[1], leg2.knee[0], leg2.knee[1], 6.5, SECONDARY)}
          {limb(leg2.knee[0], leg2.knee[1], leg2.foot[0], leg2.foot[1], 5.5, SECONDARY)}
          <circle cx={leg2.foot[0]} cy={leg2.foot[1]} r="3.4" fill={SECONDARY} />
        </g>
      )}

      {/* Legs and torso sit behind the arms for a cleaner read. */}
      {limb(hip[0], hip[1], knee[0], knee[1], 7.5, BONE)}
      {limb(knee[0], knee[1], foot[0], foot[1], 6, BONE)}
      <circle cx={foot[0]} cy={foot[1]} r="3.8" fill={BONE} />

      {limb(neck[0], neck[1], hip[0], hip[1], 10, BONE)}

      {limb(neck[0], neck[1], elbow[0], elbow[1], 5.5, BONE)}
      {limb(elbow[0], elbow[1], hand[0], hand[1], 5, BONE)}
      <circle cx={hand[0]} cy={hand[1]} r="3.8" fill={BONE} />

      <circle cx={head[0]} cy={head[1]} r="11" fill="none" stroke={BONE} strokeWidth="4.5" />
    </g>
  )
}

export interface ExerciseAnimationProps {
  /** Pose keys from the exercise record. */
  poses?: string[]
  /** Milliseconds per pose transition. */
  duration?: number
  className?: string
  autoPlay?: boolean
  label?: string
  /**
   * Playback controlled by the parent. When supplied, this component renders
   * no pause button of its own — the caller owns the control, which keeps the
   * markup free of a button nested inside another button.
   */
  playing?: boolean
}

const FIRST_FRAME = 0
const HOLD_SHARE = 0.28

export function ExerciseAnimation({
  poses,
  duration = 1100,
  className,
  autoPlay = true,
  label,
  playing: playingProp,
}: ExerciseAnimationProps) {
  const frames = useMemo(() => resolvePoses(poses), [poses])
  const [playingLocal, setPlayingLocal] = useState(autoPlay)
  const controlled = playingProp !== undefined
  const playing = controlled ? playingProp : playingLocal
  const setPlaying = controlled ? () => {} : setPlayingLocal
  const [frame, setFrame] = useState(FIRST_FRAME)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const single = frames.length <= 1

  useEffect(() => {
    if (!playing || single) return

    function tick(now: number) {
      if (startRef.current == null) startRef.current = now
      const elapsed = now - startRef.current
      const cycle = duration * Math.max(1, frames.length - 1)
      // Ping-pong: forward, hold, back to the start, so the loop is seamless.
      const position = (elapsed / cycle) % 2
      const forward = position <= 1
      const value = forward ? position : 2 - position
      setFrame(Math.min(1, HOLD_SHARE + value * (1 - HOLD_SHARE * 2)))
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      startRef.current = null
    }
  }, [playing, single, duration, frames.length])

  const scene: Scene = frames[0]?.scene ?? 'floor'
  const from: Pose = frames[0] ?? frames[0]
  const to: Pose = frames[Math.min(frames.length - 1, Math.max(1, Math.round(frame * (frames.length - 1))))] ?? from
  const blended = frames.length ? interpolatePose(from, to, frames.length === 1 ? 0 : frame) : null

  return (
    <figure className={className}>
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        role="img"
        aria-label={label ?? 'Illustration of the movement'}
      >
        <SceneProps scene={scene} />
        {blended && <Figure pose={blended} />}
      </svg>
      {frames.length > 1 && !controlled && (
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? `Pause the ${label ?? 'movement'} animation` : `Play the ${label ?? 'movement'} animation`}
          className="absolute right-1 bottom-1 min-h-11 rounded-full border border-ink-600/80 bg-ink-900/80 px-3.5 py-2 text-[11px] font-medium text-mist-300 backdrop-blur transition hover:border-brand-400/60 hover:text-brand-300"
        >
          {playing ? '❚❚ Pause' : '▶ Animate'}
        </button>
      )}
    </figure>
  )
}
