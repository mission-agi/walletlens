export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/30 py-16 animate-fade-in-up">
      <div className="text-muted-foreground/60">{icon}</div>
      <h3 className="mt-4 text-base font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-center text-[13px] text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
