import type { ReactNode } from "react";

type ReportSummaryCellProps = {
  label: string;
  value: ReactNode;
};

type ReportSectionHeadingProps = {
  title: string;
  meta?: string;
};

export function ReportSummaryCell({ label, value }: ReportSummaryCellProps) {
  return (
    <div className="border-b border-border px-4 py-3 sm:border-b-0 sm:border-r last:border-r-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function ReportSectionHeading({ title, meta }: ReportSectionHeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground">{title}</h2>
      {meta ? <p className="text-xs text-stone-500">{meta}</p> : null}
    </div>
  );
}
