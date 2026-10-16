import { useEffect, useState } from "react";
import { api, isAbortError } from "./api";
import Chat from "./components/Chat";
import Dashboard from "./components/Dashboard";
import IncidentDetail from "./components/IncidentDetail";
import type { Meta } from "./types";
import { IncidentTable, type FilterKey } from "./components/IncidentTable";

type Tab = "dashboard" | "incidents" | "assistant";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [openIncident, setOpenIncident] = useState<string | null>(null);
  const [incidentsFilter, setIncidentsFilter] = useState<FilterKey | undefined>();

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .meta({ signal: ctrl.signal })
      .then(setMeta)
      .catch((e) => {
        if (isAbortError(e)) return;
        setMetaError(e instanceof Error ? e.message : String(e));
      });
    return () => ctrl.abort();
  }, []);

  const goIncidents = (id: string) => {
    setOpenIncident(id);
  };

  const goToIncidentTab = (filter: FilterKey) => {
    setIncidentsFilter(filter);
    setTab("incidents");
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <h1>Support AI Assistant</h1>
            <div className="muted small">Azure DevOps Support &amp; Incident Management</div>
          </div>
        </div>
        <nav className="tabs">
          {(
            [
              ["dashboard", "Dashboard"],
              ["incidents", "Incidents"],
              ["assistant", "Ask Assistant"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "tab active" : "tab"}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="badges">
          {meta?.demo_banner && <span className="badge demo">{meta.demo_banner}</span>}
        </div>
      </header>

      {metaError && <div className="error">Backend unreachable: {metaError}</div>}

      <main className="content">
        {tab === "dashboard" && (
          <Dashboard
            onOpenIncident={goIncidents}
            onGoToIncidents={goToIncidentTab}
          />
        )}
        {tab === "incidents" && (
          <IncidentTable
            onOpenIncident={goIncidents}
            initialFilter={incidentsFilter}
          />
        )}
        {tab === "assistant" && <Chat onOpenIncident={goIncidents} />}
      </main>

      {openIncident && (
        <IncidentDetail incidentId={openIncident} onClose={() => setOpenIncident(null)} />
      )}

      <footer className="footer muted small">
        Read-only AI assistant · no changes are made to Azure DevOps
      </footer>
    </div>
  );
}

