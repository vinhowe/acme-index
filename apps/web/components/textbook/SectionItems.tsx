import React, { memo } from "react";
import { SectionItem as SectionItemType } from "@acme-index/common";
import { BodyItems } from "./BodyItem";
import HeadingAnchor from "./HeadingAnchor";

export interface SectionItemsProps {
  sectionItems: SectionItemType[];
  virtualizing?: boolean;
}

export interface SectionItemProps {
  sectionItem: SectionItemType;
  virtualizing?: boolean;
}

const MemoBodyItems = memo(BodyItems);

export const SectionItems: React.FC<SectionItemsProps> = ({
  sectionItems,
  virtualizing = true,
}) => {
  return (
    <>
      {sectionItems.map((item, itemIndex) => {
        return (
          <MemoSectionItem
            sectionItem={item}
            key={itemIndex}
            virtualizing={virtualizing}
          />
        );
      })}
    </>
  );
};

const SectionItem: React.FC<SectionItemProps> = ({
  sectionItem,
  virtualizing = true,
}) => {
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
          <MemoBodyItems
            bodyItems={sectionItem.body}
            virtualizing={virtualizing}
          />
        </section>
      )}
      {sectionItem.type === "section" && sectionItem.sections && (
        <MemoSectionItems
          sectionItems={sectionItem.sections}
          virtualizing={virtualizing}
        />
      )}
    </section>
  );
};

const MemoSectionItem = memo(SectionItem);
const MemoSectionItems = memo(SectionItems);

export default SectionItem;
