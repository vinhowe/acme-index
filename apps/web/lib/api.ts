import { fetchEventSource } from "@microsoft/fetch-event-source";
import { ExercisesChapter, TextChapter } from "./textbook/types";
import { cache } from "react";

export interface ChatHistoryItem {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  displayReference: string | null;
}

export interface Chat {
  id: string;
  reference: string;
  rootTurns: string[];
  currentTurn: string | null;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatTurn {
  id: string;
  query: string;
  status: "pending" | "finished" | "error";
  root?: string;
  response?: string;
  error?: string;
}

export interface Reference {
  namespace: string;
  book: string;
  type: string;
  chapter: string;
  section?: string;
  subsection?: string;
  chats: string[];
}

// export interface ReferenceInteractions {
//   id: string;
//   chats: string[];
// }

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787/api";

export async function createChat(reference?: string) {
  return (
    await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        reference: reference || null,
      }),
    })
  ).json();
}

export async function getChat(id: string): Promise<Chat> {
  return (
    await fetch(`${API_URL}/chat/${id}`, {
      credentials: "include",
    })
  ).json();
}

export async function getChats(): Promise<Chat[]> {
  console.log(process.env.NEXT_PUBLIC_API_URL);
  return (
    await fetch(`${API_URL}/chat`, {
      credentials: "include",
    })
  ).json();
}

export async function getTurn(
  chatId: string,
  turnId: string,
): Promise<ChatTurn> {
  return (
    await fetch(`${API_URL}/chat/${chatId}/turn/${turnId}`, {
      credentials: "include",
    })
  ).json();
}

export async function getReference(reference: string): Promise<Reference> {
  return (
    await fetch(`${API_URL}/reference/${reference}`, {
      credentials: "include",
    })
  ).json();
}

// export async function getReferenceInteractions(): Promise<
//   ReferenceInteractions[]
// > {
//   return (await fetch(`${API_URL}/reference-interactions`)).json();
// }

export async function getTurnsTo(
  chatId: string,
  turnId: string,
): Promise<ChatTurn[]> {
  return (
    await fetch(`${API_URL}/chat/${chatId}/turns-to/${turnId}`, {
      credentials: "include",
    })
  ).json();
}

export async function generateTurnStreaming(
  chatId: string,
  parentId: string | null,
  query: string,
  {
    onopen,
    onupdate,
  }: {
    onopen?: (response: Response) => void;
    onupdate?: (turn: ChatTurn) => void;
  } = {},
): Promise<ChatTurn | null> {
  let turn: ChatTurn | null = null;

  await fetchEventSource(`${API_URL}/chat/${chatId}/turn`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parentId,
      query,
      streaming: true,
    }),
    onopen: async (response) => {
      if (onopen) {
        onopen(response);
      }
    },
    onmessage: (message) => {
      if (message.event === "update") {
        const update = JSON.parse(message.data);
        if (!turn!.response) {
          turn!.response = "";
        }
        turn!.response += update.completion;
        if (onupdate && turn) {
          onupdate(turn);
        }
      } else if (message.event === "error") {
        turn!.error = message.data;
      } else if (message.event === "start") {
        turn = JSON.parse(message.data);
      }
    },
  });

  return turn;
}

export const getTextbookChapterText = cache(
  async (volume: string, chapter: string): Promise<TextChapter> => {
    // use fetch api to get textbook markdown
    const response = await fetch(
      `${API_URL}/textbook/text/acme:${volume}/text/${chapter}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }
    return json;
  },
);

export const getTextbookChapterExercises = cache(
  async (volume: string, chapter: string): Promise<ExercisesChapter> => {
    // use fetch api to get textbook markdown
    const response = await fetch(
      `${API_URL}/textbook/exercises/acme:${volume}/exercise/${chapter}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }
    return json;
  },
);

export const getTextbookChapters = cache(
  async (volume: string): Promise<string[]> => {
    // use fetch api to get textbook markdown
    const response = await fetch(
      `${API_URL}/textbook/chapters/acme:${volume}/text`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }
    return json;
  },
);
