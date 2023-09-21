import React from "react";
import { FigureBodyItem } from "@acme-index/common";
import InfoBox from "./InfoBox";

export interface FigureProps {
  figure: FigureBodyItem;
}

const Figure: React.FC<React.PropsWithChildren<FigureProps>> = ({
  figure,
  children,
}) => {
  return (
    <InfoBox title={`Figure ${figure.id}`} content={figure.content}>
      {children}
    </InfoBox>
  );
};

export default Figure;
