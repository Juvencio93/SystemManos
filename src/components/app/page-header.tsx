import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{title}</h1>
        {subtitle ? (
          <div className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {action ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div> : null}
    </div>
  );
}
