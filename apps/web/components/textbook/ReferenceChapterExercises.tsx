import React from "react";
import { ExercisesChapter, TextChapter } from "@acme-index/common";
import { BodyItems } from "./BodyItem";
import { SectionItems } from "./SectionItems";

export interface ChapterExercisesProps {
  chapter: ExercisesChapter | TextChapter;
}

const ReferenceChapterExercises: React.FC<ChapterExercisesProps> = ({
  chapter,
}) => {
  return (
    <article className="relative">
      <h2 className="text-3xl font-normal tracking-tight">
        {chapter.id}&ensp;{chapter.name}
      </h2>
      {chapter.body && (
        <section>
          <BodyItems bodyItems={chapter.body} />
        </section>
      )}
      {chapter.sections && <SectionItems sectionItems={chapter.sections} />}
    </article>
  );
};

export default ReferenceChapterExercises;
