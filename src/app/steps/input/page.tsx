"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import BottomBar from "@/components/layout/BottomBar";
import type { CartSystem, WmsSystem, OmsSystem } from "@/lib/types";

export default function InputPage() {
  const router = useRouter();
  const {
    inputMode, setInputMode,
    inputText, setInputText,
    systemSelection, setSystemSelection,
    completeStep, setCurrentStep,
  } = useAppStore();

  const canProceed = inputText.trim().length > 0;

  const handleNext = () => {
    completeStep(1);
    setCurrentStep(2);
    router.push("/steps/analysis");
  };

  return (
    <>
      <div className="page-body">
        <div className="page-header">
          <h2>入力</h2>
          <p>MTG文字起こしまたは業務手順書を入力してタスク設計を開始します。</p>
        </div>

        {/* データ入力 */}
        <div className="card">
          <div className="card-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="#6c5ce7" strokeWidth="1.5" />
              <path d="M5 6h6M5 9h4" stroke="#6c5ce7" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            データ入力
          </div>

          <div className="toggle-row">
            <button
              className={`toggle-btn ${inputMode === "transcript" ? "active" : ""}`}
              onClick={() => setInputMode("transcript")}
            >
              MTG文字起こし
            </button>
            <button
              className={`toggle-btn ${inputMode === "document" ? "active" : ""}`}
              onClick={() => setInputMode("document")}
            >
              業務手順書（PDF）
            </button>
          </div>

          {inputMode === "transcript" ? (
            <>
              <label className="form-label">文字起こしテキストを貼り付け</label>
              <textarea
                className="form-textarea"
                placeholder={"例）\n田中：注文キャンセルの問い合わせが多いので、タスクで自動対応したいんですが...\n山田：Shopifyのキャンセル処理はAPIで対応できます。まず注文番号を聞いて..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{ minHeight: 140 }}
              />
            </>
          ) : (
            <div
              style={{
                border: "1.5px dashed var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: 28,
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                クリックまたはドラッグ&ドロップでPDFをアップロード
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                PDF / Word (.docx) に対応
              </p>
            </div>
          )}
        </div>

        {/* 利用システム選択 */}
        <div className="card">
          <div className="card-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="#6c5ce7" strokeWidth="1.5" />
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="#6c5ce7" strokeWidth="1.5" />
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="#6c5ce7" strokeWidth="1.5" />
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="#6c5ce7" strokeWidth="1.5" />
            </svg>
            利用システム
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>
              （任意）
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* カートシステム */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 120, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 4,
                  background: "rgba(108,92,231,0.1)", color: "#6c5ce7",
                  display: "inline-block", marginBottom: 3
                }}>カート</span>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>カートシステム</div>
              </div>
              <select
                className="form-select"
                value={systemSelection.cart}
                onChange={(e) => setSystemSelection({ cart: e.target.value as CartSystem })}
              >
                <option value="">選択しない</option>
                <option value="shopify">Shopify</option>
                <option value="futureshop">futureshop</option>
                <option value="crossmall">CROSS MALL</option>
                <option value="other">その他</option>
              </select>
            </div>

            {/* WMS */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 120, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 4,
                  background: "rgba(29,158,117,0.1)", color: "#1D9E75",
                  display: "inline-block", marginBottom: 3
                }}>WMS</span>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>倉庫管理システム</div>
              </div>
              <select
                className="form-select"
                value={systemSelection.wms}
                onChange={(e) => setSystemSelection({ wms: e.target.value as WmsSystem })}
              >
                <option value="">選択しない</option>
                <option value="logiless">ロジレス</option>
                <option value="openlogi">OpenLogi</option>
                <option value="crobo">Commerce Robotics</option>
                <option value="other">その他</option>
              </select>
            </div>

            {/* OMS */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 120, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 4,
                  background: "rgba(186,117,23,0.1)", color: "#BA7517",
                  display: "inline-block", marginBottom: 3
                }}>OMS</span>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>受注管理システム</div>
              </div>
              <select
                className="form-select"
                value={systemSelection.oms}
                onChange={(e) => setSystemSelection({ oms: e.target.value as OmsSystem })}
              >
                <option value="">選択しない</option>
                <option value="nextengine">Next Engine</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>

          <div style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-muted)"
          }}>
            「その他」を選択した場合はテンプレートなしで設計します。選択しない項目はスキップされます。
          </div>
        </div>
      </div>

      <BottomBar
        currentStep={1}
        onNext={handleNext}
        nextLabel="分析を開始する"
        nextDisabled={!canProceed}
      />
    </>
  );
}
