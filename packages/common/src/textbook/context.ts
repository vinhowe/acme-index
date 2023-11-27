import {
  AlgorithmBodyItem,
  BodyItem,
  BodyItemWithReference,
  ChapterSectionItem,
  EquationBodyItem,
  ExerciseBodyItem,
  FenceBodyItem,
  FigureBodyItem,
  InlineItem,
  InlineReference,
  InlineText,
  ListBodyItem,
  ListItemBodyItem,
  PageBreakItem,
  ProofBodyItem,
  ResultBodyItem,
  SectionItem,
  SectionSectionItem,
  StandaloneHeadingBodyItem,
  TableBodyItem,
  TextBodyItem,
  TextChapter,
} from "./types";

class TextbookContextRenderer {
  private pinnedReferences?: Set<string>;

  constructor(
    private namespace: string,
    private book: string,
    pinnedReferences?: Set<string>,
  ) {
    this.pinnedReferences = pinnedReferences;
    this.renderTextbookBodyItem = this.renderTextbookBodyItem.bind(this);
    this.renderTextbookSection = this.renderTextbookSection.bind(this);
    this.filterContextItem = this.filterContextItem.bind(this);
  }

  private buildReference(type: string, id: string): string {
    return `${this.namespace}:${this.book}/${type}/${id}`;
  }

  renderSingleSectionChapterContext(
    sectionId: string,
    chapter: TextChapter,
  ): string {
    let chapterWithSingleSection = {
      type: "chapter",
      ...chapter,
    } as ChapterSectionItem;

    const foundSection = chapter.sections.find((section) => {
      return section.id === sectionId;
    }) as SectionSectionItem | undefined;

    chapterWithSingleSection.sections = foundSection ? [foundSection] : [];

    return this.renderTextbookSection(chapterWithSingleSection);
  }

  renderTextbookBodyItem(item: Exclude<BodyItem, PageBreakItem>): string {
    switch (item.type) {
      case "text":
        return this.renderTextbookText(item);
      case "standalone_heading":
        return this.renderTextbookStandaloneHeading(item);
      case "result":
        return this.renderTextbookResult(item);
      case "proof":
        return this.renderGenericItemWithReference(item, "proof");
      case "equation":
        return this.renderGenericItemWithReference(item, "equation");
      case "algorithm":
        return this.renderGenericItemWithReference(item, "algorithm");
      case "table":
        return this.renderGenericItemWithReference(item, "table");
      case "figure":
        return this.renderGenericItemWithReference(item, "figure");
      case "fence":
        return this.renderTextbookFence(item);
      case "list":
        return this.renderTextbookList(item);
      case "exercise":
        return this.renderTextbookExercise(item);
    }
  }

  filterContextItem(bodyItem: BodyItem): boolean {
    switch (bodyItem.type) {
      case "pagebreak":
        return false;
      case "text":
        return !bodyItem.context_optional;
      case "result":
        // TODO: Add check that result is not referenced in exercise
        // —one way to do this is to add a list of references to keep
        // track of—we can pull it from the exercise or the target
        return (
          // !["example", "unexample", "application", "vista"].includes(
          !["application", "vista"].includes(bodyItem.result_type) ||
          (this.pinnedReferences !== undefined &&
            this.pinnedReferences.has(
              this.buildReference("result", bodyItem.id),
            ))
        );
      default:
        return true;
    }
  }

  renderTextbookBodyItems(bodyItems: BodyItem[]): string {
    return bodyItems
      .filter(this.filterContextItem)
      .map((item) =>
        this.renderTextbookBodyItem(item as Exclude<BodyItem, PageBreakItem>),
      )
      .join("\n\n");
  }

  renderInlineItem(item: InlineText | InlineReference): string {
    switch (item.type) {
      case "inline":
        return item.body;
      case "reference":
        const listItemNumber = item.roman || item.letter;
        return `[[${this.buildReference(
          item.reference_type,
          `${item.id}${listItemNumber ? `(${listItemNumber})` : ""}`,
        )}]]`;
    }
  }

