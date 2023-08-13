import React from "react";
import { ExerciseBodyItem } from "@/lib/types";
import InfoBox from "./InfoBox";

export interface ExerciseProps {
  exercise: ExerciseBodyItem;
}

const Exercise: React.FC<React.PropsWithChildren<ExerciseProps>> = ({
  exercise,
  children,
}) => {
  let title = `Exercise ${exercise.id}`;
  if (exercise.name) {
    title += ` (${exercise.name})`;
  }
  return (
    <InfoBox id={`exercise-${exercise.id}`} title={title}>
      {children}
    </InfoBox>
  );
};

export default Exercise;
