"use client";
import { ChatHistoryItem, createFlashcard, getFlashcard } from "@/lib/api";
import classNames from "classnames";
import {
  MutableRefObject,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  ChatContext,
  WaitingTurn,
  editTurn,
  openChat,
  openHistory,
  sendMessage,
} from "./ChatProvider";
import wikiLinkPlugin from "@/lib/textbook/link-parsing/remark-plugin";
import { parseRef } from "textref";
import { buildDisplayReference } from "@/lib/textbook/textbook-ref";
import { ChatTurn, CompletionResponse } from "@acme-index/common";
import { ReactMarkdownOptions } from "react-markdown/lib/react-markdown";
import rehypeRaw from "rehype-raw";

const ChatInput = ({
  streaming = false,
  onSubmit,
  initialValue = "",
}: {
  streaming?: boolean;
  onSubmit: (value: string) => void;
  initialValue?: string;
}) => {
  const [composingText, setComposingText] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textareaRef || !textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = "inherit";
    textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
    textareaRef.current.style.overflow = `${
      textareaRef?.current?.scrollHeight > 400 ? "auto" : "hidden"
    }`;
  }, [composingText]);

  useEffect(() => {
    setComposingText(initialValue);
  }, [initialValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComposingText(e.target.value);
    },
    [],
  );

  const submitText = useCallback(() => {
    onSubmit(composingText);
    setComposingText("");
  }, [composingText, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey || e.metaKey) e.stopPropagation();

      switch (e.key) {
        case "Enter": {
          if (e.ctrlKey || e.metaKey) {
            submitText();
          }
          break;
        }
      }
    },
    [submitText],
  );
  return (
    <div className={classNames("relative")}>
      <textarea
        style={{
          maxHeight: "400px",
        }}
        className={classNames(
          streaming
            ? "bg-green-300/40 dark:bg-green-900/40"
            : "bg-neutral-300 dark:bg-neutral-700",
          "mx-0",
          "resize-none",
          "px-2",
          "py-2",
          "w-full",
          "overflow-hidden",
          "text-base",
          "block",
          "pr-10",
          "min-w-0",
          "rounded-md",
          streaming
            ? "dark:placeholder:text-green-200 placeholder:text-green-800"
            : "dark:placeholder:text-neutral-400 placeholder:text-neutral-500",
        )}
        placeholder={streaming ? "Responding..." : "Ask a question..."}
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        value={composingText}
        ref={textareaRef}
        disabled={streaming}
      />
      <button
        className={classNames(
          "absolute",
          "p-1.5",
          "right-0",
          "top-0",
          "my-[4px]",
          "mr-[4px]",
          "text-white",
          "dark:text-black",
          streaming
            ? "bg-green-700 dark:bg-green-400"
            : "bg-blue-700 dark:bg-blue-400",
          "rounded",
          "aspect-square",
          "flex",
          "justify-center",
          "items-center",
        )}
        disabled={!composingText && !streaming}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          submitText();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          submitText();
        }}
      >
        <span className="select-none material-symbols-rounded leading-[0] text-xl">
          {streaming ? "stop" : "send"}
        </span>
      </button>
    </div>
  );
};

const StreamingChatTurnSection = ({
  turn: emptyTurn,
  streamingRef,
}: {
  turn: Pick<ChatTurn, "query">;
  streamingRef: MutableRefObject<(turn: ChatTurn) => void>;
}) => {
  const [turn, setTurn] =
    useState<Pick<ChatTurn, "query" | "response">>(emptyTurn);

  useEffect(() => {
    streamingRef.current = (partial) => {
      setTurn((lastTurn) => ({
        ...lastTurn,
        response: partial.response,
      }));
    };
  }, [streamingRef]);

  return <ChatTurnSection turn={turn} />;
};

