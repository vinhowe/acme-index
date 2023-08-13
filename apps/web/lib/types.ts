export interface InlineReference {
  type: "reference";
  reference_type: string;
  id: string;
  roman?: string;
  letter?: string;
  number?: number;
  body: string;
}
export interface InlineText {
  type: "inline";
  body: string;
}
export type InlineType = InlineText | InlineReference | PageBreakItem;

export interface BaseBodyItem<T = Array<InlineType>> {
  type:
    | "text"
    | "result"
    | "list"
    | "list_item"
    | "proof"
    | "equation"
    | "figure"
    | "pagebreak"
    | "exercise";
  page: number;
  body: T;
}
export interface TextBodyItem extends BaseBodyItem<Array<InlineType>> {
  type: "text";
}
export interface ResultBodyItem extends BaseBodyItem<Array<BodyItem>> {
  type: "result";
  result_type: string;
  id: string;
  name?: string;
}
export interface ProofBodyItem extends BaseBodyItem<Array<BodyItem>> {
  type: "proof";
  of: string;
}
export interface EquationBodyItem extends BaseBodyItem<Array<BodyItem>> {
  type: "equation";
  id: string;
}
export interface FigureBodyItem extends BaseBodyItem<Array<BodyItem>> {
  type: "figure";
  id: string;
  name: string;
}
export interface ListItemBodyItem extends BaseBodyItem<Array<BodyItem>> {
  type: "list_item";
  number: number;
  roman?: string;
  letter?: string;
}
export interface ListBodyItem
  extends BaseBodyItem<Array<ListItemBodyItem | PageBreakItem>> {
  type: "list";
  list_type: string;
}
export interface ExerciseBodyItem extends BaseBodyItem<Array<BodyItem>> {
  type: "exercise";
  id: string;
  name: string;
}
export interface PageBreakItem {
  type: "pagebreak";
  page: number;
}

export type BodyItem =
  | TextBodyItem
  | ResultBodyItem
  | ProofBodyItem
  | EquationBodyItem
  | ExerciseBodyItem
  | FigureBodyItem
  | ListBodyItem
  | PageBreakItem;

export interface BaseSectionItem {
  type: "section" | "subsection";
  id: string;
  name: string;
  page: number;
  body: Array<BodyItem>;
}
export interface SectionBodyItem extends BaseSectionItem {
  type: "section";
  sections: Array<SubsectionBodyItem>;
}
export interface SubsectionBodyItem extends BaseSectionItem {
  type: "subsection";
}
export type SectionItem = SectionBodyItem | SubsectionBodyItem;
export interface TextChapter {
  id: string;
  name: string;
  page?: number;
  body: Array<BodyItem>;
  sections: Array<SectionItem>;
}

export interface ExercisesChapter {
  id: string;
  name: string;
  page?: number;
  body: Array<ExerciseBodyItem>;
  sections: Array<SectionItem>;
}

export interface RawChapter {
  id: string;
  title: string;
  intro: string;
  sections: Array<RawSection>;
}

export interface RawSection {
  id: string;
  title: string;
  content: string;
}
