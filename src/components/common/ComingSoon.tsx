import { Clock } from "lucide-react";
import { PageHeader } from "./StateViews";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="surface-panel flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent/20">
          <Clock className="size-5 text-accent-foreground" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">Coming in a later phase</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {title} arrives in {phase}. Your business, roles and permissions are already set
          up, so nothing here will need re-doing.
        </p>
      </div>
    </div>
  );
}