const REMARK_PLUGINS: ReactMarkdownOptions["remarkPlugins"] = [
  remarkGfm,
  remarkMath,
  wikiLinkPlugin,
];
const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [
  // @ts-expect-error
  rehypeRaw,
  rehypeKatex,
  rehypeMinifyWhitespace,
];
const REACT_MARKDOWN_COMPONENTS: ReactMarkdownOptions["components"] = {
  div: ({ node, className, children, ...props }) => {
    // if math isn't in classname, render as normal
    if (!className?.includes("math-display")) {
      return <div {...props}>{children}</div>;
    }

    return (
      <div {...props} className={className}>
        <div className="katex-display-wrapper">{children}</div>
      </div>
    );
  },
};

const MemoizedReactMarkdown = memo(ReactMarkdown);

const ChatTurnMarkdownRenderer = ({ children }: { children: string }) => {
  return (
    <MemoizedReactMarkdown
      className={classNames(
        "mb-2",
        "prose",
        "prose-neutral",
        "dark:prose-invert",
        "w-full",
      )}
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={REACT_MARKDOWN_COMPONENTS}
    >
      {children}
    </MemoizedReactMarkdown>
  );
};

const ChatBasicFlashcardSuggestionViewer = ({
  suggestion,
}: {
  suggestion: { back: string; front: string; reference?: string };
}) => {
  const createSuggestedFlashcard = useCallback(() => {
    return createFlashcard({
      type: "basic",
      content: {
        front: suggestion.front,
        back: suggestion.back,
      },
      reference: suggestion.reference,
    });
  }, [suggestion.back, suggestion.front, suggestion.reference]);

  const createAndOpenSuggestedFlashcard = useCallback(() => {
    createSuggestedFlashcard().then((flashcard) => {
      window.open(`/flashcard/edit/${flashcard.id}`, "_blank");
    });
  }, [createSuggestedFlashcard]);

  return (
    <div className="my-2 flex flex-col items-start p-4 rounded border dark:border-blue-800/50 dark:bg-blue-950/20 w-full">
      <div className="flex justify-between w-full items-baseline">
        <span className="uppercase font-mono text-xs mb-4 font-bold tracking-wider dark:text-neutral-300">
          Flashcard
        </span>
        <span className="font-button text-sm">{suggestion.reference}</span>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <ChatTurnMarkdownRenderer>{suggestion.front}</ChatTurnMarkdownRenderer>
        <hr className="dark:border-t-neutral-700" />
        <ChatTurnMarkdownRenderer>{suggestion.back}</ChatTurnMarkdownRenderer>
      </div>
      <div className="w-full flex justify-center mt-1 gap-2">
        <button
          className={classNames(
            "material-symbols-rounded select-none text-xl dark:bg-blue-950 w-full rounded py-1",
          )}
          role="button"
          onClick={createSuggestedFlashcard}
        >
          add
        </button>
        <button
          className={classNames(
            "material-symbols-rounded select-none text-xl dark:bg-blue-950 w-full rounded py-1",
          )}
          role="button"
          onClick={createAndOpenSuggestedFlashcard}
        >
          open_in_new
        </button>
      </div>
    </div>
  );
};

