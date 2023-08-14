import { ExactReferenceMatch } from "textref";

export const buildDisplayReference = (
  reference: ExactReferenceMatch
): string => {
  let referenceType = reference.type;
  if (referenceType === "exercise") {
    // This just saves some space
    referenceType = "HW";
  }
  const capitalizedReferenceType =
    referenceType.charAt(0).toUpperCase() + referenceType.slice(1);
  let displayReference = capitalizedReferenceType;
  if (reference.chapter) {
    displayReference += ` ${reference.chapter}`;
    if (reference.section) {
      displayReference += `.${reference.section}`;
      if (reference.subsection) {
        displayReference += `.${reference.subsection}`;
      }
    }
  }
  return displayReference;
};

export const buildHref = (reference: ExactReferenceMatch): string => {
  let href = `#${reference.type}-${reference.chapter}`;
  if (reference.section) {
    href += `.${reference.section}`;
    if (reference.subsection) {
      href += `.${reference.subsection}`;
    }
  }
  return href;
};
