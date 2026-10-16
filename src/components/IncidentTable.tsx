import { useEffect, useMemo, useState } from "react";
import { api, isAbortError } from "../api";
import { formatDate } from "../dates";
import type { Incident } from "../types";

export type FilterKey =
  | "all"
  | "opentab"
  | "open"
  | "inprogress"
  | "testing"
  | "uat"
  | "hold"
  | "closed"
  | "critical"
  | "aging"
  | "unassigned"
  | "de"
  | "fsd"
  | "mobile"
  | "devops"
  | "week"
  | "month";

// Team rosters match the assignee display names in Azure DevOps.
const TEAMS: Record<string, string[]> = {
  de: ["Suthakaran Venkatachalapathi", "Ryme Majumdar", "Lakshmi Priya Kirla"],
  fsd: ["Sujit Kumar Mishra", "Manoranjan Kumar Saha"],
  mobile: ["Saurabh More"],
  devops: ["Sanket Anil Shirode"],
};

// Current-month window: first day 00:00 -> last day 23:59 (no past-month tickets).
function monthBounds(): { created_after: string } {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
  return { created_after: start.toISOString() };
}

// Current-week window: Monday 00:00 -> now.
function weekBounds(): { created_after: string } {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return { created_after: monday.toISOString() };
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0).toISOString();
}

const ALL_STATES = "New,Triage,In Progress,Testing,UAT,On Hold,Closed";

const FILTERS: {
  key: FilterKey;
  label: string;
  title?: string;
  params: Record<string, string | number | boolean>;
}[] = [
  {
    key: "all",
    label: "All",
    title:
      "New, Triage, In Progress, Testing, UAT + closed this month (created this month only)",
    params: {
      state_in: ALL_STATES,
      closed_after: monthStartIso(),
      closed_created_after: monthStartIso(),
      limit: 500,
    },
  },
  {
    key: "opentab",
    label: "Open",
    title: "All open (not closed) tickets",
    params: { open_only: true, limit: 500 },
  },
  {
    key: "open",
    label: "New",
    title: "Status New only",
    params: { state: "New", limit: 500 },
  },
  {
    key: "inprogress",
    label: "In Progress",
    title: "In Progress and Triage",
    params: { state_in: "In Progress,Triage", limit: 500 },
  },
  {
    key: "testing",
    label: "Testing",
    title: "Status Testing",
    params: { state: "Testing", limit: 500 },
  },
  {
    key: "uat",
    label: "UAT",
    title: "Status UAT",
    params: { state: "UAT", limit: 500 },
  },
  {
    key: "hold",
    label: "On Hold",
    title: "Paused tickets — tracked separately, not counted in SLA risk",
    params: { state: "On Hold", limit: 500 },
  },
  {
    key: "closed",
    label: "Closed",
    title: "Closed in the current month",
    params: { closed_only: true, closed_after: monthStartIso(), limit: 500 },
  },
  { key: "critical", label: "Critical", params: { severity: "Critical" } },
  { key: "aging", label: "> 7 days", params: { min_age_days: 7, open_only: true } },
  { key: "unassigned", label: "Unassigned", params: { unassigned: true, open_only: true } },
  {
    key: "de",
    label: "DE",
    title: `${TEAMS.de.join(", ")} · current month`,
    params: {
      assigned_to_in: TEAMS.de.join(","),
      open_only: true,
      ...monthBounds(),
      limit: 500,
    },
  },
  {
    key: "fsd",
    label: "FSD",
    title: `${TEAMS.fsd.join(", ")} · current month`,
    params: {
      assigned_to_in: TEAMS.fsd.join(","),
      open_only: true,
      ...monthBounds(),
      limit: 500,
    },
  },
  {
    key: "mobile",
    label: "Mobile",
    title: `${TEAMS.mobile.join(", ")} · current month`,
    params: {
      assigned_to_in: TEAMS.mobile.join(","),
      open_only: true,
      ...monthBounds(),
      limit: 500,
    },
  },
  {
    key: "devops",
    label: "DevOps",
    title: `${TEAMS.devops.join(", ")} · current month`,
    params: {
      assigned_to_in: TEAMS.devops.join(","),
      open_only: true,
      ...monthBounds(),
      limit: 500,
    },
  },
  {
    key: "week",
    label: "Weekly",
    title: "Created this week, Monday-Friday (open + closed)",
    params: { ...weekBounds(), limit: 500 },
  },
  {
    key: "month",
    label: "Monthly",
    title: "Created in the current month (open + closed)",
    params: { ...monthBounds(), limit: 500 },
  },
];

type SortKey =
  | "id"
  | "title"
  | "severity"
  | "priority"
  | "state"
  | "owner"
  | "created"
  | "days"
  | "sla"
  | "comments";

// Skeleton bar widths per column (#, ID, Title, Severity, Pri, State, Owner, Created, Days, SLA due, Comments)
const SKEL_WIDTHS = ["24px", "72px", "100%", "64px", "36px", "84px", "96px", "80px", "48px", "80px", "28px"];

