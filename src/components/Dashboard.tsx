import { useEffect, useState } from "react";
import { api, isAbortError } from "../api";
import { formatDate, formatDateTime, formatTime } from "../dates";
import type { Dashboard as DashboardData } from "../types";
import type { FilterKey } from "./IncidentTable";

function Kpi({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: "danger" | "warn" | "ok";
  onClick?: () => void;
}) {
  const className = `kpi ${tone ?? ""}${onClick ? " kpi-clickable" : ""}`;
  const title = onClick
    ? `${label}: ${value} — click to view in Incidents`
    : `${label}: ${value}`;
  if (onClick) {
    return (
      <button type="button" className={className} title={title} onClick={onClick}>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">
          <span className="kpi-dot" aria-hidden="true" />
          {label}
        </div>
      </button>
    );
  }
  return (
    <div className={className} title={title}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">
        <span className="kpi-dot" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

function linkifyIds(
  text: string,
  onOpenIncident: (id: string) => void,
  keyPrefix: string,
) {
  const parts = text.split(/(#\d+|INC-\d+)/g);
  return parts.map((part, idx) =>
    /^(#\d+|INC-\d+)$/.test(part) ? (
      <button
        key={`${keyPrefix}-${idx}`}
        className="link mono"
        onClick={() => onOpenIncident(part)}
      >
        {part}
      </button>
    ) : (
      <span key={`${keyPrefix}-${idx}`}>{part}</span>
    ),
  );
}

function onHoldAgeDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

export default function Dashboard({
  onOpenIncident,
  onGoToIncidents,
}: {
  onOpenIncident: (id: string) => void;
  onGoToIncidents?: (filter: FilterKey) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .dashboard({ signal: ctrl.signal })
      .then(setData)
      .catch((e) => {
        if (isAbortError(e)) return;
        setError(String(e.message ?? e));
      });
    return () => ctrl.abort();
  }, []);

  if (error) return <div className="error">Failed to load dashboard: {error}</div>;
  if (!data)
    return (
      <div className="dashboard">
        <div className="section-head">
          <h2>Support Overview</h2>
        </div>
        <div className="kpi-grid">
          {[0, 1].map((p) => (
            <section key={p} className="panel kpi-panel" aria-hidden="true">
              <div className="skeleton skeleton-title" />
              <div className="kpi-row">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton skeleton-kpi" />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="two-col">
          {[0, 1].map((i) => (
            <section key={i} className="panel">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line" />
            </section>
          ))}
        </div>
      </div>
    );

  const s = data.status;
  const generatedAt = new Date(s.generated_at);
  const ageMin = Math.max(
    0,
    Math.round((Date.now() - generatedAt.getTime()) / 60000),
  );
  const ageLabel =
    ageMin < 1
      ? "just now"
      : ageMin < 60
        ? `${ageMin} min ago`
        : `${Math.round(ageMin / 60)} h ago`;

  return (
    <div className="dashboard">
      <div className="section-head">
        <h2>Support Overview</h2>
        <span
          className="updated-pill"
          title={formatDateTime(generatedAt)}
        >
          <span className="pulse-dot" />
          Updated {formatTime(generatedAt)}
          <span className="muted">· {ageLabel}</span>
        </span>
      </div>

      <div className="kpi-grid">
        <section className="panel kpi-panel">
          <h4 className="kpi-heading">Needs attention</h4>
          <div className="kpi-row">
            <Kpi
              label="Open"
              value={s.open_incidents}
              onClick={onGoToIncidents ? () => onGoToIncidents("opentab") : undefined}
            />
            <Kpi label="Critical" value={s.critical} tone={s.critical ? "danger" : undefined} />
            <Kpi label="High" value={s.high} tone={s.high ? "warn" : undefined} />
            <Kpi label="Unassigned" value={s.unassigned} tone={s.unassigned ? "warn" : undefined} />
          </div>
        </section>
        <section className="panel kpi-panel">
          <h4 className="kpi-heading">Throughput</h4>
          <div className="kpi-row">
            <Kpi
              label="New this week"
              value={data.recent_total}
              onClick={onGoToIncidents ? () => onGoToIncidents("week") : undefined}
            />
            <Kpi
              label="New this month"
              value={data.monthly_total}
              onClick={onGoToIncidents ? () => onGoToIncidents("month") : undefined}
            />
            <Kpi label="Closed this week" value={data.weekly_resolved} tone="ok" />
            <Kpi label="Closed this month" value={data.monthly_resolved} tone="ok" />
          </div>
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3 className="panel-title">
            Recently Created <span className="muted">({data.recent_week_label})</span>{" "}
            <span className="count-badge" title="Tickets created this week">
              {data.recent_total ?? data.recent_incidents.length}
            </span>
          </h3>
          {(data.recent_incidents?.length ?? 0) === 0 && (
            <p className="muted">Nothing created this week.</p>
          )}
          {(data.recent_incidents?.length ?? 0) > 0 && (
            <div className="sla-table" role="table" aria-label="Recently created tickets">
              <div className="sla-row sla-head" role="row">
                <span>ID</span>
                <span>Title</span>
                <span className="num">Created</span>
                <span className="num">Status</span>
              </div>
              {(data.recent_incidents ?? []).map((i) => (
                <div
                  key={i.id}
                  className="sla-row"
                  role="row"
                  onClick={() => onOpenIncident(i.id)}
                >
                  <span><span className="mono id-chip">{i.id}</span></span>
                  <span className="title">{i.title}</span>
                  <span className="num muted">
                    {formatDate(i.created_at)}
                  </span>
                  <span className="num">{<span className="tag">{i.state}</span>}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h3>SLA Risk</h3>
          <p className="muted small">
            Tickets in UAT are excluded — tracked separately as near-closure.
          </p>
          {data.sla_risk.length === 0 && <p className="muted">No incident inside its SLA window.</p>}
          {data.sla_risk.length > 0 && (
            <div className="sla-table" role="table" aria-label="SLA risk tickets">
              <div className="sla-row sla-head" role="row">
                <span>ID</span>
                <span>Title</span>
                <span className="num">Time left</span>
                <span className="num num-center">Risk</span>
                <span className="num">Status</span>
              </div>
              {data.sla_risk.map((r) => (
                <div
                  key={r.incident_id}
                  className={`sla-row ${r.risk.startsWith("HIGH") ? "is-high" : "is-med"}`}
                  role="row"
                  onClick={() => onOpenIncident(r.incident_id)}
                >
                  <span><span className="mono id-chip">{r.incident_id}</span></span>
                  <span className="title">{r.title}</span>
                  <span className="num">
                    <span className={`risk ${r.risk.startsWith("HIGH") ? "danger" : "warn"}`}>
                      {r.time_remaining_hours !== null ? `${(r.time_remaining_hours / 8).toFixed(1)} working days` : "—"}
                    </span>
                  </span>
                  <span className={`num num-center ${r.risk.startsWith("HIGH") ? "danger" : r.risk.startsWith("MEDIUM") ? "warn" : "ok"}`}>
                    {r.risk.startsWith("HIGH")
                      ? "High"
                      : r.risk.startsWith("MEDIUM")
                        ? "Medium"
                        : r.risk.startsWith("LOW")
                          ? "Low"
                          : r.risk}
                  </span>
                  <span className="num">{r.state && <span className="tag">{r.state}</span>}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Top Risks</h3>
          <ol className="risks">
            {s.top_risks.map((r) => (
              <li key={r.incident_id}>
                <button className="link" onClick={() => onOpenIncident(r.incident_id)}>
                  {r.incident_id}
                </button>{" "}
                — {r.title}
                <div className="muted small">
                  {r.severity ?? ""} {r.priority ?? ""} · Status: {r.status ?? "—"} · open {r.age_days}d · {r.reasons.join(" · ")}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <h3>On Hold ({data.on_hold_incidents?.length ?? 0})</h3>
          <p className="muted small">
            Paused tickets — tracked separately, not counted in SLA risk.
          </p>
          {(data.on_hold_incidents?.length ?? 0) === 0 && (
            <p className="muted">Nothing on hold.</p>
          )}
          <ul className="incident-list">
            {(data.on_hold_incidents ?? []).map((i) => (
              <li key={i.id} onClick={() => onOpenIncident(i.id)}>
                <span className="mono id-chip">{i.id}</span>
                <span className="title">{i.title}</span>
                <span className="muted">{i.assigned_to ?? "Unassigned"}</span>
                <span className="muted small">Aging {onHoldAgeDays(i.created_at)}d</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h3>Recommendations</h3>
          <ul className="bullets">
            {s.recommendations.map((r, idx) => (
              <li key={idx}>{linkifyIds(r, onOpenIncident, `rec-${idx}`)}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h3>PM Discussion Points</h3>
          {(data.pm_discussion?.length ?? 0) === 0 && (
            <p className="muted">No discussion points right now.</p>
          )}
          <ul className="incident-list">
            {(data.pm_discussion ?? []).map((d) => (
              <li key={d.incident_id} onClick={() => onOpenIncident(d.incident_id)}>
                <span className="mono id-chip">{d.incident_id}</span>
                <span className="title">{d.title}</span>
                <span className="tag">{d.state}</span>
                <span className="muted">
                  {d.points.length} point{d.points.length === 1 ? "" : "s"} in ticket popup
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

    </div>
  );
}

