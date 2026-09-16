import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Account } from "@/lib/api/types";

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email || "?";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserCard({ account }: { account: Account }) {
  const name = account.profile.full_name?.trim() || account.email || "Your account";

  return (
    <div className="flex items-start gap-3 rounded-xl bg-sidebar-accent/70 p-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary font-display text-xs font-bold text-sidebar-primary-foreground"
      >
        {initials(account.profile.full_name, account.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
        <p className="truncate text-xs text-sidebar-foreground/65">
          {account.business?.name ?? "No business yet"}
        </p>
        <Badge className="mt-1.5 border-transparent bg-sidebar-primary/20 text-[11px] font-semibold text-sidebar-primary hover:bg-sidebar-primary/20">
          {ROLE_LABELS[account.profile.role]}
        </Badge>
      </div>
    </div>
  );
}
