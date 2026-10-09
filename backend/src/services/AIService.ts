import axios from 'axios';
import logger from '../utils/logger';

interface ProviderConfig {
  model: string;
  apiKey: string;
}

class AIServiceClass {
  private providers: ProviderConfig[] = [
    {
      model: 'qwen/qwen3-32b',
      apiKey: process.env.OPENROUTER_QWEN_KEY || ''
    },
    {
      model: 'moonshotai/kimi-k2.6',
      apiKey: process.env.OPENROUTER_KIMI_KEY || ''
    },
    {
      model: 'openai/gpt-oss-120b:free',
      apiKey: process.env.OPENROUTER_FALLBACK_KEY || ''
    }
  ];

  // Circuit Breaker state
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_TIME_MS = 60000; // 1 minute

  private isCircuitOpen(): boolean {
    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      const now = Date.now();
      if (now - this.lastFailureTime < this.CIRCUIT_RESET_TIME_MS) {
        return true;
      }
      // Half-open attempt reset
      this.failureCount = 0;
    }
    return false;
  }

  private recordSuccess() {
    this.failureCount = 0;
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  /**
   * Send request to OpenRouter with timeout, retries, exponential backoff, and circuit breaker
   */
  async generateText(prompt: string, systemPrompt?: string, providerIndex = 0, retryCount = 0): Promise<string> {
    if (this.isCircuitOpen()) {
      logger.warn('AI Circuit Breaker is OPEN. Serving graceful fallback response.');
      return this.getFallbackTextResponse(prompt);
    }

    if (providerIndex >= this.providers.length) {
      this.recordFailure();
      logger.error('All OpenRouter AI providers exhausted. Returning fallback.');
      return this.getFallbackTextResponse(prompt);
    }

    const provider = this.providers[providerIndex];
    if (!provider.apiKey) {
      // Skip unconfigured keys and jump to next provider
      return this.generateText(prompt, systemPrompt, providerIndex + 1, 0);
    }

    logger.info('Invoking OpenRouter AI provider', { model: provider.model, attempt: providerIndex + 1 });

    try {
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: provider.model,
          messages
        },
        {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from AI provider');
      }

      this.recordSuccess();
      return content;
    } catch (error: any) {
      logger.warn('AI Provider failed', { model: provider.model, error: error?.message || error });

      // Exponential backoff if retry
      if (retryCount < 1) {
        await new Promise(r => setTimeout(r, 800));
        return this.generateText(prompt, systemPrompt, providerIndex, retryCount + 1);
      }

      // Failover to next provider
      return this.generateText(prompt, systemPrompt, providerIndex + 1, 0);
    }
  }

  /**
   * Generate clean parsed JSON from AI response
   */
  async generateJSON<T = any>(prompt: string, systemPrompt?: string): Promise<T> {
    const jsonInstruction = '\nReturn ONLY a raw JSON string. Do not include markdown code block syntax (like ```json). Just start with [ or { and end with ] or }. Ensure it is perfectly valid JSON.';
    const fullPrompt = prompt + jsonInstruction;

    const text = await this.generateText(fullPrompt, systemPrompt);

    try {
      return this.cleanAndParseJSON<T>(text);
    } catch (err: any) {
      logger.error('Failed to parse JSON from AI response', { raw: text.slice(0, 200), error: err.message });
      throw new Error(`AI failed to return valid JSON structures: ${err.message || ''}`);
    }
  }

  /**
   * Clean, repair, and parse JSON string from AI response
   */
  public cleanAndParseJSON<T = any>(text: string): T {
    let cleaned = text.trim();

    const escapeJSONStrings = (jsonStr: string): string => {
      let result = '';
      let inString = false;
      let isEscaped = false;
      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        if (char === '"' && !isEscaped) {
          inString = !inString;
          result += char;
        } else if (inString) {
          if (char === '\\') {
            isEscaped = !isEscaped;
            result += char;
          } else {
            if (char === '\n') {
              result += '\\n';
            } else if (char === '\r') {
              result += '\\r';
            } else if (char === '\t') {
              result += '\\t';
            } else {
              result += char;
            }
            isEscaped = false;
          }
        } else {
          result += char;
          isEscaped = false;
        }
      }
      return result;
    };

    const repairJSONString = (jsonStr: string): string => {
      let repaired = escapeJSONStrings(jsonStr);
      repaired = repaired.replace(/,\s*([}\]])/g, '$1');
      return repaired;
    };

    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n/, '').replace(/\n\s*```$/, '').trim();
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (e) {
      // Try extracting curly or square brackets
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(extracted) as T;
      } catch (e) {
        cleaned = extracted;
      }
    }

    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const extracted = cleaned.substring(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(extracted) as T;
      } catch (e) {
        cleaned = extracted;
      }
    }

    try {
      const repaired = repairJSONString(cleaned);
      return JSON.parse(repaired) as T;
    } catch (e: any) {
      throw new Error(`JSON parsing failed after all recovery strategies: ${e.message || ''}`);
    }
  }

  private getFallbackTextResponse(prompt: string): string {
    return `### Placement AI Mentor Guidance\n\nI am currently operating in high-resilience mode. Here is a key recommendation for your interview preparation:\n\n* **Structure Your Answer**: Use the **STAR method** (Situation, Task, Action, Result) for behavioral questions.\n* **Technical Clarity**: State your assumptions, write clean modular code, and analyze Time ($O$) and Space ($O$) complexity explicitly.\n* Keep practicing in the Practice Hub and 1v1 PvP Battles to build speed and accuracy!`;
  }
}

export const AIService = new AIServiceClass();
export default AIService;
