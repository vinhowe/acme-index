import React from "react";
import Result from "./Result";
import Proof from "./Proof";
import PageBreak from "./PageBreak";
import InlineBody from "./InlineBody";
import Figure from "./Figure";
import Equation from "./Equation";
import Exercise from "./Exercise";
import type { BodyItem as BodyItemType } from "@/lib/textbook/types";
import HeadingAnchor from "./HeadingAnchor";

export interface BodyItemsProps {
  bodyItems: BodyItemType[];
  nearestId?: string;
}

export interface BodyItemProps {
  bodyItem: BodyItemType;
  nearestId?: string;
}

export const BodyItems: React.FC<BodyItemsProps> = ({
  bodyItems,
  nearestId,
}) => {
  return (
    <div>
      {bodyItems.map((item, itemIndex) => {
        return (
          <BodyItem bodyItem={item} nearestId={nearestId} key={itemIndex} />
        );
      })}
    </div>
  );
};

const BodyItem: React.FC<BodyItemProps> = ({ bodyItem, nearestId }) => {
  nearestId = "id" in bodyItem ? (bodyItem.id as string) : nearestId;

  switch (bodyItem.type) {
    case "text":
      return (
        <p className="text-justify">
          <InlineBody items={bodyItem.body} />
        </p>
      );
    case "exercise":
      return (
        <Exercise exercise={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`exercise-${bodyItem.id}`}
          />
        </Exercise>
      );
    case "list":
      return (
        <ol type={bodyItem.list_type === "roman" ? "i" : "a"}>
          {bodyItem.body.map((item, itemIndex) => {
            if (item.type === "list_item") {
              const id = `${nearestId}-${item?.roman || item?.letter}`;
              return (
                <li
                  key={itemIndex}
                  value={item.number}
                  className="text-justify [&:hover_.anchor-link]:text-current scroll-mt-4"
                  id={id}
                >
                  {nearestId && (
                    <div className="absolute left-0.5">
                      <HeadingAnchor id={id} />
                    </div>
                  )}
                  {item.body.map((bodyItem, bodyItemIndex) => {
                    return <BodyItem bodyItem={bodyItem} key={bodyItemIndex} />;
                  })}
                </li>
              );
            } else if (item.type === "pagebreak") {
              return <PageBreak key={itemIndex} page={item.page} />;
            } else {
              return null;
            }
          })}
        </ol>
      );
    case "equation":
      return (
        <Equation equation={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`equation-${bodyItem.id}`}
          />
        </Equation>
      );
    case "result":
      return (
        <Result result={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`result-${bodyItem.id}`}
          />
        </Result>
      );
    case "figure":
      return (
        <Figure figure={bodyItem}>
          <BodyItems bodyItems={bodyItem.body} nearestId={nearestId} />
        </Figure>
      );
    case "proof":
      return (
        <Proof proof={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`proof-${bodyItem.of}`}
          />
        </Proof>
      );
    case "pagebreak":
      return <PageBreak page={bodyItem.page} />;
    default:
      return null;
  }
};

export default BodyItem;
