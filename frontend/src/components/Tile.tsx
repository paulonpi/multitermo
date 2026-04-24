import type { TileStatus } from '../types'

interface TileProps {
  letter?: string
  state: TileStatus
  size?: 'normal' | 'small'
  animateFlip?: boolean
  flipDelay?: number
  isCursor?: boolean
}

const STATE_CLASS: Record<TileStatus, string> = {
  empty:   '',
  input:   'tile-input',
  correct: 'tile-right',
  present: 'tile-place',
  absent:  'tile-wrong',
}

export function Tile({ letter = '', state, size = 'normal', animateFlip, flipDelay = 0, isCursor }: TileProps) {
  const cls = [
    'tile',
    size === 'normal' ? 'tile-normal' : 'tile-small',
    STATE_CLASS[state],
    isCursor ? 'tile-cursor' : '',
  ].filter(Boolean).join(' ')

  const style: React.CSSProperties = {}
  if (animateFlip && flipDelay > 0) style.animationDelay = `${flipDelay}ms`

  return (
    <div className={cls} style={style}>
      {letter}
    </div>
  )
}
