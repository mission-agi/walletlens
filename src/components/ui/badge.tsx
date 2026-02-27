export function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide"
      style={{
        backgroundColor: color ? `${color}18` : undefined,
        color: color || undefined,
      }}
    >
      {children}
    </span>
  );
}
