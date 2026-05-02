// Pixel-art heart rendered as SVG rects on a 7×6 grid

const GRID: number[][] = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

interface Props {
  size?:      number;
  color:      string;
  emptyColor: string;
  filled:     boolean;
  style?:     React.CSSProperties;
}

export default function PixelHeart({ size = 14, color, emptyColor, filled, style }: Props) {
  const px = size / 7; // each pixel cell width
  const py = size / 6; // each pixel cell height

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 7 6`}
      style={{ imageRendering: 'pixelated', flexShrink: 0, ...style }}
    >
      {GRID.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x} y={y}
              width={1} height={1}
              fill={filled ? color : emptyColor}
            />
          ) : null
        )
      )}
    </svg>
  );
}
