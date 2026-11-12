import { t } from "./i18n";
import { LanguageSelector, useLanguage } from "./language";
import React, { useEffect, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import { ArrowUpRight, Menu, X, Heart, MoveUpRight } from "lucide-react";
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
import "./styles.css";
function App() {
  useLanguage();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const { me, error, config } = useData();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
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
            <Heart size={21} />
          </span>
          <span>
            {t("reunite")}
            <span className="brand-now">{t("now")}</span>
          </span>
        </Link>
        <LanguageSelector />
        <button
          className="mobile-menu icon-button"
          aria-expanded={menu}
          aria-label={t("Toggle navigation")}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav aria-label={t("Main navigation")} className={menu ? "open" : ""}>
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
      {config.demoData && (
        <div className="demo-banner" role="status">
          <strong>{t("Local demo")}</strong>
          <span>
            {t(
              "Sample signatures, stories, and visa timelines. These are fictional records.",
            )}
          </span>
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
            <Route path="/login" element={<Login />} />
            <Route path="/auth/verify" element={<Verify />} />
            <Route path="/account" element={<Account />} />
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
              <Heart size={21} />
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
    <BrowserRouter>
      <DataProvider>
        <App />
      </DataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
