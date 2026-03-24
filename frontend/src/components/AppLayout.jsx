import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Generator", to: "/" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Templates", to: "/templates" },
  { label: "About", to: "/about" },
];

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="top-nav-wrap">
        <nav className="top-nav" aria-label="Main navigation">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <div>
              <strong>Credify</strong>
              <p>Bulk certificate platform</p>
            </div>
          </div>

          <div className="nav-links">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <div className="shell">
        <Outlet />
      </div>

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <h3>Credify</h3>
            <p>
              Fast certificate generation with CSV automation, visual placement,
              and downloadable ZIP exports.
            </p>
          </div>
          <div>
            <h4>Pages</h4>
            <p>Generator</p>
            <p>Dashboard</p>
            <p>Templates</p>
            <p>About</p>
          </div>
          <div>
            <h4>Workflow</h4>
            <p>Upload files</p>
            <p>Place fields</p>
            <p>Generate and download</p>
          </div>
        </div>
        <p className="footer-note">
          Built for events, institutions, and teams that issue certificates at scale.
        </p>
      </footer>
    </div>
  );
}
