import { AI_REQUEST_TIMEOUT_MS } from "@/ai/aiConfig.js";
import { BaseAiService } from "@/ai/BaseAiService.js";
import { AiInvalidJsonError, type AiProvider, type JsonCallResult } from "@/ai/aiTypes.js";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Google Gemini provider.
 */
export class GeminiService extends BaseAiService {
  readonly provider: AiProvider = "gemini";

  protected async callJson(
    systemInstruction: string,
    prompt: string,
  ): Promise<JsonCallResult> {
    if (!this.apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

    try {
      const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction.trim() }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${body}`);
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };

      const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new AiInvalidJsonError();
      }

      const data = this.parseJsonContent(content);
      const promptTokens = payload.usageMetadata?.promptTokenCount ?? 0;
      const completionTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;

      return {
        data,
        tokensUsed: promptTokens + completionTokens,
        model: this.model,
        prompt,
        rawResponse: content,
      };
    } catch (error) {
      if (error instanceof AiInvalidJsonError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Gemini API request timed out after 60 seconds.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
