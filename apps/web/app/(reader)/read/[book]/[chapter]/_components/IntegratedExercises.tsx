"use client";
import { ChatContext, newChat, openChat } from "@/components/chat/ChatProvider";
import { BodyItems } from "@/components/textbook/BodyItem";
import { ExerciseBodyItem } from "@/lib/types";
import classNames from "classnames";
import { useContext, useEffect, useState } from "react";

export type IntegratedExercisesProps = {
  sectionId: string;
  exercises: ExerciseBodyItem[];
};

export default function IntegratedExercises({
  sectionId,
  exercises,
}: IntegratedExercisesProps) {
  const [selectedExercise, setSelectedExercise] = useState(0);
  const [exerciseNumbers, setExerciseNumbers] = useState(
    exercises.map((exercise) => exercise.id)
  );
  useEffect(() => {
    setExerciseNumbers(exercises.map((exercise) => exercise.id));
  }, [exercises]);

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-baseline gap-4">
        <h2 className="text-2xl font-normal tracking-tight scroll-mt-4 [&:hover_>_a]:text-current shrink-0">
          {sectionId}&ensp;Exercises
        </h2>
        <div className="flex flex-wrap flex-row gap-2 translate-y-[-0.1rem]">
          {exerciseNumbers.map((exerciseNumber, index) => {
            return (
              <button
                key={index}
                className={classNames(
                  "px-2.5 py-0.5",
                  "rounded font-mono text-center",
                  "border",
                  selectedExercise === index
                    ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black"
                    : "border-neutral-700 dark:border-neutral-300"
                )}
                onClick={() => setSelectedExercise(index)}
              >
                {exerciseNumber.split(".")[1]}
              </button>
            );
          })}
        </div>
      </div>
      <ExerciseInteractionSection exercise={exercises[selectedExercise]} />
      <div>
        {exercises[selectedExercise].body && (
          <BodyItems bodyItems={exercises[selectedExercise].body} />
        )}
      </div>
    </div>
  );
}

const ExerciseInteractionSection = ({
  exercise,
}: {
  exercise: ExerciseBodyItem;
}) => {
  const { state, dispatch } = useContext(ChatContext);
  const referenceId = `acme:v1/exercise/${exercise.id}`;
  const interactions = state.referenceInteractions[referenceId];
  return (
    <div className="flex flex-col items-start gap-4">
      <button
        className="font-button text-white dark:text-black bg-green-600 dark:bg-green-500 rounded cursor-pointer py-1 px-3 mt-2"
        onClick={() => {
          newChat(referenceId, dispatch);
        }}
      >
        Ask a question
      </button>
      {interactions?.length > 0 && (
        <div className="flex flex-col gap-2 text-lg underline dark:text-green-300">
          {interactions.slice(0, 2).map((interaction) => (
            <div
              key={interaction.id}
              role="button"
              className="line-clamp-2"
              onClick={() => openChat(interaction.id, dispatch)}
            >
              {interaction.description}
            </div>
          ))}
          {interactions.length > 2 && (
            <div role="button">+ {interactions.length - 2} more</div>
          )}
        </div>
      )}
    </div>
  );
};
