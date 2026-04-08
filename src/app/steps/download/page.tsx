"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

export default function DownloadPage() {
  const router = useRouter();
  const { taskJson, reset } = useAppStore();
  const [taskName, setTaskName] = useState(taskJson?.task?.name ?? "");
  const [downloaded, setDownloaded] = useState(false);

  if (!taskJson) {
    return (
      <div className="page-body">
        <div className="page-header"><h2>ダウンロード</h2></div>
        <div className="card">
          <p style={{ color: "var(--text-secondary)" }}>Task JSONがありません。Step 1から始めてください。</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => router.push("/steps/input")}>
            最初から始める
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
          <h2>ダウンロード</h2>
          <p>Task JSON を確認してダウンロードしてください。Channel Talk管理画面からインポートできます。</p>
        </div>

        {/* Task名 */}
        <div className="card">
          <div className="card-title">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M3 8h6M3 12h4" stroke="#6c5ce7" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            タスク名の確認・変更
          </div>
          <label className="form-label">タスク名（50文字以内）</label>
          <input
            className="form-input"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value.slice(0, 50))}
            placeholder="タスク名を入力"
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
            {taskName.length} / 50文字
          </div>
        </div>

        {/* サマリー */}
        <div className="card">
          <div className="card-title">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="#6c5ce7" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="#6c5ce7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            生成サマリー
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <div style={statCardStyle}>
              <div style={statNumStyle}>{nodeCount}</div>
              <div style={statLabelStyle}>ノード数</div>
            </div>
            {Object.entries(nodeTypeCounts).map(([type, count]) => (
              <div key={type} style={statCardStyle}>
                <div style={statNumStyle}>{count}</div>
                <div style={statLabelStyle}>{typeLabel(type)}</div>
              </div>
            ))}
            <div style={statCardStyle}>
              <div style={statNumStyle}>{taskJson.task.memorySchema?.length ?? 0}</div>
              <div style={statLabelStyle}>メモリ変数</div>
            </div>
          </div>
        </div>

        {/* プレビュー */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>
            JSON プレビュー
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: "auto" }}>
              {JSON.stringify(finalJson).length.toLocaleString()} 文字
            </span>
          </div>
          <pre style={{
            fontSize: 11, lineHeight: 1.6, maxHeight: 220, overflow: "auto",
            background: "#1a1a2e", color: "#e2e8f0", padding: 14,
            borderRadius: 8, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {JSON.stringify(finalJson, null, 2).slice(0, 2000)}
            {JSON.stringify(finalJson).length > 2000 ? "\n... (省略)" : ""}
          </pre>
        </div>

        {/* インポート手順 */}
        <div className="card" style={{ background: "rgba(108,92,231,0.03)", borderColor: "rgba(108,92,231,0.15)" }}>
          <div className="card-title">インポート手順</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)", lineHeight: 2 }}>
            <li>Channel Talk 管理画面 → <strong>自動化 → ALF</strong> を開く</li>
            <li><strong>タスク</strong> タブ → <strong>タスクをインポート</strong> をクリック</li>
            <li>ダウンロードした JSON ファイルを選択してインポート</li>
            <li>インポート後、タスクの動作確認を行う</li>
          </ol>
        </div>

        {downloaded && (
          <div style={{
            padding: "10px 14px", background: "rgba(16,185,129,0.1)",
            border: "0.5px solid rgba(16,185,129,0.3)", borderRadius: 8,
            fontSize: 13, color: "#065f46", marginBottom: 16,
          }}>
            ✓ ダウンロードしました。Channel Talk管理画面からインポートしてください。
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
          <span className="step-label">Step 6 / 6</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => router.push("/steps/editor")}>
            ← 戻る
          </button>
          <button className="btn btn-secondary" onClick={() => { reset(); router.push("/steps/input"); }}>
            最初から始める
          </button>
          <button className="btn btn-primary" onClick={handleDownload}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v7M5 8l3 3 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 13h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            JSON をダウンロード
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
