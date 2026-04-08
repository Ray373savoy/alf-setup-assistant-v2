// validate_task.js — Task JSON 事前検証スクリプト（Stage 1 + Stage 2）
// 使用法: node validate_task.js <task.json>

const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node validate_task.js <task.json>'); process.exit(1); }

const raw = fs.readFileSync(path, 'utf8');
const data = JSON.parse(raw);
const task = data.task;
const positions = data.taskEditorPosition;
let errors = [], warnings = [];

// ============================================================
// Stage 1: 構造検証（Static）
// ============================================================

if (!task.name || task.name.length > 50) errors.push('S01: Task名が不正（1〜50文字）');
if (!task.trigger || task.trigger.length > 5000) errors.push('S02: トリガーが不正（1〜5,000文字）');
if (!task.memorySchema) errors.push('S04: memorySchemaが未定義');
if (!task.nodes || task.nodes.length > 100) errors.push('S03: ノード数が不正（1〜100個）');
if (!task.startNodeId) errors.push('S03b: startNodeIdが未定義');

const nodeIds = new Set(task.nodes.map(n => n.id));
const nodeKeys = new Set(task.nodes.map(n => n.key));
if (nodeIds.size !== task.nodes.length) errors.push('S10: ノードIDに重複あり');
if (nodeKeys.size !== task.nodes.length) errors.push('S10b: ノードkeyに重複あり');

// S07: CodeNode コード文字数チェック（5,000文字超で警告）
for (const node of task.nodes) {
  if (node.type === 'code' && node.code && node.code.length > 5000) {
    warnings.push(`S07: ${node.id} のコードが${node.code.length}文字（5,000文字超過。インポートエラーのリスクあり）`);
  }
}

// S11: next参照の存在チェック
for (const node of task.nodes) {
  const nxt = node.next;
  if (!nxt) continue;
  if (nxt.type === 'goto' && nxt.to !== 'END_TASK' && !nodeIds.has(nxt.to))
    errors.push(`S11: ${node.id} の next.to "${nxt.to}" が存在しない`);
  if (nxt.type === 'branch') {
    for (const c of (nxt.conditions || []))
      if (c.to !== 'END_TASK' && !nodeIds.has(c.to))
        errors.push(`S11: ${node.id} の branch条件 to "${c.to}" が存在しない`);
    if (nxt.default && nxt.default !== 'END_TASK' && !nodeIds.has(nxt.default))
      errors.push(`S11: ${node.id} の branch.default "${nxt.default}" が存在しない`);
  }
  if (nxt.type === 'button') {
    for (const b of (nxt.buttons || []))
      if (b.to !== 'END_TASK' && !nodeIds.has(b.to))
        errors.push(`S11: ${node.id} の button.to "${b.to}" が存在しない`);
  }
}

