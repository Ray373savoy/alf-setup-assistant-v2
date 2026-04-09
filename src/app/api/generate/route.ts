import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildGenerationPrompt } from "@/lib/prompt-loader";
import type { SystemSelection, QAItem, TaskJson } from "@/lib/types";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { inputText, systemSelection, qaAnswers, chatFeedback } =
      (await request.json()) as {
        inputText: string;
        systemSelection: SystemSelection;
        qaAnswers: QAItem[];
        chatFeedback?: string;
      };

    const systemPrompt = buildGenerationPrompt(systemSelection);

    const answeredQA = qaAnswers
      .filter((q) => q.answer.trim())
      .map((q) => `Q: ${q.question}\nA: ${q.answer}`)
      .join("\n\n");

    const feedbackSection = chatFeedback
      ? `\n\n## 修正指示\n${chatFeedback}`
      : "";

    const userPrompt = `
以下の情報からChannel Talk ALF Task JSONを生成してください。

## 入力テキスト
${inputText}

## 要件確認 Q&A
${answeredQA || "（未回答）"}
${feedbackSection}

有効なTask JSONのみ出力してください。説明文やマークダウンは含めないこと。
`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Task JSON could not be parsed" }, { status: 500 });
    }

    let taskJson: TaskJson;
    try {
      taskJson = JSON.parse(jsonMatch[0]);
    } catch {
      // Truncated response — notify user
      const isTruncated = response.stop_reason === "max_tokens";
      const detail = isTruncated
        ? "生成されたJSONが長すぎて途中で切れました。入力テキストを短くするか、要件を絞って再試行してください。"
        : "AIレスポンスのJSON解析に失敗しました。再生成をお試しください。";
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    // Mermaid コードを生成
    const mermaidCode = generateMermaid(taskJson);

    return NextResponse.json({ taskJson, mermaidCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateMermaid(data: TaskJson): string {
  const nodes = data.task.nodes;
  const lines: string[] = ["flowchart LR"];

  const styleMap: Record<string, string> = {
    agent: "fill:#fff,stroke:#d1d5db",
    code: "fill:#FFF9DB,stroke:#F0D060",
    message: "fill:#DBEAFE,stroke:#93C5FD",
    userChatInlineAction: "fill:#D1FAE5,stroke:#6EE7B7",
  };

  lines.push(`    TRIGGER([トリガー])`);

  for (const node of nodes) {
    const label = node.name.replace(/"/g, "'");
    if (node.type === "agent" || node.type === "code") {
      lines.push(`    ${node.id}[${label}]`);
    } else if (node.type === "message") {
      lines.push(`    ${node.id}([${label}])`);
    } else {
      lines.push(`    ${node.id}{{${label}}}`);
    }
  }

  // エッジ
  lines.push(`    TRIGGER --> ${data.task.startNodeId}`);
  for (const node of nodes) {
    const nxt = node.next;
    if (!nxt) continue;
    if (nxt.type === "goto") {
      const to = nxt.to === "END_TASK" ? "END([終了])" : nxt.to ?? "";
      lines.push(`    ${node.id} --> ${to}`);
    } else if (nxt.type === "branch") {
      for (const cond of nxt.conditions ?? []) {
        const to = cond.to === "END_TASK" ? "END([終了])" : cond.to;
        lines.push(`    ${node.id} --> ${to}`);
      }
      if (nxt.default) {
        const def = nxt.default === "END_TASK" ? "END([終了])" : nxt.default;
        lines.push(`    ${node.id} --> ${def}`);
      }
    }
  }

  // スタイル
  for (const node of nodes) {
    const style = styleMap[node.type];
    if (style) lines.push(`    style ${node.id} ${style}`);
  }

  return lines.join("\n");
}
