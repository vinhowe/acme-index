import React from "react";
import { EquationBodyItem } from "@acme-index/common";

export interface EquationProps {
  equation: EquationBodyItem;
}

const Equation: React.FC<React.PropsWithChildren<EquationProps>> = ({
  equation,
  children,
}) => {
  return (
    <div
      id={`equation-${equation.id}`}
      className="equation flex w-full flex-row items-center"
    >
      <div className="min-w-0 flex-1 [&_.katex-display-wrapper]:-mr-14 [&_.katex-display-wrapper]:pr-6">
        {children}
      </div>
      <div className="z-10 flex h-full flex-none items-center bg-gradient-to-r from-transparent to-white to-40% pl-8 dark:to-black dark:to-40%">
        <a href={`#equation-${equation.id}`} className="no-underline">
          ({equation.id})
        </a>
      </div>
    </div>
  );
};

export default Equation;
