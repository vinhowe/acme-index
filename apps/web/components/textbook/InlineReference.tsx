import React from "react";
import { InlineReference } from "@/lib/types";
import MathRender from "./MathRender";

export interface InlineBodyProps {
  item: InlineReference;
}

const InlineReference: React.FC<InlineBodyProps> = ({ item }) => {
  let id = "";
  const ids = item.id.split(".");
  id = ids[0];
  if (item.reference_type === "text") {
    if (ids.length > 1) {
      id += `#${item.id}`;
    }
  } else {
    id += `#${item.reference_type}-${item.id}`;
  }

  const roman = item.roman;
  const letter = item.letter;
  if (roman !== undefined || letter !== undefined) {
    id += `-${roman || letter}`;
  }

  return (
    <a href={id}>
      <MathRender body={item.body || ""} />
    </a>
  );
};

export default InlineReference;