// S15-S17: memorySchema完全性
const schemaKeys = new Set((task.memorySchema || []).map(m => m.key));
for (const node of task.nodes) {
  if (node.type === 'code' && node.code) {
    const puts = [...node.code.matchAll(/memory\.put\(['"]([^'"]+)['"]/g)].map(m => m[1]);
    const gets = [...node.code.matchAll(/memory\.get\(['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const k of [...puts, ...gets])
      if (!schemaKeys.has(k)) errors.push(`S15: ${node.id} の memory key "${k}" が memorySchema に未登録`);
  }
  if (node.type === 'agent' && node.instruction) {
    const ids = [...node.instruction.matchAll(/identifier="([^"]+)"/g)].map(m => m[1]);
    for (const k of ids) {
      // context参照（userChat.*, context.*）はmemorySchemaの対象外
      if (k.startsWith('userChat.') || k.startsWith('context.')) continue;
      if (!schemaKeys.has(k)) errors.push(`S16: ${node.id} の promptdata "${k}" が memorySchema に未登録`);
    }
  }
  // S17: branch条件内のtaskMemory参照
  const nxt = node.next;
  if (nxt && nxt.type === 'branch') {
    const checkFilter = (filter) => {
      if (!filter) return;
      if (filter.key && filter.key.startsWith('taskMemory.')) {
        const k = filter.key.replace('taskMemory.', '');
        if (!schemaKeys.has(k)) errors.push(`S17: ${node.id} の branch条件 "${k}" が memorySchema に未登録`);
      }
      if (filter.and) filter.and.forEach(checkFilter);
      if (filter.or) filter.or.forEach(checkFilter);
    };
    for (const c of (nxt.conditions || [])) checkFilter(c.filter);
  }
}

// S09: edgePositions 存在チェック
if (!positions || !positions.edgePositions || positions.edgePositions.length === 0)
  errors.push('S09: edgePositions が未定義');

// ============================================================
// Stage 2: フロー検証（Flow）
// ============================================================

// F01: 循環検出（DFS）
const adjacency = {};
for (const node of task.nodes) {
  adjacency[node.id] = [];
  const nxt = node.next;
  if (!nxt) continue;
  if (nxt.type === 'goto' && nxt.to !== 'END_TASK') adjacency[node.id].push(nxt.to);
  if (nxt.type === 'branch') {
    for (const c of (nxt.conditions || []))
      if (c.to !== 'END_TASK') adjacency[node.id].push(c.to);
    if (nxt.default && nxt.default !== 'END_TASK') adjacency[node.id].push(nxt.default);
  }
  if (nxt.type === 'button') {
    for (const b of (nxt.buttons || []))
      if (b.to !== 'END_TASK') adjacency[node.id].push(b.to);
  }
}

const visited = new Set(), inStack = new Set();
let hasCycle = false;
const dfs = (nodeId) => {
  if (inStack.has(nodeId)) { hasCycle = true; return; }
  if (visited.has(nodeId)) return;
  visited.add(nodeId);
  inStack.add(nodeId);
  for (const next of (adjacency[nodeId] || [])) dfs(next);
  inStack.delete(nodeId);
};
for (const nodeId of nodeIds) dfs(nodeId);
if (hasCycle) warnings.push('F01: 循環（サイクル）が検出されました。リトライパターンの場合は agentノードの maxTurn で制御することを推奨');

// F02: 到達性チェック（BFS from startNodeId）
const reachable = new Set();
const queue = [task.startNodeId];
reachable.add(task.startNodeId);
while (queue.length > 0) {
  const current = queue.shift();
  for (const next of (adjacency[current] || [])) {
    if (!reachable.has(next)) {
      reachable.add(next);
      queue.push(next);
    }
  }
}
for (const nodeId of nodeIds) {
  if (!reachable.has(nodeId)) errors.push(`F02: ${nodeId} が startNode から到達不可能`);
}

// F03: 終端性チェック（全ノードからEND_TASKに到達可能か）
const reachesEnd = new Set();
reachesEnd.add('END_TASK');
let changed = true;
while (changed) {
  changed = false;
  for (const node of task.nodes) {
    if (reachesEnd.has(node.id)) continue;
    const nxt = node.next;
    if (!nxt) continue;
    let targets = [];
    if (nxt.type === 'goto') targets = [nxt.to];
    if (nxt.type === 'branch') {
      targets = (nxt.conditions || []).map(c => c.to);
      if (nxt.default) targets.push(nxt.default);
    }
    if (nxt.type === 'button') targets = (nxt.buttons || []).map(b => b.to);
    if (targets.some(t => reachesEnd.has(t))) {
      reachesEnd.add(node.id);
      changed = true;
    }
  }
}
for (const nodeId of nodeIds) {
  if (!reachesEnd.has(nodeId)) warnings.push(`F03: ${nodeId} から END_TASK への経路がない可能性`);
}

// F04: branch の default 存在チェック
for (const node of task.nodes) {
  const nxt = node.next;
  if (nxt && nxt.type === 'branch') {
    if (!nxt.default && nxt.default !== 'END_TASK')
      errors.push(`F04: ${node.id} の branch に default が未定義`);
  }
}

// F05b: edgePositions 完全性チェック（全接続に対応するedgeが存在するか）
if (positions && positions.edgePositions) {
  // 期待される全接続を列挙
  const expectedEdges = [];

  // TRIGGER → startNodeId
  expectedEdges.push({ source: 'TRIGGER', type: 'goto', index: 0, target: task.startNodeId });

  for (const node of task.nodes) {
    const nxt = node.next;
    if (!nxt) continue;

    if (nxt.type === 'goto') {
      expectedEdges.push({ source: node.id, type: 'goto', index: 0, target: nxt.to });
    }
    if (nxt.type === 'branch') {
      (nxt.conditions || []).forEach((c, i) => {
        expectedEdges.push({ source: node.id, type: 'branch', index: i, target: c.to });
      });
      if (nxt.default !== undefined) {
        expectedEdges.push({ source: node.id, type: 'branch', index: (nxt.conditions || []).length, target: nxt.default });
      }
    }
    if (nxt.type === 'button') {
      (nxt.buttons || []).forEach((b, i) => {
        expectedEdges.push({ source: node.id, type: 'button', index: i, target: b.to });
      });
    }
    // ⚠️ onError は edgePositions に含めない（Channel Talk 本番が拒否するため）
  }

  // F05c: onError エッジ混入チェック（使用禁止）
  const invalidOnErrorEdges = positions.edgePositions.filter(e => e.sourceNode?.type === 'onError');
  if (invalidOnErrorEdges.length > 0) {
    invalidOnErrorEdges.forEach(e => {
      errors.push(`F05c: edgePositions に onError エッジが含まれています（使用禁止）— ${e.sourceNode.id} → ${e.targetNode.id}`);
    });
  }

  // 実際のedgePositionsと突合
  const actualEdgeSet = new Set(
    positions.edgePositions.map(e =>
      `${e.sourceNode.id}|${e.sourceNode.type}|${e.sourceNode.index}|${e.targetNode.id}`
    )
  );

  let missingCount = 0;
  for (const exp of expectedEdges) {
    const key = `${exp.source}|${exp.type}|${exp.index}|${exp.target}`;
    if (!actualEdgeSet.has(key)) {
      errors.push(`F05b: edgePositions 欠落 — ${exp.source} →(${exp.type}[${exp.index}])→ ${exp.target}`);
      missingCount++;
    }
  }

  // 逆方向: 余分なedgeがないかもチェック
  const expectedEdgeSet = new Set(
    expectedEdges.map(e => `${e.source}|${e.type}|${e.index}|${e.target}`)
  );
  for (const e of positions.edgePositions) {
    const key = `${e.sourceNode.id}|${e.sourceNode.type}|${e.sourceNode.index}|${e.targetNode.id}`;
    if (!expectedEdgeSet.has(key)) {
      warnings.push(`F05b: edgePositions に余分なエントリ — ${e.sourceNode.id} →(${e.sourceNode.type}[${e.sourceNode.index}])→ ${e.targetNode.id}`);
    }
  }

  if (missingCount === 0 && expectedEdges.length > 0) {
    // pass silently
  }
}

// F09-F10: レイアウト検証
if (positions && positions.nodePositions) {
  const pos = positions.nodePositions;
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const dx = Math.abs(pos[i].position.x - pos[j].position.x);
      const dy = Math.abs(pos[i].position.y - pos[j].position.y);
      if (dx < 400 && dy < 400 && (dx + dy) > 0)
        warnings.push(`F09: ${pos[i].id} ↔ ${pos[j].id} が近接 (dx=${dx}, dy=${dy})`);
      if (dx === 0 && dy === 0)
        errors.push(`F10: ${pos[i].id} ↔ ${pos[j].id} が同一座標`);
    }
  }
}

// ============================================================
// レポート出力
// ============================================================
console.log('=== Task JSON 事前検証レポート ===');
console.log(`Task名: ${task.name}`);
console.log(`ノード数: ${task.nodes.length}`);
console.log(`memorySchemaキー数: ${schemaKeys.size}`);
console.log(`edgePositions数: ${(positions?.edgePositions || []).length}`);
console.log(`到達可能ノード: ${reachable.size}/${nodeIds.size}`);
console.log('');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ 全チェック PASS');
} else {
  if (errors.length > 0) {
    console.log(`❌ Errors (${errors.length}件):`);
    for (const e of errors) console.log(`  ❌ ${e}`);
  }
  if (warnings.length > 0) {
    console.log(`⚠️ Warnings (${warnings.length}件):`);
    for (const w of warnings) console.log(`  ⚠️ ${w}`);
  }
  console.log('');
  console.log(`結果: ${errors.length > 0 ? '❌ FAIL' : '⚠️ WARN'} (errors=${errors.length}, warnings=${warnings.length})`);
}
