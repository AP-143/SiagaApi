import { useRef, useState } from "react";

import { ChatError, type ChatReply, sendChat } from "./api";
import { type Filters, TIME_WINDOWS } from "./filters";

export type Choice = { label: string; message: string };

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** "Sumber: ..." of a quoted answer, shown apart from the quoted text. */
  sourceNote?: string;
  /** The rows of a ranking answer, shown as a list; `text` is then only its introduction. */
  ranking?: RankedRow[];
  /** What follows a ranking's list: when the data was updated, and the caveat. */
  tail?: string;
  /** The map filters that reproduce what this answer is about, when it is about a view of the map. */
  view?: Filters;
  /** Questions the person can tap to ask next. */
  suggestions?: string[];
  /** Places to choose from when the question was ambiguous. */
  choices?: Choice[];
  /** Web addresses of the documents a quoted answer comes from. Only plain http(s) ever gets here. */
  sourceLinks?: string[];
};

export const GREETING =
  "Halo! Tanyakan jumlah titik api per wilayah, peringkat kabupaten/kota, kapan data diperbarui, " +
  "atau arti istilah seperti hotspot dan gambut.";

// The same four questions the API suggests when it cannot answer (backend/app/chat/understanding.py,
// SUGGESTIONS). The greeting has to work before any answer has come back, so each side keeps a copy.
export const STARTER_QUESTIONS = [
  "Berapa titik api di Kalimantan Tengah hari ini?",
  "Kabupaten mana yang paling banyak titik apinya?",
  "Apa itu titik api (hotspot)?",
  "Kapan data terakhir diperbarui?",
];

function failureText(error: unknown): string {
  if (error instanceof ChatError && error.status === 429) {
    return error.retryAfterSeconds
      ? `Terlalu banyak pertanyaan. Coba lagi dalam ${error.retryAfterSeconds} detik.`
      : "Terlalu banyak pertanyaan. Coba lagi sebentar lagi.";
  }
  return "Maaf, chat sedang tidak bisa dihubungi. Coba lagi sebentar lagi.";
}

/**
 * The map view an answer describes: the same place, time window, peat and confidence settings the
 * server used to count. Only counts and rankings are about a view; anything incomplete or odd
 * yields null, so the button never sets a view different from the one the answer talked about.
 */
export function filtersFromReply(reply: ChatReply): Filters | null {
  if (reply.kind !== "count" && reply.kind !== "ranking") return null;
  const { area, window, peat_only, include_low } = reply.data as {
    area?: { type?: string; code?: string; province_code?: string };
    window?: string;
    peat_only?: boolean;
    include_low?: boolean;
  };
  const knownWindow = TIME_WINDOWS.find((candidate) => candidate.value === window);
  if (!area || !knownWindow) return null;

  let province: string | null = null;
  let regency: string | null = null;
  if (area.type === "province" && area.code) {
    province = area.code;
  } else if (area.type === "regency" && area.code && area.province_code) {
    province = area.province_code;
    regency = area.code;
  } else if (area.type !== "region") {
    return null;
  }
  return {
    province,
    regency,
    window: knownWindow.value,
    showLowConfidence: include_low === true,
    peatOnly: peat_only === true,
  };
}

/** Addresses that are safe to link: a source is text from outside, so `javascript:` and the like are dropped. */
export function linkableSources(reply: ChatReply): string[] {
  const links: string[] = [];
  for (const source of reply.data.sources ?? []) {
    if (typeof source?.url !== "string") continue;
    try {
      const url = new URL(source.url);
      if (url.protocol === "http:" || url.protocol === "https:") links.push(url.href);
    } catch {
      // not an address at all
    }
  }
  return links;
}

export type RankedRow = { name: string; count: string };

const RANKING_ITEM = /^\d+\. (.+): ([\d.,]+) titik api$/;

/**
 * A ranking answer is an introduction, numbered lines, then notes. The lines are shown as a list of
 * names and counts; the introduction and the notes stay sentences. Anything that does not have that
 * shape is left whole, so a changed wording on the server shows as text rather than as a broken list.
 */
export function splitRanking(reply: ChatReply): { text: string; ranking?: RankedRow[]; tail?: string } {
  if (reply.kind !== "ranking") return { text: reply.answer };
  const lines = reply.answer.split("\n");
  const rows: RankedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const match = RANKING_ITEM.exec(lines[i]);
    if (!match) break;
    rows.push({ name: match[1], count: match[2] });
  }
  if (rows.length === 0) return { text: reply.answer };
  const tail = lines.slice(1 + rows.length).join("\n").trim();
  return { text: lines[0], ranking: rows, tail: tail || undefined };
}

const SOURCE_MARK = "\n\nSumber: ";

/** A quoted answer ends with its source line; it is shown apart so the quotation reads as a quotation. */
export function splitSourceNote(reply: ChatReply): { text: string; sourceNote?: string } {
  const at = reply.kind === "knowledge" ? reply.answer.lastIndexOf(SOURCE_MARK) : -1;
  if (at <= 0) return { text: reply.answer };
  return { text: reply.answer.slice(0, at).trim(), sourceNote: reply.answer.slice(at).trim() };
}

function followUps(reply: ChatReply, asked: string) {
  const choices = (reply.data.candidates ?? []).map((candidate) => ({
    label: candidate.name,
    // The name is added to the original question, so its time window and filters are kept.
    message: `${asked} ${candidate.name}`,
  }));
  // Other passages that fit are offered as questions, worded as the passage's own title.
  const suggestions = reply.data.suggestions ?? reply.data.related;
  return { suggestions, choices: choices.length ? choices : undefined };
}

/** The conversation. It lives only in the page: a reload starts fresh and nothing is stored. */
export function useChat() {
  const nextId = useRef(1);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", text: GREETING, suggestions: STARTER_QUESTIONS },
  ]);
  const [busy, setBusy] = useState(false);

  function add(message: Omit<ChatMessage, "id">) {
    setMessages((current) => [...current, { ...message, id: nextId.current++ }]);
  }

  /** `shown` is what the person sees as their question; `asked` is what is sent to the server. */
  async function ask(shown: string, asked: string = shown) {
    if (busy) return;
    setBusy(true);
    add({ role: "user", text: shown });
    try {
      const reply = await sendChat(asked);
      add({
        role: "assistant",
        ...(reply.kind === "ranking" ? splitRanking(reply) : splitSourceNote(reply)),
        view: filtersFromReply(reply) ?? undefined,
        sourceLinks: linkableSources(reply),
        ...followUps(reply, asked),
      });
    } catch (error) {
      add({ role: "assistant", text: failureText(error) });
    } finally {
      setBusy(false);
    }
  }

  return { messages, busy, ask };
}
