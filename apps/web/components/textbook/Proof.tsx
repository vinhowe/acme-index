import React from "react";
import type { ProofBodyItem } from "@acme-index/common";
import InfoBox from "./InfoBox";

export interface ProofProps {
  proof: ProofBodyItem;
}

const Proof: React.FC<React.PropsWithChildren<ProofProps>> = ({
  proof,
  children,
}) => {
  return (
    <InfoBox
      id={`proof-${proof.of}`}
      title={`Proof of ${proof.of}`}
      content={proof.content}
    >
      {children}
    </InfoBox>
  );
};

export default Proof;