const ChatWorkedFlashcardSuggestionViewer = ({
  suggestion,
}: {
  suggestion: {
    steps: {
      context: string;
      content: string;
    }[];
    reference?: string;
  };
}) => {
  const createSuggestedFlashcard = useCallback(() => {
    return createFlashcard({
      type: "worked",
      content: {
        steps: suggestion.steps,
      },
      reference: suggestion.reference,
    });
  }, [suggestion.reference, suggestion.steps]);

  const createAndOpenSuggestedFlashcard = useCallback(() => {
    createSuggestedFlashcard().then((flashcard) => {
      window.open(`/flashcard/edit/${flashcard.id}`, "_blank");
    });
  }, [createSuggestedFlashcard]);

  return (
    <div className="my-2 flex flex-col items-start p-4 rounded border dark:border-blue-800/50 dark:bg-blue-950/20 w-full">
      <span className="uppercase font-mono text-xs mb-3 font-bold tracking-wider dark:text-neutral-300">
        Worked Flashcard
      </span>
      <div className="flex flex-col gap-2">
        {suggestion.steps.map((step, i) => (
          <div key={i} className="flex flex-col gap-2">
            {step.context && (
              <>
                <hr className="dark:border-t-neutral-700" />
                <ChatTurnMarkdownRenderer>
                  {step.context}
                </ChatTurnMarkdownRenderer>
              </>
            )}
            <hr className="dark:border-t-neutral-700" />
            <ChatTurnMarkdownRenderer>{step.content}</ChatTurnMarkdownRenderer>
          </div>
        ))}
      </div>
      <div className="w-full flex justify-center mt-1 gap-2">
        <button
          className={classNames(
            "material-symbols-rounded select-none text-xl dark:bg-blue-950 w-full rounded py-1",
          )}
          role="button"
          onClick={createSuggestedFlashcard}
        >
          add
        </button>
        <button
          className={classNames(
            "material-symbols-rounded select-none text-xl dark:bg-blue-950 w-full rounded py-1",
          )}
          role="button"
          onClick={createAndOpenSuggestedFlashcard}
        >
          open_in_new
        </button>
      </div>
    </div>
  );
};

const ChatTurnSection = ({
  turn,
  onEdit,
}: {
  turn: Pick<ChatTurn, "query" | "response">;
  onEdit?: () => void;
}) => {
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(
      typeof turn.response === "string"
        ? turn.response
        : turn.response
            ?.filter((chunk) => chunk.type === "completion" && chunk.content)
            ?.map((chunk) => (chunk as CompletionResponse).content)
            ?.join("") || "",
    );
  }, [turn.response]);

  return (
    <div className="flex flex-col items-start">
      <div className="my-2 w-full flex gap-4 justify-between items-center">
        <div
          className={classNames(
            "px-2.5",
            "py-1.5",
            "max-w-[90%]",
            "bg-neutral-200",
            "dark:bg-neutral-600",
            "rounded-xl",
          )}
        >
          <MemoizedReactMarkdown
            className={classNames(
              "prose",
              "prose-neutral",
              "dark:text-white",
              "text-black",
              "dark:prose-invert",
            )}
            remarkPlugins={REMARK_PLUGINS}
            rehypePlugins={REHYPE_PLUGINS}
            components={REACT_MARKDOWN_COMPONENTS}
          >
            {turn.query}
          </MemoizedReactMarkdown>
        </div>
        <div className="flex gap-2 text-neutral-700 dark:text-neutral-500">
          {onEdit && (
            <button
              className={classNames(
                "material-symbols-rounded text-lg select-none",
              )}
              role="button"
              onClick={onEdit}
            >
              edit
            </button>
          )}
          <button
            className={classNames(
              "material-symbols-rounded text-lg select-none",
            )}
            role="button"
            onClick={copyToClipboard}
          >
            content_copy
          </button>
        </div>
      </div>
      {turn.response &&
        (typeof turn.response === "string" ? (
          <ChatTurnMarkdownRenderer>
            {turn.response || ""}
          </ChatTurnMarkdownRenderer>
        ) : (
          turn.response?.map((chunk, i) => {
            if (chunk.type === "completion") {
              return (
                <ChatTurnMarkdownRenderer key={i}>
                  {chunk.content}
                </ChatTurnMarkdownRenderer>
              );
            } else {
              let functionData;
              try {
                functionData = JSON.parse(
                  chunk.arguments.replaceAll("\\", "\\\\").replaceAll("\n", ""),
                );
              } catch (e) {
                return chunk.arguments;
              }
              console.log(functionData);
              if (chunk.name === "create_basic_flashcard") {
                return (
                  <ChatBasicFlashcardSuggestionViewer
                    key={i}
                    suggestion={
                      {
                        front: functionData.front
                          .replaceAll("\\\\", "\\")
                          .replaceAll("\\n", "\n"),
                        back: functionData.back
                          .replaceAll("\\\\", "\\")
                          .replaceAll("\\n", "\n"),
                        reference: functionData.reference,
                      } as {
                        front: string;
                        back: string;
                        reference?: string;
                      }
                    }
                  />
                );
              } else if (chunk.name === "create_basic_flashcards") {
                return (
                  <div key={i}>
                    {functionData.cards.map(
                      (
                        flashcard: {
                          front: string;
                          back: string;
                          reference: string;
                        },
                        i,
                      ) => (
                        <ChatBasicFlashcardSuggestionViewer
                          key={i}
                          suggestion={{
                            front: flashcard.front
                              .replaceAll("\\\\", "\\")
                              .replaceAll("\\n", "\n"),
                            back: flashcard.back
                              .replaceAll("\\\\", "\\")
                              .replaceAll("\\n", "\n"),
                            reference: flashcard.reference,
                          }}
                        />
                      ),
                    )}
                  </div>
                );
              } else if (chunk.name === "create_worked_flashcard") {
                return (
                  <ChatWorkedFlashcardSuggestionViewer
                    key={i}
                    suggestion={
                      {
                        steps: functionData.steps.map((step: any) => ({
                          context: step.context
                            ?.replaceAll("\\\\", "\\")
                            ?.replaceAll("\\n", "\n"),
                          content: step.content
                            .replaceAll("\\\\", "\\")
                            .replaceAll("\\n", "\n"),
                        })),
                        reference: functionData.reference,
                      } as {
                        steps: { context: string; content: string }[];
                        reference?: string;
                      }
                    }
                  />
                );
              } else if (chunk.name === "create_worked_flashcards") {
                return (
                  <div key={i}>
                    {functionData.cards.map(
                      (
                        flashcard: {
                          steps: { context: string; content: string }[];
                          reference: string;
                        },
                        i,
                      ) => (
                        <ChatWorkedFlashcardSuggestionViewer
                          key={i}
                          suggestion={{
                            steps: flashcard.steps.map((step: any) => ({
                              context: step.context
                                ?.replaceAll("\\\\", "\\")
                                ?.replaceAll("\\n", "\n"),
                              content: step.content
                                .replaceAll("\\\\", "\\")
                                .replaceAll("\\n", "\n"),
                            })),
                            reference: flashcard.reference,
                          }}
                        />
                      ),
                    )}
                  </div>
                );
              }
              return `Unknown function: ${chunk.name}`;
            }
          })
        ))}
    </div>
  );
};

