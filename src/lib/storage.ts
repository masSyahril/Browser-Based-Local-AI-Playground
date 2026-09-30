import { createStore, del, entries, set } from "idb-keyval";
import { DEFAULT_MODEL_KEY } from "./models";
import type { Conversation, Settings } from "./types";

/**
 * Conversations live in IndexedDB (no 5 MB cap, async, off the render path).
 * Settings are tiny and read synchronously on mount, so they use localStorage.
 */

const conversationStore =
  typeof indexedDB !== "undefined"
    ? createStore("local-ai-playground", "conversations")
    : undefined;

export async function loadConversations(): Promise<Conversation[]> {
  if (!conversationStore) return [];
  try {
    const all = await entries<string, Conversation>(conversationStore);
    return all.map(([, c]) => c).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error("Failed to read conversations from IndexedDB", err);
    return [];
  }
}

export async function saveConversation(conversation: Conversation) {
  if (!conversationStore) return;
  try {
    await set(conversation.id, conversation, conversationStore);
  } catch (err) {
    console.error("Failed to persist conversation", err);
  }
}

export async function deleteConversation(id: string) {
  if (!conversationStore) return;
  try {
    await del(id, conversationStore);
  } catch (err) {
    console.error("Failed to delete conversation", err);
  }
}

const SETTINGS_KEY = "local-ai-playground:settings:v1";

export const DEFAULT_SETTINGS: Settings = {
  modelKey: DEFAULT_MODEL_KEY,
  systemPrompt:
    "You are a helpful, concise assistant running entirely in the user's browser. Use Markdown for formatting and fenced code blocks for code.",
  useSystemPrompt: true,
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 1024,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode / quota exceeded: settings simply won't persist.
  }
}
