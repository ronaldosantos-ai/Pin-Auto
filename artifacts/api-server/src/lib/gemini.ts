import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerativeModel } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

function getApiKey(): string {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required but was not provided. " +
        "Set it in your Railway project Variables.",
    );
  }
  return apiKey;
}

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(getApiKey());
  }
  return _client;
}

export function getTextModel(modelName = "gemini-2.5-flash"): GenerativeModel {
  return getClient().getGenerativeModel({ model: modelName });
}

export function getGeminiApiKey(): string {
  return getApiKey();
}
