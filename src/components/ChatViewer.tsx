import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { parseChat, getAuthors, type ChatMessage } from "@/lib/whatsapp-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Search, Calendar, MessageSquare, Send, Inbox, X, Lock } from "lucide-react";

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateHeader(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yest.toDateString()) return "Yesterday";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
function parseDisplayDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function ChatViewer() {

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [me, setMe] = useState<string>("");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const authors = useMemo(() => getAuthors(messages), [messages]);

  useEffect(() => {
    if (!me && authors.length > 0) {
      // default "me" to the author with fewest messages (often the exporter sends more, but offer choice)
      setMe(authors[authors.length - 1]);
    }
  }, [authors, me]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, query]);

  const stats = useMemo(() => {
    let sent = 0,
      received = 0;
    for (const m of messages) {
      if (m.isSystem || !m.author) continue;
      if (m.author === me) sent++;
      else received++;
    }
    return { total: messages.filter((m) => !m.isSystem).length, sent, received };
  }, [messages, me]);

  async function handleFile(file: File) {
    setError("");
    setLoading(true);
    try {
      let text = "";
      if (file.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);
        const txt = Object.values(zip.files).find(
          (f) => !f.dir && f.name.toLowerCase().endsWith(".txt"),
        );
        if (!txt) throw new Error("No .txt file found inside the .zip");
        text = await txt.async("string");
      } else {
        text = await file.text();
      }
      const parsed = parseChat(text);
      if (parsed.length === 0) throw new Error("Could not parse any messages. Is this a WhatsApp export?");
      setMessages(parsed);
      setFileName(file.name);
      setMe("");
      setQuery("");
      setDateFilter("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read file");
    } finally {
      setLoading(false);
    }
  }

  function jumpToDate(dateStr: string) {
    setDateFilter(dateStr);
    if (!dateStr) return;
    const dateKey = parseDisplayDate(dateStr);
    if (!dateKey) return;
    // find first message with that dateKey
    const target = messages.find((m) => m.dateKey === dateKey);
    if (target) {
      const el = messageRefs.current.get(target.id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.classList.add("ring-2", "ring-primary");
      setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 1500);
    }
  }

  function reset() {

    setMessages([]);
    setFileName("");
    setMe("");
    setQuery("");
    setDateFilter("");
    setError("");
  }

  // Group filtered messages by dateKey
  const grouped = useMemo(() => {
    const groups: { dateKey: string; items: ChatMessage[] }[] = [];
    for (const m of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.dateKey === m.dateKey) last.items.push(m);
      else groups.push({ dateKey: m.dateKey, items: [m] });
    }
    return groups;
  }, [filtered]);

  if (messages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">WhatsApp Chat Viewer</h1>
            <p className="mt-2 text-muted-foreground">
              Upload an exported WhatsApp chat to view it in a clean, searchable interface.
            </p>
          </div>

          <label
            htmlFor="file-input"
            className="block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center transition-colors hover:border-primary hover:bg-accent"
          >
            <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">Click to upload a .txt or .zip export</p>
            <p className="mt-1 text-sm text-muted-foreground">
              In WhatsApp: Chat → More → Export chat → Without media
            </p>
            <input
              id="file-input"
              type="file"
              accept=".txt,.zip,text/plain,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>

          {loading && <p className="mt-4 text-center text-sm text-muted-foreground">Parsing…</p>}
          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span>100% local. Your chats never leave your device.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-chat-bg">
      {/* Header */}
      <header className="flex flex-col gap-2 border-b border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-semibold">{fileName}</h1>
            <p className="text-xs text-muted-foreground">
              {stats.total} messages · {stats.sent} sent · {stats.received} received
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          {authors.length > 1 && (
            <select
              value={me}
              onChange={(e) => setMe(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Select which side is you"
            >
              {authors.map((a) => (
                <option key={a} value={a}>
                  I am: {a}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={reset}>
            <X className="h-4 w-4" /> Close
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border bg-card px-4 py-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search messages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="dd/mm/yyyy"
            value={dateFilter}
            onChange={(e) => jumpToDate(e.target.value)}
            className="pl-9 sm:w-48"
          />

        </div>
      </div>

      {/* Stats strip on mobile */}
      <div className="grid grid-cols-3 gap-px bg-border sm:hidden">
        <StatCell icon={<MessageSquare className="h-3.5 w-3.5" />} label="Total" value={stats.total} />
        <StatCell icon={<Send className="h-3.5 w-3.5" />} label="Sent" value={stats.sent} />
        <StatCell icon={<Inbox className="h-3.5 w-3.5" />} label="Received" value={stats.received} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-4 sm:px-6">
        {filtered.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">No messages match your search.</p>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          {grouped.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-1">
              <div className="my-3 flex justify-center">
                <span className="rounded-md bg-date-pill px-3 py-1 text-xs font-medium text-date-pill-foreground shadow-sm">
                  {formatDateHeader(group.dateKey)}
                </span>
              </div>
              {group.items.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMe={m.author === me}
                  highlight={query.trim()}
                  registerRef={(el) => {
                    if (el) messageRefs.current.set(m.id, el);
                    else messageRefs.current.delete(m.id);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-card py-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-300 px-0.5 text-foreground">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function MessageBubble({
  message,
  isMe,
  highlight,
  registerRef,
}: {
  message: ChatMessage;
  isMe: boolean;
  highlight: string;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  if (message.isSystem) {
    return (
      <div ref={registerRef} className="my-2 flex justify-center">
        <span className="rounded-md bg-date-pill px-3 py-1 text-xs text-date-pill-foreground shadow-sm">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div ref={registerRef} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[85%] rounded-lg px-3 py-1.5 shadow-sm sm:max-w-[70%] ${
          isMe ? "bg-bubble-out text-bubble-out-foreground" : "bg-bubble-in text-bubble-in-foreground"
        }`}
      >
        {!isMe && message.author && (
          <div className="mb-0.5 text-xs font-semibold text-primary">{message.author}</div>
        )}
        <div className="whitespace-pre-wrap break-words text-sm">
          {highlightText(message.content, highlight)}
        </div>
        <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
          {formatTime(message.date)}
        </div>
      </div>
    </div>
  );
}
