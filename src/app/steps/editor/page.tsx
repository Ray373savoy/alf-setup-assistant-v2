"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

export default function EditorPage() {
  const router = useRouter();
  const {
    taskJson, setTaskJson,
    systemSelection,
    editorChatHistory, addEditorChatMessage,
    completeStep, setCurrentStep,
  } = useAppStore();

  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    if (!chatInput.trim() || sending || !taskJson) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput, timestamp: Date.now() };
    addEditorChatMessage(userMsg);
    const feedback = chatInput;
    setChatInput("");
    setSending(true);

    try {
      const res = await fetch("/api/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskJson, systemSelection, feedback,
          chatHistory: editorChatHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTaskJson(data.taskJson);
      addEditorChatMessage({
        role: "assistant", content: data.assistantMessage, timestamp: Date.now(),
      });
    } catch (e) {
      addEditorChatMessage({
        role: "assistant",
        content: `修正に失敗しました: ${e instanceof Error ? e.message : "不明なエラー"}`,
        timestamp: Date.now(),
      });
    } finally {
      setSending(false);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  if (!taskJson) {
    return (
      <div className="page-body">
        <div className="page-header"><h2>タスクエディタ</h2></div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>Task JSONがありません。Step 3から始めてください。</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => router.push("/steps/flow")}>
            ← フロー可視化へ
          </button>
        </div>
      </div>
    );
  }

  const nodes = taskJson.task.nodes;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        background: "var(--card-bg)", borderBottom: "1px solid var(--border)",
        padding: "9px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Step 5 — タスクエディタ</div>
        <div style={{ display: "flex", gap: 7 }}>
          <button className="btn btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }}
            onClick={() => router.push("/steps/validation")}>← 検証へ戻る</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Node list (React Flow placeholder) */}
        <div style={{ flex: 6, borderRight: "1px solid var(--border)", overflow: "auto", background: "#f8f9fb", position: "relative" }}>
          <div style={{ padding: 14 }}>
            <div style={{
              position: "sticky", top: 0, background: "rgba(248,249,251,0.95)",
              paddingBottom: 8, marginBottom: 8, fontSize: 11,
              color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
            }}>
              {nodes.length}ノード — React Flow ビジュアルエディタは開発中です。現在はノード一覧で確認できます。
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nodes.map((node) => {
                const colors: Record<string, { bg: string; border: string; label: string }> = {
                  agent:   { bg: "#fff", border: "#d1d5db", label: "Agent" },
                  code:    { bg: "#FFF9DB", border: "#F0D060", label: "Code" },
                  message: { bg: "#DBEAFE", border: "#93C5FD", label: "Message" },
                  userChatInlineAction: { bg: "#D1FAE5", border: "#6EE7B7", label: "Action" },
                };
                const c = colors[node.type] ?? { bg: "#f3f4f6", border: "#d1d5db", label: node.type };
                return (
                  <div key={node.id} style={{
                    border: `1.5px solid ${c.border}`, borderRadius: 10,
                    background: c.bg, overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "7px 12px", borderBottom: `0.5px solid ${c.border}`,
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 12, fontWeight: 500,
                    }}>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: c.border, color: "#374151" }}>
                        {c.label}
                      </span>
                      <span>{node.name}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {node.id} / {node.key}
                      </span>
                    </div>
                    {node.instruction && (
                      <div style={{ padding: "7px 12px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7, maxHeight: 80, overflow: "hidden" }}>
                        {node.instruction.slice(0, 200)}{node.instruction.length > 200 ? "..." : ""}
                      </div>
                    )}
                    {node.code && (
                      <div style={{ padding: "7px 12px", fontSize: 10, color: "#92400e", fontFamily: "monospace", maxHeight: 60, overflow: "hidden", whiteSpace: "pre-wrap" }}>
                        {node.code.slice(0, 150)}{node.code.length > 150 ? "..." : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Chat */}
        <div style={{ flex: 4, display: "flex", flexDirection: "column", background: "var(--card-bg)" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
            自然言語で修正
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {editorChatHistory.length === 0 && (
              <div style={{
                fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7,
                background: "var(--bg)", borderRadius: 8, padding: "10px 12px",
                borderLeft: "2px solid #6c5ce7",
              }}>
                修正したいことを自然言語で入力してください。例: 「Aノードのinstructionに再試行処理を追加」
              </div>
            )}
            {editorChatHistory.map((msg, i) => (
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
                <span className="spinner" style={{ width: 12, height: 12 }} /> Task JSON修正中...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 7, alignItems: "flex-end" }}>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="修正内容を入力... (Shift+Enterで改行)"
              style={{
                flex: 1, fontSize: 12, padding: "7px 10px", border: "1px solid var(--border)",
                borderRadius: 6, background: "var(--bg)", resize: "none", height: 34,
                fontFamily: "inherit", color: "var(--text-primary)",
              }}
            />
            <button onClick={handleSend} disabled={!chatInput.trim() || sending}
              style={{ width: 30, height: 30, background: "#6c5ce7", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M13 8H3M10 5l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="step-dots">
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} className={`step-dot ${n === 5 ? "active" : n < 5 ? "done" : ""}`} />
            ))}
          </div>
          <span className="step-label">Step 5 / 6</span>
        </div>
        <button className="btn btn-primary" onClick={() => {
          completeStep(5); setCurrentStep(6); router.push("/steps/download");
        }}>
          ダウンロードへ進む
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 8h8M9 5l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
