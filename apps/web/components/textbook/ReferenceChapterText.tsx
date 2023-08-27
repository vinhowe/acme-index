import React from "react";
import { TextChapter } from "@acme-index/common";
import { BodyItems } from "./BodyItem";
import { SectionItems } from "./SectionItems";

export interface ChapterTextProps {
  chapter: TextChapter;
}

const ReferenceChapterText: React.FC<ChapterTextProps> = ({ chapter }) => {
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

export default ReferenceChapterText;
