import type { Plot, Point } from '../../types/domain'
// Hệ tọa độ tương đối 1100 × 720, không chứa tọa độ GPS.
const vertices: readonly (readonly Point[])[] = [
  [
    [230, 140],
    [415, 120],
    [610, 100],
    [805, 80],
    [940, 235],
  ],
  [
    [175, 310],
    [380, 315],
    [590, 323],
    [795, 332],
    [980, 345],
  ],
  [
    [115, 477],
    [340, 490],
    [565, 509],
    [790, 530],
    [983, 550],
  ],
  [
    [92, 570],
    [303, 615],
    [545, 648],
    [790, 674],
    [985, 694],
  ],
]
export const geometryPlots: Omit<Plot, 'sensorIds'>[] = ['A', 'B', 'C'].flatMap((row, r) =>
  [0, 1, 2, 3].map((c) => {
    const top = vertices[r]!
    const bottom = vertices[r + 1]!
    const points: Point[] = [top[c]!, top[c + 1]!, bottom[c + 1]!, bottom[c]!]
    const center: Point = [
      points.reduce((sum, p) => sum + p[0], 0) / 4,
      points.reduce((sum, p) => sum + p[1], 0) / 4,
    ]
    return {
      id: `${row}-0${c + 1}`,
      name: `Luống ${row} · Ô ${c + 1}`,
      farmId: 'paw-demo',
      areaHa: Number((0.43 + (r * 4 + c) * 0.03).toFixed(2)),
      geometry: { type: 'polygon', points, label: center },
    }
  }),
)
