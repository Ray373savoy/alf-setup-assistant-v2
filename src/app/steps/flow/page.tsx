"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { ChatMessage } from "@/lib/types";

export default function FlowPage() {
  const router = useRouter();
  const t = useT();
  const {
    inputText, systemSelection, qaAnswers,
    taskJson, setTaskJson,
    mermaidCode, setMermaidCode,
    chatHistory, addChatMessage,
    completeStep, setCurrentStep,
  } = useAppStore();

  const [generating, setGenerating] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inputText.trim()) { router.push("/steps/input"); return; }
    if (!taskJson) generateFlow();
    else if (mermaidCode) renderMermaid(mermaidCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  async function generateFlow(feedback?: string) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText, systemSelection, qaAnswers, chatFeedback: feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTaskJson(data.taskJson);
      setMermaidCode(data.mermaidCode);
      renderMermaid(data.mermaidCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function renderMermaid(code: string) {
    if (!mermaidRef.current || !code) return;
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, code);
      if (mermaidRef.current) mermaidRef.current.innerHTML = svg;
    } catch (e) {
      console.error("Mermaid render error:", e);
    }
  }

  async function handleChatSend() {
    if (!chatInput.trim() || sending) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput, timestamp: Date.now() };
    addChatMessage(userMsg);
    const feedback = chatInput;
    setChatInput("");
    setSending(true);

    try {
      await generateFlow(feedback);
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: t.flow.modifySuccess,
        timestamp: Date.now(),
      };
      addChatMessage(aiMsg);
    } catch {
      const aiMsg: ChatMessage = { role: "assistant", content: t.flow.modifyFail, timestamp: Date.now() };
      addChatMessage(aiMsg);
    } finally {
      setSending(false);
    }
  }

  const SUGGESTIONS = t.flow.suggestions;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Topbar */}
      <div style={{
        background: "var(--card-bg)", borderBottom: "1px solid var(--border)",
        padding: "9px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
          {t.flow.heading}
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }}
            onClick={() => router.push("/steps/analysis")}>{t.common.back}</button>
          <button className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }}
            onClick={() => generateFlow()} disabled={generating}>
            {generating ? t.flow.generating : t.flow.regenerate}
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Mermaid */}
        <div style={{ flex: 6, borderRight: "1px solid var(--border)", padding: 16, overflow: "auto", background: "#f8f9fb", position: "relative" }}>
          <div style={{ position: "absolute", top: 8, left: 8, fontSize: 10, background: "rgba(29,158,117,0.1)", color: "#0F6E56", border: "0.5px solid rgba(29,158,117,0.3)", padding: "2px 7px", borderRadius: 4 }}>
            {t.flow.mermaidPreview}
          </div>

          {generating && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.flow.generatingJson}</p>
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, color: "var(--danger)", fontSize: 13 }}>
              {error}
            </div>
          )}

          {!generating && mermaidCode && (
            <div ref={mermaidRef} style={{ marginTop: 28, textAlign: "center" }} />
          )}

          {!generating && !mermaidCode && !error && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 13 }}>
              {t.flow.generatePrompt}
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div style={{ flex: 4, display: "flex", flexDirection: "column", background: "var(--card-bg)" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
            {t.flow.chatTitle}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {chatHistory.length === 0 && (
              <div style={{
                fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7,
                background: "var(--bg)", borderRadius: 8, padding: "10px 12px",
                borderLeft: "2px solid #6c5ce7",
              }}>
                {t.flow.chatInitial}
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} style={{
                maxWidth: "88%", fontSize: 12, lineHeight: 1.6, padding: "7px 10px",
                borderRadius: 8,
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#6c5ce7" : "var(--bg)",
                color: msg.role === "user" ? "#fff" : "var(--text-secondary)",
              }}>
                {msg.content}
              </div>
            ))}
            {sending && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="spinner" style={{ width: 12, height: 12 }} /> {t.flow.modifying}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggestion chips */}
          <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 5 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setChatInput(s)} style={{
                fontSize: 10, padding: "3px 8px", borderRadius: 12, cursor: "pointer",
                border: "0.5px solid rgba(108,92,231,0.3)", color: "#6c5ce7",
                background: "rgba(108,92,231,0.05)",
              }}>{s}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 7, alignItems: "flex-end" }}>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
              placeholder={t.flow.chatPlaceholder}
              style={{
                flex: 1, fontSize: 12, padding: "7px 10px", border: "1px solid var(--border)",
                borderRadius: 6, background: "var(--bg)", resize: "none", height: 34,
                fontFamily: "inherit", color: "var(--text-primary)",
              }}
            />
            <button onClick={handleChatSend} disabled={!chatInput.trim() || sending}
              style={{ width: 30, height: 30, background: "#6c5ce7", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M13 8H3M10 5l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="step-dots">
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} className={`step-dot ${n === 3 ? "active" : n < 3 ? "done" : ""}`} />
            ))}
          </div>
          <span className="step-label">{t.flow.stepLabel}</span>
        </div>
        <button
          className="btn btn-primary"
          disabled={!taskJson || generating}
          onClick={() => { completeStep(3); setCurrentStep(4); router.push("/steps/validation"); }}
        >
          {t.flow.nextButton}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 8h8M9 5l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
