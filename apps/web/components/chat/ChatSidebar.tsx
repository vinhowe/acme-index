"use client";
import { ChatHistoryItem, ChatTurn } from "@/lib/api";
import classNames from "classnames";
import {
  MutableRefObject,
  useCallback,
  useContext,
  useEffect,
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
  openChat,
  openHistory,
  sendMessage,
} from "./ChatProvider";
import wikiLinkPlugin from "@/lib/link-parsing/remark-plugin";
import { parseRef } from "textref";
import { buildDisplayReference } from "@/lib/textbook-ref";

const ChatInput = ({ onSubmit }: { onSubmit: (value: string) => void }) => {
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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComposingText(e.target.value);
    },
    []
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
    [submitText]
  );
  return (
    <div className={classNames("relative")}>
      <textarea
        style={{
          maxHeight: "400px",
        }}
        className={classNames(
          "bg-neutral-300",
          "dark:bg-neutral-700",
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
          "rounded-md"
        )}
        placeholder="Ask a question..."
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        value={composingText}
        ref={textareaRef}
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
          "bg-blue-700",
          "dark:bg-blue-400",
          "rounded",
          "aspect-square",
          "flex",
          "justify-center",
          "items-center"
        )}
        disabled={!composingText}
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
        <span className="select-none material-icons leading-[0] text-xl">
          send
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

const ChatTurnSection = ({
  turn,
}: {
  turn: Pick<ChatTurn, "query" | "response">;
}) => {
  return (
    <div className="flex flex-col items-start">
      <div className="my-2 w-full flex justify-end">
        <div
          className={classNames(
            "px-2.5",
            "py-1.5",
            "max-w-[90%]",
            "bg-neutral-200",
            "dark:bg-neutral-600",
            "rounded-xl"
          )}
        >
          {turn.query}
        </div>
      </div>
      <ReactMarkdown
        className={classNames(
          "mb-2",
          "prose",
          "prose-neutral",
          "dark:prose-invert",
          "w-full"
        )}
        remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
        rehypePlugins={[rehypeKatex, rehypeMinifyWhitespace]}
        components={{
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
        }}
      >
        {turn.response || ""}
      </ReactMarkdown>
    </div>
  );
};

const ChatSession = ({ referenceId }: { referenceId: string }) => {
  const { dispatch, state } = useContext(ChatContext);
  const chat = state.chatData?.chat;

  const [turns, setTurns] = useState<ChatTurn[] | null>(null);
  const [streamingTurn, setStreamingTurn] = useState<ChatTurn | null>(null);
  const [displayReference, setDisplayReference] = useState<string | null>(null);

  const streamingUpdateRef = useRef<(turn: ChatTurn) => void>(
    (_turn: ChatTurn) => {}
  );

  useEffect(() => {
    const reference = parseRef(referenceId);
    if (!reference) {
      setDisplayReference(null);
    } else {
      setDisplayReference(buildDisplayReference(reference));
    }
  }, [referenceId]);

  useEffect(() => {
    const turns = state.chatData?.turns;
    if (!turns) {
      setStreamingTurn(null);
      setTurns(null);
      return;
    }

    if (turns.length === 0) {
      setStreamingTurn(null);
      setTurns([]);
      return;
    }

    const lastTurn = turns[turns.length - 1];

    if (!lastTurn || lastTurn.status !== "pending") {
      setTurns(turns);
      setStreamingTurn(null);
    } else {
      setTurns(turns.slice(0, -1));
      setStreamingTurn(lastTurn);
    }
  }, [state.chatData?.turns]);

  const handleChatSubmit = useCallback(
    async (query: string) => {
      await sendMessage(
        query,
        chat ?? null,
        referenceId,
        (turn: ChatTurn) => streamingUpdateRef.current(turn),
        dispatch
      );
    },
    [chat, dispatch, referenceId]
  );

  return (
    <div className="overflow-hidden flex-1 w-full px-4 py-4">
      <div className="h-full max-h-full flex flex-col justify-between">
        <div className="shrink grow-1 overflow-scroll -mt-4 pt-4 -mb-5 pb-5 -mx-4 px-4">
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
                    "rounded"
                  )}
                >
                  {chat.provider}/{chat.model}
                </div>
              </div>
            )}
          </div>
          <div>
            <div>
              {turns &&
                turns.map((turn) => (
                  <ChatTurnSection key={turn.id} turn={turn} />
                ))}
              {streamingTurn && (
                <StreamingChatTurnSection
                  streamingRef={streamingUpdateRef}
                  turn={streamingTurn}
                />
              )}
            </div>
          </div>
        </div>
        <div>
          <div className={classNames(turns?.length && "mt-4")}>
            <ChatInput onSubmit={handleChatSubmit} />
          </div>
          {chat && (
            <div className="font-mono opacity-40 text-xs mt-2">
              chat {chat?.id}
            </div>
          )}
        </div>
      </div>
    </div>
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
      <div className="font-mono px-3 h-full bg-green-300 text-green-900 dark:bg-green-900 dark:text-green-100 flex items-center select-none">
        Chat
      </div>
      <div className="flex items-start h-full gap-px overflow-x-scroll bg-neutral-300 dark:bg-neutral-700 gap-x-px pr-px">
        <div
          className={classNames(
            "flex items-center align-center px-3 cursor-pointer h-full",
            !activeId
              ? "dark:bg-[#101010] bg-neutral-100"
              : "dark:bg-neutral-800 bg-neutral-200"
          )}
          onClick={() => openHistory(dispatch)}
        >
          <span className="material-icons select-none text-lg">history</span>
        </div>
        {history.map((item) => (
          <div
            key={item.id}
            className={classNames(
              "flex flex-col items-start justify-center px-2 cursor-pointer h-full font-button text-sm w-32",
              item.id === activeId
                ? "dark:bg-[#101010] bg-neutral-100"
                : "dark:bg-neutral-800 bg-neutral-200"
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
    <div className="w-full py-4 px-4">
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
  const { state } = useContext(ChatContext);
  return (
    <div className="w-full h-full bg-neutral-100 dark:bg-[#101010] flex flex-col">
      <ChatTopBar
        history={state.chatHistory}
        activeId={state?.chatData?.chat?.id || state?.referenceId || null}
      />
      {state.referenceId ? (
        <ChatSession referenceId={state.referenceId} />
      ) : (
        <ChatHistoryPanel />
      )}
    </div>
  );
};

export default ChatSidebar;
