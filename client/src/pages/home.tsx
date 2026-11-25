import { t, number } from "../i18n/i18n";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  ChartNoAxesCombined,
  Users,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { usePublicView, useData } from "../app/api";
import { previewMode } from "../app/preview";
import { Participate } from "../features/policy/campaign";
// HumanitarianCases ("The Americans and their families paying the price") is
// intentionally not rendered here; keep the component for future use.
import { PetitionContext } from "../features/policy/petition-context";
import type { PlaceCount } from "../../../shared/public-views";

const demands = [
  {
    icon: Eye,
    title: "Publish wait times by post and visa category.",
    text: "Publish monthly figures for each stage, including the time after an interview, with sample sizes and clear definitions so applicants can see where their case stands.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Explain the delays—and the plan to fix them.",
    text: "Identify the main causes of delays. For training, vetting changes or processing pauses, publish the scope, expected end date, recovery plan and progress against it.",
  },
  {
    icon: Users,
    title: "Report staffing gaps and fund a plan to close them.",
    text: "Report staffing needs and actual capacity at each post. Where staff, technology or funding fall short, give Congress a funded plan, deadlines and regular progress reports.",
  },
];
export function Home() {
  const { profiles, loading, me } = useData();
  const reach = usePublicView<{ places: PlaceCount[] }>("/stats/coverage");
  const places = previewMode
    ? profiles.map((p) => ({ ...p, count: 1 }))
    : (reach?.data?.places ?? []);
  const pending = previewMode ? loading : !reach?.data;
  const us = places.filter((p) => p.country === "United States");
  const nstates = new Set(us.map((p) => p.state)).size,
    ndistricts = new Set(us.map((p) => `${p.state}-${p.district}`)).size;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="petition-tag">
            {t("A petition to Congress and the Department of State")}
          </div>
          <h1>
            {t("Demand transparency.")}
            <br />
            {t("Bring families together.")}
          </h1>
          <p>
            {t(
              "We demand transparency and accountability for consular visa processing: published wait times, explanations for delays, and a funded plan to end the backlog.",
            )}
          </p>
          <p className="hero-citizen-ask">
            {t(
              "US citizens: sign to hold Congress accountable and ask your representatives to demand change.",
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
            <span>{t("Sign with your name. Your email stays private.")}</span>
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
            <div className="photo-copy">
              <div className="photo-caption">
                {t("Time together")} {t("shouldn’t be this hard.")}
              </div>
            </div>
          </div>
          <div className="circle-stamp">
            <Heart size={25} />
            <span>
              {t("LESS WAITING")} {t("MORE LIVING")}
            </span>
          </div>
          <Link className="photo-credit" to="/sources#photography">
            {t("Illustrative photography · Unsplash")}
          </Link>
          <div className="hero-orbit" aria-hidden="true" />
        </div>
      </section>
      <section className="impact-strip">
        <div className="impact-intro">
          {t(" Petition support")} {t("so far")}
        </div>
        <div>
          <strong>
            {pending
              ? "—"
              : number(places.reduce((sum, p) => sum + p.count, 0))}
          </strong>
          <span>{t("petition signatories")}</span>
        </div>
        <div>
          <strong>{pending ? "—" : number(nstates)}</strong>
          <span>{t("US states & territories")}</span>
        </div>
        <div>
          <strong>{pending ? "—" : number(ndistricts)}</strong>
          <span>{t("congressional districts")}</span>
        </div>
        <Link to="/coverage">
          {t("See our reach ")}
          <ArrowUpRight size={20} />
        </Link>
      </section>
      <div className="petition-motivation">
        <PetitionContext />
      </div>
      <div className="petition-demands-band">
        <section className="demands section" id="our-demands">
          <div className="section-heading">
            <h2>
              {t(
                "This petition demands Congress require the State Department to:",
              )}
            </h2>
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
      </div>
      <div className="petition-action-band">
        <Participate />
      </div>
      <section className="join-banner">
        <h2>{t("Put your name behind the demand.")}</h2>
        <p>
          {t(
            "Sign for transparent timelines, accountable decisions and families reunited.",
          )}
        </p>
        <Link className="button coral" to="/login?intent=sign">
          {t("Sign the petition ")}
          <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
