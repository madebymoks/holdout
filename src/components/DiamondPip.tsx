interface Props {
  filled:      boolean;
  size?:       number;
  color?:      string;
  emptyColor?: string;
  style?:      React.CSSProperties;
}

// Small rotated-square "life pip" used across the redesigned menu/HUD screens.
export default function DiamondPip({ filled, size = 10, color = '#f4813f', emptyColor = 'rgba(244,129,63,0.25)', style }: Props) {
  return (
    <div
      style={{
        width:        size,
        height:       size,
        transform:    'rotate(45deg)',
        background:   filled ? color : 'transparent',
        border:       `1.5px solid ${filled ? color : emptyColor}`,
        boxSizing:    'border-box',
        flexShrink:   0,
        ...style,
      }}
    />
  );
}
