import React from "react";
import { TableBodyItem } from "@acme-index/common";
import InfoBox from "./InfoBox";

export interface AlgorithmProps {
  table: TableBodyItem;
}

const Table: React.FC<React.PropsWithChildren<AlgorithmProps>> = ({
  table,
  children,
}) => {
  return (
    <InfoBox
      title={`Table ${table.id}`}
      id={`table-${table.id}`}
      content={table.content}
    >
      {children}
    </InfoBox>
  );
};

export default Table;
