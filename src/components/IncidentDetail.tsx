import { useEffect, useState } from "react";
import { api, isAbortError } from "../api";
import { formatDateTime } from "../dates";
import { renderAdoHtml, renderMarkdown } from "../richtext";
import type { Incident } from "../types";

interface IncidentFull {
  incident: Incident;
  pm_discussion?: string[];
  ado_base?: string | null;
  summary?: {
    owner?: string | null;
    age_days?: number;
    status?: string;
    severity?: string | null;
    priority?: string | null;
    customer_impact?: string | null;
    escalation?: string;
    next_recommended_action?: string | null;
    sla_risk?: string;
  };
  sla_risk?: {
    risk?: string;
    time_remaining_hours?: number | null;
    reason?: string;
    recommendation?: string;
  };
}

const CLOSED_STATES = new Set(
  ["resolved", "closed", "done", "removed", "completed", "verified"].map((s) => s),
);

function riskTone(risk?: string): "danger" | "warn" | "ok" | "muted" {
  if (!risk) return "muted";
  if (risk.startsWith("HIGH")) return "danger";
  if (risk.startsWith("MEDIUM")) return "warn";
  if (risk.startsWith("LOW") || risk.startsWith("NO")) return "ok";
  return "muted";
}

export default function IncidentDetail({
  incidentId,
  onClose,
}: {
  incidentId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<IncidentFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    const ctrl = new AbortController();
    api
      .incident(incidentId, { signal: ctrl.signal })
      .then((r) => setData(r as IncidentFull))
      .catch((e) => {
        if (isAbortError(e)) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => ctrl.abort();
  }, [incidentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const incident = data?.incident ?? null;
  const risk = data?.sla_risk?.risk ?? null;
  const adoBase = data?.ado_base ?? null;
  const adoDigits = incidentId.replace(/\D/g, "");
  const adoUrl = adoBase && adoDigits ? `${adoBase}${adoDigits}` : null;
  const tone = riskTone(risk ?? undefined);
  const isOpen = incident
    ? !CLOSED_STATES.has((incident.state || "").trim().toLowerCase())
    : true;
  const ageDays = incident
    ? Math.max(
        0,
        (Date.now() - +new Date(incident.created_at)) / 86400000,
      ).toFixed(1)
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal incident-modal tone-${tone}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Incident ${incidentId}`}
      >
        <div className="modal-head incident-head">
          <div className="incident-title">
            {adoUrl ? (
              <a
                className="mono id-chip id-chip-link"
                href={adoUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in Azure DevOps"
              >
                {incidentId} ↗
              </a>
            ) : (
              <span className="mono id-chip">{incidentId}</span>
            )}
            <h3>{incident ? incident.title : "Loading…"}</h3>
          </div>
          <button className="btn icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="error">{error}</div>}
        {!incident && !error && <div className="loading">Loading incident…</div>}

        {incident && (
          <div className="modal-body">
            <div className="pill-row">
              <span className={`pill ${isOpen ? "pill-open" : "pill-closed"}`}>
                <span className="dot" /> {incident.state}
              </span>
              {incident.severity && (
                <span
                  className={`pill ${
                    incident.severity.toLowerCase() === "critical"
                      ? "pill-danger"
                      : incident.severity.toLowerCase() === "high"
                        ? "pill-warn"
                        : "pill-muted"
                  }`}
                >
                  {incident.severity}
                </span>
              )}
              {incident.priority && (
                <span className="pill pill-muted">P{incident.priority}</span>
              )}
              <span className="pill pill-muted">
                👤 {incident.assigned_to ?? "Unassigned"}
              </span>
              {ageDays !== null && (
                <span className="pill pill-muted">🕒 {ageDays} days open</span>
              )}
            </div>

            {risk && (
              <div className={`risk-banner ${tone}`}>
                <div className="risk-banner-head">
                  <strong>SLA: {risk}</strong>
                  {data?.sla_risk?.time_remaining_hours != null && (
                    <span>
                      {(data.sla_risk.time_remaining_hours / 8).toFixed(1)}{" "}
                      working days left
                    </span>
                  )}
                </div>
                {data?.sla_risk?.reason && (
                  <div className="muted small">{data.sla_risk.reason}</div>
                )}
                {data?.sla_risk?.recommendation && (
                  <div className="small">→ {data.sla_risk.recommendation}</div>
                )}
              </div>
            )}

            {(incident.tags.length > 0 || incident.dependency) && (
              <div className="tag-row tag-row-top">
                <span className="pill pill-muted">
                  {incident.priority ? `P${incident.priority}` : "No priority"}
                </span>
                {incident.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
                {incident.dependency && (
                  <span className="tag tag-warn">⛓ {incident.dependency}</span>
                )}
              </div>
            )}

            {(data?.summary?.next_recommended_action ||
              (data?.pm_discussion?.length ?? 0) > 0) && (
              <div className="risk-banner pm-banner">
                <div className="risk-banner-head">
                  <strong>Next action & PM discussion</strong>
                </div>
                {data?.summary?.next_recommended_action && (
                  <div className="pm-next">
                    → {data.summary.next_recommended_action}
                  </div>
                )}
                <ul className="bullets pm-points">
                  {(data?.pm_discussion ?? []).map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card-grid">
              <div className="fact">
                <span className="fact-label">Owner</span>
                <span className="fact-value">
                  {incident.assigned_to ?? "Unassigned"}
                </span>
              </div>
              <div className="fact">
                <span className="fact-label">Created</span>
                <span className="fact-value">
                  {formatDateTime(incident.created_at)}
                </span>
              </div>
              <div className="fact">
                <span className="fact-label">End date</span>
                <span className="fact-value">
                  {incident.due_date
                    ? formatDateTime(incident.due_date)
                    : "Not set"}
                </span>
              </div>
              <div className="fact">
                <span className="fact-label">SLA due</span>
                <span className="fact-value">
                  {incident.sla_due_at
                    ? formatDateTime(incident.sla_due_at)
                    : "No SLA target in Azure DevOps"}
                </span>
              </div>
              <div className="fact">
                <span className="fact-label">Impact</span>
                <span className="fact-value">{incident.impact ?? "Not recorded"}</span>
              </div>
              {data?.summary?.escalation && (
                <div className="fact">
                  <span className="fact-label">Escalation</span>
                  <span className="fact-value">{data.summary.escalation}</span>
                </div>
              )}
              {data?.summary?.next_recommended_action && (
                <div className="fact">
                  <span className="fact-label">Next action</span>
                  <span className="fact-value">
                    {data.summary.next_recommended_action}
                  </span>
                </div>
              )}
            </div>

            {incident.description && (
              <section className="section">
                <h4>Description</h4>
                <div
                  className="rich card"
                  dangerouslySetInnerHTML={{
                    __html: renderAdoHtml(incident.description),
                  }}
                />
              </section>
            )}

            <section className="section">
              <h4>Activity timeline ({incident.comments.length})</h4>
              {incident.comments.length === 0 && (
                <p className="muted">No comments recorded.</p>
              )}
              <ul className="timeline">
                {[...incident.comments]
                  .sort(
                    (a, b) =>
                      +new Date(b.created_at) - +new Date(a.created_at),
                  )
                  .map((c, idx) => (
                    <li key={idx}>
                      <div className="timeline-meta">
                        <strong>{c.author}</strong>
                        <span className="muted small">
                          {formatDateTime(c.created_at)} · {c.author}
                        </span>
                      </div>
                      <div
                        className="rich timeline-body"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(c.text),
                        }}
                      />
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
