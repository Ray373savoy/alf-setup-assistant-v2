import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildGenerationPrompt } from "@/lib/prompt-loader";
import type { SystemSelection, TaskJson, ChatMessage } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { taskJson, systemSelection, feedback, chatHistory } =
      (await request.json()) as {
        taskJson: TaskJson;
        systemSelection: SystemSelection;
        feedback: string;
        chatHistory: ChatMessage[];
      };

    if (!taskJson || !feedback?.trim()) {
      return NextResponse.json(
        { error: "taskJson and feedback are required" },
        { status: 400 }
      );
    }

    const systemPrompt = buildGenerationPrompt(systemSelection);

    const historyMessages: Anthropic.MessageParam[] = chatHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userPrompt = `以下の既存Task JSONを、修正指示に従って更新してください。

## 現在のTask JSON
${JSON.stringify(taskJson, null, 2)}

## 修正指示
${feedback}

変更点のみ修正した完全なTask JSONを出力してください。説明文は不要です。JSONのみ出力。`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        ...historyMessages,
        { role: "user", content: userPrompt },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Modified Task JSON could not be parsed" },
        { status: 500 }
      );
    }

    let updatedTaskJson: TaskJson;
    try {
      updatedTaskJson = JSON.parse(jsonMatch[0]);
    } catch {
      const isTruncated = response.stop_reason === "max_tokens";
      const detail = isTruncated
        ? "修正後のJSONが長すぎて途中で切れました。再試行してください。"
        : "修正後のJSON解析に失敗しました。再試行してください。";
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    const assistantMessage =
      `修正しました。${feedback.slice(0, 40)}${feedback.length > 40 ? "..." : ""}`;

    return NextResponse.json({ taskJson: updatedTaskJson, assistantMessage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
