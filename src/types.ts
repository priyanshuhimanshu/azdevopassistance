export interface TopRisk {
  incident_id: string;
  title: string;
  severity: string | null;
  priority: string | null;
  status: string | null;
  age_days: number;
  reasons: string[];
}

export interface SupportStatus {
  generated_at: string;
  overall_health: "GREEN" | "AMBER" | "RED";
  open_incidents: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  new_today: number;
  resolved_today: number;
  sla_at_risk: number;
  oldest_open_id: string | null;
  oldest_open_age_days: number | null;
  unassigned: number;
  escalation_required: number;
  top_risks: TopRisk[];
  recommendations: string[];
}

export interface IncidentRisk {
  incident_id: string;
  title: string;
  severity: string | null;
  priority: string | null;
  state: string | null;
  owner: string | null;
  age_hours: number;
  sla_target_hours: number | null;
  time_remaining_hours: number | null;
  risk: "HIGH RISK" | "MEDIUM RISK" | "LOW RISK" | "UNKNOWN" | "NO RISK";
  reason: string;
  recommendation: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  work_item_type: string;
  state: string;
  severity: string | null;
  priority: number | null;
  assigned_to: string | null;
  created_at: string;
  changed_at: string;
  sla_due_at: string | null;
  due_date: string | null;
  customer: string | null;
  environment: string | null;
  impact: string | null;
  tags: string[];
  blocked: boolean;
  dependency: string | null;
  comments: { author: string; created_at: string; text: string }[];
}

export interface ChatResponse {
  answer: string;
  intent: string;
  mode: "demo" | "azure_devops";
  used_llm: boolean;
}

export interface Meta {
  mode: "demo" | "azure_devops";
  demo_banner: string | null;
  llm_configured: boolean;
  llm_model: string | null;
  ado_configured: boolean;
  project_work_item_types: string[];
  mapped_incident_types: string[];
  read_tools: string[];
}

export interface Dashboard {
  mode: string;
  generated_at: string;
  status: SupportStatus;
  sla_risk: IncidentRisk[];
  critical_incidents: Incident[];
  on_hold_incidents: Incident[];
  recent_incidents: Incident[];
  recent_week_label: string;
  recent_total: number;
  monthly_total: number;
  weekly_resolved: number;
  monthly_resolved: number;
  pm_discussion: { incident_id: string; title: string; state: string; points: string[] }[];
}
