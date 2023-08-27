import React, { Children } from "react";
import { ExerciseBodyItem, ExercisesChapter, TextChapter } from "@/lib/textbook/types";
import { BodyItems } from "@/components/textbook/BodyItem";
import SectionItem, {
  SectionItemsProps,
} from "@/components/textbook/SectionItems";
import IntegratedExercises from "./IntegratedExercises";

export interface ChapterWithIntegratedExercisesProps {
  text: TextChapter;
  exercises: ExercisesChapter;
}

type ExerciseIntegratedSectionItemsProps = SectionItemsProps & {
  exercises: ExercisesChapter;
};

const ExerciseIntegratedSectionWrapper: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const childrenArray = Children.toArray(children);
  return (
    <div className="md:grid md:grid-cols-[minmax(0,_65ch)_minmax(0,_55ch)] w-full gap-x-8 md:gap-x-12">
      <div className="col-span-1 relative">{childrenArray[0]}</div>
      {childrenArray.slice(1).map((child, index) => {
        return <div key={index}>{child}</div>;
      })}
    </div>
  );
};

const ExerciseIntegratedSectionItems: React.FC<
  ExerciseIntegratedSectionItemsProps
> = ({ sectionItems, exercises }) => {
  // zip sectionItems and exercises.sections
  const zippedSectionItems = sectionItems.map((sectionItem, index) => {
    return {
      section: sectionItem,
      exercises: exercises.sections[index].body.filter(
        (item) => item.type === "exercise",
      ),
    };
  });

  return (
    <>
      {zippedSectionItems.map(({ section, exercises }, itemIndex) => {
        return (
          <ExerciseIntegratedSectionWrapper key={itemIndex}>
            <SectionItem sectionItem={section} />
            <div className="md:sticky top-0 mb-4 md:mb-10">
              <IntegratedExercises
                sectionId={section.id}
                exercises={exercises as ExerciseBodyItem[]}
              />
            </div>
          </ExerciseIntegratedSectionWrapper>
        );
      })}
    </>
  );
};

const ChapterTextWithExercises: React.FC<
  ChapterWithIntegratedExercisesProps
> = ({ text, exercises }) => {
  return (
    <article className="relative">
      <h2 className="text-3xl font-normal tracking-tight">
        {text.id}&ensp;{text.name}
      </h2>
      {text.body && (
        <ExerciseIntegratedSectionWrapper>
          <section>
            <BodyItems bodyItems={text.body} />
          </section>
        </ExerciseIntegratedSectionWrapper>
      )}
      {text.sections && (
        <ExerciseIntegratedSectionItems
          sectionItems={text.sections}
          exercises={exercises}
        />
      )}
    </article>
  );
};

export default ChapterTextWithExercises;
