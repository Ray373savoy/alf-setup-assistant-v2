import Anthropic from "@anthropic-ai/sdk";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

const RETRYABLE_ERRORS = ["overloaded_error", "rate_limit_error"];

function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    return error.status === 429 || error.status === 529 || error.status === 503;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return RETRYABLE_ERRORS.some((e) => msg.includes(e)) || msg.includes("overloaded");
  }
  return false;
}

function friendlyMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 429 || error.status === 529) {
      return "AIサーバーが混み合っています。しばらく待ってから再試行してください。";
    }
    if (error.status === 401) {
      return "API認証に失敗しました。管理者にお問い合わせください。";
    }
  }
  if (error instanceof Error) {
    if (error.message.includes("Overloaded")) {
      return "AIサーバーが混み合っています。しばらく待ってから再試行してください。";
    }
    return error.message;
  }
  return "不明なエラーが発生しました。";
}

export async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  throw lastError;
}

export { friendlyMessage };
