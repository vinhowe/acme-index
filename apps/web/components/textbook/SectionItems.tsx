import React from "react";
import { SectionItem as SectionItemType } from "@/lib/textbook/types";
import { BodyItems } from "./BodyItem";
import HeadingAnchor from "./HeadingAnchor";

export interface SectionItemsProps {
  sectionItems: SectionItemType[];
}

export interface SectionItemProps {
  sectionItem: SectionItemType;
}

export const SectionItems: React.FC<SectionItemsProps> = ({ sectionItems }) => {
  return (
    <>
      {sectionItems.map((item, itemIndex) => {
        return <SectionItem sectionItem={item} key={itemIndex} />;
      })}
    </>
  );
};

const SectionItem: React.FC<SectionItemProps> = ({ sectionItem }) => {
  const HeadingTag = sectionItem.type === "section" ? "h2" : "h3";
  const headingClass = `text-${
    sectionItem.type === "section" ? "2xl" : "xl"
  } font-normal tracking-tight scroll-mt-4 [&:hover_>_a]:text-current`;

  return (
    <section>
      <HeadingTag className={headingClass} id={sectionItem.id}>
        {sectionItem.id}&ensp;{sectionItem.name}{" "}
        <HeadingAnchor id={sectionItem.id} />
      </HeadingTag>
      {sectionItem.body && (
        <section>
          <BodyItems bodyItems={sectionItem.body} />
        </section>
      )}
      {sectionItem.type === "section" && sectionItem.sections && (
        <SectionItems sectionItems={sectionItem.sections} />
      )}
    </section>
  );
};

export default SectionItem;
