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
export type InlineItem = InlineText | InlineReference | PageBreakItem;

export interface BaseBodyItem<T> {
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
  page?: number;
  body: T;
}
export interface TextBodyItem extends BaseBodyItem<Array<InlineItem>> {
  type: "text";
  context_optional?: boolean;
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
  list_type: "roman" | "letter";
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

export interface BaseSectionItem<T = BodyItem> {
  type: "chapter" | "section" | "subsection";
  id: string;
  name: string;
  page?: number;
  body: Array<T>;
}
export interface ChapterSectionItem<T = BodyItem> extends BaseSectionItem<T> {
  type: "chapter";
  sections: Array<SectionSectionItem>;
}
export interface SectionSectionItem<T = BodyItem> extends BaseSectionItem<T> {
  type: "section";
  sections: Array<SubsectionSectionItem>;
}
export interface SubsectionSectionItem<T = BodyItem>
  extends BaseSectionItem<T> {
  type: "subsection";
}
export type SectionItem<T = BodyItem> =
  | ChapterSectionItem<T>
  | SectionSectionItem<T>
  | SubsectionSectionItem<T>;

export interface BaseChapter<T = BodyItem> {
  id: string;
  name: string;
  body: Array<BodyItem>;
  page?: number;
  sections: Array<SectionItem<T>>;
}

export type TextChapter = BaseChapter<BodyItem>;
export type ExercisesChapter = BaseChapter<ExerciseBodyItem>;

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
