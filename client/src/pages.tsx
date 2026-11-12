import { t, number } from "./i18n";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  ChartNoAxesCombined,
  Users,
  Heart,
  MoveUpRight,
  Plus,
  Search,
  ShieldCheck,
  Clock3,
  MapPin,
  Check,
} from "lucide-react";
import { useData } from "./api";
import { PageIntro, External, Modal, Timeline, Empty, date } from "./ui";
import { policies } from "../../shared/policies";
import type { PublicStory } from "../../shared/schema";
const demands = [
  {
    icon: Eye,
    title: "Publish the full wait.",
    text: "Publish complete, understandable visa processing times by consular post and visa category. Explain the delays, including the time after an interview.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Explain what’s causing delays.",
    text: "Give Congress and the public clear reporting on staffing, technology, and the effect of vetting policies. Set measurable goals and report progress.",
  },
  {
    icon: Users,
    title: "Staff the system properly.",
    text: "Build and fund a practical staffing and modernization plan so consular teams can move cases forward and families can plan their lives.",
  },
];
export function Home() {
  const { profiles, loading, me } = useData();
  const us = profiles.filter((p) => p.country === "United States");
  const nstates = new Set(us.map((p) => p.state)).size,
    ndistricts = new Set(us.map((p) => `${p.state}-${p.district}`)).size;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">{t(" VISA PROCESSING NEEDS TO CHANGE")}</div>
          <h1>
            {t("Visa delays")} {t("keep families")} {t("apart.")}
          </h1>
          <p>
            {t(
              "Families need to know where their visa cases stand. We’re asking Congress and the State Department for honest timelines, public accountability, and enough staff to process applications.",
            )}
          </p>
          <div className="hero-actions">
            <Link
              className="button coral"
              to={me.user ? "/account" : "/login?intent=sign"}
            >
              {t("Sign the petition ")}
              <ArrowUpRight size={18} />
            </Link>
            <a className="text-button" href="#our-demands">
              {t("What we’re asking for ")}
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="hero-footnote">
            <ShieldCheck size={16} />
            <span>
              {t(
                "Sign with your name or a nickname. Your email stays private.",
              )}
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="photo-arch">
            <img
              src="/hero-family.jpg"
              alt={t(
                "A family together outdoors, illustrating the everyday moments this campaign is about",
              )}
            />
            <div className="photo-shade" />
            <span className="image-label">
              <span />
              {t(" THE REASON THIS MATTERS")}
            </span>
            <div className="photo-caption">
              {t("Time together")} {t("shouldn’t be this hard.")}
            </div>
          </div>
          <div className="circle-stamp">
            <Heart size={25} />
            <span>
              {t("LESS WAITING")} {t("MORE LIVING")}
            </span>
          </div>
          <span className="photo-credit">
            {t("Illustrative photography · Unsplash")}
          </span>
          <div className="hero-orbit" aria-hidden="true" />
        </div>
      </section>
      <section className="impact-strip">
        <div className="impact-intro">
          {t(" Petition support")} {t("so far")}
        </div>
        <div>
          <strong>{loading ? "—" : number(profiles.length)}</strong>
          <span>{t("petition signatories")}</span>
        </div>
        <div>
          <strong>{loading ? "—" : nstates}</strong>
          <span>{t("US states & territories")}</span>
        </div>
        <div>
          <strong>{loading ? "—" : ndistricts}</strong>
          <span>{t("congressional districts")}</span>
        </div>
        <Link to="/coverage">
          {t("See our reach ")}
          <ArrowUpRight size={20} />
        </Link>
      </section>
      <section className="demands section" id="our-demands">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t("OUR PETITION")}</div>
            <h2>
              {t("Three things")} {t("we’re asking for.")}
            </h2>
          </div>
          <p>
            {t(
              "We call on Congress and the Department of State to make visa processing transparent, accountable, and adequately resourced.",
            )}
          </p>
        </div>
        <div className="demands-grid">
          {demands.map((d, i) => (
            <article key={d.title}>
              <div className="demand-icon">
                <d.icon size={24} />
                <span>0{i + 1}</span>
              </div>
              <h3>{t(d.title)}</h3>
              <p>{t(d.text)}</p>
            </article>
          ))}
        </div>
        <div className="petition-note">
          <span>
            {t("Our demands build on the")}{" "}
            <Link to="/policies/reducing-visa-delays-act">
              {t("Reducing Visa Delays Act, H.R. 10711")}
            </Link>
            {t(
              ", with additional community calls for measurable progress and humane communication.",
            )}
          </span>
          <Link className="text-button" to="/login?intent=sign">
            {t("I stand with this petition ")}
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="human-section">
        <div className="human-art" aria-hidden="true">
          <div className="art-sun" />
          <span className="art-word">
            {t("Still waiting")} {t("to come home.")}
          </span>
        </div>
        <div>
          <div className="eyebrow">{t("LIVING WITH THE DELAYS")}</div>
          <h2>
            {t("What the wait")} {t("has cost us.")}
          </h2>
          <p>
            {t(
              "Missed birthdays, extra flights, a second rent payment. Share what the process has been like for you and what you want officials to understand.",
            )}
          </p>
          <Link to="/stories" className="text-button">
            {t("Read the stories ")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="section action-preview">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t("LEGISLATION & LEGAL CASES")}</div>
            <h2>
              {t("What’s being done")} {t("about it.")}
            </h2>
          </div>
          <Link to="/policies" className="text-button">
            {t("Explore policy & action ")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="policy-grid">
          {policies.slice(0, 2).map((p) => (
            <Link key={p.id} to={`/policies/${p.id}`} className="policy-card">
              <div className="card-top">
                <span className="tag">{t(p.kind)}</span>
                <ArrowUpRight size={24} />
              </div>
              <div className="eyebrow">{t(p.eyebrow)}</div>
              <h3>{t(p.title)}</h3>
              <p>{t(p.summary)}</p>
              <div className="card-bottom">
                <span className="status-dot" />
                {t(p.status)}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="join-banner">
        <span className="eyebrow">{t("SIGN THE PETITION")}</span>
        <h2>{t("Help us ask for better.")}</h2>
        <p>{t("You don’t need to have a visa case to support this.")}</p>
        <Link className="button coral" to="/login?intent=sign">
          {t("Sign the petition ")}
          <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
export function Policies() {
  const [kind, setKind] = useState("All");
  const [theme, setTheme] = useState("All");
  const [q, setQ] = useState("");
  const items = policies.filter(
    (p) =>
      (kind === "All" || p.kind === kind) &&
      (theme === "All" || p.theme === theme) &&
      `${t(p.title)} ${t(p.summary)}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("POLICY & ACTION")}
        title={<>{t("Policy & legal cases")}</>}
        text={t(
          "Track legislation and lawsuits affecting visa processing. Read the background, check the sources, and find ways to get involved.",
        )}
      />
      <div className="toolbar">
        <div className="segmented">
          {["All", "Legislation", "Legal case"].map((x) => (
            <button
              key={x}
              className={kind === x ? "selected" : ""}
              onClick={() => setKind(x)}
            >
              {x === "All"
                ? t("All initiatives")
                : x === "Legal case"
                  ? t("Legal cases")
                  : t(x)}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label={t("Search initiatives")}
            placeholder={t("Search initiatives")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select
          aria-label={t("Filter by advocacy goal")}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="All">{t("All")}</option>
          <option value="Transparency">{t("Transparency")}</option>
          <option value="Accountability">{t("Accountability")}</option>
        </select>
      </div>
      <div className="policy-grid three">
        {items.map((p) => (
          <Link key={p.id} to={`/policies/${p.id}`} className="policy-card">
            <div className="card-top">
              <span className="tag">{t(p.kind)}</span>
              <ArrowUpRight />
            </div>
            <div className="eyebrow">{t(p.eyebrow)}</div>
            <h3>{t(p.title)}</h3>
            <p>{t(p.summary)}</p>
            <div className="card-bottom">
              <span className="status-dot" />
              {t(p.status)}
            </div>
            <small>
              {t("Reviewed ")}
              {date(p.updated)}
            </small>
          </Link>
        ))}
      </div>
      {!items.length && (
        <Empty title={t("No matching initiatives")}>
          {t("Try a different search or filter.")}
        </Empty>
      )}
      <p className="method-note">
        {t(
          "Updates are editorially reviewed snapshots, not a live court docket. Each initiative links to its sources and shows when it was reviewed. Litigation summaries are general information, not legal advice.",
        )}
      </p>
    </div>
  );
}
export function PolicyDetail() {
  const { id } = useParams();
  const p = policies.find((p) => p.id === id);
  if (!p)
    return (
      <div className="page-shell">
        <Empty title={t("Initiative not found")}>
          {t("Return to ")}
          <Link to="/policies">{t("policy & action")}</Link>.
        </Empty>
      </div>
    );
  return (
    <div className="page-shell">
      <Link className="back-link" to="/policies">
        {t("← All initiatives")}
      </Link>
      <PageIntro eyebrow={t(p.eyebrow)} title={t(p.title)} text={t(p.summary)}>
        <span className="tag">{t(p.status)}</span>
      </PageIntro>
      <div className="detail-grid">
        <article>
          <section>
            <h2>{t("Background")}</h2>
            <p className="large-copy">{t(p.background)}</p>
          </section>
          <section>
            <h2>{t("Goals")}</h2>
            <ul className="check-list">
              {p.goals.map((g) => (
                <li key={g}>
                  <Check size={18} />
                  {t(g)}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>{t("Timeline & updates")}</h2>
            <ol className="timeline">
              {p.timeline.map((entry, i) => (
                <li key={i}>
                  <time>{date(entry.date)}</time>
                  <div>
                    <strong>{t(entry.title)}</strong>
                    <p>{t(entry.text)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </article>
        <aside>
          <div className="side-card">
            <span className="eyebrow">{t("HOW TO HELP")}</span>
            <h3>{t("Get involved")}</h3>
            <p>{t(p.contribute)}</p>
            {p.contact && (
              <External href={p.contact.url}>{t(p.contact.label)}</External>
            )}
          </div>
          <div className="side-card light">
            <h3>{t("Sources")}</h3>
            {p.sources.map((s) => (
              <External key={s.url} href={s.url}>
                {t(s.label)}
              </External>
            ))}
            <small>
              {t("Reviewed ")}
              {date(p.updated)}
              {t(". Recheck sources before acting.")}
            </small>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function Stories() {
  const { stories } = useData();
  const [selected, setSelected] = useState<PublicStory | null>(null);
  const [q, setQ] = useState("");
  const items = stories.filter((s) =>
    `${s.title} ${s.country} ${s.impacts.join(" ")}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("OUR STORIES")}
        title={
          <>
            {t("Stories from")} {t("people waiting.")}
          </>
        }
        text={t(
          "What visa delays mean day to day, told by the people dealing with them.",
        )}
      >
        <Link className="button coral" to="/account#story">
          {t("Share your story ")}
          <Plus size={18} />
        </Link>
      </PageIntro>
      <div className="toolbar">
        <span>
          {stories.length === 1
            ? t("1 community story")
            : t("{count} community stories", { count: number(stories.length) })}
        </span>
        <label className="search">
          <Search size={16} />
          <input
            aria-label={t("Search stories")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search places, stories, or experiences")}
          />
        </label>
      </div>
      {items.length ? (
        <div className="story-grid">
          {items.map((s) => (
            <button
              key={s.id}
              className="story-card"
              onClick={() => setSelected(s)}
            >
              {s.photos[0] ? (
                <img
                  src={s.photos[0]}
                  alt={t("Photo shared by {name}", { name: s.name })}
                  loading="lazy"
                />
              ) : (
                <div className="story-art">
                  <Heart size={62} />
                </div>
              )}
              <div className="story-shade" />
              <div className="story-overlay">
                <span className="eyebrow">
                  {t(s.country)} · {s.name}
                </span>
                <h3>{s.title}</h3>
                <p>{s.summary}</p>
                <span className="read-story">
                  {t("Read their story ")}
                  <ArrowUpRight size={18} />
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="story-empty">
          <div className="story-placeholder one">
            <Heart size={60} />
            <span>{t("Living apart")}</span>
          </div>
          <div className="story-placeholder two">
            <Clock3 size={60} />
            <span>{t("Plans on hold")}</span>
          </div>
          <div className="story-invite">
            <span className="eyebrow">{t("COMMUNITY STORIES")}</span>
            <h2>
              {q ? t("No matching stories.") : t("No stories published yet.")}
            </h2>
            <p>
              {t(
                "You can add photos, describe what happened, and include your visa timeline. Nothing appears here until you choose to publish it.",
              )}
            </p>
            <Link className="text-button" to="/account#story">
              {t("Share your experience ")}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      )}
      <p className="method-note">
        {t(
          "Community stories and external sources remain in their original language.",
        )}{" "}
        {t(
          "Stories are self-reported and are not independently verified. Sharing here does not send your story to a lawyer, political group, or representative.",
        )}
      </p>
      {selected && (
        <Modal
          title={t("A COMMUNITY STORY")}
          wide
          onClose={() => setSelected(null)}
        >
          <div className="story-modal">
            {selected.photos.length > 0 && (
              <div className="story-photos">
                {selected.photos.map((p, i) => (
                  <img
                    key={i}
                    src={p}
                    alt={t("Photo {count} shared by {name}", {
                      count: i + 1,
                      name: selected.name,
                    })}
                  />
                ))}
              </div>
            )}
            <span className="eyebrow">
              {selected.name} · {t(selected.country)}
            </span>
            <h2>{selected.title}</h2>
            <p className="large-copy">{selected.summary}</p>
            <p className="preserve-lines">{selected.body}</p>
            <div className="tags">
              {selected.impacts.map((x) => (
                <span className="tag" key={x}>
                  {x}
                </span>
              ))}
            </div>
            {selected.support && (
              <>
                <h3>{t("The support they’re looking for")}</h3>
                <p className="preserve-lines">{selected.support}</p>
              </>
            )}
            {selected.timeline.length > 0 && (
              <>
                <h3>{t("Their timeline")}</h3>
                <Timeline events={selected.timeline} />
              </>
            )}
            <small>
              {t("Story last updated ")}
              {date(selected.updatedAt)}
            </small>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function DataUse() {
  return (
    <div className="page-shell narrow">
      <PageIntro
        eyebrow={t("DATA USE & PRIVACY")}
        title={
          <>
            {t("How we use")} {t("your data.")}
          </>
        }
        text={t(
          "Clear information about what you share, what is public, and how to take it back.",
        )}
      />
      <div className="privacy-summary">
        <ShieldCheck size={30} />
        <p>
          {t(
            "Your email is private. Your petition profile and visa timelines are public after you consent. Stories are public only when you choose to publish them.",
          )}
        </p>
      </div>
      <div className="prose">
        <h2>{t("What other people can see")}</h2>
        <p>
          {t(
            "Your chosen name or nickname, legal-status category, country, city, US state and congressional district, optional political affiliation, involvement in the visa process, signature date, and last-confirmed date are public. The applicant names or nicknames, countries, visa categories, posts, relationships, dates, and event notes you enter are also public. Do not include passport numbers, receipt numbers, addresses, birth dates, or documents.",
          )}
        </p>
        <p>
          {t(
            "You must have permission to publish information about another person. Use a nickname if identification would be uncomfortable or unsafe. You must be at least 18 to create an account.",
          )}
        </p>
        <h2>{t("What stays private")}</h2>
        <p>
          {t(
            "Your sign-in and reminder email addresses, sign-in tokens, session details, and reminder preferences stay private. They are used to operate your account and send optional reminders. We do not sell personal data or use advertising trackers.",
          )}
        </p>
        <h2>{t("Address lookup")}</h2>
        <p>
          {t(
            "When you use district lookup, your address is sent to the US Census Bureau’s geocoding service. Reunite Now does not save the search address or geocoding result. Only the state and congressional district you confirm are saved. Census may process the request under its own policies. You can select your district manually instead.",
          )}
        </p>
        <h2>{t("Statistics and interpretation")}</h2>
        <p>
          {t(
            "Statistics summarize voluntarily submitted cases. They are not a representative sample, official agency statistics, or a prediction. Each median shows its sample size. Missing dates are excluded from that metric. A future interview is not a completed interview. Administrative processing and policy-related refusals remain active unless a final decision or withdrawal is recorded. An approved or issued case is closed unless subsequently reopened.",
          )}
        </p>
        <h2>{t("Photos and stories")}</h2>
        <p>
          {t(
            "You control whether your story is published. Only upload photos you have permission to share, including permission from identifiable people. The photo uploader resizes images and re-encodes them to remove embedded metadata. You can unpublish or delete your story from your account.",
          )}
        </p>
        <h2>{t("Monthly reminders")}</h2>
        <p>
          {t(
            "Reminders are optional. For active cases not confirmed in at least 30 days, we send at most one reminder per calendar month to each selected address. Your sign-in email receives reminders, and you can add up to 5 other addresses you own or have permission to notify. Each recipient gets a separate email without applicant details or other recipients’ addresses. Add a dated milestone or confirm no change in your account; reminders never update timelines automatically. Edit recipients or turn reminders off in Account.",
          )}
        </p>
        <h2>{t("Export, correct, or delete")}</h2>
        <p>
          {t(
            "Visit your account to edit your profile, download your data, remove a visa case, unpublish your story, or permanently delete your account. Deletion removes your account, signature, case timelines, story photos, sessions, and reminder records from the live database. Aggregate statistics then recalculate without your records.",
          )}
        </p>
        <p>
          {t(
            "Encrypted Azure database backups expire under the configured retention period of 7 days. Deleted data is not used from backups; any recovery must reapply deletions before reopening the site. Copies independently saved by other visitors, search engines, or external services cannot be recalled. Email delivery providers may retain operational delivery records under their own policies.",
          )}
        </p>
        <h2>{t("Services that process data")}</h2>
        <p>
          {t(
            "Microsoft Azure hosts the application, database, and scheduled work. Azure Communication Services handles email when enabled. Google handles Google sign-in if you choose it. Census handles optional address lookup. Public policy links and contact links take you to external organizations. We do not automatically share submissions with those organizations.",
          )}
        </p>
        <h2>{t("Agreement version")}</h2>
        <p>
          {t(
            "November 11, 2026. The version accepted with your signature is recorded. This is an independent advocacy project, not a law firm or government service.",
          )}
        </p>
        <Link className="button" to="/account">
          {t("Manage my data ")}
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </div>
  );
}
export function About() {
  return (
    <div className="page-shell narrow">
      <PageIntro
        eyebrow={t("ABOUT REUNITE NOW")}
        title={<>{t("About Reunite Now")}</>}
        text={t(
          "A project advocating for transparency, accountability, and adequate resources in US visa processing.",
        )}
      />
      <div className="about-statement">
        <Heart size={36} />
        <h2>
          {t("The process takes too long.")} {t("Getting answers shouldn’t.")}
        </h2>
      </div>
      <div className="prose">
        <h2>{t("Why we’re here")}</h2>
        <p>
          {t(
            "When a visa process stretches on without clear information, people put their lives on hold. Families plan around unknowns. The costs are emotional, practical, and financial. Reunite Now exists to make those experiences visible and advocate for a system that communicates clearly and has the resources to do its job.",
          )}
        </p>
        <h2>{t("What we do")}</h2>
        <p>
          {t(
            "We collect petition signatures with geographic context, track legislation and litigation with source links, make room for personal stories, and summarize voluntarily submitted visa timelines. These tools help people see a shared problem and ask for concrete improvements.",
          )}
        </p>
        <h2>{t("Who can take part")}</h2>
        <p>
          {t(
            "You do not have to be a US citizen or personally involved in a visa case to support this petition. Political affiliation is optional. The project does not endorse candidates, provide legal representation, or promise an outcome for any case.",
          )}
        </p>
        <h2>{t("Project maintainer")}</h2>
        <p>
          {t(
            "The project is maintained by Ethan Rimes. Policy summaries link to their sources so you can read the underlying documents and check for updates.",
          )}
        </p>
        <External href="https://github.com/ethanrimes">
          {t("Ethan Rimes on GitHub")}
        </External>
        <h2>{t("Where signatures go")}</h2>
        <p>
          {t(
            "Signatures demonstrate public support and geographic reach on this website. They are not automatically filed with Congress, a court, or the State Department. Any future petition delivery will be described publicly before it happens.",
          )}
        </p>
      </div>
    </div>
  );
}
