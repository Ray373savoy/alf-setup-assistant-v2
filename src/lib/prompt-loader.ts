import fs from "fs";
import path from "path";
import type { SystemSelection } from "./types";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

function read(filePath: string): string {
  try {
    return fs.readFileSync(path.join(PROMPTS_DIR, filePath), "utf-8");
  } catch {
    console.warn(`[prompt-loader] File not found: ${filePath}`);
    return "";
  }
}

// ── 常時ロード A: JSONジェネレーター核心 ─────────────────────────
function loadCore(): string {
  const files = [
    "core/system_prompt.md",
    "core/basic_rule1.txt",
    "core/basic_rule2.txt",
    "core/task-policy.md",
    "core/alf-policy.md",
    "core/task_schema.json",
    "core/spec-prod.md",
  ];
  return files.map((f) => `\n\n---\n${read(f)}`).join("");
}

// ── 常時ロード B: ノードナレッジ 8種 ─────────────────────────────
function loadKnowledge(): string {
  const files = [
    "knowledge/agent.md",
    "knowledge/code.md",
    "knowledge/branch.md",
    "knowledge/message.md",
    "knowledge/trigger.md",
    "knowledge/memory.md",
    "knowledge/action.md",
    "knowledge/context.md",
  ];
  return files.map((f) => `\n\n---\n${read(f)}`).join("");
}

// ── 動的ロード: 利用システム選択に応じてテンプレートを追加 ──────
function loadTemplates(sel: SystemSelection): string {
  const templateMap: Record<string, string> = {
    shopify: "templates/shopify-engine.md",
    futureshop: "templates/futureshop-engine.md",
    crossmall: "templates/crossmall-engine.md",
    logiless: "templates/logiless-engine.md",
    openlogi: "templates/openlogi-engine.md",
    crobo: "templates/crobo-engine.md",
    nextengine: "templates/nextengine-engine.md",
  };

  const selected = ([sel.cart, sel.wms, sel.oms] as string[]).filter(
    (v) => v && v !== "other" && v !== ""
  ) as string[];

  if (selected.length === 0) return "";

  return selected
    .map((sys) => {
      const file = templateMap[sys];
      if (!file) return "";
      return `\n\n---\n## テンプレート: ${sys}\n${read(file)}`;
    })
    .join("");
}

// ── フェーズ限定: Step 2 分析・Q&A生成 ──────────────────────────
function loadAnalysisPhase(): string {
  const files = [
    "analysis/system.md",
    "analysis/methodology.md",
    "analysis/step1_complexity.md",
    "analysis/step2_pricing.md",
    "analysis/planning_system.md",
    "analysis/turn1_plan.md",
    "analysis/turn2_plan.md",
  ];
  return files.map((f) => `\n\n---\n${read(f)}`).join("");
}

// ── フェーズ限定: Step 3-5 Task JSON生成・修正 ────────────────────
function loadExecutionPhase(): string {
  const files = [
    "execution/system_task_creator.md",
    "execution/node_creation.md",
    "execution/checklist.md",
  ];
  return files.map((f) => `\n\n---\n${read(f)}`).join("");
}

// ── 公開インターフェース ──────────────────────────────────────────

/** Step 2: 分析 + Q&A生成用のシステムプロンプト */
export function buildAnalysisPrompt(sel: SystemSelection): string {
  return [loadCore(), loadKnowledge(), loadTemplates(sel), loadAnalysisPhase()]
    .join("")
    .trim();
}

/** Step 3-5: Task JSON生成・修正用のシステムプロンプト */
export function buildGenerationPrompt(sel: SystemSelection): string {
  return [
    loadCore(),
    loadKnowledge(),
    loadTemplates(sel),
    loadExecutionPhase(),
  ]
    .join("")
    .trim();
}
