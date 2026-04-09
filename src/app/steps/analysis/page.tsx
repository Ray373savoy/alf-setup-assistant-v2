"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import BottomBar from "@/components/layout/BottomBar";
import type { AnalysisResult } from "@/lib/types";

export default function AnalysisPage() {
  const router = useRouter();
  const t = useT();
  const {
    inputText, systemSelection,
    analysisResult, setAnalysisResult,
    qaAnswers, updateQAAnswer,
    completeStep, setCurrentStep,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inputText.trim()) { router.push("/steps/input"); return; }
    if (!analysisResult) runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText, systemSelection }),
      });
      const data: AnalysisResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error);
      setAnalysisResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }

  const canProceed = qaAnswers.filter((q) => q.required).every((q) => q.answer.trim());

  const handleNext = () => {
    completeStep(2);
    setCurrentStep(3);
    router.push("/steps/flow");
  };

  return (
    <>
      <div className="page-body">
        <div className="page-header">
          <h2>{t.analysis.heading}</h2>
          <p>{t.analysis.description}</p>
        </div>

        {loading && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px" }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{t.analysis.analyzing}</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {t.analysis.analyzingDetail}
            </p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: "var(--danger)", background: "#fef2f2" }}>
            <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
            <button
              className="btn btn-secondary"
              onClick={runAnalysis}
              style={{ marginTop: 10 }}
            >
              {t.common.retry}
            </button>
          </div>
        )}

        {analysisResult && !loading && (
          <>
            {/* 概要 */}
            <div className="card" style={{ background: "rgba(108,92,231,0.04)", borderColor: "rgba(108,92,231,0.2)" }}>
              <p style={{ fontSize: 13, margin: 0, color: "var(--text-secondary)" }}>
                {analysisResult.summary}
              </p>
              {analysisResult.detectedSystems.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  {analysisResult.detectedSystems.map((s) => (
                    <span key={s} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 10,
                      background: "rgba(108,92,231,0.1)", color: "#6c5ce7"
                    }}>{s}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Q&A */}
            <div className="card">
              <div className="card-title">
                {t.analysis.requirementsCheck}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: "auto" }}>
                  {t.common.required} {qaAnswers.filter((q) => q.required).length}{t.analysis.requiredCount} {qaAnswers.filter((q) => !q.required).length}問
                </span>
              </div>

              <p style={{ fontSize: 11, color: "#92400e", background: "rgba(245,158,11,0.07)", padding: "7px 12px", borderRadius: 6, margin: "0 0 14px 0", lineHeight: 1.6 }}>
                ⚠ {t.analysis.confirmLaterHint}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {qaAnswers.map((q) => (
                  <div key={q.id} style={{ borderLeft: `2px solid ${q.required ? "#6c5ce7" : "var(--border)"}`, paddingLeft: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <span className={`badge ${q.required ? "badge-required" : "badge-optional"}`}>
                        {q.required ? t.common.required : t.common.optional}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{q.question}</span>
                    </div>
                    {q.hint && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{q.hint}</p>
                    )}

                    {q.answerType === "radio" && q.options ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => updateQAAnswer(q.id, opt)}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 20,
                              fontSize: 12,
                              cursor: "pointer",
                              border: `1px solid ${q.answer === opt ? "#6c5ce7" : "var(--border)"}`,
                              background: q.answer === opt ? "rgba(108,92,231,0.08)" : "transparent",
                              color: q.answer === opt ? "#6c5ce7" : "var(--text-secondary)",
                              transition: "all 0.15s",
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                        {q.required && (
                          <button
                            onClick={() => updateQAAnswer(q.id, t.analysis.needsConfirmationMarker)}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 20,
                              fontSize: 12,
                              cursor: "pointer",
                              border: `1px solid ${q.answer === t.analysis.needsConfirmationMarker ? "#f59e0b" : "rgba(245,158,11,0.4)"}`,
                              background: q.answer === t.analysis.needsConfirmationMarker ? "rgba(245,158,11,0.1)" : "transparent",
                              color: q.answer === t.analysis.needsConfirmationMarker ? "#b45309" : "#92400e",
                              transition: "all 0.15s",
                            }}
                          >
                            ⚠ {t.analysis.needsConfirmation}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <textarea
                          className="form-textarea"
                          value={q.answer === t.analysis.needsConfirmationMarker ? "" : q.answer}
                          onChange={(e) => updateQAAnswer(q.id, e.target.value)}
                          style={{ minHeight: 70 }}
                          placeholder={q.required ? t.analysis.answerPlaceholder : t.analysis.optionalPlaceholder}
                          disabled={q.answer === t.analysis.needsConfirmationMarker}
                        />
                        {q.required && (
                          <button
                            onClick={() => updateQAAnswer(q.id, q.answer === t.analysis.needsConfirmationMarker ? "" : t.analysis.needsConfirmationMarker)}
                            style={{
                              alignSelf: "flex-start",
                              padding: "4px 12px",
                              borderRadius: 16,
                              fontSize: 11,
                              cursor: "pointer",
                              border: `1px solid ${q.answer === t.analysis.needsConfirmationMarker ? "#f59e0b" : "rgba(245,158,11,0.4)"}`,
                              background: q.answer === t.analysis.needsConfirmationMarker ? "rgba(245,158,11,0.1)" : "transparent",
                              color: q.answer === t.analysis.needsConfirmationMarker ? "#b45309" : "#92400e",
                              transition: "all 0.15s",
                            }}
                          >
                            ⚠ {t.analysis.needsConfirmation}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <BottomBar
        currentStep={2}
        onNext={handleNext}
        nextLabel={t.analysis.nextButton}
        nextDisabled={!canProceed || loading || !!error}
        onBack={() => router.push("/steps/input")}
      />
    </>
  );
}
