"use client";

interface BottomBarProps {
  currentStep: number;
  totalSteps?: number;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  loading?: boolean;
}

export default function BottomBar({
  currentStep,
  totalSteps = 6,
  onNext,
  nextLabel = "次へ進む",
  nextDisabled = false,
  onBack,
  loading = false,
}: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="step-dots">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`step-dot ${
                i + 1 === currentStep
                  ? "active"
                  : i + 1 < currentStep
                  ? "done"
                  : ""
              }`}
            />
          ))}
        </div>
        <span className="step-label">
          Step {currentStep} / {totalSteps}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack}>
            ← 戻る
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={nextDisabled || loading}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              処理中...
            </>
          ) : (
            <>
              {nextLabel}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 8h8M9 5l3 3-3 3"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
