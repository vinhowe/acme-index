import React from "react";
import { AlgorithmBodyItem } from "@acme-index/common";
import InfoBox from "./InfoBox";

export interface AlgorithmProps {
  algorithm: AlgorithmBodyItem;
}

const Algorithm: React.FC<React.PropsWithChildren<AlgorithmProps>> = ({
  algorithm,
  children,
}) => {
  return (
    <InfoBox
      title={`Algorithm ${algorithm.id}`}
      id={`algorithm-${algorithm.id}`}
      content={algorithm.content}
    >
      {children}
    </InfoBox>
  );
};

export default Algorithm;
