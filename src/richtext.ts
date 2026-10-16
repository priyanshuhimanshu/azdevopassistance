import DOMPurify from "dompurify";
import { marked } from "marked";

/** Azure DevOps work-item descriptions arrive as HTML (rich text).
 * Inline colors/fonts pasted from Word/Outlook (e.g. color:black) are
 * stripped so text stays readable on the dark theme; structure
 * (lists, tables, quotes) is preserved. */
export function renderAdoHtml(html: string): string {
  return DOMPurify.sanitize(html || "", { FORBID_ATTR: ["style"] });
}

/** Azure DevOps comments arrive as Markdown (may contain HTML entities). */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md || "", { breaks: true }) as string;
  return DOMPurify.sanitize(html);
}
