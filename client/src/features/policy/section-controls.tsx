import { useRef } from "react";
import { ArrowDown, ChevronUp } from "lucide-react";

type Props = {
  canCollapse: boolean;
  onCollapse: () => void;
  noun: string;
  contentId: string;
  moreLabel?: string;
  onMore: () => void;
};

export function SectionControls({
  canCollapse,
  onCollapse,
  noun,
  contentId,
  moreLabel,
  onMore,
}: Props) {
  const moreButton = useRef<HTMLButtonElement>(null);
  return (
    <div className="petition-controls">
      {moreLabel && (
        <button
          ref={moreButton}
          type="button"
          className="policy-more"
          onClick={onMore}
          aria-controls={contentId}
        >
          <ArrowDown aria-hidden="true" />
          {moreLabel}
        </button>
      )}
      {canCollapse && (
        <button
          type="button"
          className="policy-more"
          aria-controls={contentId}
          onClick={() => {
            onCollapse();
            requestAnimationFrame(() => moreButton.current?.focus());
          }}
        >
          <ChevronUp aria-hidden="true" />
          {"Collapse " + noun}
        </button>
      )}
    </div>
  );
}
