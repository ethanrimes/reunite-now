import { Link } from "react-router-dom";
import { t } from "./i18n";
import { date, External } from "./ui";
import {
  legislation,
  legislativeTopics,
  topicForBill,
  billLabel,
  memberVote,
} from "../../shared/legislation";
export function LegislativeScope() {
  return (
    <details className="research-scope">
      <summary>{t("What is included in this review?")}</summary>
      <p>
        {t(
          "Reviewed November 12, 2026: 22 bills across 17 initiatives, covering consular capacity, wait-time transparency, family reunification, visa-number backlogs, restrictions, and fees. Current proposals are shown alongside selected predecessors from the 116th–118th Congresses.",
        )}
      </p>
      <p>
        {t(
          "Six passage or concurrence roll calls are included. This is a sourced, curated record, not every immigration bill, amendment, procedural vote, or member statement. Sponsorship is separate from voting; a missing vote is not opposition.",
        )}
      </p>
      <p>
        {t(
          "Official bill names and congressional action text are shown in their original English. Summaries and interface labels follow your selected language.",
        )}
      </p>
    </details>
  );
}
export function BillRecord({ topicId }: { topicId: string }) {
  const topic = legislativeTopics.find((x) => x.id === topicId);
  if (!topic) return null;
  return (
    <section className="bill-record">
      <h2>{t("Official legislative record")}</h2>
      {topic.bills.map((id) => {
        const b = legislation.bills.find((x) => x.id === id)!;
        const votes = legislation.votes.filter((v) => v.bill === id);
        return (
          <article key={id}>
            <h3>
              {billLabel(b)} · {b.congress}
            </h3>
            <p lang="en">{b.latest.text}</p>
            <small>{date(b.latest.date)}</small>
            <div>
              {votes.map((v) => (
                <p key={v.source}>
                  <External href={v.url}>
                    {t(v.chamber)} · {date(v.date)} · {t("Roll call")} {v.roll}
                  </External>
                  <span lang="en">
                    {v.question} — {v.result}
                  </span>
                </p>
              ))}
            </div>
            {!votes.length && (
              <p className="small-copy">
                {t("No recorded floor vote in this reviewed bill record.")}
              </p>
            )}
            <External href={`${b.url}/all-actions`}>
              {t("All official actions & votes")}
            </External>
            <External href={`${b.url}/cosponsors`}>
              {t("Sponsors & cosponsors")}
            </External>
          </article>
        );
      })}
      {topic.omnibus && (
        <p className="method-note">
          {t(
            "These votes cover the whole legislative package. They do not establish a member’s position on the visa provision alone.",
          )}
        </p>
      )}
      {topicId === "fairness-high-skilled" && (
        <p className="method-note">
          {t(
            "The Senate’s December 2, 2020 voice vote on amended H.R. 1044 has no individual roll-call positions. S. 386 is a separate bill; do not attribute that voice vote to it.",
          )}
        </p>
      )}
    </section>
  );
}
export function MemberVotes({ memberId }: { memberId: string }) {
  return (
    <div className="member-votes">
      <h4>{t("Relevant voting history")}</h4>
      <p className="small-copy">
        {t(
          "Votes are matched by congressional member ID, including service in a previous chamber. “Not listed” means the member has no entry in that roll call; it is not a vote against the bill.",
        )}
      </p>
      <div className="vote-list">
        {[...legislation.votes]
          .sort(
            (a, b) =>
              Number(!!memberVote(b, memberId)) -
                Number(!!memberVote(a, memberId)) ||
              b.date.localeCompare(a.date),
          )
          .map((v) => {
            const b = legislation.bills.find((b) => b.id === v.bill)!;
            const topic = topicForBill(b.id)!;
            const vote = memberVote(v, memberId);
            return (
              <div className="vote-row" key={v.source}>
                <div>
                  <Link to={`/policies/${topic.id}`}>
                    {billLabel(b)} · {b.congress}
                  </Link>
                  <small>
                    {t(v.chamber)} · {date(v.date)} · {t("Roll call")} {v.roll}
                  </small>
                  <span lang="en">{v.question}</span>
                  {topic.omnibus && (
                    <small>{t("Vote on the whole package")}</small>
                  )}
                </div>
                <div>
                  <strong
                    className={`vote-result ${vote === "Yea" || vote === "Aye" ? "yea" : vote === "Nay" || vote === "No" ? "nay" : ""}`}
                  >
                    {t(vote || "Not listed")}
                  </strong>
                  <External href={v.url}>{t("Verify vote")}</External>
                </div>
              </div>
            );
          })}
      </div>
      <details>
        <summary>{t("Sponsorship and bills without recorded votes")}</summary>
        <p className="small-copy">
          {t(
            "Sponsorship is a legislative action, not a vote. Absence from the sponsor list does not establish a member’s position.",
          )}
        </p>
        {legislation.bills.map((b) => (
          <div className="sponsorship-row" key={b.id}>
            <Link to={`/policies/${topicForBill(b.id)!.id}`}>
              {billLabel(b)} · {b.congress}
            </Link>
            <span>
              {t(
                b.sponsors.includes(memberId)
                  ? "Sponsor"
                  : b.cosponsors.includes(memberId)
                    ? "Cosponsor"
                    : "Not a listed sponsor",
              )}
            </span>
            <small>
              {t(
                legislation.votes.some((v) => v.bill === b.id)
                  ? "Roll call above"
                  : "No individual roll call in this review",
              )}
            </small>
          </div>
        ))}
      </details>
      <small>
        {t("Reviewed ")}
        {date(legislation.reviewed)}
      </small>
    </div>
  );
}
