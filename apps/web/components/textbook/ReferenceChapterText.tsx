import React, { memo } from "react";
import { TextChapter } from "@acme-index/common";
import { BodyItems } from "./BodyItem";
import { SectionItems } from "./SectionItems";

export interface ChapterTextProps {
  chapter: TextChapter;
}

const MemoBodyItems = memo(BodyItems);
const MemoSectionItems = memo(SectionItems);

const ReferenceChapterText: React.FC<ChapterTextProps> = ({ chapter }) => {
  return (
    <article className="relative">
      <h2 className="text-3xl font-normal tracking-tight">
        {chapter.id}&ensp;{chapter.name}
      </h2>
      {chapter.body && (
        <section>
          <MemoBodyItems bodyItems={chapter.body} virtualizing={false} />
        </section>
      )}
      {chapter.sections && (
        <MemoSectionItems
          sectionItems={chapter.sections}
          virtualizing={false}
        />
      )}
    </article>
  );
};

export default ReferenceChapterText;
