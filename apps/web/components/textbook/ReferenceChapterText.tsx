import React from "react";
import { TextChapter } from "@acme-index/common";
import { MemoBodyItems } from "./BodyItem";
import { MemoSectionItems } from "./SectionItems";

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
          <MemoBodyItems bodyItems={chapter.body} />
        </section>
      )}
      {chapter.sections && <MemoSectionItems sectionItems={chapter.sections} />}
    </article>
  );
};

export default ReferenceChapterText;