const ChatSession = ({ referenceId }: { referenceId: string }) => {
  const { dispatch, state } = useContext(ChatContext);
  const chat = state.chatData?.chat;

  const [turns, setTurns] = useState<Array<ChatTurn | WaitingTurn> | null>(
    null,
  );
  const [streamingTurn, setStreamingTurn] = useState<ChatTurn | null>(null);
  const [streaming, setStreaming] = useState<boolean>(false);

  const [composingText, setComposingText] = useState<string>("");

  const streamingUpdateRef = useRef<(turn: ChatTurn) => void>(
    (_turn: ChatTurn) => {},
  );
  const abortSignalRef = useRef<AbortController | null>(null);
  const lastTimeClickedRef = useRef<number>(0);

  const displayReference = useMemo(() => {
    const reference = parseRef(referenceId);
    if (!reference) {
      return null;
    } else {
      return buildDisplayReference(reference);
    }
  }, [referenceId]);

  useEffect(() => {
    const turns = state.chatData?.turns;
    if (!turns) {
      if (streamingTurn) {
        setStreamingTurn(null);
      }
      setTurns(null);
      return;
    }

    if (turns.length === 0) {
      if (streamingTurn) {
        setStreamingTurn(null);
      }
      setTurns([]);
      return;
    }

    if (streaming && streamingTurn && streamingTurn.chatId === chat?.id) {
      setTurns(turns.slice(0, -1));
    } else {
      setTurns(turns);
      if (streamingTurn) {
        setStreamingTurn(null);
      }
    }
  }, [chat?.id, state.chatData?.turns, streamingTurn, streaming]);

  useEffect(() => {
    if (state?.initialComposingText) {
      setComposingText(state.initialComposingText);
    }
  }, [state?.initialComposingText]);

  const cancelStreaming = useCallback(() => {
    if (abortSignalRef.current) {
      abortSignalRef.current.abort();
      abortSignalRef.current = null;
    }
  }, []);

  const handleChatSubmit = useCallback(
    async (query: string) => {
      const now = Date.now();
      // Do this to debounce double clicks
      if (now - lastTimeClickedRef.current < 1000) {
        return;
      }
      lastTimeClickedRef.current = now;
      if (streaming) {
        cancelStreaming();
        setStreamingTurn(null);
        return;
      }
      if (abortSignalRef.current) {
        await abortSignalRef.current.abort();
        abortSignalRef.current = null;
      }
      abortSignalRef.current = new AbortController();
      dispatch({
        type: "set initial composing text",
        payload: {
          text: "",
        },
      });
      setStreaming(true);
      setStreamingTurn({
        query,
        status: "pending",
        chatId: chat?.id,
      } as ChatTurn);
      let streamingTurnSet = false;
      await sendMessage(
        query,
        turns?.length ? turns[turns.length - 1].id : null,
        chat ?? null,
        referenceId,
        (turn: ChatTurn) => {
          if (!streamingTurnSet) {
            setStreamingTurn(turn);
            streamingTurnSet = true;
          }
          streamingUpdateRef.current(turn);
        },
        dispatch,
        abortSignalRef.current.signal,
      );
      abortSignalRef.current = null;
      setStreaming(false);
    },
    [chat, dispatch, referenceId, turns, streaming, cancelStreaming],
  );

  const handleEditTurn = useCallback(
    (turn: ChatTurn) => {
      if (!chat) {
        return;
      }
      editTurn(chat, turn, dispatch);
    },
    [dispatch, chat],
  );

  const lastTurn = turns?.length ? turns[turns.length - 1] : null;
  let tokenCount: number | null = null;
  if (lastTurn && lastTurn.status !== "pending" && "tokenCount" in lastTurn) {
    tokenCount = lastTurn.tokenCount ?? null;
  }

  return (
    <div className="overflow-hidden flex flex-col flex-1 w-full h-full px-4 py-4">
      <div className="flex flex-wrap w-full justify-between items-baseline mb-4 gap-2">
        {referenceId && (
          <div className="flex justify-start gap-1">
            <h2 className="text-lg font-button">
              {displayReference || referenceId}
            </h2>
          </div>
        )}
        {chat && (
          <div className="flex justify-start gap-1">
            <div
              className={classNames(
                "font-button",
                "text-sm",
                "px-1",
                "py-0.5",
                "text-blue-900",
                "dark:text-blue-200",
                "bg-blue-200",
                "dark:bg-blue-900",
                "rounded",
              )}
            >
              {chat.provider}/{chat.model}
            </div>
          </div>
        )}
      </div>
      <div className="shrink grow flex flex-col justify-between overflow-scroll">
        <div className="shrink grow overflow-scroll -mt-4 pt-4 -mb-5 pb-5 -mx-4 px-4">
          <div>
            <div>
              {turns &&
                turns.map((turn) => (
                  <ChatTurnSection
                    key={turn.id}
                    turn={turn}
                    onEdit={() => handleEditTurn(turn as ChatTurn)}
                  />
                ))}
              {streamingTurn && (
                <StreamingChatTurnSection
                  streamingRef={streamingUpdateRef}
                  turn={streamingTurn}
                  key={streamingTurn?.id}
                />
              )}
            </div>
          </div>
        </div>
        <div>
          <div className={classNames(turns?.length && "mt-4")}>
            <ChatInput
              onSubmit={handleChatSubmit}
              streaming={streaming}
              initialValue={composingText}
            />
          </div>
          {chat && (
            <div className="font-button text-xs mt-2 flex justify-between gap-2">
              <span className="opacity-40">chat {chat?.id}</span>
              <span className="dark:text-green-400 text-green-600">
                {tokenCount !== null ? `${tokenCount} tokens` : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatToggleButton = ({
  isOpen = false,
  onClick,
}: {
  isOpen?: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      className="font-mono px-3 h-full bg-green-600 dark:bg-green-500 text-green-50 dark:text-green-950 flex items-center select-none gap-2"
      onClick={onClick}
    >
      Chat
      <span className="material-symbols-rounded text-lg">
        {isOpen ? "right_panel_close" : "right_panel_open"}
      </span>
    </button>
  );
};

const ChatTopBar = ({
  history,
  activeId,
}: {
  history: ChatHistoryItem[];
  activeId: string | null;
}) => {
  const { dispatch } = useContext(ChatContext);
  return (
    <div className="w-full flex justify-start items-center h-12 shrink-0 dark:bg-neutral-800 bg-neutral-200">
      <ChatToggleButton
        isOpen
        onClick={() =>
          dispatch({
            type: "set sidebar open state",
            payload: {
              isOpen: false,
            },
          })
        }
      />
      <div className="flex items-start h-full gap-px overflow-x-scroll bg-neutral-300 dark:bg-neutral-700 gap-x-px pr-px">
        <div
          className={classNames(
            "flex items-center align-center px-3 cursor-pointer h-full",
            !activeId
              ? "dark:bg-[#101010] bg-neutral-100"
              : "dark:bg-neutral-800 bg-neutral-200",
          )}
          onClick={() => openHistory(dispatch)}
        >
          <span className="material-symbols-rounded select-none text-lg">
            history
          </span>
        </div>
        {history.map((item) => (
          <div
            key={item.id}
            className={classNames(
              "flex flex-col items-start justify-center px-2 cursor-pointer h-full font-button text-sm w-32",
              item.id === activeId
                ? "dark:bg-[#101010] bg-neutral-100"
                : "dark:bg-neutral-800 bg-neutral-200",
            )}
            onClick={() => openChat(item.id, dispatch)}
          >
            <span className="text-[11px] font-mono tracking-wider uppercase opacity-80 inline-block truncate max-w-full">
              {item.displayReference || item.reference}
            </span>
            <span className="inline-block truncate max-w-full">
              {item.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChatHistoryPanel: React.FC = () => {
  const { state, dispatch } = useContext(ChatContext);

  return (
    <div className="w-full py-4 px-4 overflow-scroll">
      <div className="flex flex-col w-full gap-2">
        {state.chatHistory.map((item) => (
          <div
            key={item.id}
            className="flex items-baseline cursor-pointer font-sans gap-3 text-base"
            onClick={() => openChat(item.id, dispatch)}
          >
            <span className="font-mono tracking-wider uppercase opacity-80 shrink-0 text-xs">
              {item.displayReference || item.reference}
            </span>
            <span className="line-clamp-2">{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChatSidebar: React.FC = () => {
  const { state, dispatch } = useContext(ChatContext);
  return (
    <div
      className={classNames(
        "flex",
        state.isSidebarOpen
          ? "flex-col w-full h-full bg-neutral-100 dark:bg-[#101010]"
          : "",
      )}
    >
      {state.isSidebarOpen ? (
        <>
          <ChatTopBar
            history={state.chatHistory}
            activeId={state?.chatData?.chat?.id || state?.referenceId || null}
          />
          {state.referenceId ? (
            <ChatSession
              referenceId={state.referenceId}
              key={state.referenceId}
            />
          ) : (
            <ChatHistoryPanel />
          )}
        </>
      ) : (
        <div className="h-12 p-2">
          <ChatToggleButton
            onClick={() =>
              dispatch({
                type: "set sidebar open state",
                payload: {
                  isOpen: true,
                },
              })
            }
          />
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
