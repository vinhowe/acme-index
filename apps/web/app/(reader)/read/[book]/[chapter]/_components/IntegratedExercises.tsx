"use client";
import ReferenceInteractions from "@/components/chat/ReferenceInteractions";
import { MemoBodyItems } from "@/components/textbook/BodyItem";
import Exercise from "@/components/textbook/Exercise";
import { ExerciseBodyItem } from "@acme-index/common";
import classNames from "classnames";
import { useEffect, useState } from "react";

export type IntegratedExercisesProps = {
  book: string;
  sectionId: string;
  exercises: ExerciseBodyItem[];
};

export default function IntegratedExercises({
  book,
  sectionId,
  exercises,
}: IntegratedExercisesProps) {
  const [selectedExercise, setSelectedExercise] = useState(0);
  const [exerciseNumbers, setExerciseNumbers] = useState(
    exercises.map((exercise) => exercise.id),
  );
  useEffect(() => {
    setExerciseNumbers(exercises.map((exercise) => exercise.id));
  }, [exercises]);

  return (
    <div className="flex flex-col items-start gap-2">
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
                    : "border-neutral-700 dark:border-neutral-300",
                )}
                onClick={() => setSelectedExercise(index)}
              >
                {exerciseNumber.split(".")[1]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="w-full">
        {exercises[selectedExercise].body && (
          <Exercise exercise={exercises[selectedExercise]}>
            <MemoBodyItems bodyItems={exercises[selectedExercise].body} />
            <div className="-mx-4 p-4 border-t dark:border-white dark:border-opacity-25">
              <ReferenceInteractions
                reference={exercises[selectedExercise].reference}
              />
            </div>
          </Exercise>
        )}
      </div>
    </div>
  );
}
