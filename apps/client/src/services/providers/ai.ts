import type { AppSettings } from "@resonara/contracts";
import { z } from "zod";
import { requestJson } from "../http";
import { ProviderRequestError } from "./providerErrors";

const aiConnectionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().trim().min(1),
        }),
      }),
    )
    .min(1),
});

export async function assertAIConnection(
  settings: AppSettings,
): Promise<void> {
  const baseUrl = settings.aiBaseUrl.trim().replace(/\/+$/, "");
  const apiKey = settings.aiApiKey.trim();
  const model = settings.aiModel.trim();

  if (!baseUrl || !model) {
    throw new ProviderRequestError(
      "configuration",
      "Enter an AI Base URL and model first.",
      null,
    );
  }

  const response = await requestJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: 'Reply with this JSON only: {"ok":true}',
          },
        ],
      }),
    },
    aiConnectionResponseSchema,
  );

  const content = response.choices[0]?.message.content.trim();
  if (!content) {
    throw new ProviderRequestError(
      "schema",
      "The AI provider returned an empty response.",
      null,
    );
  }
}
