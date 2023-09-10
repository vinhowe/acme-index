import { Drawing } from "./drawing-types";

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

type BaseDocumentCell<T> = UniqueObject & {
  type: string;
  documentId: UniqueID;
  createdAt: string;
  updatedAt: string;
  content: T;
};

export interface DocumentTextCell extends BaseDocumentCell<string> {
  type: "text";
}

export interface DocumentDrawingCell extends BaseDocumentCell<Drawing> {
  type: "drawing";
}

export type DocumentCell = DocumentTextCell | DocumentDrawingCell;

export type Document = UniqueObject & {
  title?: string;
  reference?: string;
  // We allow null values because individual cells can be empty
  cells: Array<UniqueID | null>;
  createdAt: string;
  updatedAt: string;
};
