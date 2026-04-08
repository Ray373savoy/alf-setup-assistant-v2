import { NextResponse } from "next/server";
import { validateTaskJson } from "@/lib/validate";
import type { TaskJson } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { taskJson } = (await request.json()) as { taskJson: TaskJson };

    if (!taskJson) {
      return NextResponse.json({ error: "taskJson is required" }, { status: 400 });
    }

    const result = validateTaskJson(taskJson);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
