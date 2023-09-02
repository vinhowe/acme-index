// src/routes/Textbook.js
import React, { useContext } from "react";
import { getTextbookChapterExercises, getTextbookChapterText } from "@/lib/api";
import ChapterTextWithExercises from "./_components/ChapterTextWithExercises";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { ChatContext, ChatProvider } from "@/components/chat/ChatProvider";
import { ExercisesChapter, TextChapter } from "@acme-index/common";
import classNames from "classnames";
import { SidebarToggleAwareBodyLayout, SidebarToggleAwareSidebarLayout } from "./_components/SidebarAwareLayouts";


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
            <h1 className="text-5xl font-light tracking-tight">Volume 1</h1>
            <ChapterTextWithExercises text={text} exercises={exercises} />
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
  const chapters = ["1"];
  return chapters.map((id) => ({ book: "v1", chapter: id }));
}
