export const MAIN_CONTENT_ID = "main-content";

type SkipLinkProps = {
  targetId?: string;
  label?: string;
};

export function SkipLink({
  targetId = MAIN_CONTENT_ID,
  label = "Skip to main content"
}: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      {label}
    </a>
  );
}

export function SectionSkipLink({ targetId, label }: { targetId: string; label: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="absolute left-0 top-0 z-10 -translate-y-full rounded-b-lg bg-foreground px-4 py-2 text-sm font-semibold text-[rgb(var(--background))] transition-transform focus:translate-y-0"
    >
      {label}
    </a>
  );
}
