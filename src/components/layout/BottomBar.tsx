"use client";

import { useT } from "@/lib/i18n";

interface BottomBarProps {
  currentStep: number;
  totalSteps?: number;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  loading?: boolean;
}

export default function BottomBar({
  currentStep,
  totalSteps = 6,
  onNext,
  nextLabel,
  nextDisabled = false,
  onBack,
  loading = false,
}: BottomBarProps) {
  const t = useT();

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
            {t.common.back}
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
              {t.common.processing}
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
