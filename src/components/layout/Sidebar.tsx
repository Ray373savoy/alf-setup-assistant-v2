"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";

const STEPS = [
  { num: 1, label: "入力", path: "/steps/input" },
  { num: 2, label: "AI分析・要件補完", path: "/steps/analysis" },
  { num: 3, label: "フロー可視化", path: "/steps/flow" },
  { num: 4, label: "検証", path: "/steps/validation" },
  { num: 5, label: "タスクエディタ", path: "/steps/editor" },
  { num: 6, label: "ダウンロード", path: "/steps/download" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const completedSteps = useAppStore((s) => s.completedSteps);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <Image src="/logo.svg" alt="Channel Talk" width={36} height={36} />
        <div>
          <div className="sidebar-logo-text">ALF設計<br />アシスタント</div>
          <div className="sidebar-logo-sub">Channel Talk</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {STEPS.map((step) => {
          const isActive = pathname === step.path;
          const isCompleted = completedSteps.has(step.num);
          const isAccessible =
            step.num === 1 ||
            isCompleted ||
            completedSteps.has(step.num - 1);

          const className = [
            "nav-item",
            isActive && "active",
            isCompleted && !isActive && "completed",
            !isAccessible && "disabled",
          ]
            .filter(Boolean)
            .join(" ");

          if (!isAccessible) {
            return (
              <div
                key={step.num}
                className={className}
                onClick={() =>
                  showToast("Step 1 の情報を入力してください")
                }
              >
                <span className="nav-num">{step.num}</span>
                <span className="nav-label">{step.label}</span>
              </div>
            );
          }

          return (
            <Link key={step.num} href={step.path} className={className}>
              <span className="nav-num">
                {isCompleted && !isActive ? "✓" : step.num}
              </span>
              <span className="nav-label">{step.label}</span>
            </Link>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </nav>
  );
}
