import type { AppSettings } from "@resonara/contracts";
import { z } from "zod";
import { requestJson } from "../http";
import { ProviderRequestError } from "../providers/providerErrors";

export type AIJsonRequestOptions<T> = {
  purpose: "planner" | "reranker" | "explanation" | "discover";
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
};

export type AIJsonRequester = <T>(
  settings: AppSettings,
  options: AIJsonRequestOptions<T>,
) => Promise<T>;

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().min(1),
        }),
      }),
    )
    .min(1),
});

export function isAIConfigured(settings: AppSettings): boolean {
  return Boolean(
    settings.aiBaseUrl.trim() &&
      settings.aiApiKey.trim() &&
      settings.aiModel.trim(),
  );
}

function parseJsonContent(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? content).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new ProviderRequestError(
      "schema",
      "The AI provider did not return valid JSON.",
      null,
    );
  }
}

export const requestAIJson: AIJsonRequester = async <T>(
  settings: AppSettings,
  options: AIJsonRequestOptions<T>,
) => {
  if (!isAIConfigured(settings)) {
    throw new ProviderRequestError(
      "configuration",
      "AI is not configured.",
      null,
    );
  }

  const baseUrl = settings.aiBaseUrl.trim().replace(/\/+$/, "");
  const response = await requestJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${settings.aiApiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.aiModel.trim(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: options.systemPrompt,
          },
          {
            role: "user",
            content: options.userPrompt,
          },
        ],
      }),
    },
    chatResponseSchema,
    { timeoutMs: options.timeoutMs ?? 20_000 },
  );

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new ProviderRequestError(
      "schema",
      "The AI provider returned an empty response.",
      null,
    );
  }

  const parsed = options.schema.safeParse(parseJsonContent(content));
  if (!parsed.success) {
    throw new ProviderRequestError(
      "schema",
      "The AI provider returned data that failed validation.",
      null,
    );
  }
  return parsed.data;
};
