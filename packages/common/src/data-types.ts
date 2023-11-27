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

type BaseStructuredChatResponse = {
  type: string;
}

export interface CompletionResponse extends BaseStructuredChatResponse {
  type: "completion";
  content: string;
}

export interface FunctionCallResponse extends BaseStructuredChatResponse {
  type: "function_call";
  name: string;
  arguments: string;
}

export type StructuredChatResponse = CompletionResponse | FunctionCallResponse;

export type ChatTurn = UniqueObject & {
  chatId: UniqueID;
  child?: UniqueID;
  parent?: UniqueID;
  parents?: UniqueID[];
  root?: UniqueID;
  additionalContextReferences?: string[];
  query: string;
  status: "pending" | "finished" | "error";
  response?: string | StructuredChatResponse[];
  error?: string;
  tokenCount?: number;
  createdAt: string;
};

export type ChatHistoryInfo = UniqueObject & {
  chat: Chat;
  rootTurn: ChatTurn | null;
  currentTurn: ChatTurn | null;
};

export type Reference = UniqueObject & {
  chats: UniqueID[];
  questionSuggestions?: string[];
  createdAt: string;
  updatedAt: string;
};

export type History = UniqueObject & {
  chats: UniqueID[];
};

type BaseDocumentCell<T> = UniqueObject & {
  type: string;
  documentId: UniqueID;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
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
  // Keep track of deleted cells so we can restore them if needed
  deletedCells?: Array<UniqueID>;
  createdAt: string;
  updatedAt: string;
};

export type BaseFlashcard<T> = UniqueObject & {
  type: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  suspended: boolean;
  // Magic for exams
  special: boolean;
  content: T;
};

export interface BasicFlashcard
  extends BaseFlashcard<{
    front: string;
    back: string;
  }> {
  type: "basic";
}

export interface WorkedFlashcard
  extends BaseFlashcard<{
    steps: Array<{
      context: string;
      content: string;
    }>;
  }> {
  type: "worked";
}

export type Flashcard = BasicFlashcard | WorkedFlashcard;
