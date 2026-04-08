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
