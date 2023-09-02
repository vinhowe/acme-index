"use client";

import {
  ChatHistoryItem,
  createChat,
  generateTurnStreaming,
  getChat,
  getChats,
  getTurn,
  getTurnsTo,
} from "@/lib/api";
import { buildDisplayReference } from "@/lib/textbook/textbook-ref";
import { Chat, ChatTurn } from "@acme-index/common";
// ChatContext.tsx
import React, { createContext, useReducer, useEffect, Dispatch } from "react";
import { parseRef } from "textref";

export interface WaitingTurn {
  id: "waiting";
  query: string;
  status: "pending";
}

// Define the state shape
interface ChatState {
  isSidebarOpen: boolean;
  chatHistory: ChatHistoryItem[];
  // onCompletionUpdate: (value: string) => void;
  chatData: {
    chat: Chat | null;
    turns: Array<ChatTurn | WaitingTurn>;
  } | null;
  referenceId: string | null;
  referenceInteractions: {
    [referenceId: string]: ChatHistoryItem[];
  };
}

// Define the action shape
type ChatAction =
  | {
      type: "set sidebar open state";
      payload: {
        isOpen: boolean;
      };
    }
  | {
      type: "load chat history";
      payload: {
        chatHistory: ChatHistoryItem[];
        referenceInteractions: {
          [referenceId: string]: ChatHistoryItem[];
        };
      };
    }
  | {
      type: "new chat";
      payload: {
        referenceId: string;
      };
    }
  | {
      type: "load chat";
      payload: {
        chat: Chat;
        turns: ChatTurn[];
      };
    }
  | {
      type: "start chat";
      payload: {
        chat: Chat;
        query: string;
        displayReference: string | null;
      };
    }
  | { type: "send message"; payload: string }
  | {
      type: "add turn waiting for response";
      payload: {
        query: string;
      };
    }
  | {
      type: "start chat stream";
      payload: {
        turn: ChatTurn;
      };
    }
  | {
      type: "finish chat stream";
      payload: {
        turn: ChatTurn;
      };
    }
  | { type: "close chat" };

// Define shape of the context data
interface ChatContextProps {
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
}

// Initial state
const initialState: ChatState = {
  isSidebarOpen: true,
  chatHistory: [],
  // onCompletionUpdate: (_value: string) => {},
  // Following two:
  // - both null: no chat is open
  // - both non-null: existing chat is open
  // - showingReferenceId non-null: new chat is open
  // showingChatId !== null => showingReferenceId !== null
  chatData: null,
  referenceId: null,
  referenceInteractions: {},
};

// Reducer function
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "set sidebar open state":
      return {
        ...state,
        isSidebarOpen: action.payload.isOpen,
      };
    case "load chat history":
      return {
        ...state,
        chatHistory: action.payload.chatHistory,
        referenceInteractions: action.payload.referenceInteractions,
      };
    case "new chat":
      return {
        ...state,
        chatData: null,
        referenceId: action.payload.referenceId,
      };
    case "load chat":
      return {
        ...state,
        chatData: {
          chat: action.payload.chat,
          turns: action.payload.turns,
        },
        referenceId: action.payload.chat.reference,
      };
    case "start chat":
      const chat = action.payload.chat;
      const historyItem = {
        id: chat.id,
        reference: chat.reference,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        description: action.payload.query,
        displayReference: action.payload.displayReference,
      };
      const referenceInteractions = state.referenceInteractions;
      if (!referenceInteractions[chat.reference]) {
        referenceInteractions[chat.reference] = [];
      }
      referenceInteractions[chat.reference].push(historyItem);
      return {
        ...state,
        chatData: {
          chat,
          turns: [],
        },
        chatHistory: [historyItem, ...state.chatHistory],
        referenceInteractions,
      };
    case "add turn waiting for response":
      if (!state.chatData?.chat || !state.chatData?.turns) {
        throw new Error("Chat data is null");
      }

      let chatHistoryItem: ChatHistoryItem;

      const chatHistoryWithoutChat = state.chatHistory.filter((item) => {
        if (item.id === state.chatData?.chat?.id) {
          chatHistoryItem = item;
          return false;
        }
        return true;
      });

      chatHistoryItem!.updatedAt = new Date().toISOString();

      return {
        ...state,
        chatData: {
          ...state.chatData,
          turns: [
            ...state.chatData.turns,
            {
              id: "waiting",
              query: action.payload.query,
              status: "pending",
            },
          ],
        },
        chatHistory: [chatHistoryItem!, ...chatHistoryWithoutChat],
      };
    case "start chat stream":
      if (!state.chatData?.chat || !state.chatData?.turns) {
        throw new Error("Chat data is null");
      }

      return {
        ...state,
        chatData: {
          ...state.chatData,
          chat: {
            ...state.chatData.chat,
            currentTurn: action.payload.turn.id,
          },
          turns: [...state.chatData.turns.slice(0, -1), action.payload.turn],
        },
      };
    case "finish chat stream":
      if (!state.chatData?.chat || !state.chatData?.turns) {
        throw new Error("Chat data is null");
      }

      return {
        ...state,
        chatData: {
          ...state.chatData,
          turns: [
            ...state.chatData.turns.slice(0, -1),
            { ...action.payload.turn, status: "finished" },
          ],
        },
      };
    case "close chat":
      return {
        ...state,
        chatData: null,
        referenceId: null,
      };

    // case "OPEN_CHAT":
    //   return { ...state, isOpen: true, showingChatId: action.payload };
    // case "CLOSE_CHAT":
    //   return { ...state, isOpen: false };
    // case "SEND_MESSAGE":
    //   return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    default:
      return state;
  }
};

