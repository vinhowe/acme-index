import React from "react";
import type { ProofBodyItem } from "@/lib/textbook/types";
import InfoBox from "./InfoBox";

export interface ProofProps {
  proof: ProofBodyItem;
}

const Proof: React.FC<React.PropsWithChildren<ProofProps>> = ({
  proof,
  children,
}) => {
  return (
    <InfoBox id={`proof-${proof.of}`} title={`Proof of ${proof.of}`}>
      {children}
    </InfoBox>
  );
};

export default Proof;
