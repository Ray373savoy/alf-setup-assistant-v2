"use client";

import { create } from "zustand";
import type {
  InputMode,
  SystemSelection,
  AnalysisResult,
  QAItem,
  TaskJson,
  ValidationResult,
  ChatMessage,
} from "./types";

interface AppState {
  // ── Step tracking ──────────────────────────────────────
  currentStep: number;
  completedSteps: Set<number>;

  // ── Step 1: 入力 ───────────────────────────────────────
  inputMode: InputMode;
  inputText: string;
  uploadedFileName: string | null;
  systemSelection: SystemSelection;

  // ── Step 2: AI分析・要件補完 ───────────────────────────
  analysisResult: AnalysisResult | null;
  qaAnswers: QAItem[];

  // ── Step 3: フロー可視化 ───────────────────────────────
  taskJson: TaskJson | null;
  mermaidCode: string;
  chatHistory: ChatMessage[];

  // ── Step 4: 検証 ───────────────────────────────────────
  validationResult: ValidationResult | null;

  // ── Step 5: タスクエディタ ─────────────────────────────
  editorChatHistory: ChatMessage[];

  // ── Actions ────────────────────────────────────────────
  setCurrentStep: (step: number) => void;
  completeStep: (step: number) => void;

  setInputMode: (mode: InputMode) => void;
  setInputText: (text: string) => void;
  setUploadedFileName: (name: string | null) => void;
  setSystemSelection: (sel: Partial<SystemSelection>) => void;

  setAnalysisResult: (result: AnalysisResult) => void;
  updateQAAnswer: (id: string, answer: string) => void;

  setTaskJson: (json: TaskJson) => void;
  setMermaidCode: (code: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChatHistory: () => void;

  setValidationResult: (result: ValidationResult) => void;

  addEditorChatMessage: (msg: ChatMessage) => void;

  reset: () => void;
}

const defaultSystemSelection: SystemSelection = {
  cart: "",
  wms: "",
  oms: "",
};

const initialState = {
  currentStep: 1,
  completedSteps: new Set<number>(),
  inputMode: "transcript" as InputMode,
  inputText: "",
  uploadedFileName: null,
  systemSelection: defaultSystemSelection,
  analysisResult: null,
  qaAnswers: [],
  taskJson: null,
  mermaidCode: "",
  chatHistory: [],
  validationResult: null,
  editorChatHistory: [],
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),

  completeStep: (step) =>
    set((s) => ({ completedSteps: new Set([...s.completedSteps, step]) })),

  setInputMode: (mode) => set({ inputMode: mode }),
  setInputText: (text) => set({ inputText: text }),
  setUploadedFileName: (name) => set({ uploadedFileName: name }),
  setSystemSelection: (sel) =>
    set((s) => ({ systemSelection: { ...s.systemSelection, ...sel } })),

  setAnalysisResult: (result) =>
    set({
      analysisResult: result,
      qaAnswers: result.qaItems.map((q) => ({ ...q, answer: q.answer ?? "" })),
    }),
  updateQAAnswer: (id, answer) =>
    set((s) => ({
      qaAnswers: s.qaAnswers.map((q) => (q.id === id ? { ...q, answer } : q)),
    })),

  setTaskJson: (json) => set({ taskJson: json }),
  setMermaidCode: (code) => set({ mermaidCode: code }),
  addChatMessage: (msg) =>
    set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
  clearChatHistory: () => set({ chatHistory: [] }),

  setValidationResult: (result) => set({ validationResult: result }),

  addEditorChatMessage: (msg) =>
    set((s) => ({ editorChatHistory: [...s.editorChatHistory, msg] })),

  reset: () => set(initialState),
}));
