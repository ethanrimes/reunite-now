import { type CSSProperties, useState } from "react";
import { Plus } from "lucide-react";
import { SectionControls } from "./section-controls";

import copy from "./humanitarian-cases.en.json";

const { heading, cases } = copy;
const rowSize = 3;

export function HumanitarianCases() {
  const [visible, setVisible] = useState(rowSize);
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <section
      className="section humanitarian-cases"
      lang="en"
      dir="ltr"
      id="humanitarian-cases"
      aria-labelledby="humanitarian-title"
    >
      <h2 id="humanitarian-title">{heading}</h2>
      <div id="humanitarian-list" className="humanitarian-grid">
        {cases.slice(0, visible).map((item, index) => (
          <div
            key={item.name}
            className="humanitarian-entry"
            style={{
              "--desktop-row": 2 * Math.floor(index / rowSize) + 1,
              "--desktop-column": (index % rowSize) + 1,
              "--mobile-row": 2 * index + 1,
            } as CSSProperties}
          >
            <button
              type="button"
              className="humanitarian-card"
              id={"humanitarian-case-" + index}
              aria-expanded={expanded === index}
              aria-controls={"humanitarian-detail-" + index}
              onClick={() => setExpanded(expanded === index ? null : index)}
            >
              <span className="humanitarian-name">
                {item.name}
                {item.note && (
                  <>
                    {" "}
                    <em>{item.note}</em>
                  </>
                )}
              </span>
              <strong>{item.title}</strong>
              <Plus aria-hidden="true" />
            </button>
            <div
              className="humanitarian-detail"
              id={"humanitarian-detail-" + index}
              role="region"
              aria-labelledby={"humanitarian-case-" + index}
              hidden={expanded !== index}
            >
              <p>{item.detail}</p>
              <a href={item.source.href}>{item.source.label}</a>
            </div>
          </div>
        ))}
      </div>
      <SectionControls
        canCollapse={visible > rowSize}
        onCollapse={() => {
          setVisible(rowSize);
          setExpanded(null);
        }}
        noun="cases"
        contentId="humanitarian-list"
        moreLabel={visible < cases.length ? "Show more cases" : undefined}
        onMore={() => {
          setVisible(visible + rowSize);
          requestAnimationFrame(() =>
            document.getElementById("humanitarian-case-" + visible)?.focus(),
          );
        }}
      />
    </section>
  );
}
