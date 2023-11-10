"use client";
import React from "react";
import ReferenceChapterText from "@/components/textbook/ReferenceChapterText";
import { getTextbookChapterText } from "@/lib/api";
import { TextChapter } from "@acme-index/common";
import { useEffect, useState, memo } from "react";

const MemoizedReferenceChapterText = memo(ReferenceChapterText);

export default function Textbook({
  params,
}: {
  params: { book: string; chapter: string };
}) {
  const { book, chapter: chapterId } = params;
  const [chapter, setChapter] = useState<TextChapter | null>(null);

  useEffect(() => {
    // Function to fetch chapter text
    const fetchChapterText = async () => {
      const chapterText = (await getTextbookChapterText(
        book,
        chapterId,
      )) as TextChapter;

      // Only update state if the chapter text has changed
      if (JSON.stringify(chapter) !== JSON.stringify(chapterText)) {
        setChapter(chapterText);
      }
    };

    // Initial fetch
    fetchChapterText();

    // Set up polling
    const intervalId = setInterval(fetchChapterText, 1000);

    // Clear the interval on component unmount
    return () => clearInterval(intervalId);
  }, [book, chapterId, chapter]);

  return (
    <div className="p-8 sm:p-10">
      <main className="prose prose-neutral mx-auto mt-8 dark:prose-invert">
        <h1 className="text-5xl font-light tracking-tight">Textbook</h1>
        {chapter && <MemoizedReferenceChapterText chapter={chapter} />}
      </main>
    </div>
  );
}
