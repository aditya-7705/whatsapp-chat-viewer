export interface ChatMessage {
  id: number;
  date: Date;
  dateKey: string; // YYYY-MM-DD
  author: string | null; // null for system messages
  content: string;
  isSystem: boolean;
}

// Matches lines like:
// "12/06/24, 14:32 - Alice: Hello"
// "[12/06/2024, 14:32:11] Alice: Hello"
// "6/12/24, 2:32 PM - Alice: Hello"
const LINE_REGEXES = [
  // [DD/MM/YYYY, HH:MM:SS] Author: message  (iOS)
  /^\[(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\]\s?(.*)$/,
  // DD/MM/YY, HH:MM - Author: message  (Android)
  /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*[-–]\s?(.*)$/,
];

function parseDate(d: string, m: string, y: string, hh: string, mm: string, ss: string | undefined, ampm: string | undefined): Date {
  let day = parseInt(d, 10);
  let month = parseInt(m, 10) - 1;
  let year = parseInt(y, 10);
  if (year < 100) year += 2000;
  let hour = parseInt(hh, 10);
  const minute = parseInt(mm, 10);
  const second = ss ? parseInt(ss, 10) : 0;
  if (ampm) {
    const isPM = ampm.toLowerCase() === "pm";
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
  }
  return new Date(year, month, day, hour, minute, second);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseChat(text: string): ChatMessage[] {
  // Normalize line endings and strip LRM/RTL marks WhatsApp inserts
  const cleaned = text.replace(/\r\n/g, "\n").replace(/[\u200E\u200F\u202A-\u202E]/g, "");
  const lines = cleaned.split("\n");
  const messages: ChatMessage[] = [];
  let id = 0;

  for (const rawLine of lines) {
    let matched: RegExpMatchArray | null = null;
    let rest = "";
    let date: Date | null = null;

    for (const re of LINE_REGEXES) {
      const m = rawLine.match(re);
      if (m) {
        matched = m;
        date = parseDate(m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
        rest = m[8] ?? "";
        break;
      }
    }

    if (!matched || !date || isNaN(date.getTime())) {
      // continuation of previous message
      if (messages.length > 0 && rawLine.length > 0) {
        messages[messages.length - 1].content += "\n" + rawLine;
      }
      continue;
    }

    // rest is "Author: content" OR a system message
    const colonIdx = rest.indexOf(": ");
    let author: string | null = null;
    let content = rest;
    let isSystem = false;
    if (colonIdx > 0 && colonIdx < 80) {
      author = rest.slice(0, colonIdx).trim();
      content = rest.slice(colonIdx + 2);
    } else {
      isSystem = true;
    }

    messages.push({
      id: id++,
      date,
      dateKey: dateKey(date),
      author,
      content,
      isSystem,
    });
  }

  return messages;
}

export function getAuthors(messages: ChatMessage[]): string[] {
  const set = new Set<string>();
  for (const m of messages) if (m.author) set.add(m.author);
  return Array.from(set);
}
