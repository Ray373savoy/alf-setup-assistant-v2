import type { TaskJson, ValidationResult } from "./types";

/**
 * validate_task.js のロジックをサーバーサイドで実行する。
 * Node.js ファイルシステム依存部分を除いてインラインで実装。
 */
export function validateTaskJson(data: TaskJson): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const task = data.task;
  const positions = data.taskEditorPosition;

  // ── Stage 1: 構造検証 ──────────────────────────────────────────
  if (!task.name || task.name.length > 50)
    errors.push("S01: Task名が不正（1〜50文字）");
  if (!task.trigger || task.trigger.length > 5000)
    errors.push("S02: トリガーが不正（1〜5,000文字）");
  if (!task.memorySchema) errors.push("S04: memorySchemaが未定義");
  if (!task.nodes || task.nodes.length > 100)
    errors.push("S03: ノード数が不正（1〜100個）");
  if (!task.startNodeId) errors.push("S03b: startNodeIdが未定義");

  const nodeIds = new Set(task.nodes?.map((n) => n.id) ?? []);
  const nodeKeys = new Set(task.nodes?.map((n) => n.key) ?? []);
  if (nodeIds.size !== (task.nodes?.length ?? 0))
    errors.push("S10: ノードIDに重複あり");
  if (nodeKeys.size !== (task.nodes?.length ?? 0))
    errors.push("S10b: ノードkeyに重複あり");

  // コードノード文字数
  for (const node of task.nodes ?? []) {
    if (node.type === "code" && node.code && node.code.length > 5000) {
      warnings.push(
        `S07: ${node.id} のコードが${node.code.length}文字（5,000文字超過。インポートエラーのリスクあり）`
      );
    }
  }

  // next参照の存在チェック
  for (const node of task.nodes ?? []) {
    const nxt = node.next;
    if (!nxt) continue;
    if (nxt.type === "goto" && nxt.to !== "END_TASK" && !nodeIds.has(nxt.to ?? ""))
      errors.push(`S11: ${node.id} の next.to "${nxt.to}" が存在しない`);
    if (nxt.type === "branch") {
      for (const cond of nxt.conditions ?? []) {
        if (cond.to !== "END_TASK" && !nodeIds.has(cond.to))
          errors.push(`S11b: ${node.id} の branch.to "${cond.to}" が存在しない`);
      }
      if (nxt.default && nxt.default !== "END_TASK" && !nodeIds.has(nxt.default))
        errors.push(`S11c: ${node.id} の branch.default "${nxt.default}" が存在しない`);
    }
  }

  // startNodeId の存在確認
  if (task.startNodeId && !nodeIds.has(task.startNodeId))
    errors.push(`S12: startNodeId "${task.startNodeId}" が nodes に存在しない`);

  // ── Stage 2: フロー整合性検証 ──────────────────────────────────
  // 前方向（ループバック禁止）チェック
  const idList = task.nodes?.map((n) => n.id) ?? [];
  const idIndex = new Map(idList.map((id, i) => [id, i]));

  for (const node of task.nodes ?? []) {
    const currentIdx = idIndex.get(node.id) ?? 0;
    const nxt = node.next;
    if (!nxt) continue;

    const checkBackward = (to: string) => {
      if (to === "END_TASK") return;
      const targetIdx = idIndex.get(to);
      if (targetIdx !== undefined && targetIdx < currentIdx) {
        warnings.push(`S20: ${node.id} → ${to} は後退参照（ループバック）の可能性あり`);
      }
    };

    if (nxt.type === "goto") checkBackward(nxt.to ?? "");
    if (nxt.type === "branch") {
      for (const cond of nxt.conditions ?? []) checkBackward(cond.to);
      if (nxt.default) checkBackward(nxt.default);
    }
  }

  // edgePositions の参照チェック
  const allValidIds = new Set([...nodeIds, "TRIGGER", "END_TASK"]);
  for (const ep of positions?.edgePositions ?? []) {
    if (!allValidIds.has(ep.sourceNode.id))
      warnings.push(`P01: edgePositions.sourceNode.id "${ep.sourceNode.id}" が不正`);
    if (!allValidIds.has(ep.targetNode.id))
      warnings.push(`P02: edgePositions.targetNode.id "${ep.targetNode.id}" が不正`);
  }

  return { passed: errors.length === 0, errors, warnings };
}
