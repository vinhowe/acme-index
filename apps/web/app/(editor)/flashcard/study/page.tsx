"use client";
import React, { useState, useEffect, use, useCallback } from "react";
import { getFlashcards, updateFlashcard } from "@/lib/api";
import { Flashcard } from "@acme-index/common";
import {
  REACT_MARKDOWN_COMPONENTS,
  REHYPE_PLUGINS,
  REMARK_PLUGINS,
} from "../_components/markdown";
import ReactMarkdown from "react-markdown";
import classNames from "classnames";

const STORAGE_KEY = "flashcard-study";

// All state is in localStorage
const getLocalStorage = <T extends unknown>(
  key: string,
  defaultValue: T,
): T => {
  const value = localStorage.getItem(key);
  if (!value) return defaultValue;
  return JSON.parse(value) as T;
};

const ActionButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}): JSX.Element => {
  return (
    <button
      className={classNames(
        "py-2 px-4  dark:text-white text-black transition-colors duration-200 dark:bg-neutral-800 font-button",
      )}
      onClick={() => onClick()}
    >
      {children}
    </button>
  );
};

const MarkdownRenderer = ({ children }: { children: string }): JSX.Element => {
  return (
    <ReactMarkdown
      className={classNames(
        "prose",
        "prose-neutral",
        "dark:prose-invert",
        "prose-h1:font-light",
        "prose-headings:font-normal",
        "max-w-none",
        "w-full",
      )}
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={REACT_MARKDOWN_COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
};

type FlashcardRef = {
  id: string;
  part?: number;
};

export default function FlashcardStudyPage() {
  const [flashcards, setFlashcards] = useState<{
    [id: string]: Flashcard;
  } | null>(null);
  const [studyQueue, setStudyQueue] = useState<FlashcardRef[] | null>(null);
  const [currentFlashcardRef, setCurrentFlashcardRef] =
    useState<FlashcardRef | null>(null);
  const [showingBack, setShowingBack] = useState<boolean>(false);

  const saveLocalStorage = useCallback(() => {
    if (!studyQueue) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studyQueue));
  }, [studyQueue]);

  // Fetch flashcards
  useEffect(() => {
    if (flashcards) return;
    console.log(flashcards);
    getFlashcards().then((flashcards) => {
      console.log(flashcards);
      const filteredFlashcards = flashcards.filter(
        (flashcard) => !flashcard.deleted && !flashcard.suspended,
      ) as Flashcard[];
      const localStudyQueue = getLocalStorage<FlashcardRef[]>(
        STORAGE_KEY,
        filteredFlashcards,
      );
      // Remove any flashcards that are no longer in the database
      let studyQueue = localStudyQueue.filter((flashcard) =>
        filteredFlashcards.some((f) => f.id === flashcard.id),
      );
      const newFlashcardRefs: FlashcardRef[] = [];
      // Insert new flashcards at random positions in the queue
      filteredFlashcards
        .filter((flashcard) => !studyQueue.some((f) => f.id === flashcard.id))
        .forEach((flashcard) => {
          if (flashcard.type === "basic") {
            newFlashcardRefs.push({
              id: flashcard.id,
            });
          } else if (flashcard.type === "worked") {
            flashcard.content.steps.forEach((step, i) => {
              newFlashcardRefs.push({
                id: flashcard.id,
                part: i,
              });
            });
          }
        });

      newFlashcardRefs.forEach((flashcard) => {
        const index = Math.floor(Math.random() * studyQueue.length);
        studyQueue.splice(index, 0, flashcard);
      });
      saveLocalStorage();
      setFlashcards(
        filteredFlashcards.reduce(
          (acc, flashcard) => {
            acc[flashcard.id] = flashcard;
            return acc;
          },
          {} as { [id: string]: Flashcard },
        ),
      );
      setCurrentFlashcardRef(studyQueue[0]);
      setStudyQueue(studyQueue.slice(1));
    });
  }, [flashcards, saveLocalStorage]);

  const scheduleFlashcard = useCallback(
    (proportionOfDeck: number) => {
      if (!studyQueue || !currentFlashcardRef || !flashcards) return;
      // let adjustedProp = flashcards[currentFlashcardRef.id].special
      //   ? 0.05
      //   : proportionOfDeck;
      const index = Math.floor(studyQueue.length * proportionOfDeck);
      const newStudyQueue = [...studyQueue];
      newStudyQueue.splice(index, 0, currentFlashcardRef);
      setCurrentFlashcardRef(newStudyQueue[0]);
      setStudyQueue(newStudyQueue.slice(1));
      setShowingBack(false);
      saveLocalStorage();
    },
    [currentFlashcardRef, flashcards, saveLocalStorage, studyQueue],
  );

  const graduateFlashcard = useCallback(() => {
    if (!studyQueue) return;
    const newStudyQueue = [...studyQueue];
    newStudyQueue.shift();
    setStudyQueue(newStudyQueue);
    setCurrentFlashcardRef(newStudyQueue[0]);
    console.log(newStudyQueue.length);
    setShowingBack(false);
    saveLocalStorage();
  }, [saveLocalStorage, studyQueue]);

  const suspendFlashcard = useCallback(() => {
    if (!currentFlashcardRef) return;
    updateFlashcard(currentFlashcardRef.id, {
      suspended: true,
    }).then(() => {
      graduateFlashcard();
    });
  }, [currentFlashcardRef, graduateFlashcard]);

  const editFlashcard = useCallback(() => {
    if (!currentFlashcardRef) return;
    window.open(`/flashcard/edit/${currentFlashcardRef.id}`, "_blank");
  }, [currentFlashcardRef]);

  const resetCards = useCallback(() => {
    if (!studyQueue) return;
    getFlashcards().then((flashcards) => {
      const filteredFlashcards = flashcards.filter(
        (flashcard) => !flashcard.deleted && !flashcard.suspended,
      ) as Flashcard[];
      // const specialFlashcards = filteredFlashcards.filter(
      //   (flashcard) => flashcard.special,
      // );
      const regularFlashcards = filteredFlashcards.filter(
        (flashcard) => flashcard.special,
      );
      // Overwrite the study queue with the new flashcards, shuffled
      const studyQueue: FlashcardRef[] = [];
      regularFlashcards.forEach((flashcard) => {
        if (flashcard.type === "basic") {
          studyQueue.push({
            id: flashcard.id,
          });
        } else if (flashcard.type === "worked") {
          flashcard.content.steps.forEach((step, i) => {
            studyQueue.push({
              id: flashcard.id,
              part: i,
            });
          });
        }
      });
      studyQueue.sort(() => Math.random() - 0.5);
      // specialFlashcards.forEach((flashcard) => {
      //   if (flashcard.type === "basic") {
      //     const index = Math.floor(studyQueue.length * 0.05);
      //     studyQueue.splice(index, 0, flashcard);
      //   } else if (flashcard.type === "worked") {
      //     flashcard.content.steps.forEach((step, i) => {
      //       const index = Math.floor(studyQueue.length * 0.05);
      //       studyQueue.splice(index, 0, {
      //         id: flashcard.id,
      //         part: i,
      //       });
      //     });
      //   }
      // });
      saveLocalStorage();
      setFlashcards(
        filteredFlashcards.reduce(
          (acc, flashcard) => {
            acc[flashcard.id] = flashcard;
            return acc;
          },
          {} as { [id: string]: Flashcard },
        ),
      );
      setStudyQueue(studyQueue);
      setCurrentFlashcardRef(studyQueue[0]);
    });
  }, [saveLocalStorage, studyQueue]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcuts (similar to anky):
      // space: toggle answer
      // 1: again
      // 2: hard
      // 3: good
      // 4: easy
      // !: suspend (only thing that uses updateFlashcard)
      if (e.key === " ") {
        setShowingBack((showingBack) => {
          if (showingBack) {
            graduateFlashcard();
          }
          return !showingBack;
        });
      } else if (e.key === "1") {
        scheduleFlashcard(0.25);
      } else if (e.key === "2") {
        scheduleFlashcard(0.5);
      } else if (e.key === "3") {
        scheduleFlashcard(0.75);
      } else if (e.key === "4") {
        graduateFlashcard();
      } else if (e.key === "!") {
        suspendFlashcard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const currentFlashcard =
    currentFlashcardRef && flashcards
      ? flashcards[currentFlashcardRef?.id]
      : null;

  return (
    <div className="w-full bg-[#fafafa] dark:bg-[#0a0a0a] mx-auto lg:max-w-3xl md:max-w-2xl sm:max-w-xl py-4 px-6">
      {currentFlashcardRef && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex justify-between mb-3">
              <button
                className={classNames(
                  "material-symbols-rounded select-none text-lg rounded dark:text-neutral-400",
                )}
                role="button"
                onClick={() => editFlashcard()}
              >
                edit
              </button>
              <div>
                <button
                  className={classNames(
                    "material-symbols-rounded select-none text-lg rounded dark:text-neutral-400",
                  )}
                  role="button"
                  onClick={() => resetCards()}
                >
                  refresh
                </button>
              </div>
            </div>
            {currentFlashcard?.type === "basic" && (
              <MarkdownRenderer>
                {currentFlashcard?.content?.front || "..."}
              </MarkdownRenderer>
            )}
            {currentFlashcard?.type === "worked" &&
              currentFlashcardRef?.part !== undefined && (
                <div className="flex flex-col gap-6">
                  {currentFlashcard?.content?.steps
                    .filter((_, i) => i <= currentFlashcardRef!.part!)
                    .map((step, i) => {
                      return (
                        <>
                          <div key={i} className="flex gap-4">
                            <div
                              className={classNames(
                                "flex-1 flex flex-col gap-2",
                                i === currentFlashcardRef!.part!
                                  ? "font-bold"
                                  : "dark:opacity-80",
                              )}
                            >
                              <MarkdownRenderer>
                                {step.context}
                              </MarkdownRenderer>
                            </div>
                            <div className="flex-1">
                              {(i !== currentFlashcardRef!.part! ||
                                showingBack) && (
                                <MarkdownRenderer>
                                  {step.content}
                                </MarkdownRenderer>
                              )}
                            </div>
                          </div>
                          {i < currentFlashcardRef!.part! && (
                            <hr className="dark:border-t-neutral-700" />
                          )}
                        </>
                      );
                    })}
                </div>
              )}
          </div>
          <hr className="dark:border-t-neutral-700" />
          <div>
            {showingBack ? (
              <div className="flex flex-col gap-4">
                <MarkdownRenderer>
                  {/* {currentFlashcard?.type currentFlashcard?.content?.back || "..."} */}
                  {currentFlashcard?.type === "basic"
                    ? currentFlashcard?.content?.back
                    : "No content…"}
                </MarkdownRenderer>
                <div className="flex justify-center gap-6">
                  <ActionButton onClick={() => scheduleFlashcard(0.25)}>
                    Again&emsp;<b>1</b>
                  </ActionButton>
                  <ActionButton onClick={() => scheduleFlashcard(0.5)}>
                    Hard&emsp;<b>2</b>
                  </ActionButton>
                  <ActionButton onClick={() => scheduleFlashcard(0.75)}>
                    Good&emsp;<b>3</b>
                  </ActionButton>
                  <ActionButton onClick={() => graduateFlashcard()}>
                    Easy&emsp;<b>4</b>
                  </ActionButton>
                </div>
              </div>
            ) : (
              <span className="dark:text-blue-300">
                Press space to reveal back
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
