"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useT, useI18nStore, type Locale } from "@/lib/i18n";
import {
  FileText,
  BrainCircuit,
  GitBranch,
  ShieldCheck,
  PenTool,
  Download,
  CheckCircle,
} from "lucide-react";

const STEP_PATHS = [
  "/steps/input",
  "/steps/analysis",
  "/steps/flow",
  "/steps/validation",
  "/steps/editor",
  "/steps/download",
];

const STEP_ICONS = [FileText, BrainCircuit, GitBranch, ShieldCheck, PenTool, Download];

const LOCALES: { value: Locale; label: string }[] = [
  { value: "ja", label: "JA" },
  { value: "ko", label: "KO" },
  { value: "en", label: "EN" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const completedSteps = useAppStore((s) => s.completedSteps);
  const [toast, setToast] = useState<string | null>(null);
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <Image src="/logo.png" alt="Channel Talk" width={36} height={36} />
        <h1>
          {t.sidebar.title.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </h1>
      </div>

      <div className="lang-switcher">
        <div className="lang-switcher-inner">
          {LOCALES.map((l) => (
            <button
              key={l.value}
              className={`lang-btn ${locale === l.value ? "active" : ""}`}
              onClick={() => setLocale(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-nav">
        {STEP_PATHS.map((path, i) => {
          const num = i + 1;
          const isActive = pathname === path;
          const isCompleted = completedSteps.has(num);
          const isAccessible =
            num === 1 || isCompleted || completedSteps.has(num - 1);
          const Icon = STEP_ICONS[i];

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
                key={num}
                className={className}
                onClick={() => showToast(t.sidebar.stepIncomplete)}
              >
                <span className="nav-num">{num}</span>
                <Icon className="nav-item-icon" />
                <span className="nav-label">{t.sidebar.steps[i]}</span>
              </div>
            );
          }

          return (
            <Link key={num} href={path} className={className}>
              <span className="nav-num">
                {isCompleted && !isActive ? <CheckCircle size={14} /> : num}
              </span>
              <Icon className="nav-item-icon" />
              <span className="nav-label">{t.sidebar.steps[i]}</span>
            </Link>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </nav>
  );
}
