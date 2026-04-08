"use client";

import Link from "next/link";
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

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        {/* ロゴファイルを /public/logo.png に置いてください */}
        <img src="/logo.png" alt="Channel Talk" onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }} />
        <div>
          <div className="sidebar-logo-text">ALF設計<br />アシスタント</div>
          <div className="sidebar-logo-sub">Channel Talk</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {STEPS.map((step) => {
          const isActive = pathname === step.path;
          const isCompleted = completedSteps.has(step.num);
          const isDisabled =
            !isActive &&
            !isCompleted &&
            step.num > Math.max(1, ...Array.from(completedSteps)) + 1;

          const className = [
            "nav-item",
            isActive && "active",
            isCompleted && !isActive && "completed",
            isDisabled && "disabled",
          ]
            .filter(Boolean)
            .join(" ");

          if (isDisabled) {
            return (
              <div key={step.num} className={className}>
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
    </nav>
  );
}