  renderTextbookStandaloneHeading(item: StandaloneHeadingBodyItem): string {
    // TODO: This is kind of awful but I don't want to take the time to do this
    // properly right now
    return `<h${item.level}>"${item.body}"</h${item.level}>`;
  }

  renderTextbookText(...bodyItems: TextBodyItem[]): string {
    return bodyItems
      .map((item) =>
        item.body
          .filter((item) => ["inline", "reference"].includes(item.type))
          .map((item) =>
            this.renderInlineItem(item as InlineText | InlineReference),
          )
          .join(""),
      )
      .join("\n\n");
  }

  renderTextbookExercise(exercise: ExerciseBodyItem): string {
    return `begin exercise [[${exercise.reference}]]\n\
${this.renderTextbookBodyItems(exercise.body)}\n\
end exercise [[${exercise.reference}]]`;
  }

  renderTextbookResult(result: ResultBodyItem): string {
    // Compute result type from result_type: "nota_bene" -> "Nota Bene"
    const getResultType = (resultType: string) => {
      return resultType
        .split("_")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" ");
    };

    const resultType = getResultType(result.result_type);

    let title = `${resultType} ${result.id}`;
    if (result.name) {
      title += ` (${result.name})`;
    }

    return `begin result [[${result.reference}]]: ${title}\n\
${this.renderTextbookBodyItems(result.body)}\n\
end result [[${result.reference}]]`;
  }

  renderGenericItemWithReference(
    item: BodyItemWithReference,
    type: string,
  ): string {
    return `begin ${type} [[${item.reference}]]\n\
${this.renderTextbookBodyItems(item.body)}\n\
end ${type} [[${item.reference}]]`;
  }

  renderTextbookFence(item: FenceBodyItem): string {
    return `\`\`\`${item.info ?? ""}\n\
${item.body}\n\
\`\`\``;
  }

  renderTextbookListItem(item: ListItemBodyItem): string {
    return `begin item [[${item.reference}]]\n\
${this.renderTextbookBodyItems(item.body)}\n\
end item [[${item.reference}]]`;
  }

  renderTextbookList(list: ListBodyItem): string {
    return list.body
      .filter((item) => item.type === "list_item")
      .map((item) => this.renderTextbookListItem(item as ListItemBodyItem))
      .join("\n");
  }

  renderTextbookSection(section: SectionItem): string {
    const sectionDisplayType = section.type.toLowerCase();
    let sectionText = `begin ${sectionDisplayType} [[${section.reference}]]\n\n`;
    const sectionBody = this.renderTextbookBodyItems(section.body).trim();
    if (sectionBody !== "") {
      sectionText += `${sectionBody}\n`;
    }
    if ("sections" in section) {
      const sectionsText = this.renderTextbookSections(section.sections).trim();
      if (sectionsText !== "") {
        if (sectionBody !== "") {
          // This is horrible but I don't want to think about it
          sectionText += "\n";
        }
        sectionText += `${sectionsText}\n`;
      }
    }
    sectionText += `\nend ${sectionDisplayType} [[${section.reference}]]`;
    return sectionText;
  }

  renderTextbookSections(sections: SectionItem[]): string {
    return sections.map(this.renderTextbookSection).join("\n\n");
  }
}

const getReferencesRecursive = (
  bodyItem: BodyItem | ListItemBodyItem | InlineItem,
  references: InlineReference[] = [],
): InlineReference[] => {
  if ("body" in bodyItem) {
    if (bodyItem.type === "reference") {
      references.push(bodyItem);
      return references;
    }
    if (typeof bodyItem.body === "string") {
      return references;
    }
    bodyItem.body.forEach((item) => {
      if ("body" in item) {
        getReferencesRecursive(item, references);
      }
    });
  }
  return references;
};

const buildPinnedReferencesSet = (
  namespace: string,
  book: string,
  references: InlineReference[],
): Set<string> => {
  return references.reduce((acc, reference) => {
    acc.add(`${namespace}:${book}/${reference.reference_type}/${reference.id}`);
    return acc;
  }, new Set<string>());
};

