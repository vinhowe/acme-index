import React, { useMemo } from "react";
import type { ResultBodyItem } from "@acme-index/common";
import InfoBox from "./InfoBox";

export interface ResultProps {
  namespace: string;
  book: string;
  result: ResultBodyItem;
}

const Result: React.FC<React.PropsWithChildren<ResultProps>> = ({
  result,
  children,
}) => {
  // Compute result type from result_type: "nota_bene" -> "Nota Bene"
  const getResultType = (resultType: string) => {
    return resultType
      .split("_")
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");
  };

  const resultType = useMemo(
    () => getResultType(result.result_type),
    [result.result_type],
  );

  let title = `${resultType} ${result.id}`;
  if (result.name) {
    title += ` (${result.name})`;
  }

  return (
    <InfoBox id={`result-${result.id}`} title={title} content={result.content}>
      {children}
    </InfoBox>
  );
};

export default Result;
