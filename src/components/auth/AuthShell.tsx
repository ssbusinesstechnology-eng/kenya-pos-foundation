import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="brand-canvas flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandMark tone="dark" />
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            by S&amp;S Tech Solutions
          </p>
        </div>

        <div className="surface-panel px-6 py-7 sm:px-8">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
