// ============================================================
// 利用システム選択（Step 1）
// ============================================================

export type CartSystem = "shopify" | "futureshop" | "other" | "";
export type WmsSystem = "logiless" | "openlogi" | "crobo" | "other" | "";
export type OmsSystem = "nextengine" | "crossmall" | "other" | "";

export interface SystemSelection {
  cart: CartSystem;
  wms: WmsSystem;
  oms: OmsSystem;
}

export type InputMode = "transcript" | "document";

// ============================================================
// Q&A（Step 2）
// ============================================================

export type QAAnswerType = "radio" | "text" | "checkbox";

export interface QAItem {
  id: string;
  question: string;
  hint?: string;
  required: boolean;
  answerType: QAAnswerType;
  options?: string[];
  answer: string;
}

export interface AnalysisResult {
  summary: string;
  complexity: "simple" | "medium" | "complex";
  qaItems: QAItem[];
  detectedSystems: string[];
}

// ============================================================
// Task JSON（Step 3〜6）
// ============================================================

export interface TaskFilter {
  and?: { or: TaskFilterCondition[] }[];
  or?: TaskFilterCondition[];
  key?: string;
  type?: string;
  operator?: string;
  values?: unknown[];
}

export interface TaskFilterCondition {
  key: string;
  type: string;
  operator: string;
  values: unknown[];
}

export interface MemorySchemaItem {
  key: string;
  type: "string" | "number" | "boolean" | "list" | "listOfNumber" | "date" | "datetime" | "object" | "listOfObject";
  description: string;
}

export interface TaskNodeNext {
  type: "goto" | "branch" | "button";
  to?: string;
  conditions?: { filter: TaskFilter; to: string }[];
  default?: string;
  buttons?: { id: string; name: string; to: string }[];
}

export interface TaskNode {
  id: string;
  key: string;
  name: string;
  type: "agent" | "code" | "message" | "userChatInlineAction";
  next?: TaskNodeNext;
  instruction?: string;
  code?: string;
  message?: {
    blocks: { type: string; value?: string }[];
    buttons?: unknown;
    files?: unknown;
    form?: unknown;
    webPage?: unknown;
    customPayload?: unknown;
  };
  actions?: { type: "addUserChatTags" | "removeUserChatTags"; tags: string[] }[];
}

export interface TaskJson {
  task: {
    name: string;
    trigger: string;
    filter: TaskFilter;
    targetMediums: { mediumType: string }[];
    memorySchema: MemorySchemaItem[];
    nodes: TaskNode[];
    startNodeId: string;
    folderId: string;
  };
  taskEditorPosition: {
    nodePositions: { id: string; position: { x: number; y: number } }[];
    edgePositions: {
      sourceNode: { id: string; offset: number; type: string; index: number };
      targetNode: { id: string; offset: number };
    }[];
  };
}

// ============================================================
// 検証（Step 4）
// ============================================================

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================
// チャット修正（Step 3・5）
// ============================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
