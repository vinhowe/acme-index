import React from "react";
import { InlineType } from "@/lib/textbook/types";
import MathRender from "./MathRender";
import PageBreak from "./PageBreak";
import InlineReference from "./InlineReference";

export interface InlineBodyProps {
  items: Array<InlineType>;
}

const InlineBody: React.FC<InlineBodyProps> = ({ items }) => {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === "inline") {
          return <MathRender key={index} body={item.body} />;
        } else if (item.type === "pagebreak") {
          return <PageBreak key={index} page={item.page} inline />;
        } else if (item.type === "reference") {
          return <InlineReference key={index} item={item} />;
        } else {
          return null;
        }
      })}
    </>
  );
};

export default InlineBody;
