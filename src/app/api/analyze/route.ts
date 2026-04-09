import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAnalysisPrompt } from "@/lib/prompt-loader";
import { callWithRetry, friendlyMessage } from "@/lib/api-retry";
import type { SystemSelection, AnalysisResult } from "@/lib/types";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { inputText, systemSelection } = (await request.json()) as {
      inputText: string;
      systemSelection: SystemSelection;
    };

    if (!inputText?.trim()) {
      return NextResponse.json({ error: "inputText is required" }, { status: 400 });
    }

    const systemPrompt = buildAnalysisPrompt(systemSelection);

    const userPrompt = `
以下の入力テキストを分析して、ALF Taskの設計に必要な情報を補完するためのQ&Aリストを生成してください。

## 入力テキスト
${inputText}

## 出力形式（JSONのみ）
{
  "summary": "タスクの概要（1〜2文）",
  "complexity": "simple | medium | complex",
  "detectedSystems": ["検出されたシステム名"],
  "qaItems": [
    {
      "id": "q1",
      "question": "質問文",
      "hint": "補足説明（任意）",
      "required": true,
      "answerType": "radio | text | checkbox",
      "options": ["選択肢1", "選択肢2"]
    }
  ]
}

必須質問は最大3問、任意質問は最大2問まで。
JSONのみ出力し、それ以外のテキストは含めないこと。
`;

    const response = await callWithRetry(() =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt || "あなたはChannel Talk ALF Task設計アシスタントです。",
        messages: [{ role: "user", content: userPrompt }],
      })
    );

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI response could not be parsed" }, { status: 500 });
    }

    const result: AnalysisResult = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: friendlyMessage(error) }, { status: 500 });
  }
}
