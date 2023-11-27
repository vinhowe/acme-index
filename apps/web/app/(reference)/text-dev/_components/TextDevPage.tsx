"use client";
import React, { Fragment } from "react";
import { getTextbookChapterExercises, getTextbookChapterText } from "@/lib/api";
import { ExercisesChapter, TextChapter } from "@acme-index/common";
import { useEffect, useState, memo } from "react";
import equal from "fast-deep-equal";
import { MemoBodyItems } from "@/components/textbook/BodyItem";
import {
  MemoSectionItem,
  SectionItemsProps,
} from "@/components/textbook/SectionItems";
import { ChangeHighlightingContextProvider } from "@/components/textbook/ChangeHighlightingItemWrapper";
import MathRender from "@/components/textbook/MathRender";

interface ChapterWithIntegratedExercisesProps {
  book: string;
  text: TextChapter;
  exercises: ExercisesChapter;
}

type ExerciseIntegratedSectionItemsProps = SectionItemsProps & {
  book: string;
  exercises: ExercisesChapter;
};

const ChapterTextWithExercises: React.FC<
  ChapterWithIntegratedExercisesProps
> = ({ book, text, exercises }) => {
  return (
    <article className="relative flex flex-col">
      <h2 className="text-3xl font-normal tracking-tight">
        {text.id}&ensp;{text.name}
      </h2>
      {text.body && (
        <section>
          <MemoBodyItems bodyItems={text.body} />
        </section>
      )}
      {text.sections && (
        <ExerciseIntegratedSectionItems
          book={book}
          sectionItems={text.sections}
          exercises={exercises}
        />
      )}
    </article>
  );
};

const ExerciseIntegratedSectionItems: React.FC<
  ExerciseIntegratedSectionItemsProps
> = ({ sectionItems, exercises }) => {
  // zip sectionItems and exercises.sections
  const zippedSectionItems = sectionItems.map((sectionItem, index) => {
    return {
      section: sectionItem,
      exercises:
        exercises.sections[index]?.body?.filter(
          (item) => item.type === "exercise",
        ) ?? [],
    };
  });

  return (
    <>
      {zippedSectionItems.map(({ section, exercises }, itemIndex) => {
        return (
          <Fragment key={itemIndex}>
            <MemoSectionItem sectionItem={section} />
            <section>
              <h2 className="text-2xl font-normal tracking-tight scroll-mt-4 [&:hover_>_a]:text-current">
                <MathRender body={`${section.id}&ensp;Exercises`} />
              </h2>
              <MemoBodyItems bodyItems={exercises} />
            </section>
          </Fragment>
        );
      })}
    </>
  );
};

const urlRegex = /\/text-dev\/(?<book>[^?&#/]*)\/(?<chapter>[^?&#/]*)/;

const bookAndChapter = (pathname: string) => {
  const match = urlRegex.exec(pathname);
  if (!match || !match.groups) {
    return {};
  }
  return { book: match.groups.book, chapter: match.groups.chapter };
};

export default function Textbook() {
  const { book, chapter: chapterId } = bookAndChapter(window.location.pathname);
  const [chapter, setChapter] = useState<TextChapter | null>(null);
  const [exercises, setExercises] = useState<ExercisesChapter | null>(null);
  const [changeCount, setChangeCount] = useState(0);

  useEffect(() => {
    if (!book || !chapterId) {
      return;
    }

    // Function to fetch chapter text
    const fetchChapterText = async () => {
      const chapterText = (await getTextbookChapterText(
        book,
        chapterId,
      )) as TextChapter;
      const exercisesText = (await getTextbookChapterExercises(
        book,
        chapterId,
      )) as ExercisesChapter;

      let changed = false;
      if (!equal(chapterText, chapter)) {
        setChapter(chapterText);
        changed = true;
      }
      if (!equal(exercisesText, exercises)) {
        setExercises(exercisesText);
        changed = true;
      }
      if (changed) {
        setChangeCount((prev) => prev + 1);
      }
    };

    // Initial fetch
    fetchChapterText();

    // Set up polling
    const intervalId = setInterval(fetchChapterText, 500);

    // Clear the interval on component unmount
    return () => clearInterval(intervalId);
  }, [book, chapter, chapterId, exercises]);

  return (
    (book && chapter && exercises && (
      <div className="p-8 sm:p-10">
        <main className="prose prose-neutral mx-auto mt-8 dark:prose-invert">
          <ChangeHighlightingContextProvider changeCount={changeCount}>
            <ChapterTextWithExercises
              book={book}
              text={chapter}
              exercises={exercises}
            />
          </ChangeHighlightingContextProvider>
        </main>
      </div>
    )) || <div>Loading...</div>
  );
}
