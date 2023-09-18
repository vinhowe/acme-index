import { fetchEventSource } from "@microsoft/fetch-event-source";
import { cache } from "react";
import {
  Chat,
  ChatTurn,
  ExercisesChapter,
  Reference,
  TextChapter,
  Document,
  DocumentCell,
  ChatHistoryInfo,
} from "@acme-index/common";

export interface ChatHistoryItem {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  displayReference: string | null;
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787/api";

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

export async function getChatHistory(): Promise<ChatHistoryInfo[]> {
  return (
    await fetch(`${API_URL}/chat/history`, {
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
    signal,
  }: {
    onopen?: (response: Response) => void;
    onupdate?: (turn: ChatTurn) => void;
    signal?: AbortSignal;
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
        if (!turn?.response) {
          turn!.response = "";
        }
        if (update.completion) {
          turn!.response += update.completion;
        }
        if (update.tokenCount) {
          turn!.tokenCount = update.tokenCount;
        }
        if (onupdate && turn) {
          onupdate(turn);
        }
      } else if (message.event === "error") {
        turn!.error = message.data;
      } else if (message.event === "start") {
        turn = JSON.parse(message.data);
      }
    },
    signal,
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

export const createDocument = async (
  id: string,
  title?: string,
): Promise<Document> => {
  // Name is part of the URL
  const response = await fetch(`${API_URL}/document/${id}`, {
    method: "POST",
    body: JSON.stringify({ title }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};

export const getDocument = async (id: string): Promise<Document> => {
  const response = await fetch(`${API_URL}/document/${id}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};

export const updateDocument = async (
  id: string,
  update: Partial<Document>,
): Promise<Document> => {
  const response = await fetch(`${API_URL}/document/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(update),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};

export const getDocuments = async (): Promise<Document[]> => {
  const response = await fetch(`${API_URL}/document`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};

export const createDocumentCell = async (
  documentId: string,
  cell: Partial<DocumentCell>,
): Promise<DocumentCell> => {
  const response = await fetch(`${API_URL}/document/${documentId}/cell`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cell),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};

export const updateDocumentCell = async (
  documentId: string,
  cellId: string,
  cell: Partial<DocumentCell>,
): Promise<DocumentCell> => {
  const response = await fetch(
    `${API_URL}/document/${documentId}/cell/${cellId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cell),
    },
  );
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};

export const getDocumentCells = async (
  documentId: string,
): Promise<DocumentCell[]> => {
  const response = await fetch(`${API_URL}/document/${documentId}/cell`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};

export const getDocumentCell = async (
  documentId: string,
  cellId: string,
): Promise<DocumentCell> => {
  const response = await fetch(
    `${API_URL}/document/${documentId}/cell/${cellId}`,
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
};

export const uploadFile = async (file: File): Promise<{ id: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/file`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
};
