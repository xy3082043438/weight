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
