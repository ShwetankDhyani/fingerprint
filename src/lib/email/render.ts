import { siteConfig } from "@/lib/site";

export type EmailButton = { label: string; href: string };

export type EmailBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "keyValue"; rows: Array<[string, string]> }
  | { kind: "callout"; text: string }
  | { kind: "code"; text: string }
  | { kind: "section"; title: string };

export type EmailContent = {
  preheader?: string;
  heading: string;
  blocks: EmailBlock[];
  button?: EmailButton;
  footerNote?: string;
};

const INK = "#0b1210";
const PANEL = "#121a17";
const BORDER = "#24302b";
const TEXT = "#e8eee9";
const MUTED = "#9aaba2";
const GOLD = "#d4b45a";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blockToHtml(block: EmailBlock): string {
  switch (block.kind) {
    case "section":
      return `<p style="margin:24px 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD}">${escapeHtml(
        block.title,
      )}</p>`;
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT}">${escapeHtml(
        block.text,
      )}</p>`;
    case "list":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-collapse:collapse">${block.items
        .map(
          (item) =>
            `<tr><td style="width:18px;vertical-align:top;padding:4px 0;font-size:15px;line-height:1.55;color:${GOLD}">•</td><td style="padding:4px 0;font-size:15px;line-height:1.55;color:${TEXT}">${escapeHtml(
              item,
            )}</td></tr>`,
        )
        .join("")}</table>`;
    case "keyValue":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-collapse:separate;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;background:${INK}"><tr><td style="padding:4px 16px">${block.rows
        .map(
          ([key, value], index) =>
            `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse${
              index < block.rows.length - 1
                ? `;border-bottom:1px solid ${BORDER}`
                : ""
            }"><tr><td style="padding:12px 0;font-size:13px;color:${MUTED}">${escapeHtml(
              key,
            )}</td><td style="padding:12px 0;font-size:14px;color:${TEXT};text-align:right;font-weight:600">${escapeHtml(
              value,
            )}</td></tr></table>`,
        )
        .join("")}</td></tr></table>`;
    case "callout":
      return `<div style="margin:0 0 18px;padding:16px 18px;border:1px solid ${BORDER};border-left:3px solid ${GOLD};border-radius:10px;background:${INK};font-size:14px;line-height:1.65;color:${TEXT}">${escapeHtml(
        block.text,
      )}</div>`;
    case "code":
      return `<p style="margin:0 0 16px;padding:12px 14px;border:1px solid ${BORDER};border-radius:8px;background:${INK};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:${GOLD};word-break:break-all">${escapeHtml(
        block.text,
      )}</p>`;
  }
}

function blockToText(block: EmailBlock): string {
  switch (block.kind) {
    case "section":
      return `\n${block.title.toUpperCase()}`;
    case "paragraph":
      return block.text;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "keyValue":
      return block.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    case "callout":
      return block.text;
    case "code":
      return block.text;
  }
}

export function renderEmail(content: EmailContent) {
  const year = new Date().getFullYear();
  const preheader = content.preheader ?? content.heading;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    content.heading,
  )}</title></head>
<body style="margin:0;padding:0;background:${INK};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${INK};padding:32px 12px">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${PANEL};border:1px solid ${BORDER};border-radius:14px;overflow:hidden">
      <tr><td style="padding:28px 28px 8px">
        <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${GOLD}">${escapeHtml(
          siteConfig.name,
        )}</p>
        <h1 style="margin:10px 0 8px;font-size:22px;line-height:1.3;color:${TEXT};font-weight:600">${escapeHtml(
          content.heading,
        )}</h1>
      </td></tr>
      <tr><td style="padding:0 28px 8px">
        ${content.blocks.map(blockToHtml).join("")}
        ${
          content.button
            ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 12px"><tr><td style="border-radius:10px;background:${GOLD}"><a href="${escapeHtml(
                content.button.href,
              )}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:${INK};text-decoration:none;border-radius:10px">${escapeHtml(
                content.button.label,
              )}</a></td></tr></table>
               <p style="margin:0 0 20px;font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all">Or paste this link:<br>${escapeHtml(
                 content.button.href,
               )}</p>`
            : ""
        }
      </td></tr>
      <tr><td style="padding:8px 28px 28px;border-top:1px solid ${BORDER}">
        ${
          content.footerNote
            ? `<p style="margin:16px 0 8px;font-size:12px;line-height:1.6;color:${MUTED}">${escapeHtml(
                content.footerNote,
              )}</p>`
            : ""
        }
        <p style="margin:8px 0 0;font-size:12px;line-height:1.7;color:${MUTED}">
          ${escapeHtml(siteConfig.name)} · <a href="${siteConfig.url}" style="color:${GOLD};text-decoration:none">${escapeHtml(
            siteConfig.url.replace(/^https?:\/\//, ""),
          )}</a><br>
          ${escapeHtml(siteConfig.email)} · ${escapeHtml(siteConfig.phones[0])}<br>
          © ${year} ${escapeHtml(siteConfig.name)}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    content.heading,
    "",
    ...content.blocks.map(blockToText),
    content.button ? `\n${content.button.label}: ${content.button.href}` : "",
    "",
    content.footerNote ?? "",
    "",
    `— ${siteConfig.name} · ${siteConfig.url}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}
