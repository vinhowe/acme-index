function makeRegexListPartial(regexList: Array<string>): string {
  let innerRegex = regexList[regexList.length - 1];
  for (let i = regexList.length - 2; i >= 0; i--) {
    innerRegex = `${regexList[i]}(?:${innerRegex})?`;
  }
  return innerRegex;
}

function makeRegexOr(regexList: Array<string>): string {
  return `(?:${regexList.join("|")})`;
}

function makeRegexItemOptional(regex: string): string {
  return `(?:${regex})?`;
}

function makeRegexNonCapturingGroup(regexList: Array<string>): string {
  return `(?:${regexList.join("")})`;
}

const ROMAN_NUMERAL_REGEX =
  "(?=[mdclxvi])m*(c[md]|d?c{0,3})(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})";

const LIST_ITEM_REGEX = (listItemName: string) =>
  `(?<${listItemName}>${ROMAN_NUMERAL_REGEX}|[a-z])`;

const LIST_ITEM_RANGE_REGEX = (
  startListItemName: string,
  endListItemName: string,
) =>
  `${LIST_ITEM_REGEX(startListItemName)}\\.\\.${LIST_ITEM_REGEX(
    endListItemName,
  )}`;

const EXACT_REFERENCE_NUMBER_REGEX = (
  chapterName: string,
  sectionName: string,
  subsectionName: string,
) =>
  `(?<${chapterName}>\\d+|[A-Z])(?:\\.(?<${sectionName}>\\d+)(?:\\.(?<${subsectionName}>\\d+))?)?`;

const EXACT_REFERENCE_RANGE_REGEX = `${EXACT_REFERENCE_NUMBER_REGEX(
  "chapter",
  "section",
  "subsection",
)}(?:(?:\\(${LIST_ITEM_RANGE_REGEX(
  "listItemRangeStart",
  "listItemRangeEnd",
)}\\))?|(?:(?:\\(${LIST_ITEM_REGEX(
  "listItem",
)}\\))?(?:\\.\\.${EXACT_REFERENCE_NUMBER_REGEX(
  "chapterEnd",
  "sectionEnd",
  "subsectionEnd",
)}(?:\\(${LIST_ITEM_REGEX("listItemEnd")}\\))?)?)?)?`;

const TYPE_REGEX = `(?<type>[a-z\-]+)/(?:${EXACT_REFERENCE_RANGE_REGEX})`;
const EXACT_REFERENCE_REGEX = new RegExp(
  `^(?<namespace>[a-z0-9\-]+):(?<book>[a-z0-9\-]+)/${TYPE_REGEX}$`,
  "i",
);

const PARTIAL_REFERENCE_NUMBER_REGEX = (
  chapterName: string,
  sectionName: string,
  subsectionName: string,
) =>
  makeRegexListPartial([
    `(?<${chapterName}>\\d+|[A-Z])`,
    "\\.",
    `(?<${sectionName}>\\d+)`,
    "\\.",
    `(?<${subsectionName}>\\d+)`,
  ]);
const PARTIAL_LIST_ITEM_RANGE_REGEX = (
  startListItemName: string,
  endListItemName: string,
  listItemRangeOpName: string,
) =>
  `${LIST_ITEM_REGEX(
    startListItemName,
  )}(?:(?:(?<!\\.)\\.)(?<${listItemRangeOpName}>\\.)(?:${LIST_ITEM_REGEX(
    endListItemName,
  )})?)?`;
const PARTIAL_REFERENCE_RANGE_REGEX = makeRegexListPartial([
  PARTIAL_REFERENCE_NUMBER_REGEX("chapter", "section", "subsection"),
  makeRegexItemOptional(
    makeRegexListPartial([
      "\\(",
      PARTIAL_LIST_ITEM_RANGE_REGEX(
        "listItemStartRangeStart",
        "listItemStartRangeEnd",
        "listItemStartRangeOp",
      ),
      "\\)",
    ]),
  ),
  "(?:(?<!\\.)\\.)",
  "(?<rangeOp>\\.)",
  PARTIAL_REFERENCE_NUMBER_REGEX("chapterEnd", "sectionEnd", "subsectionEnd"),
  makeRegexItemOptional(
    makeRegexListPartial([
      "\\(",
      PARTIAL_LIST_ITEM_RANGE_REGEX(
        "listItemEndRangeStart",
        "listItemEndRangeEnd",
        "listItemEndRangeOp",
      ),
      "\\)",
    ]),
  ),
]);

const PARTIAL_REFERENCE_REGEX = new RegExp(
  makeRegexListPartial([
    "^",
    "(?<namespace>[a-z0-9-]+)",
    ":",
    "(?<book>[a-z0-9-]+)",
    "\\/",
    makeRegexOr([
      makeRegexListPartial([
        "(?<type>[a-z-]+)",
        "\\/",
        PARTIAL_REFERENCE_RANGE_REGEX,
      ]),
      "(?<fuzzyQuery>.*)",
    ]),
  ]),
  "i",
);

export interface ExactReferenceMatch {
  namespace: string;
  book: string;
  type: string;
  chapter: string;
  section?: string;
  listItem?: string;
  listItemRangeStart?: string;
  listItemRangeEnd?: string;
  subsection?: string;
  chapterEnd?: string;
  sectionEnd?: string;
  subsectionEnd?: string;
  listItemEnd?: string;
}

export type BasePartialReferenceMatch = {
  namespace?: string;
  book?: string;
};

export interface SpecifiedPartialReferenceMatch
  extends BasePartialReferenceMatch {
  type?: string;
  chapter?: string;
  section?: string;
  subsection?: string;
  listItemStartRangeStart?: string;
  listItemStartRangeEnd?: string;
  rangeOp?: string;
  chapterEnd?: string;
  sectionEnd?: string;
  subsectionEnd?: string;
  listItemEndRangeStart?: string;
  listItemEndRangeEnd?: string;
}

export interface FuzzyPartialReferenceMatch extends BasePartialReferenceMatch {
  fuzzyQuery?: string;
}

export type PartialReferenceMatch =
  | SpecifiedPartialReferenceMatch
  | FuzzyPartialReferenceMatch;

export function parseRef(
  exactRef: string,
  options?: { partial: false },
): ExactReferenceMatch | null;
export function parseRef(
  partialRef: string,
  options?: { partial: true },
): PartialReferenceMatch | null;
export function parseRef(
  exactRef: string,
  { partial } = { partial: false },
): ExactReferenceMatch | PartialReferenceMatch | null {
  const match = exactRef.match(
    partial ? PARTIAL_REFERENCE_REGEX : EXACT_REFERENCE_REGEX,
  );

  if (!match?.groups) {
    return null;
  }

  const reference = match.groups as unknown as typeof partial extends true
    ? PartialReferenceMatch
    : ExactReferenceMatch;

  return reference;
}
