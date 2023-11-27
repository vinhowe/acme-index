// src/routes/Textbook.js
import React from "react";
import ReferenceChapterText from "@/components/textbook/ReferenceChapterText";
import { getTextbookChapterText } from "@/lib/api";
import { TextChapter } from "@acme-index/common";

export default async function Textbook({
  params,
}: {
  params: { book: string; chapter: string };
}) {
  const { book, chapter: chapterId } = params;
  const chapter = (await getTextbookChapterText(
    book,
    chapterId,
  )) as TextChapter;
  return (
    <div className="p-8 sm:p-10">
      <main className="prose prose-neutral mx-auto mt-8 dark:prose-invert">
        <h1 className="text-5xl font-light tracking-tight">Textbook</h1>
        <ReferenceChapterText chapter={chapter} />
      </main>
    </div>
  );
}

export async function generateStaticParams() {
  const chapters = {
    v1: ["1", "2", "3", "4", "5"],
    v2: ["1", "2", "3", "4", "5", "6", "7", "8"],
  };
  return Object.entries(chapters).flatMap(([book, chapters]) =>
    chapters.map((id) => ({ book, chapter: id })),
  );
}

export const dynamic = "force-static";
