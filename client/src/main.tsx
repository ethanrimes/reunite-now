import { t } from "./i18n";
import { LanguageSelector, useLanguage } from "./language";
import React, { useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import { ArrowUpRight, MoveUpRight } from "lucide-react";
import { DataProvider, useData } from "./api";
import { Home, Policies, PolicyDetail, Stories, DataUse, About } from "./pages";
const Coverage = lazy(() =>
  import("./maps").then((m) => ({ default: m.Coverage })),
);
const VisaData = lazy(() =>
  import("./maps").then((m) => ({ default: m.VisaData })),
);
const Account = lazy(() =>
  import("./account").then((m) => ({ default: m.Account })),
);
const Login = lazy(() =>
  import("./account").then((m) => ({ default: m.Login })),
);
const Verify = lazy(() =>
  import("./account").then((m) => ({ default: m.Verify })),
);
import { BrandMark } from "./brand";
import { Sources } from "./sources";
import { previewMode } from "./preview";
import "./styles.css";
import "./campaign.css";
import "./refinements.css";
function PreviewGate() {
  return (
    <div className="page-shell preview-gate">
      <h1>{t("You’re exploring sample data.")}</h1>
      <p>
        {t(
          "To sign the petition or share your own timeline and story, continue to the live site.",
        )}
      </p>
      <a className="button" href="/login?intent=sign">
        {t("Continue to the live site")}
      </a>
    </div>
  );
}
function App() {
  useLanguage();
  const location = useLocation();
  const { me, error, config } = useData();
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!location.hash) return;
    const reveal = () => {
      const target = document.getElementById(
        decodeURIComponent(location.hash.slice(1)),
      );
      if (target) {
        target.scrollIntoView({ block: "start" });
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(reveal);
    observer.observe(document.getElementById("main")!, {
      childList: true,
      subtree: true,
    });
    reveal();
    return () => observer.disconnect();
  }, [location.pathname, location.hash]);
  return (
    <>
      <a className="skip-link" href="#main">
        {t("Skip to content")}
      </a>
      <div className="announcement">
        <span className="status-dot" />
        {t(" Supporting better US visa processing.")}{" "}
        <Link to="/policies/reducing-visa-delays-act">
          {t("Read H.R. 10711 ")}
          <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label={t("Reunite Now home")}>
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>
            {t("reunite")}
            <span className="brand-now">{t("now")}</span>
          </span>
        </Link>
        <LanguageSelector />
        <nav aria-label={t("Main navigation")}>
          <NavLink to="/policies">{t("Policy & action")}</NavLink>
          <NavLink to="/stories">{t("Our stories")}</NavLink>
          <NavLink to="/coverage">{t("Signature map")}</NavLink>
          <NavLink to="/visa-data">{t("Visa data")}</NavLink>
          <NavLink to="/data-use">{t("Data use")}</NavLink>
          <NavLink to="/about">{t("About")}</NavLink>
          <div className="nav-account">
            {me.user ? (
              <Link className="button small" to="/account">
                {t("My account ")}
                <ArrowUpRight size={15} />
              </Link>
            ) : (
              <>
                <Link className="login-link" to="/login">
                  {t("Log in")}
                </Link>
                <Link className="button small" to="/login?intent=sign">
                  {t("Sign the petition ")}
                  <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      {(previewMode || config.demoData) && (
        <div className="demo-banner" role="status">
          <strong>{previewMode ? t("Sample data") : t("Local demo")}</strong>
          <span>
            {t(
              "Sample signatures, stories, and visa timelines. These are fictional records.",
            )}
          </span>
          {previewMode && (
            <a href={location.pathname + location.search}>
              {t("Exit sample view")}
            </a>
          )}
        </div>
      )}
      {error && (
        <div className="site-error">
          {t("We couldn’t load community data. Please refresh to try again. ")}
          {t(error)}
        </div>
      )}
      <main id="main">
        <Suspense
          fallback={
            <div className="page-shell">
              <p>{t("Loading…")}</p>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/policies/:id" element={<PolicyDetail />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/coverage" element={<Coverage />} />
            <Route path="/visa-data" element={<VisaData />} />
            <Route path="/data-use" element={<DataUse />} />
            <Route path="/about" element={<About />} />
            <Route path="/sources" element={<Sources />} />
            <Route
              path="/login"
              element={previewMode ? <PreviewGate /> : <Login />}
            />
            <Route
              path="/auth/verify"
              element={previewMode ? <PreviewGate /> : <Verify />}
            />
            <Route
              path="/account"
              element={previewMode ? <PreviewGate /> : <Account />}
            />
            <Route
              path="*"
              element={
                <div className="page-shell">
                  <h1>{t("Let’s find your way back.")}</h1>
                  <Link className="button" to="/">
                    {t("Return home")}
                  </Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer>
        <div className="footer-top">
          <Link className="brand" to="/">
            <span className="brand-mark">
              <BrandMark />
            </span>
            <span>
              {t("reunite")}
              <span className="brand-now">{t("now")}</span>
            </span>
          </Link>
          <p>
            {t("For transparent, accountable")} {t("visa processing.")}
          </p>
          <Link to="/login?intent=sign" className="footer-cta">
            {t("Sign the petition ")}
            <MoveUpRight />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()}
            {t(" Reunite Now · Independent, community-led advocacy")}
          </span>
          <div>
            <Link to="/data-use">{t("Privacy & data use")}</Link>
            <Link to="/about">{t("Our purpose")}</Link>
            <Link to="/sources">{t("Sources & credits")}</Link>
            {!previewMode && <a href="/demo">{t("Explore sample data")}</a>}
            <a
              href="https://github.com/ethanrimes"
              target="_blank"
              rel="noreferrer"
            >
              {t("Project maintainer ↗")}
            </a>
          </div>
        </div>
        <p className="footer-note">
          {t(
            "Not affiliated with the U.S. government, any political party, or the legal teams featured here. Community reports are not official processing estimates.",
          )}
        </p>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={previewMode ? "/demo" : undefined}>
      <DataProvider>
        <App />
      </DataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
