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
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const { me, error } = useData();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        <span className="status-dot" /> Supporting better US visa processing.{" "}
        <Link to="/policies/reducing-visa-delays-act">
          Read H.R. 10711 <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Reunite Now home">
          <span className="brand-mark">
            <Heart size={21} />
          </span>
          <span>
            reunite<span className="brand-now">now</span>
          </span>
        </Link>
        <button
          className="mobile-menu icon-button"
          aria-expanded={menu}
          aria-label="Toggle navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav aria-label="Main navigation" className={menu ? "open" : ""}>
          <NavLink to="/policies">Policy & action</NavLink>
          <NavLink to="/stories">Our stories</NavLink>
          <NavLink to="/coverage">Signature map</NavLink>
          <NavLink to="/visa-data">Visa data</NavLink>
          <NavLink to="/data-use">Data use</NavLink>
          <NavLink to="/about">About</NavLink>
          <div className="nav-account">
            {me.user ? (
              <Link className="button small" to="/account">
                My account <ArrowUpRight size={15} />
              </Link>
            ) : (
              <>
                <Link className="login-link" to="/login">
                  Log in
                </Link>
                <Link className="button small" to="/login?intent=sign">
                  Sign the petition <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      {error && (
        <div className="site-error">
          We couldn’t load community data. Please refresh to try again. {error}
        </div>
      )}
      <main id="main">
        <Suspense
          fallback={
            <div className="page-shell">
              <p>Loading…</p>
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
                  <h1>Let’s find your way back.</h1>
                  <Link className="button" to="/">
                    Return home
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
              reunite<span className="brand-now">now</span>
            </span>
          </Link>
          <p>
            For transparent, accountable
            <br />
            visa processing.
          </p>
          <Link to="/login?intent=sign" className="footer-cta">
            Sign the petition <MoveUpRight />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Reunite Now · Independent,
            community-led advocacy
          </span>
          <div>
            <Link to="/data-use">Privacy & data use</Link>
            <Link to="/about">Our purpose</Link>
            <a
              href="https://github.com/ethanrimes"
              target="_blank"
              rel="noreferrer"
            >
              Project maintainer ↗
            </a>
          </div>
        </div>
        <p className="footer-note">
          Not affiliated with the U.S. government, any political party, or the
          legal teams featured here. Community reports are not official
          processing estimates.
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