export const renderExerciseHelpContext = (
  namespace: string,
  book: string,
  sectionId: string,
  exercise: ExerciseBodyItem,
  chapter: TextChapter,
): string => {
  const exerciseReferences = buildPinnedReferencesSet(
    namespace,
    book,
    getReferencesRecursive(exercise),
  );

  const contextRenderer = new TextbookContextRenderer(
    namespace,
    book,
    exerciseReferences,
  );

  const singleSectionContext =
    contextRenderer.renderSingleSectionChapterContext(sectionId, chapter);

  const exampleReferencePrefix = `${namespace}:${book}`;

  return `begin textbook material

${singleSectionContext}

end textbook material


${contextRenderer.renderTextbookExercise(exercise).trim()}

You are helping a student UNDERSTAND this exercise—not solve it. You must\
 follow these rules:
- As a large language model, are not good at providing solutions. You should\
 strongly prefer to help the student discover the solution themselves,\
 answering questions about the material instead. IF YOU DO PROVIDE A SOLUTION,\
 EVEN AS AN EXAMPLE, you MUST FIRST explain to the student how large language\
 models (like you!) can provide false but convincing answers. DO THIS AT THE\
 BEGINNING OF ANY SOLUTION RESPONSE, IN BOLD.
- Respond only in Markdown with LaTeX math blocks ($, $$). Do not use any other\
 formatting.
- When writing a dollar sign if you are not writing LaTeX, use the escape\
  character \\ (backslash) before the dollar sign. For example, write \\$100 to\
  get $100.
- Write references as follows:
  - Results (Theorems, Statements, Lemmas, Corollaries, Examples, etc.):\
 [[${exampleReferencePrefix}/result/1.2.34]]
  - Sections: [[${exampleReferencePrefix}/text/1.2.3]]
  - Proofs, Figures, Equations, Algorithms:\
 [[${exampleReferencePrefix}/{proof,figure,equation,algorithm}/1.4]]
  - If the item of interest is a numbered list item, include the number in\
 parentheses: [[${exampleReferencePrefix}/result/1.2.3(iv)]]`;
};

export const renderReferenceSuggestionsContext = (
  namespace: string,
  book: string,
  sectionId: string,
  itemWithReference: BodyItemWithReference,
  chapter: TextChapter,
): string => {
  const contextRenderer = new TextbookContextRenderer(
    namespace,
    book,
    undefined,
  );

  const singleSectionContext =
    contextRenderer.renderSingleSectionChapterContext(sectionId, chapter);

  const exampleReferencePrefix = `${namespace}:${book}`;

  return `begin textbook material

${singleSectionContext}

end textbook material


${contextRenderer.renderTextbookBodyItem(itemWithReference).trim()}

A student is seeing [[${itemWithReference.reference}]] for the first time and\
 has asked you to help them come up with a suggestions for ideas for follow-up\
 queries to ask you. You should come up with at least three short suggestions\
 for queries that guide the student to understand the material better. They can
 be questions or requests in command form. Some ideas include:
- Questions about how this relates to other material in this chapter
- Requests to reframe the material in a simpler or more intuitive way
- Asking to see why a proof wouldn't work without a step or assumption
- And whatever else you think might be helpful.

Here are your formatting rules, which you MUST follow:
- If you use math, use inline LaTeX math blocks ($). Do not use any other math\
 formatting.
- When writing a dollar sign if you are not writing LaTeX, use the escape\
  character \\ (backslash) before the dollar sign. For example, write \\$100 to\
  get $100.
- Write references as follows:
  - Results (Theorems, Statements, Lemmas, Corollaries, Examples, etc.):\
 [[${exampleReferencePrefix}/result/1.2.34]]
  - Sections: [[${exampleReferencePrefix}/text/1.2.3]]
  - Proofs, Figures, Equations, Algorithms:\
 [[${exampleReferencePrefix}/{proof,figure,equation,algorithm}/1.4]]
  - If the item of interest is a numbered list item, include the number in\
 parentheses: [[${exampleReferencePrefix}/result/1.2.3(iv)]]`;
};
