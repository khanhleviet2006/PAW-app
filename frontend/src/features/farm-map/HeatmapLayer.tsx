import { useId, useMemo } from 'react'
import type { Plot, Threshold } from '../../types/domain'
import type { HeatPoint } from './heatmap'
import { contourPath, heatColor, interpolate } from './heatmap'
export function HeatmapLayer({
  plots,
  points,
  domain,
  opacity = 1,
}: {
  plots: Plot[]
  points: HeatPoint[]
  opacity?: number
  domain: Threshold
}) {
  const id = useId().replace(/:/g, '')
  const surface = useMemo(() => {
    if (points.length < 3) return undefined
    const cells = []
    for (let y = 48; y < 720; y += 20)
      for (let x = 72; x < 1032; x += 20) {
        const value = interpolate(points, x + 10, y + 10)!
        cells.push(
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={21}
            height={21}
            fill={heatColor(value, domain.min, domain.max)}
          />,
        )
      }
    const contours = Array.from({ length: 12 }, (_, i) =>
      contourPath(points, domain.min + ((domain.max - domain.min) * (i + 1)) / 13),
    )
    return { cells, contours }
  }, [points, domain])
  if (!surface) return null
  return (
    <g
      className="heatmap-surface"
      opacity={opacity}
      aria-hidden="true"
      pointerEvents="none"
      clipPath={`url(#heat-clip-${id})`}
    >
      <defs>
        <clipPath id={`heat-clip-${id}`}>
          {plots
            .filter((plot) => points.some((point) => point.plotId === plot.id))
            .map((plot) => (
              <polygon
                key={plot.id}
                data-plot-id={plot.id}
                points={plot.geometry.points.map((point) => point.join(',')).join(' ')}
              />
            ))}
        </clipPath>
        <filter id={`heat-smooth-${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <g filter={`url(#heat-smooth-${id})`}>{surface.cells}</g>
      <g fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1.1">
        {surface.contours.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </g>
  )
}
