import React from "react";
import { FigureBodyItem } from "@/lib/textbook/types";
import InfoBox from "./InfoBox";

export interface FigureProps {
  figure: FigureBodyItem;
}

const Figure: React.FC<React.PropsWithChildren<FigureProps>> = ({
  figure,
  children,
}) => {
  return <InfoBox title={`Figure ${figure.id}`}>{children}</InfoBox>;
};

export default Figure;
