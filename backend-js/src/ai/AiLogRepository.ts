import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import { tryGetMongoClient } from "@/platform/mongoConfig.js";
import { getDatabaseName } from "@/platform/mongoUri.js";

export type AiLogDocument = {
  id: string;
  action: string;
  prompt: string;
  response: string;
  tokens_used: number;
  created_at: Date;
  model: string;
  error?: string;
};

export type AiLogInsert = {
  action: string;
  prompt: string;
  response: string;
  tokens_used: number;
  model: string;
  error?: string;
};

const COLLECTION_NAME = "ai_logs";

async function getCollection(): Promise<Collection<AiLogDocument> | null> {
  const client = await tryGetMongoClient();
  if (!client) {
    return null;
  }
  return client.db(getDatabaseName()).collection<AiLogDocument>(COLLECTION_NAME);
}

/**
 * Append-only audit log for AI calls (success and failure).
 */
export async function appendAiLog(entry: AiLogInsert): Promise<void> {
  const collection = await getCollection();
  if (!collection) {
    return;
  }
  const doc: AiLogDocument = {
    id: randomUUID(),
    action: entry.action,
    prompt: entry.prompt,
    response: entry.response,
    tokens_used: entry.tokens_used,
    created_at: new Date(),
    model: entry.model,
    ...(entry.error ? { error: entry.error } : {}),
  };

  await collection.insertOne(doc);
}
