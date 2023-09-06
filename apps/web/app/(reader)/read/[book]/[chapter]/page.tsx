// src/routes/Textbook.js
import React from "react";
import { getTextbookChapterExercises, getTextbookChapterText } from "@/lib/api";
import ChapterTextWithExercises from "./_components/ChapterTextWithExercises";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ExercisesChapter, TextChapter } from "@acme-index/common";
import {
  SidebarToggleAwareBodyLayout,
  SidebarToggleAwareSidebarLayout,
} from "./_components/IntegratedLayouts";

export default async function Textbook({
  params,
}: {
  params: { book: string; chapter: string };
}) {
  const { book, chapter: chapterId } = params;
  const text = (await getTextbookChapterText(book, chapterId)) as TextChapter;
  const exercises = (await getTextbookChapterExercises(
    book,
    chapterId,
  )) as ExercisesChapter;
  return (
    <ChatProvider>
      <div className="relative">
        <div className="grid 2xl:grid-cols-[1fr_minmax(0,_32rem)] xl:grid-cols-[1fr_minmax(0,_28rem)] overflow-none h-[100dvh]">
          <SidebarToggleAwareBodyLayout>
            <div className="flex flex-col md:grid md:grid-cols-[minmax(0,_65ch)_minmax(0,_55ch)] md:mx-auto gap-x-8 md:gap-x-12 w-fit">
              <h1 className="text-5xl font-light tracking-tight col-span-1">
                Volume {book.match(/\d+/)![0]}
              </h1>
            </div>
            <ChapterTextWithExercises
              book={book}
              text={text}
              exercises={exercises}
            />
          </SidebarToggleAwareBodyLayout>
          <SidebarToggleAwareSidebarLayout>
            <ChatSidebar />
          </SidebarToggleAwareSidebarLayout>
        </div>
      </div>
    </ChatProvider>
  );
}

export async function generateStaticParams() {
  // const chapters = await getTextbookChapters("v1");
  const chapters = {
    v1: ["1"],
    v2: ["1"],
  };
  return Object.entries(chapters).flatMap(([book, chapters]) =>
    chapters.map((id) => ({ book, chapter: id })),
  );
}
