// src/routes/Textbook.js
import React from "react";
import ReferenceChapterExercises from "@/components/textbook/ReferenceChapterExercises";
import { getTextbookChapterExercises, getTextbookChapters } from "@/lib/api";
import { ExercisesChapter } from "@acme-index/common";

export default async function Exercises({
  params,
}: {
  params: { book: string; chapter: string };
}) {
  const { book, chapter: chapterId } = params;
  const chapter = (await getTextbookChapterExercises(
    book,
    chapterId,
  )) as ExercisesChapter;
  return (
    <div className="p-8 sm:p-10">
      <main className="prose prose-neutral mx-auto mt-8 dark:prose-invert">
        <h1 className="text-5xl font-light tracking-tight">Exercises</h1>
        <ReferenceChapterExercises chapter={chapter} />
      </main>
    </div>
  );
}

export async function generateStaticParams() {
  const chapters = {
    v1: ["1"],
    v2: ["1"],
  };
  return Object.entries(chapters).flatMap(([book, chapters]) =>
    chapters.map((id) => ({ book, chapter: id })),
  );
}

export const dynamic = "force-static";
