import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerativeModel } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required but was not provided. " +
          "Set it in your Railway project Variables.",
      );
    }
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

export function getTextModel(modelName = "gemini-2.5-flash"): GenerativeModel {
  return getClient().getGenerativeModel({ model: modelName });
}

export function getImageModel(): GenerativeModel {
  return getClient().getGenerativeModel({
    model: "gemini-2.5-flash-image",
  });
}
