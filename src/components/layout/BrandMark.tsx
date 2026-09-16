export function BrandMark({ tone = "light" }: { tone?: "light" | "dark" }) {
  const text = tone === "light" ? "text-sidebar-foreground" : "text-foreground";
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-lg bg-accent font-display text-sm font-bold text-accent-foreground"
      >
        S&S
      </span>
      <span className={`font-display text-base font-semibold tracking-tight ${text}`}>
        S&amp;S POS
      </span>
    </div>
  );
}
