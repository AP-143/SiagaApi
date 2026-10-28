import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { useChat } from "./chat";
import Collapsible from "./Collapsible";
import type { Filters } from "./filters";
import { ChatIcon } from "./icons";

const MAX_LENGTH = 500; // what the server accepts

type Props = {
  open: boolean;
  onToggle: () => void;
  /** Put the map on the view an answer is about. */
  onShowOnMap: (filters: Filters) => void;
};

/** Ask questions about the Hotspots in plain words. Answers are computed by the server from the same data as the map. */
export default function ChatPanel({ open, onToggle, onShowOnMap }: Props) {
  const { messages, busy, aiOn, ask } = useChat();
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Once a conversation is under way: a question just sent goes to the bottom, with the wait under
  // it; an answer is read from its first line, so the log goes to the top of the answer rather than
  // to its end. Before that, the greeting is all there is and is read from its first line.
  useEffect(() => {
    const log = logRef.current;
    if (!log || (messages.length <= 1 && !busy)) return;
    const newest = messages[messages.length - 1];
    const answer =
      newest.role === "assistant" && !busy
        ? log.querySelector<HTMLElement>(`[data-message-id="${newest.id}"]`)
        : null;
    log.scrollTop = answer ? Math.max(0, answer.offsetTop - 4) : log.scrollHeight;
  }, [messages, busy]);

  const canSend = !busy && draft.trim() !== "";

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    const question = draft.trim();
    setDraft("");
    void ask(question);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter writes a new line.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const last = messages[messages.length - 1];

  return (
    <section className="card chat-panel">
      <Collapsible label="Tanya" icon={<ChatIcon />} open={open} onToggle={onToggle}>
        <div className="chat-log" role="log" aria-label="Percakapan" aria-live="polite" ref={logRef}>
          {messages.map((message) => (
            <div key={message.id} data-message-id={message.id} className={`chat-message chat-${message.role}`}>
              {/* Plain text only: an answer can never become markup, and line breaks are kept. */}
              <p style={{ whiteSpace: "pre-line" }}>{message.text}</p>
              {message.ranking && (
                <ol className="ranking">
                  {message.ranking.map((row, index) => (
                    <li key={index}>
                      <span className="rank-name">{row.name}</span>
                      <span className="rank-count">{row.count}</span>
                    </li>
                  ))}
                </ol>
              )}
              {message.tail && (
                <p className="ranking-note" style={{ whiteSpace: "pre-line" }}>
                  {message.tail}
                </p>
              )}
              {message.modelWritten && (
                <>
                  <p className="ai-label">Dijawab AI dari sumber di bawah</p>
                  <blockquote className="chat-quote" style={{ whiteSpace: "pre-line" }}>
                    {message.quote}
                  </blockquote>
                </>
              )}
              {(message.sourceNote || message.sourceLinks?.length) && (
                <p className="source-note">
                  {message.sourceNote}
                  {message.sourceLinks?.map((href) => (
                    <a key={href} className="source-link" href={href} target="_blank" rel="noopener noreferrer">
                      Buka sumber
                    </a>
                  ))}
                </p>
              )}
              {message.simpleMode && (
                <p className="simple-mode-note">
                  Mode sederhana: asisten AI sedang tidak tersedia, jadi jawaban ini dari aturan baku.
                </p>
              )}
              {message.view && (
                <button
                  type="button"
                  className="chip-button map-button"
                  onClick={() => onShowOnMap(message.view!)}
                >
                  Tampilkan di peta
                </button>
              )}
            </div>
          ))}
          {busy && (
            <div className="chat-message chat-assistant chat-typing">
              <p>Sedang menjawab…</p>
            </div>
          )}
          {/* Follow-up choices belong to the conversation, right after the message they answer. */}
          {last.role === "assistant" && !busy && (
            <div className="chat-chips">
              {last.choices?.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  className="chip-button"
                  onClick={() => void ask(choice.label, choice.message)}
                >
                  {choice.label}
                </button>
              ))}
              {last.suggestions?.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip-button"
                  onClick={() => void ask(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <form className="chat-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-question">
            Pertanyaan
          </label>
          <textarea
            id="chat-question"
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder="Tulis pertanyaan…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="submit" className="send-button" disabled={!canSend}>
            Kirim
          </button>
        </form>

        <p className="chat-note">
          Titik api adalah deteksi satelit, belum tentu kebakaran.
        </p>
        {aiOn && (
          <p className="chat-privacy">
            Pertanyaan diproses layanan AI pihak ketiga. Jangan menulis data pribadi.
          </p>
        )}
      </Collapsible>
    </section>
  );
}
