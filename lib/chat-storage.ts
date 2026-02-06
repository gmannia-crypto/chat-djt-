import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const CONVERSATIONS_KEY = "chatdjt_conversations";

let messageCounter = 0;
export function generateUniqueId(): string {
  messageCounter++;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function getAllConversations(): Promise<Conversation[]> {
  try {
    const data = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    if (!data) return [];
    const conversations: Conversation[] = JSON.parse(data);
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const conversations = await getAllConversations();
  return conversations.find((c) => c.id === id) || null;
}

export async function createConversation(title: string = "New Chat"): Promise<Conversation> {
  const conversations = await getAllConversations();
  const newConversation: Conversation = {
    id: generateConversationId(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  conversations.unshift(newConversation);
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  return newConversation;
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
  const conversations = await getAllConversations();
  const index = conversations.findIndex((c) => c.id === id);
  if (index !== -1) {
    conversations[index] = { ...conversations[index], ...updates, updatedAt: Date.now() };
    await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }
}

export async function saveMessages(conversationId: string, messages: Message[]): Promise<void> {
  const conversations = await getAllConversations();
  const index = conversations.findIndex((c) => c.id === conversationId);
  if (index !== -1) {
    conversations[index].messages = messages;
    conversations[index].updatedAt = Date.now();
    if (messages.length > 0) {
      const lastUserMsg = messages.filter((m) => m.role === "user").pop();
      if (lastUserMsg) {
        conversations[index].title = lastUserMsg.content.slice(0, 50) + (lastUserMsg.content.length > 50 ? "..." : "");
      }
    }
    await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await getAllConversations();
  const filtered = conversations.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(filtered));
}

export async function clearAllConversations(): Promise<void> {
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify([]));
}

const QUESTION_COUNT_KEY = "chatdjt_question_count";
const FREE_QUESTION_LIMIT = 3;

export async function getQuestionCount(): Promise<number> {
  try {
    const count = await AsyncStorage.getItem(QUESTION_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch {
    return 0;
  }
}

export async function incrementQuestionCount(): Promise<number> {
  const current = await getQuestionCount();
  const newCount = current + 1;
  await AsyncStorage.setItem(QUESTION_COUNT_KEY, String(newCount));
  return newCount;
}

export function getFreeQuestionLimit(): number {
  return FREE_QUESTION_LIMIT;
}

export async function hasRemainingFreeQuestions(): Promise<boolean> {
  const count = await getQuestionCount();
  return count < FREE_QUESTION_LIMIT;
}

export async function getRemainingFreeQuestions(): Promise<number> {
  const count = await getQuestionCount();
  return Math.max(0, FREE_QUESTION_LIMIT - count);
}
