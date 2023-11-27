"use client";
import { useContext } from "react";
import {
  ChatContext,
  generateReferenceSuggestions,
  newChat,
  openChat,
} from "./ChatProvider";
import classNames from "classnames";

interface ReferenceInteractionsProps {
  reference: string;
}

const ReferenceInteractions = ({ reference }: ReferenceInteractionsProps) => {
  const { state, dispatch } = useContext(ChatContext);
  const interactions = state.referenceInteractions.get(reference);
  const suggestions = state.referenceSuggestions.get(reference);
  return (
    <div className="flex flex-col items-start gap-4 w-full">
      {interactions && interactions?.length > 0 && (
        <div className="flex flex-col gap-2 text-base w-full text-green-800 dark:text-green-400">
          {suggestions && suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  role="button"
                  className="line-clamp-2 flex w-full items-start gap-3"
                  // onClick={() => newChat(interaction.id, dispatch)}
                >
                  <span className="underline">{suggestion}</span>
                </div>
              ))}
            </div>
          )}
          {interactions.slice(0, 2).map((interaction) => (
            <div
              key={interaction.id}
              role="button"
              className="line-clamp-2 flex w-full items-start gap-3"
              onClick={() => openChat(interaction.id, dispatch)}
            >
              <span className="underline line-clamp-2">
                {interaction.description}
              </span>
              <div className="flex justify-start gap-1 shrink-0 mt-1">
                <div
                  className={classNames(
                    "font-button",
                    "text-xs",
                    "px-1",
                    "py-0.5",
                    "text-green-50",
                    "dark:text-green-950",
                    "bg-green-800",
                    "dark:bg-green-400",
                    "opacity-80",
                    "rounded",
                  )}
                >
                  {interaction.model}
                </div>
              </div>
            </div>
          ))}
          {interactions && interactions.length > 2 && (
            <div role="button">
              +{" "}
              <span className="underline">{interactions.length - 2} more</span>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center w-full gap-2">
        <button
          className="text-green-950 dark:text-green-100 bg-green-200 dark:bg-green-900 px-2 py-0.5 rounded cursor-pointer flex items-center gap-1 text-sm"
          onClick={() => {
            newChat(reference, dispatch);
          }}
        >
          +{" "}
          {interactions && interactions.length > 0
            ? "New question"
            : "Ask a question"}
        </button>
        {(!interactions || interactions.length === 0) && (
          <button
            className="text-purple-950 dark:text-purple-100 bg-purple-200 dark:bg-purple-900 px-2 py-0.5 rounded cursor-pointer flex items-center gap-1 text-sm"
            onClick={() => {
              generateReferenceSuggestions(reference, dispatch);
            }}
          >
            <span className="material-symbols-rounded text-sm">lightbulb</span>
            Suggest a few ideas
          </button>
        )}
      </div>
    </div>
  );
};

export default ReferenceInteractions;
