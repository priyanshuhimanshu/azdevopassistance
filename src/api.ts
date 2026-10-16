import type {
  ChatResponse,
  Dashboard,
  Incident,
  Meta,
} from "./types";

export interface BiReportItem {
  incident_id: string;
  title: string;
  severity: string | null;
  priority: string | null;
  state: string;
  owner: string;
  area: string;
  age_days: number;
}

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://azdevopassistanceapi.onrender.com" : "")
).replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export function isAbortError(e: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  );
}

export const api = {
  meta: (init?: RequestInit) => request<Meta>("/api/meta", init),
  dashboard: (init?: RequestInit) => request<Dashboard>("/api/dashboard", init),
  incidents: (params: Record<string, string | number | boolean> = {}, init?: RequestInit) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{ count: number; incidents: Incident[] }>(
      `/api/incidents${qs ? `?${qs}` : ""}`,
      init,
    );
  },
  incident: (id: string, init?: RequestInit) =>
    request<{ incident: Incident; ado_base?: string | null }>(
      `/api/incidents/${encodeURIComponent(id)}`,
      init,
    ),
  chat: (message: string) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  briefing: () => request<Record<string, unknown>>("/api/briefing"),
  weekly: () => request<Record<string, unknown>>("/api/weekly"),
  biweekly: (init?: RequestInit) =>
    request<{
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
    }>("/api/biweekly", init),
  audit: (limit = 50) =>
    request<{ count: number; entries: Record<string, unknown>[] }>(
      `/api/audit?limit=${limit}`,
    ),
};
