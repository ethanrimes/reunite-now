import { useState } from "react";
import { Plus } from "lucide-react";
import { SectionControls } from "./section-controls";

import copy from "./humanitarian-cases.en.json";

const { heading, cases } = copy;
const rowSize = 3;

export function HumanitarianCases() {
  const [visible, setVisible] = useState(rowSize);
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
          <details
            key={item.name}
            className="humanitarian-card"
            name="humanitarian-case"
          >
            <summary id={"humanitarian-case-" + index}>
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
            </summary>
            <div className="humanitarian-detail">
              <p>{item.detail}</p>
              <a href={item.source.href}>{item.source.label}</a>
            </div>
          </details>
        ))}
      </div>
      <SectionControls
        canCollapse={visible > rowSize}
        onCollapse={() => setVisible(rowSize)}
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