// Chat context
export const ChatContext = createContext<ChatContextProps>({
  state: initialState,
  dispatch: () => null,
});

// Chat context provider
export const ChatProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  useEffect(() => {
    const isSidebarOpen = localStorage.getItem("isSidebarOpen");
    if (isSidebarOpen !== null) {
      dispatch({
        type: "set sidebar open state",
        payload: {
          isOpen: JSON.parse(isSidebarOpen),
        },
      });
    }
  }, []);

  // Save isSidebarOpen to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("isSidebarOpen", JSON.stringify(state.isSidebarOpen));
  }, [state.isSidebarOpen]);

  // Download chat history from server
  useEffect(() => {
    const loadChatHistory = async () => {
      const chatHistory = await getChats();
      // Sort by updatedAt, which is an ISO string that needs to be parsed
      chatHistory.sort((a, b) => {
        const aDate = new Date(a.updatedAt);
        const bDate = new Date(b.updatedAt);
        return bDate.getTime() - aDate.getTime();
      });

      // Get current turn for each chat, then get turn with id currentTurn.root
      // —using Promise.all
      const chatHistoryWithCurrentTurns = await Promise.all(
        chatHistory.map(async (chat) => {
          const historyItem: ChatHistoryItem = {
            id: chat.id,
            reference: chat.reference,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            description: null,
            displayReference: null,
          };

          if (!chat.currentTurn) {
            return historyItem;
          }

          const turn = await getTurn(chat.id, chat.currentTurn);
          const reference = parseRef(chat.reference);

          if (reference) {
            historyItem.displayReference = buildDisplayReference(reference);
          }

          if (!turn) {
            return historyItem;
          }

          if (!turn.root) {
            historyItem.description = turn.query;
            return historyItem;
          } else {
            const rootTurn = await getTurn(chat.id, turn.root);
            if (!rootTurn) {
              historyItem.description = turn.query;
              return historyItem;
            }
            historyItem.description = rootTurn.query;
            return historyItem;
          }
        }),
      );

      const referenceInteractions = {} as {
        [referenceId: string]: ChatHistoryItem[];
      };

      for (const chatHistoryItem of chatHistoryWithCurrentTurns) {
        if (!referenceInteractions[chatHistoryItem.reference]) {
          referenceInteractions[chatHistoryItem.reference] = [];
        }
        referenceInteractions[chatHistoryItem.reference].push(chatHistoryItem);
      }

      dispatch({
        type: "load chat history",
        payload: {
          chatHistory: chatHistoryWithCurrentTurns,
          referenceInteractions,
        },
      });
    };
    loadChatHistory();
  }, []);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
};

export const newChat = async (
  referenceId: string,
  dispatch: Dispatch<ChatAction>,
) => {
  dispatch({ type: "set sidebar open state", payload: { isOpen: true } });
  dispatch({ type: "new chat", payload: { referenceId } });
};

export const openChat = async (id: string, dispatch: Dispatch<ChatAction>) => {
  const chat = await getChat(id);
  if (!chat.currentTurn) {
    throw new Error("Chat has no current turn");
  }

  const turns = await getTurnsTo(chat.id, chat.currentTurn);

  dispatch({ type: "load chat", payload: { chat, turns } });
};

export const openHistory = async (dispatch: Dispatch<ChatAction>) => {
  dispatch({ type: "close chat" });
};

export const sendMessage = async (
  query: string,
  chat: Chat | null,
  referenceId: string,
  streamingUpdateCallback: (turn: ChatTurn) => void,
  dispatch: Dispatch<ChatAction>,
) => {
  if (!chat) {
    // Create chat
    chat = (await createChat(referenceId)) as Chat;
    const reference = parseRef(referenceId);

    let displayReference: string | null = null;
    if (reference) {
      displayReference = buildDisplayReference(reference);
    }

    dispatch({
      type: "start chat",
      payload: { chat, query, displayReference },
    });
  }

  dispatch({
    type: "add turn waiting for response",
    payload: { query },
  });

  let isStreamingTurnSet = false;

  const onupdate = (turn: ChatTurn) => {
    if (!isStreamingTurnSet) {
      isStreamingTurnSet = true;
      dispatch({
        type: "start chat stream",
        payload: { turn },
      });
    }
    streamingUpdateCallback(turn);
  };

  // Generate turn streaming
  const turn = await generateTurnStreaming(chat.id, chat.currentTurn, query, {
    onopen: () => {},
    onupdate,
  });

  if (!turn) {
    // TODO: Go to error state
    return;
  }

  dispatch({ type: "finish chat stream", payload: { turn } });
};
