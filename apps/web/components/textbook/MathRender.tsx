import React from "react";
import { renderMathInString } from "@/lib/katex-utils";

export interface MathRenderProps {
  body: string;
}

const MathRender: React.FC<MathRenderProps> = ({ body }) => {
  return (
    <span dangerouslySetInnerHTML={{ __html: renderMathInString(body) }} />
  );
};

export default MathRender;
