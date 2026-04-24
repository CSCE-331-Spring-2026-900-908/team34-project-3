import type { ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ManagerPaneHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
};

type ManagerScrollAreaProps = {
  children: ReactNode;
  className?: string;
};

type ManagerFilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function ManagerPaneHeader({ title, subtitle, action, className }: ManagerPaneHeaderProps) {
  return (
    <div className={cn("flex min-h-9 flex-wrap items-center justify-between gap-3", className)}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ManagerFilterBar({ children, className }: ManagerFilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {children}
    </div>
  );
}

export function ManagerScrollArea({ children, className }: ManagerScrollAreaProps) {
  return (
    <div className={cn("max-h-[600px] overflow-y-auto pr-1", className)}>
      {children}
    </div>
  );
}

export function ManagerSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;

  return (
    <select
      className={cn(
        "h-11 min-w-[11rem] rounded-2xl border border-border bg-white px-3 py-2 text-sm text-foreground",
        className
      )}
      {...rest}
    />
  );
}
