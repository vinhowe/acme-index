// src/routes/Textbook.js
import React from "react";
import { getTextbookChapterExercises, getTextbookChapterText } from "@/lib/api";
import { ExercisesChapter, TextChapter } from "@/lib/types";
import ChapterTextWithExercises from "./_components/ChapterTextWithExercises";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { ChatProvider } from "@/components/chat/ChatProvider";

export default async function Textbook({
  params,
}: {
  params: { book: string; chapter: string };
}) {
  const { book, chapter: chapterId } = params;
  const text = (await getTextbookChapterText(book, chapterId)) as TextChapter;
  const exercises = (await getTextbookChapterExercises(
    book,
    chapterId
  )) as ExercisesChapter;
  return (
    <ChatProvider>
      <div className="grid 2xl:grid-cols-[1fr_minmax(0,_32rem)] xl:grid-cols-[1fr_minmax(0,_28rem)] overflow-none h-[100dvh]">
        <div className="col-span-1 overflow-scroll">
          <main className="p-8 lg:p-12 prose prose-neutral mx-auto mt-8 dark:prose-invert max-w-none">
            <h1 className="text-5xl font-light tracking-tight">Volume 1</h1>
            <ChapterTextWithExercises text={text} exercises={exercises} />
          </main>
        </div>
        <div className="hidden xl:block fixed 2xl:w-[32rem] xl:w-[28rem] left-auto right-0">
          <div className="relative top-0 right-0 w-full h-[100dvh] overflow-hidden">
            <ChatSidebar />
          </div>
        </div>
      </div>
    </ChatProvider>
  );
}

export async function generateStaticParams() {
  // const chapters = await getTextbookChapters("v1");
  const chapters = ["1"];
  return chapters.map((id) => ({ book: "v1", chapter: id }));
}
