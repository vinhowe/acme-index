export type UniqueID = string;

export interface UniqueObject {
  id: UniqueID;
}

export type ChatProvider = "openai" | "anthropic";

export type Chat = UniqueObject & {
  reference: string;
  rootTurns: UniqueID[];
  currentTurn: UniqueID | null;
  provider: ChatProvider;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatTurn = UniqueObject & {
  chatId: UniqueID;
  child?: UniqueID;
  parent?: UniqueID;
  parents?: UniqueID[];
  root?: UniqueID;
  additionalContextReferences?: string[];
  query: string;
  status: "pending" | "finished" | "error";
  response?: string;
  error?: string;
  createdAt: string;
};

export type Reference = UniqueObject & {
  chats: UniqueID[];
};

export type History = UniqueObject & {
  chats: UniqueID[];
};
