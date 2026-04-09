"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

export default function DownloadPage() {
  const router = useRouter();
  const t = useT();
  const { taskJson, qaAnswers, reset } = useAppStore();
  const [taskName, setTaskName] = useState(taskJson?.task?.name ?? "");
  const [downloaded, setDownloaded] = useState(false);

  if (!taskJson) {
    return (
      <div className="page-body">
        <div className="page-header"><h2>{t.download.heading}</h2></div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>{t.download.noJson}</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => router.push("/steps/input")}>
            {t.download.startOver}
          </button>
        </div>
      </div>
    );
  }

  const finalJson = {
    ...taskJson,
    task: { ...taskJson.task, name: taskName || taskJson.task.name },
  };

  function handleDownload() {
    const blob = new Blob([JSON.stringify(finalJson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(taskName || taskJson!.task.name).replace(/\s+/g, "_") || "alf_task"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  const nodeCount = taskJson.task.nodes.length;
  const nodeTypeCounts = taskJson.task.nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <div className="page-body">
        <div className="page-header">
          <h2>{t.download.heading}</h2>
          <p>{t.download.description}</p>
        </div>

        {/* Task名 */}
        <div className="card">
          <div className="card-title">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M3 8h6M3 12h4" stroke="#6c5ce7" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t.download.taskNameSection}
          </div>
          <label className="form-label">{t.download.taskNameLabel}</label>
          <input
            className="form-input"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value.slice(0, 50))}
            placeholder={t.download.taskNamePlaceholder}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
            {taskName.length} {t.download.charCount}
          </div>
        </div>

        {/* サマリー */}
        <div className="card">
          <div className="card-title">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="#6c5ce7" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="#6c5ce7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t.download.summary}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <div style={statCardStyle}>
              <div style={statNumStyle}>{nodeCount}</div>
              <div style={statLabelStyle}>{t.download.nodeCount}</div>
            </div>
            {Object.entries(nodeTypeCounts).map(([type, count]) => (
              <div key={type} style={statCardStyle}>
                <div style={statNumStyle}>{count}</div>
                <div style={statLabelStyle}>{typeLabel(type)}</div>
              </div>
            ))}
            <div style={statCardStyle}>
              <div style={statNumStyle}>{taskJson.task.memorySchema?.length ?? 0}</div>
              <div style={statLabelStyle}>{t.download.memoryVars}</div>
            </div>
          </div>
        </div>

        {/* プレビュー */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>
            {t.download.jsonPreview}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: "auto" }}>
              {JSON.stringify(finalJson).length.toLocaleString()} {t.download.chars}
            </span>
          </div>
          <pre style={{
            fontSize: 11, lineHeight: 1.6, maxHeight: 220, overflow: "auto",
            background: "#1a1a2e", color: "#e2e8f0", padding: 14,
            borderRadius: 8, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {JSON.stringify(finalJson, null, 2).slice(0, 2000)}
            {JSON.stringify(finalJson).length > 2000 ? `\n${t.download.truncated}` : ""}
          </pre>
        </div>

        {/* 要確認事項リマインダー */}
        {qaAnswers.some((q) => q.answer === t.analysis.needsConfirmationMarker) && (
          <div className="card" style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.3)" }}>
            <div className="card-title" style={{ color: "#92400e" }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L1 14h14L8 1z" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M8 6v4M8 11.5v.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {t.download.pendingConfirmation}
            </div>
            <p style={{ fontSize: 12, color: "#92400e", margin: "0 0 10px 0" }}>
              {t.download.pendingConfirmationNote}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {qaAnswers
                .filter((q) => q.answer === t.analysis.needsConfirmationMarker)
                .map((q) => (
                  <div key={q.id} style={{
                    padding: "8px 12px", borderRadius: 8,
                    background: "rgba(245,158,11,0.08)", border: "0.5px solid rgba(245,158,11,0.2)",
                    fontSize: 12, color: "#78350f", lineHeight: 1.6,
                  }}>
                    <span style={{ fontWeight: 600 }}>Q: </span>{q.question}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* インポート手順 */}
        <div className="card" style={{ background: "rgba(108,92,231,0.03)", borderColor: "rgba(108,92,231,0.15)" }}>
          <div className="card-title">{t.download.importSteps}</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 2 }}>
            <li>{t.download.importStep1}</li>
            <li>{t.download.importStep2}</li>
            <li>{t.download.importStep3}</li>
            <li>{t.download.importStep4}</li>
          </ol>
        </div>

        {downloaded && (
          <div style={{
            padding: "10px 14px", background: "rgba(16,185,129,0.1)",
            border: "0.5px solid rgba(16,185,129,0.3)", borderRadius: 8,
            fontSize: 13, color: "#065f46", marginBottom: 16,
          }}>
            {t.download.downloaded}
          </div>
        )}
      </div>

      <div className="bottom-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="step-dots">
            {[1,2,3,4,5,6].map((n) => (
              <div key={n} className={`step-dot ${n === 6 ? "active" : "done"}`} />
            ))}
          </div>
          <span className="step-label">{t.download.stepLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => router.push("/steps/editor")}>
            {t.common.back}
          </button>
          <button className="btn btn-secondary" onClick={() => { reset(); router.push("/steps/input"); }}>
            {t.download.startOver}
          </button>
          <button className="btn btn-primary" onClick={handleDownload}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v7M5 8l3 3 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 13h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {t.download.downloadButton}
          </button>
        </div>
      </div>
    </>
  );
}

const statCardStyle: React.CSSProperties = {
  background: "var(--bg)", borderRadius: 8, padding: "10px 16px",
  textAlign: "center", minWidth: 80, border: "0.5px solid var(--border)",
};
const statNumStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: "#6c5ce7" };
const statLabelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", marginTop: 2 };

function typeLabel(type: string): string {
  return { agent: "Agent", code: "Code", message: "Message", userChatInlineAction: "Action" }[type] ?? type;
}
