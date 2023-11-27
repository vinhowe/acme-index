import React, { memo } from "react";
import { SectionItem as SectionItemType } from "@acme-index/common";
import HeadingAnchor from "./HeadingAnchor";
import equal from "fast-deep-equal";
import { MemoBodyItems } from "./BodyItem";
import MathRender from "./MathRender";

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
        return <MemoSectionItem sectionItem={item} key={itemIndex} />;
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
        <MathRender body={`${sectionItem.id}&ensp;${sectionItem.name} `} />
        <HeadingAnchor id={sectionItem.id} />
      </HeadingTag>
      {sectionItem.body && (
        <section>
          <MemoBodyItems bodyItems={sectionItem.body} />
        </section>
      )}
      {sectionItem.type === "section" && sectionItem.sections && (
        <MemoSectionItems sectionItems={sectionItem.sections} />
      )}
    </section>
  );
};

export const MemoSectionItem = memo(SectionItem, (prev, next) => {
  return equal(prev.sectionItem, next.sectionItem);
});
export const MemoSectionItems = memo(SectionItems, (prev, next) => {
  return equal(prev.sectionItems, next.sectionItems);
});

export default SectionItem;
