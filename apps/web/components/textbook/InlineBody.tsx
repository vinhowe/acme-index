import React, { forwardRef } from "react";
import { InlineItem } from "@acme-index/common";
import MathRender from "./MathRender";
import PageBreak from "./PageBreak";
import InlineReference from "./InlineReference";

export interface InlineBodyProps {
  items: Array<InlineItem>;
}

const InlineBody = forwardRef<HTMLParagraphElement, InlineBodyProps>(
  function InlineBody({ items }: InlineBodyProps, ref) {
    return (
      <p className="text-justify" ref={ref}>
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
      </p>
    );
  },
);

export default InlineBody;
