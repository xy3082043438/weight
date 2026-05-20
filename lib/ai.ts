const siliconFlowApiUrl = "https://api.siliconflow.cn/v1/chat/completions";
const defaultModel = "deepseek-ai/DeepSeek-V3.2";
const ocrModel = "deepseek-ai/DeepSeek-OCR";

type TextContent = {
  type: "text";
  text: string;
};

type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<TextContent | ImageContent>;
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

export async function createOcrCompletion(input: {
  imageUrl: string;
  prompt?: string;
}) {
  return createAiChatCompletion(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              input.prompt ??
              "请识别图片中的文字，保持原始顺序输出。只输出识别结果，不要添加额外解释。",
          },
          {
            type: "image_url",
            image_url: {
              url: input.imageUrl,
            },
          },
        ],
      },
    ],
    {
      model: ocrModel,
      temperature: 0,
    },
  );
}
