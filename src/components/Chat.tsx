import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api";
import Reports from "./Reports";
import type { ChatResponse } from "../types";

interface Message {
  role: "user" | "assistant";
  text: string;
  intent?: string;
  usedLlm?: boolean;
}

const EXAMPLES = [
  "What should we discuss with the client today?",
  "Share an update on the tickets the team is currently working on, specifically those in In Progress or Testing",
  "Prepare today's support standup",
  "Give me the weekly report",
  "Generate bi-weekly report",
  "Show the UAT list",
  "Which incidents need follow-up?",
  "Which incidents are at risk of SLA breach?",
  "Provide the list of tickets that received comments today or during the current week",
  "Show tickets assigned to Sujit updated this week",
  "List of tickets assigned to Sujit this month",
  "List of Open Tickets Assigned to Saurabh",
  "Show incidents open for more than 7 days?",
  "Which incidents need escalation?",
];

export default function Chat({ onOpenIncident }: { onOpenIncident: (id: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const res: ChatResponse = await api.chat(question);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: res.answer,
          intent: res.intent,
          usedLlm: res.used_llm,
        },
      ]);
      if (res.intent === "biweekly_report") setShowReport(true);
      // make incident ids clickable
      void onOpenIncident;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const renderInline = (text: string, keyPrefix: string) => {
    // linkify incident ids, render **bold** and `code`
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\bINC-\d+\b|#\d+)/g);
    return parts.map((part, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (/^INC-\d+$/.test(part) || /^#\d+$/.test(part)) {
        return (
          <button key={key} className="link mono" onClick={() => onOpenIncident(part)}>
            {part}
          </button>
        );
      }
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code key={key} className="mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={key}>{part}</span>;
    });
  };

  const splitRow = (line: string): string[] => {
    let cells = line.trim().split("|").map((c) => c.trim());
    if (cells.length > 0 && cells[0] === "") cells = cells.slice(1);
    if (cells.length > 0 && cells[cells.length - 1] === "") cells = cells.slice(0, -1);
    return cells.map((c) =>
      c.replace(/^\*\*(.+)\*\*$/, "$1").replace(/^`(.+)`$/, "$1").trim(),
    );
  };

  const isSeparatorRow = (line: string): boolean => {
    const t = line.trim();
    return t.includes("|") && t.includes("-") && /^[\s|:~-]+$/.test(t);
  };

  const renderAnswer = (text: string) => {
    const lines = text.split("\n");
    const blocks: ReactNode[] = [];
    let i = 0;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length === 0) return;
      const key = `p-${blocks.length}`;
      blocks.push(
        <div key={key} className="answer-para">
          {para.map((ln, li) => (
            <span key={li}>
              {li > 0 && <br />}
              {renderInline(ln, `${key}-${li}`)}
            </span>
          ))}
        </div>,
      );
      para = [];
    };
    while (i < lines.length) {
      const line = lines[i];
      if (
        line.includes("|") &&
        i + 1 < lines.length &&
        isSeparatorRow(lines[i + 1])
      ) {
        flushPara();
        const header = splitRow(line);
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
          if (!isSeparatorRow(lines[i])) rows.push(splitRow(lines[i]));
          i++;
        }
        const key = `t-${blocks.length}`;
        blocks.push(
          <div key={key} className="md-table-wrap">
            <table className="md-table">
              <thead>
                <tr>
                  {header.map((h, hi) => (
                    <th key={hi}>{renderInline(h, `${key}-h-${hi}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr
                    key={ri}
                    onClick={() => {
                      const m = row.join(" ").match(/INC-\d+|#\d+/);
                      if (m) onOpenIncident(m[0]);
                    }}
                    className="clickable"
                  >
                    {header.map((_, ci) => (
                      <td key={ci}>{renderInline(row[ci] ?? "", `${key}-${ri}-${ci}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
      if (line.trim() === "") {
        flushPara();
        i++;
        continue;
      }
      para.push(line);
      i++;
    }
    flushPara();
    return blocks;
  };

  return (
    <div className="chat">
      {showReport && (
        <div className="modal-backdrop" onClick={() => setShowReport(false)}>
          <div
            className="modal report-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Bi-Weekly Status Report"
          >
            <div className="modal-head">
              <h3>Bi-Weekly Status Report</h3>
              <button
                className="btn icon-btn"
                onClick={() => setShowReport(false)}
                aria-label="Close report"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <Reports onOpenIncident={onOpenIncident} />
            </div>
          </div>
        </div>
      )}
      <div className="chat-log">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Ask the Support Assistant anything about current incidents.</p>
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="chip" onClick={() => send(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={`bubble ${m.role}`}>
            {m.role === "assistant" && (
              <div className="bubble-meta">
                SupportIncidentAgent{m.intent ? ` · ${m.intent}` : ""}
                {m.usedLlm ? " · LLM tools" : ""}
              </div>
            )}
            <div className="answer">{renderAnswer(m.text)}</div>
          </div>
        ))}
        {busy && <div className="bubble assistant">Thinking...</div>}
        {error && <div className="error">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Support Assistant..."
          aria-label="Ask Support Assistant"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {busy ? "..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