const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function daysPending(i: Incident): number {
  const created = new Date(i.created_at).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

function sortVal(i: Incident, key: SortKey): string | number {
  switch (key) {
    case "id":
      return i.id;
    case "title":
      return (i.title || "").toLowerCase();
    case "severity":
      return SEV_RANK[(i.severity || "").toLowerCase()] ?? 9;
    case "priority":
      return i.priority ?? 99;
    case "state":
      return (i.state || "").toLowerCase();
    case "owner":
      return (i.assigned_to || "zzz").toLowerCase();
    case "created":
      return +new Date(i.created_at);
    case "days":
      return daysPending(i);
    case "sla":
      return i.sla_due_at ? +new Date(i.sla_due_at) : Number.MAX_SAFE_INTEGER;
    case "comments":
      return i.comments.length;
  }
}

function sevTone(sev: string | null): string {
  switch ((sev || "").toLowerCase()) {
    case "critical":
      return "pill-danger";
    case "high":
      return "pill-warn";
    case "medium":
      return "pill-info";
    case "low":
      return "pill-muted";
    default:
      return "pill-muted";
  }
}

export function IncidentTable({
  onOpenIncident,
  initialFilter,
}: {
  onOpenIncident: (id: string) => void;
  initialFilter?: FilterKey;
}) {
  const [filter, setFilter] = useState<FilterKey>(initialFilter ?? "week");
  const [items, setItems] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const params = {
      ...(FILTERS.find((f) => f.key === filter)?.params ?? {}),
      include_comments: true,
    };
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api
      .incidents(params, { signal: ctrl.signal })
      .then((r) => {
        setItems(r.incidents);
        setTotal(r.count);
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [filter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) =>
          [i.id, i.title, i.state, i.assigned_to ?? "", i.severity ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : [...items];
    filtered.sort((a, b) => {
      const va = sortVal(a, sortKey);
      const vb = sortVal(b, sortKey);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return cmp * sortDir;
    });
    return filtered;
  }, [items, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "owner" || key === "state" ? 1 : -1);
    }
  };

  const arrow = (key: SortKey) =>
    sortKey !== key ? <span className="sort-arrow">⇅</span> : sortDir === 1 ? (
      <span className="sort-arrow active">▲</span>
    ) : (
      <span className="sort-arrow active">▼</span>
    );

  const th = (label: string, key: SortKey) => (
    <th onClick={() => toggleSort(key)} className="sortable" title={`Sort by ${label}`}>
      {label} {arrow(key)}
    </th>
  );

  return (
    <div>
      <div className="section-head incidents-head">
        <h2>Incidents</h2>
        <span className={`count-pill${loading ? " loading" : ""}`}>
          {loading ? (
            <>
              <span className="pulse-dot" aria-hidden="true" /> Loading tickets…
            </>
          ) : (
            `${visible.length} of ${total}`
          )}
        </span>
      </div>
      <div className="toolbar">
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Search id, title, owner, state…"
          aria-label="Search incidents"
        />
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "chip active" : "chip"}
              title={f.title}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <section className="panel table-panel">
        <table className="table incidents-table" aria-busy={loading}>
          <thead>
            <tr>
              <th className="sno">#</th>
              {th("ID", "id")}
              {th("Title", "title")}
              {th("Severity", "severity")}
              {th("Pri", "priority")}
              {th("State", "state")}
              {th("Owner", "owner")}
              {th("Created", "created")}
              {th("Days", "days")}
              {th("SLA due", "sla")}
              {th("Comments", "comments")}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, r) => (
                <tr key={`skel-${r}`} className="skel-row" aria-hidden="true">
                  {SKEL_WIDTHS.map((w, c) => (
                    <td key={c}>
                      <div
                        className="skeleton skeleton-cell"
                        style={{ width: w, animationDelay: `${r * 0.1 + c * 0.03}s` }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              visible.map((i, idx) => (
              <tr key={i.id} onClick={() => onOpenIncident(i.id)} className="clickable">
                <td className="sno muted" data-label="#">{idx + 1}</td>
                <td className="mono id-chip-cell" data-label="ID">
                  <span className="mono id-chip">{i.id}</span>
                </td>
                <td data-label="Title" className="title-cell">{i.title}</td>
                <td data-label="Severity">
                  <span className={`pill ${sevTone(i.severity)}`}>{i.severity ?? "-"}</span>
                </td>
                <td data-label="Pri">
                  <span className={`pri pri-${i.priority ?? "na"}`}>{i.priority ? `P${i.priority}` : "-"}</span>
                </td>
                <td data-label="State">
                  <span className="tag">{i.state}</span>
                </td>
                <td data-label="Owner">{i.assigned_to ?? <span className="muted">Unassigned</span>}</td>
                <td className="small" data-label="Created">{formatDate(i.created_at)}</td>
                <td data-label="Days">
                  <span className={daysPending(i) >= 7 ? "days-aging" : undefined}>
                    {daysPending(i)}
                  </span>
                </td>
                <td className="small" data-label="SLA due">
                  {i.sla_due_at ? formatDate(i.sla_due_at) : "—"}
                </td>
                <td data-label="Comments">
                  <span className="comment-count" title={`${i.comments.length} comments`}>
                    {i.comments.length}
                  </span>
                </td>
              </tr>
            ))}
            {visible.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="muted empty-row">
                  {query ? `No incidents match "${query}".` : "No incidents match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
