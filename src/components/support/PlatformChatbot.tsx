"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import {
  findPlatformAnswer,
  PLATFORM_CHATBOT_INTRO,
  QUICK_PROMPTS,
} from "@/lib/platform-chatbot-knowledge";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function PlatformChatbot() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "intro", role: "assistant", text: PLATFORM_CHATBOT_INTRO },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      const t = window.setTimeout(() => inputRef.current?.focus(), 200);
      return () => window.clearTimeout(t);
    }
  }, [open, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pushAssistant(text: string) {
    setMessages((m) => [...m, { id: uid(), role: "assistant", text }]);
  }

  function sendText(raw: string) {
    const text = raw.trim();
    if (!text || typing) return;

    setMessages((m) => [...m, { id: uid(), role: "user", text }]);
    setInput("");
    setTyping(true);

    const delay = 520 + Math.min(380, text.length * 12);
    window.setTimeout(() => {
      const { text: answer } = findPlatformAnswer(text);
      setTyping(false);
      pushAssistant(answer);
    }, delay);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendText(input);
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-0 right-0 z-[100] flex flex-col items-end p-4 sm:p-5",
        "supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))]",
        "supports-[padding:max(0px)]:pr-[max(1rem,env(safe-area-inset-right))]",
      )}
    >
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Assistant CORREXIA"
          className={cn(
            "platform-chatbot-panel pointer-events-auto mb-3 flex max-h-[min(32rem,70dvh)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] sm:w-[24rem]",
          )}
        >
          <header className="relative flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-3.5 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight">Assistant CORREXIA</p>
              <p className="text-xs text-white/85">Aide sur la plateforme</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/15"
              aria-label="Fermer l’assistant"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </header>

          <div
            ref={listRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className={cn(
                  "platform-chatbot-msg max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto bg-primary-500 text-white shadow-sm"
                    : "mr-auto border border-gray-100 bg-gray-50 text-gray-800",
                )}
                style={{ animationDelay: `${Math.min(i, 6) * 0.03}s` }}
              >
                {msg.text}
              </div>
            ))}

            {typing ? (
              <div
                className="platform-chatbot-typing mr-auto flex items-center gap-1 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                aria-hidden
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              </div>
            ) : null}

            {!typing && messages.length === 1 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    disabled={typing}
                    onClick={() => sendText(q.send)}
                    className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-left text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="pt-1 text-center text-[11px] leading-snug text-gray-400">
              Réponses automatiques — pas un conseil juridique.{" "}
              <Link href="/#contact" className="text-primary-600 underline-offset-2 hover:underline">
                Contact
              </Link>
              {" · "}
              <Link href="/#faq" className="text-primary-600 underline-offset-2 hover:underline">
                FAQ
              </Link>
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-gray-100 bg-gray-50/90 p-3 backdrop-blur-sm"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Votre question…"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
                autoComplete="off"
                maxLength={500}
                aria-label="Message à envoyer"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white shadow-sm transition-transform hover:bg-primary-600 active:scale-[0.97] disabled:opacity-40"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "platform-chatbot-fab-ring pointer-events-auto relative flex h-14 w-14 animate-float items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/35 transition-transform hover:scale-105 active:scale-95",
        )}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Fermer l’assistant CORREXIA" : "Ouvrir l’assistant CORREXIA"}
      >
        {open ? (
          <X className="h-6 w-6" strokeWidth={2} />
        ) : (
          <MessageCircle className="h-6 w-6" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
