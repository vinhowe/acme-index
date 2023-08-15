// src/routes/Textbook.js
import React from "react";
import ReferenceChapterExercises from "@/components/textbook/ReferenceChapterExercises";
import { getTextbookChapterExercises, getTextbookChapters } from "@/lib/api";
import { ExercisesChapter } from "@/lib/types";

export default async function Exercises({
  params,
}: {
  params: { chapter: string };
}) {
  const { chapter: chapterId } = params;
  const chapter = (await getTextbookChapterExercises(
    "v1",
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
  // const chapters = await getTextbookChapters("v1");
  const chapters = ["1"];
  return chapters.map((id) => ({ chapter: id }));
}

export const dynamic = "force-static";
