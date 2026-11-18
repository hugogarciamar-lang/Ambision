/**
 * Apps shown in the Coverage ring, in ring order (similar apps spread apart).
 * Add/remove entries here. `logo` must be an official, unmodified brand asset in /public/logos;
 * entries with `logo: null` are still announced to screen readers but skipped in the ring.
 * `word` links an app to a rotating word so its tile highlights when that word appears.
 *
 * Sources:
 *  - Chrome: google.com/chrome · Gmail, Sheets, Docs: Google product-logo CDN (gstatic)
 *  - Excel, Word, PowerPoint, Outlook, Teams: Microsoft Fluent brand icons (Office CDN)
 *  - VS Code: code.visualstudio.com/brand icon pack · Firefox: mozilla.org · Slack: slack.com
 *  - Spotify, WhatsApp, Zoom, Notion: simple-icons (CC0) — these brands' official logos are single-colour
 */
export type App = { name: string; logo: string | null; word?: string };

export const APPS: App[] = [
  { name: "Google Chrome", logo: "/logos/chrome.svg", word: "browsing" },
  { name: "Microsoft Excel", logo: "/logos/excel.svg", word: "spreadsheets" },
  { name: "Gmail", logo: "/logos/gmail.svg", word: "emails" },
  { name: "Visual Studio Code", logo: "/logos/vscode.svg", word: "code" },
  { name: "Microsoft Teams", logo: "/logos/teams.svg", word: "meetings" },
  { name: "Spotify", logo: "/logos/spotify.svg", word: "music" },
  { name: "Microsoft Word", logo: "/logos/word.svg", word: "documents" },
  { name: "WhatsApp", logo: "/logos/whatsapp.svg", word: "messages" },
  { name: "Slack", logo: "/logos/slack.svg" },
  { name: "Google Sheets", logo: "/logos/sheets.svg" },
  { name: "Zoom", logo: "/logos/zoom.svg", word: "meetings" },
  { name: "Microsoft Outlook", logo: "/logos/outlook.svg" },
  { name: "Notion", logo: "/logos/notion.svg" },
  { name: "Mozilla Firefox", logo: "/logos/firefox.svg" },
  { name: "Microsoft PowerPoint", logo: "/logos/powerpoint.svg" },
  { name: "Google Docs", logo: "/logos/docs.svg" },
  // TODO: add the official SVG from Adobe's brand portal as /public/logos/acrobat-reader.svg
  { name: "Adobe Acrobat Reader", logo: null },
  // TODO: no public brand asset exists for Finder / File Explorer; add one only with permission.
  { name: "Finder / File Explorer", logo: null },
];

export const WORDS = ["spreadsheets", "emails", "code", "meetings", "documents", "browsing", "messages", "music"];

export const RING_APPS = APPS.filter((a): a is App & { logo: string } => !!a.logo);
export const MOBILE_COUNT = 10;
