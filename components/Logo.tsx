export function LogoMark({ color = "var(--color-ink)" }: { color?: string }) {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="0" y="8" width="4" height="6" rx="2" fill={color} />
      <rect x="7" y="3" width="4" height="16" rx="2" fill={color} />
      <rect x="14" y="0" width="4" height="22" rx="2" fill={color} />
      <rect x="21" y="6" width="4" height="10" rx="2" fill={color} />
    </svg>
  );
}
