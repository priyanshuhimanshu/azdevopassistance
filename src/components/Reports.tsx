import { useEffect, useMemo, useState } from "react";
import { api, isAbortError, type BiReportItem } from "../api";

const adoUrl = (base: string | null, incidentId: string): string | null => {
  if (!base) return null;
  const digits = incidentId.replace(/\D/g, "");
  return digits ? `${base}${digits}` : null;
};

interface BiweeklyData {
  project: string;
  ado_base: string | null;
  report: {
    week: string;
    generated_at: string;
    new_count: number;
    resolved_count: number;
    uat_open: BiReportItem[];
    testing_open: BiReportItem[];
    in_progress_open: BiReportItem[];
    new_open: BiReportItem[];
    on_hold_open: BiReportItem[];
    sla_risks: { incident_id: string; risk: string }[];
  };
}

const ageFmt = (d: number) => (d >= 1 ? `${Math.round(d)} days` : "Today");

export default function Reports({ onOpenIncident }: { onOpenIncident: (id: string) => void }) {
  const [data, setData] = useState<BiweeklyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .biweekly({ signal: ctrl.signal })
      .then(setData)
      .catch((e) => {
        if (isAbortError(e)) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => ctrl.abort();
  }, []);

  const groups = useMemo(() => {
    if (!data) return null;
    const r = data.report;
    const ordered: { label: string; items: BiReportItem[] }[] = [
      { label: "UAT", items: r.uat_open },
      { label: "Testing", items: r.testing_open },
      { label: "In Progress", items: r.in_progress_open },
      { label: "New / Triage", items: r.new_open },
      { label: "On Hold", items: r.on_hold_open },
    ];
    const serial = new Map<string, number>();
    let n = 0;
    for (const g of ordered) for (const i of g.items) serial.set(i.incident_id, ++n);
    return { ordered, serial, total: n };
  }, [data]);

  if (error) return <div className="error">Failed to load report: {error}</div>;
  if (!data || !groups)
    return (
      <div className="report">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </div>
    );

  const r = data.report;
  const accomplishments: string[] = [
    `${r.resolved_count} tickets have been closed during the reporting period.`,
  ];
  if (r.uat_open.length > 0)
    accomplishments.push(
      `UAT activities have progressed, with ${r.uat_open.length} ticket(s) currently awaiting final UAT confirmation/closure.`,
    );
  if (r.testing_open.length > 0)
    accomplishments.push(
      `Development is complete for ${r.testing_open.length} item(s) currently in testing, ready for the next validation cycle.`,
    );
  if (r.new_count > 0)
    accomplishments.push(`${r.new_count} new ticket(s) were raised during the period.`);

  const focus: string[] = [];
  if (r.uat_open.length > 0)
    focus.push(
      `Obtain UAT confirmation and close the remaining ${r.uat_open.length} UAT ticket(s).`,
    );
  const staleHold = r.on_hold_open.filter((i) => i.age_days >= 14);
  if (staleHold.length > 0)
    focus.push(
      `Review the long-pending On Hold items and confirm the required action/next steps where client input is needed.`,
    );
  const slaHigh = r.sla_risks.filter((x) => x.risk === "HIGH RISK");
  if (slaHigh.length > 0)
    focus.push(
      `Escalate tickets at SLA risk: ${slaHigh.map((x) => x.incident_id).join(", ")}.`,
    );
  if (focus.length === 0) focus.push("No critical focus items - keep monitoring.");

  const idLink = (id: string) => {
    const url = adoUrl(data?.ado_base ?? null, id);
    if (url)
      return (
        <a
          className="link mono"
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {id}
        </a>
      );
    return (
      <button className="link mono" onClick={() => onOpenIncident(id)}>
        {id}
      </button>
    );
  };

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const copyReport = async () => {
    if (!data || !groups) return;
    const r = data.report;
    const out: string[] = [
      `Bi-Weekly Status Report - ${data.project}`,
      ``,
      `Reporting Period: ${r.week}`,
      ``,
      `1. Current Backlog (${groups.total})`,
      ``,
    ];
    for (const g of groups.ordered) {
      const tickets =
        g.items.length === 0
          ? "-"
          : g.items
              .map((i) =>
                g.label === "On Hold"
                  ? `${i.incident_id} (${ageFmt(i.age_days)})`
                  : i.incident_id,
              )
              .join(", ");
      out.push(`${g.label} | ${g.items.length} | ${tickets}`);
    }
    out.push(
      ``,
      `2. Accomplishments`,
      ``,
      ...accomplishments.map((a) => `- ${a}`),
      ``,
      `3. UAT - Awaiting Confirmation / Closure (${r.uat_open.length})`,
      ``,
    );
    if (r.uat_open.length === 0) {
      out.push(`No tickets in UAT.`);
    } else {
      out.push(`# | Ticket | Area | Description | Age`);
      for (const i of r.uat_open)
        out.push(
          `${groups.serial.get(i.incident_id)} | ${i.incident_id} | ${i.area} | ${i.title} | ${ageFmt(i.age_days)}`,
        );
    }
    out.push(``, `4. Testing - Development Completed`, ``);
    if (r.testing_open.length === 0) {
      out.push(`No tickets in testing.`);
    } else {
      out.push(`Ticket | Description | Status`);
      for (const i of r.testing_open)
        out.push(`${i.incident_id} | ${i.title} | ${i.state}`);
      out.push(
        ``,
        `Next step: Once testing is completed, the items will be moved to UAT/feedback as applicable.`,
      );
    }
    out.push(``, `5. Key Focus for Next`, ``, ...focus.map((f) => `- ${f}`));
    const plain = out.join("\n");

    const cell = `border:1px solid #999;padding:6px 10px;text-align:left;vertical-align:top;`;
    const head = `${cell}background:#f0f0f0;font-weight:bold;`;
    const ids = (items: BiReportItem[], withAge: boolean) =>
      items.length === 0
        ? "-"
        : items
            .map(
              (i) =>
                `${esc(i.incident_id)}${withAge ? ` (${ageFmt(i.age_days)})` : ""}`,
            )
            .join(", ");
    const html = [
      `<h2>Bi-Weekly Status Report - ${esc(data.project)}</h2>`,
      `<p>Reporting Period: ${esc(r.week)}</p>`,
      `<h3>1. Current Backlog (${groups.total})</h3>`,
      `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">`,
      `<tr><th style="${head}">Status</th><th style="${head}">Count</th><th style="${head}">Tickets</th></tr>`,
      ...groups.ordered.map(
        (g) =>
          `<tr><td style="${cell}">${esc(g.label)}</td><td style="${cell}">${g.items.length}</td><td style="${cell}">${ids(g.items, g.label === "On Hold")}</td></tr>`,
      ),
      `</table>`,
      `<h3>2. Accomplishments</h3>`,
      `<ul>${accomplishments.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`,
      `<h3>3. UAT - Awaiting Confirmation / Closure (${r.uat_open.length})</h3>`,
      r.uat_open.length === 0
        ? `<p>No tickets in UAT.</p>`
        : [
            `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">`,
            `<tr><th style="${head}">#</th><th style="${head}">Ticket</th><th style="${head}">Area</th><th style="${head}">Description</th><th style="${head}">Age</th></tr>`,
            ...r.uat_open.map(
              (i) =>
                `<tr><td style="${cell}">${groups.serial.get(i.incident_id) ?? ""}</td><td style="${cell}">${esc(i.incident_id)}</td><td style="${cell}">${esc(i.area)}</td><td style="${cell}">${esc(i.title)}</td><td style="${cell}">${ageFmt(i.age_days)}</td></tr>`,
            ),
            `</table>`,
          ].join(""),
      `<h3>4. Testing - Development Completed</h3>`,
      r.testing_open.length === 0
        ? `<p>No tickets in testing.</p>`
        : [
            `<p>The following items have completed development and are currently in testing:</p>`,
            `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">`,
            `<tr><th style="${head}">Ticket</th><th style="${head}">Area</th><th style="${head}">Description</th><th style="${head}">Status</th></tr>`,
            ...r.testing_open.map(
              (i) =>
                `<tr><td style="${cell}">${esc(i.incident_id)}</td><td style="${cell}">${esc(i.area)}</td><td style="${cell}">${esc(i.title)}</td><td style="${cell}">${esc(i.state)}</td></tr>`,
            ),
            `</table>`,
            `<p>Next step: Once testing is completed, the items will be moved to UAT/feedback as applicable.</p>`,
          ].join(""),
      `<h3>5. Key Focus for Next</h3>`,
      `<ul>${focus.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`,
    ].join("");

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed - clipboard access was blocked by the browser.");
    }
  };

  return (
    <div className="report">
      <div className="report-toolbar no-print">
        <span />
        <button
          className={`btn-copy ${copied ? "copied" : ""}`}
          onClick={() => void copyReport()}
        >
          <span aria-hidden="true">{copied ? "✓" : "⧉"}</span>
          {copied ? "Copied!" : "Copy report"}
        </button>
      </div>

      <header className="report-header">
        <div className="report-kicker">Bi-Weekly Status Report</div>
        <h2 className="report-title">{data.project}</h2>
        <div className="muted">Reporting Period: {r.week}</div>
      </header>

      <section className="report-section">
        <h3>
          1. Current Backlog{" "}
          <span className="count-badge" title="Open tickets">
            {groups.total}
          </span>
        </h3>
        <table className="table report-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
              <th>Tickets</th>
            </tr>
          </thead>
          <tbody>
            {groups.ordered.map((g) => (
              <tr key={g.label}>
                <td>
                  <span className="tag">{g.label}</span>
                </td>
                <td className="num">{g.items.length}</td>
                <td>
                  {g.items.length === 0
                    ? "—"
                    : g.items.map((i, idx) => (
                        <span key={i.incident_id}>
                          {idx > 0 && ", "}
                          {idLink(i.incident_id)}
                          {g.label === "On Hold" ? ` (${ageFmt(i.age_days)})` : ""}
                        </span>
                      ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h3>2. Accomplishments</h3>
        <ul className="bullets">
          {accomplishments.map((a, idx) => (
            <li key={idx}>{a}</li>
          ))}
        </ul>
      </section>

      <section className="report-section">
        <h3>3. UAT – Awaiting Confirmation / Closure ({r.uat_open.length})</h3>
        {r.uat_open.length === 0 ? (
          <p className="muted">No tickets in UAT.</p>
        ) : (
          <table className="table report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ticket</th>
                <th>Area</th>
                <th>Description</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {r.uat_open.map((i) => (
                <tr key={i.incident_id} onClick={() => onOpenIncident(i.incident_id)} className="clickable">
                  <td className="muted">{groups.serial.get(i.incident_id)}</td>
                  <td>{idLink(i.incident_id)}</td>
                  <td>{i.area}</td>
                  <td>{i.title}</td>
                  <td className="num">{ageFmt(i.age_days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="report-section">
        <h3>4. Testing – Development Completed</h3>
        {r.testing_open.length === 0 ? (
          <p className="muted">No tickets in testing.</p>
        ) : (
          <>
            <p className="muted">
              The following items have completed development and are currently in
              testing:
            </p>
            <table className="table report-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Area</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {r.testing_open.map((i) => (
                  <tr key={i.incident_id} onClick={() => onOpenIncident(i.incident_id)} className="clickable">
                    <td>{idLink(i.incident_id)}</td>
                    <td>{i.area}</td>
                    <td>{i.title}</td>
                    <td>
                      <span className="tag">{i.state}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              Next step: Once testing is completed, the items will be moved to
              UAT/feedback as applicable.
            </p>
          </>
        )}
      </section>

      <section className="report-section">
        <h3>5. Key Focus for Next</h3>
        <ul className="bullets">
          {focus.map((f, idx) => (
            <li key={idx}>{f}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
