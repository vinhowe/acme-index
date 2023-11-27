"use client";
import { useEffect, useState, useCallback } from "react";

import { Flashcard } from "@acme-index/common";

import { getFlashcards, createFlashcard } from "@/lib/api";
import classNames from "classnames";

export default function FlashcardsPage() {
  const [flashcards, setFlashcards] = useState<Flashcard[] | null>(null);

  useEffect(() => {
    getFlashcards().then((flashcards) => {
      setFlashcards(flashcards);
    });
  }, []);

  const createBasicFlashcard = useCallback(() => {
    createFlashcard({
      type: "basic",
      content: {
        front: "",
        back: "",
      },
    }).then((flashcard) => {
      window.location.href = `/flashcard/edit/${flashcard.id}`;
    });
  }, []);

  const createWorkedFlashcard = useCallback(() => {
    createFlashcard({
      type: "worked",
      content: {
        steps: [],
      },
    }).then((flashcard) => {
      window.location.href = `/flashcard/edit/${flashcard.id}`;
    });
  }, []);

  return (
    <div className="flex flex-col items-start w-full p-6">
      <div className="mb-6 flex w-full items-baseline justify-between">
        <h1 className="text-4xl font-light tracking-tight mb-6">Flashcards</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-green-600 dark:text-green-500 flex items-center gap-1 px-2.5 py-1.5 rounded-md"
            onClick={() => {
              window.location.href = "/auth/login";
            }}
          >
            <span className="material-symbols-rounded select-none text-xl -mb-[0.1rem]">
              login
            </span>
            Sign in
          </button>
          <button
            type="button"
            className="text-white bg-green-600 dark:text-black dark:bg-green-500 flex items-center gap-1 px-2.5 py-1.5 rounded-md"
            onClick={() => createBasicFlashcard()}
          >
            <span className="material-symbols-rounded select-none text-xl -mb-[0.05rem]">
              add
            </span>
            Create a basic flashcard
          </button>
          <button
            type="button"
            className="text-white bg-green-600 dark:text-black dark:bg-green-500 flex items-center gap-1 px-2.5 py-1.5 rounded-md"
            onClick={() => createWorkedFlashcard()}
          >
            <span className="material-symbols-rounded select-none text-xl -mb-[0.05rem]">
              add
            </span>
            Create a worked flashcard
          </button>
        </div>
      </div>
      <div className="text-base flex flex-col items-start gap-4">
        {flashcards
          ?.filter((flashcard) => flashcard.deleted === false)
          ?.sort((a, b) => {
            const aTime = new Date(a.updatedAt).getTime();
            const bTime = new Date(b.updatedAt).getTime();

            // Check if both dates are invalid
            if (isNaN(aTime) && isNaN(bTime)) {
              return 0; // Return 0 to preserve the existing order
            }

            // Check if only a's date is invalid
            if (isNaN(aTime)) {
              return 1; // Make b "win"
            }

            // Check if only b's date is invalid
            if (isNaN(bTime)) {
              return -1; // Make a "win"
            }

            // Both dates are valid, so sort based on the timestamps
            return bTime - aTime;
          })
          ?.map((flashcard, index) => (
            <a
              key={flashcard.id}
              href={`/flashcard/edit/${flashcard.id}`}
              className={classNames(
                "hover:underline",
                flashcard.special && "bg-purple-100/50 dark:bg-purple-900/50",
              )}
            >
              <div className="text-lg leading-5 flex items-baseline gap-1">
                <span className="dark:text-neutral-500 text-sm">
                  {flashcard.type}&nbsp;&nbsp;
                </span>
                {flashcard.type === "basic" && (
                  <span className="font-button text-base dark:text-white text-black max-w-[65ch] inline-block truncate">
                    {flashcard.content.front}
                  </span>
                )}
                {flashcard.type === "worked" && (
                  <span className="font-button text-base dark:text-white text-black max-w-[65ch] inline-block truncate">
                    {flashcard.content.steps[0].content}
                  </span>
                )}
                {flashcard.reference && (
                  <span className="font-button text-base dark:text-neutral-400 text-neutral-600">
                    ({flashcard.reference})
                  </span>
                )}
              </div>
              <span className="font-button dark:text-neutral-400 text-neutral-600 text-sm">
                {flashcard.id}
              </span>
            </a>
          ))}
      </div>
    </div>
  );
}
