const NAIVE_TOP_LEVEL_GROUPS_REGEX =
  /((?<nongroup>[^\(]+)|(?<group>\([^\)]*(?:\)(?:[\?\*\+]|\{\d+(?:,\d+)?\})?)+))/g;
const INNER_REGEX = /(\^)?([^\$]+)(\$)?/;

function makeRegexGroupLevelPartial(regex: string) {
  // Get inner regex
  const match = regex.match(INNER_REGEX);
  if (!match) {
    return regex;
  }
  const start = match[1] || "";
  const inner = match[2];
  const end = match[3] || "";

  // Match exec until no more matches
  let matchExec = NAIVE_TOP_LEVEL_GROUPS_REGEX.exec(inner);
  let matches = [] as { nongroup?: string; group?: string }[];
  let innerRegex = "";
  while (matchExec) {
    matches.push(matchExec.groups as { nongroup?: string; group?: string });
    matchExec = NAIVE_TOP_LEVEL_GROUPS_REGEX.exec(inner);
  }

  innerRegex =
    matches[matches.length - 1].group ||
    matches[matches.length - 1].nongroup ||
    "";
  // In reverse order, wrap groups in non-capturing groups
  for (let i = matches.length - 2; i >= 0; i--) {
    const match = matches[i];
    innerRegex = `${match.group || match.nongroup}(?:${innerRegex})?`;
  }

  return `${start}${innerRegex}${end}`;
}

const EXACT_REFERENCE_NUMBER_REGEX = ([
  chapterName,
  sectionName,
  subsectionName,
]: [string, string, string]) =>
  `(?<${chapterName}>\\d+|[A-Z])(?:\\.(?<${sectionName}>\\d+)(?:\\.(?<${subsectionName}>\\d+))?)?`;
const EXACT_REFERENCE_RANGE_REGEX = `${EXACT_REFERENCE_NUMBER_REGEX([
  "chapter",
  "section",
  "subsection",
])}(?:\\.\\.${EXACT_REFERENCE_NUMBER_REGEX([
  "chapterEnd",
  "sectionEnd",
  "subsectionEnd",
])})?`;
const TYPE_REGEX = `(?<type>[a-z\-]+)/(?:${EXACT_REFERENCE_RANGE_REGEX})`;
const EXACT_REFERENCE_REGEX = new RegExp(
  `^(?<namespace>[a-z0-9\-]+):(?<book>[a-z0-9\-]+)/${TYPE_REGEX}$`,
  "i",
);

const PARTIAL_REFERENCE_NUMBER_REGEX = ([
  chapterName,
  sectionName,
  subsectionName,
]: [string, string, string]) =>
  makeRegexGroupLevelPartial(
    `(?<${chapterName}>\\d+|[A-Z])\\.(?<${sectionName}>\\d+)\\.(?<${subsectionName}>\\d+)`,
  );
const PARTIAL_REFERENCE_RANGE_REGEX = makeRegexGroupLevelPartial(
  `${PARTIAL_REFERENCE_NUMBER_REGEX([
    "chapter",
    "section",
    "subsection",
  ])}(?:(?<!\\.)\\.)(?<rangeOp>\\.)${PARTIAL_REFERENCE_NUMBER_REGEX([
    "chapterEnd",
    "sectionEnd",
    "subsectionEnd",
  ])}`,
);
const PARTIAL_TYPE_REGEX = makeRegexGroupLevelPartial(
  `(?<type>[a-z\-]+)/(?:${PARTIAL_REFERENCE_RANGE_REGEX})`,
);
const REFERENCE_SPECIFIER_OR_FUZZY_SEARCH_REGEX = `(?:${PARTIAL_TYPE_REGEX}|(?<fuzzyQuery>.*))`;
const PARTIAL_REFERENCE_REGEX = new RegExp(
  // We do this replacing here because the top level groups regex is too naive to handle groups in
  // disjunctions correctly and I don't want to write a full parser for this
  makeRegexGroupLevelPartial(
    `^(?<namespace>[a-z0-9\-]+):(?<book>[a-z0-9\-]+)/{reference_specifier}$`,
  ).replace("{reference_specifier}", REFERENCE_SPECIFIER_OR_FUZZY_SEARCH_REGEX),
  "i",
);

export interface ExactReferenceMatch {
  namespace: string;
  book: string;
  type: string;
  chapter: string;
  section?: string;
  subsection?: string;
  chapterEnd?: string;
  sectionEnd?: string;
  subsectionEnd?: string;
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
  rangeOp?: string;
  chapterEnd?: string;
  sectionEnd?: string;
  subsectionEnd?: string;
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

  const reference = match.groups as PartialReferenceMatch | ExactReferenceMatch;

  return reference;
}
