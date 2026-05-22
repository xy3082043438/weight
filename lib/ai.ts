const siliconFlowApiUrl = "https://api.siliconflow.cn/v1/chat/completions";
const defaultModel = "deepseek-ai/DeepSeek-V3.2";

type TextContent = {
  type: "text";
  text: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<TextContent>;
};

type SiliconFlowChoice = {
  message?: {
    content?: string;
  };
};

type SiliconFlowResponse = {
  choices?: SiliconFlowChoice[];
  error?: {
    message?: string;
  };
};

export async function createAiChatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
  },
) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SILICONFLOW_API_KEY");
  }

  const response = await fetch(siliconFlowApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options?.model ?? defaultModel,
      messages,
      temperature: options?.temperature ?? 0.4,
      stream: false,
    }),
  });

  const payload = (await response.json()) as SiliconFlowResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "AI request failed");
  }

  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

type SiliconFlowStreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
};

export async function* streamAiChatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
  },
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SILICONFLOW_API_KEY");
  }

  const response = await fetch(siliconFlowApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options?.model ?? defaultModel,
      messages,
      temperature: options?.temperature ?? 0.4,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const payload = (await response
      .json()
      .catch(() => null)) as SiliconFlowResponse | null;
    throw new Error(payload?.error?.message ?? "AI request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        return;
      }
      try {
        const chunk = JSON.parse(data) as SiliconFlowStreamChunk;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      } catch {
        // 忽略心跳/半行等非 JSON 数据
      }
    }
  }
}
