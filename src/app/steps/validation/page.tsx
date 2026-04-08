"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { ValidationResult } from "@/lib/types";

const CHECKS = [
  { key: "S01", label: "Task名の形式確認" },
  { key: "S02", label: "トリガーの形式確認" },
  { key: "S03", label: "ノード数・startNodeId確認" },
  { key: "S10", label: "ノードID・keyの一意性確認" },
  { key: "S11", label: "ノード間参照の整合性確認" },
  { key: "S20", label: "前方向フロー（ループバック禁止）確認" },
];

export default function ValidationPage() {
  const router = useRouter();
  const { taskJson, validationResult, setValidationResult, completeStep, setCurrentStep } = useAppStore();

  const [runningIdx, setRunningIdx] = useState(-1);
  const [result, setResult] = useState<ValidationResult | null>(validationResult);
  const [autoAdvance, setAutoAdvance] = useState(false);

  useEffect(() => {
    if (!taskJson) { router.push("/steps/input"); return; }
    if (!result) runValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoAdvance) {
      const timer = setTimeout(() => {
        completeStep(4);
        setCurrentStep(5);
        router.push("/steps/editor");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [autoAdvance, completeStep, setCurrentStep, router]);

  async function runValidation() {
    setResult(null);
    setRunningIdx(0);

    // チェックを順番にアニメーション表示
    for (let i = 0; i < CHECKS.length; i++) {
      setRunningIdx(i);
      await new Promise((r) => setTimeout(r, 350));
    }

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskJson }),
      });
      const data: ValidationResult = await res.json();
      setResult(data);
      setValidationResult(data);
      setRunningIdx(CHECKS.length);
      if (data.passed) setAutoAdvance(true);
    } catch {
      setResult({ passed: false, errors: ["検証サーバーへの接続に失敗しました"], warnings: [] });
      setRunningIdx(CHECKS.length);
    }
  }

  const isRunning = runningIdx < CHECKS.length && !result;

  function getCheckState(idx: number): "pass" | "fail" | "running" | "pending" {
    if (!result) {
      if (idx < runningIdx) return "pass";
      if (idx === runningIdx) return "running";
      return "pending";
    }
    if (!result.passed) {
      const errKeys = result.errors.map((e) => e.slice(0, 3));
      if (errKeys.includes(CHECKS[idx].key)) return "fail";
    }
    return "pass";
  }

  return (
    <>
      <div className="page-body">
        <div className="page-header">
          <h2>検証</h2>
          <p>生成されたTask JSONをインポート前に自動検証します。</p>
        </div>

        <div className="card">
          <div className="card-title">
            <div className="spinner" style={{ width: 14, height: 14, display: isRunning ? "block" : "none" }} />
            {result?.passed && "✓ "}
            {result && !result.passed && "✕ "}
            検証チェック
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CHECKS.map((check, idx) => {
              const state = getCheckState(idx);
              return (
                <div key={check.key} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  borderRadius: 7, fontSize: 12,
                  background: state === "pass" ? "rgba(16,185,129,0.07)"
                    : state === "fail" ? "rgba(239,68,68,0.07)"
                    : "var(--bg)",
                  color: "var(--text-secondary)",
                  transition: "background 0.3s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0,
                    background: state === "pass" ? "#10b981" : state === "fail" ? "#ef4444" : "transparent",
                    border: state === "running" ? "1.5px solid #94a3b8" : "none",
                    color: "#fff",
                  }}>
                    {state === "pass" && "✓"}
                    {state === "fail" && "✕"}
                    {state === "running" && <div className="spinner" style={{ width: 10, height: 10 }} />}
                  </div>
                  {check.label}
                </div>
              );
            })}
          </div>

          {/* 通過時 */}
          {result?.passed && (
            <div style={{
              marginTop: 14, padding: "10px 14px", background: "rgba(16,185,129,0.07)",
              border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 7,
              fontSize: 12, color: "#0F6E56", display: "flex", alignItems: "center", gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#0F6E56" strokeWidth="1.3" />
                <path d="M8 3v4l3 3" stroke="#0F6E56" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              すべてのチェックが通過しました。2.5秒後に自動でStep 5へ進みます...
              <div style={{ flex: 1, height: 3, background: "rgba(16,185,129,0.15)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "#10b981", borderRadius: 2,
                  animation: "progress 2.5s linear forwards",
                }} />
              </div>
            </div>
          )}

          {/* エラー時 */}
          {result && !result.passed && (
            <div style={{
              marginTop: 14, padding: "12px 14px", background: "rgba(239,68,68,0.07)",
              border: "0.5px solid rgba(239,68,68,0.25)", borderRadius: 7,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>
                エラー詳細
              </div>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: "#b91c1c", lineHeight: 1.8 }}>{e}</div>
              ))}
              {result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: "#92400e", lineHeight: 1.8 }}>⚠ {w}</div>
              ))}
              <div style={{ marginTop: 10, display: "flex", gap: 7 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12 }}
                  onClick={() => router.push("/steps/flow")}>
                  ← Step 3で修正する
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 12 }}
                  onClick={() => router.push("/steps/editor")}>
                  Step 5で直接修正する →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Warnings（エラーなしの場合） */}
        {result?.passed && result.warnings.length > 0 && (
          <div className="card" style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.04)" }}>
            <div className="card-title" style={{ color: "#92400e" }}>警告（インポートは可能）</div>
            {result.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: "#92400e", lineHeight: 1.8 }}>⚠ {w}</div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes progress { from { width: 0 } to { width: 100% } }`}</style>

      <div className="bottom-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="step-dots">
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} className={`step-dot ${n === 4 ? "active" : n < 4 ? "done" : ""}`} />
            ))}
          </div>
          <span className="step-label">Step 4 / 6</span>
        </div>
        <button className="btn btn-secondary" onClick={() => router.push("/steps/flow")}>
          ← 戻る
        </button>
      </div>
    </>
  );
}
