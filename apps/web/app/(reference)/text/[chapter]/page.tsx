// src/routes/Textbook.js
import React from "react";
import ReferenceChapterText from "@/components/textbook/ReferenceChapterText";
import { getTextbookChapterText, getTextbookChapters } from "@/lib/api";
import { TextChapter } from "@/lib/types";

export default async function Textbook({
  params,
}: {
  params: { chapter: string };
}) {
  const { chapter: chapterId } = params;
  const chapter = (await getTextbookChapterText(
    "v1",
    chapterId,
  )) as TextChapter;
  return (
    <div className="p-8 sm:p-10">
      <main className="prose prose-neutral mx-auto mt-8 dark:prose-invert">
        <h1 className="text-5xl font-light tracking-tight">Textbook</h1>
        <ReferenceChapterText chapter={chapter} />
        {/* {textbook.map((chapter) => (
        <Chapter key={chapter.id} chapter={chapter} />
      ))} */}
      </main>
    </div>
  );
}

export async function generateStaticParams() {
  // const chapters = await getTextbookChapters("v1");
  const chapters = ["1"];
  return chapters.map((id) => ({ chapter: id }));
}

export const dynamic = "force-static";
