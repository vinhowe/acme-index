import {
  BodyItem,
  ChapterSectionItem,
  EquationBodyItem,
  ExerciseBodyItem,
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
  TextBodyItem,
  TextChapter,
} from "./types";

class TextbookContextRenderer {
  private pinnedReferences?: Set<string>;

  constructor(pinnedReferences?: Set<string>) {
    this.pinnedReferences = pinnedReferences;
    this.renderTextbookBodyItem = this.renderTextbookBodyItem.bind(this);
    this.renderTextbookSection = this.renderTextbookSection.bind(this);
    this.filterContextItem = this.filterContextItem.bind(this);
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
      case "result":
        return this.renderTextbookResult(item);
      case "proof":
        return this.renderTextbookProof(item);
      case "equation":
        return this.renderTextbookEquation(item);
      case "figure":
        return this.renderTextbookFigure(item);
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
          !["example", "application", "vista"].includes(bodyItem.result_type) ||
          (this.pinnedReferences !== undefined &&
            this.pinnedReferences.has(`acme:v1/result/${bodyItem.id}`))
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
        return `[[acme:v1/${item.reference_type}/${item.id}]]`;
    }
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
    return `begin exercise [[acme:v1/exercise/${exercise.id}]]\n\
${this.renderTextbookBodyItems(exercise.body)}\n\
end exercise [[acme:v1/exercise/${exercise.id}]]`;
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

    let title = `${resultType}`;
    if (result.name) {
      title += ` (${result.name})`;
    }
    return `begin result [[acme:v1/result/${result.id}]]: ${title}\n\
${this.renderTextbookBodyItems(result.body)}\n\
end result [[acme:v1/result/${result.id}]]`;
  }

  renderTextbookProof(proof: ProofBodyItem): string {
    return `begin proof [[acme:v1/proof/${proof.of}]]\n\
${this.renderTextbookBodyItems(proof.body)}\n\
end proof [[acme:v1/proof/${proof.of}]]`;
  }

  renderTextbookEquation(equation: EquationBodyItem): string {
    return `begin equation [[acme:v1/equation/${equation.id}]]\n\
${this.renderTextbookBodyItems(equation.body)}\n\
end equation [[acme:v1/equation/${equation.id}]]`;
  }

  renderTextbookFigure(figure: FigureBodyItem): string {
    return `begin figure [[acme:v1/figure/${figure.id}]]\n\
${this.renderTextbookBodyItems(figure.body)}\n\
end figure [[acme:v1/figure/${figure.id}]]`;
  }

  renderTextbookListItem(item: ListItemBodyItem): string {
    return `${item.roman || item.letter}. ${this.renderTextbookBodyItems(
      item.body,
    )}`;
  }

  renderTextbookList(list: ListBodyItem): string {
    return list.body
      .filter((item) => item.type === "list_item")
      .map((item) => this.renderTextbookListItem(item as ListItemBodyItem))
      .join("\n");
  }

  renderTextbookSection(section: SectionItem): string {
    const sectionDisplayType = section.type.toLowerCase();
    let sectionText = `begin ${sectionDisplayType} [[acme:v1/text/${section.id}]]\n\n`;
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
    sectionText += `\nend ${sectionDisplayType} [[acme:v1/text/${section.id}]]`;
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
  references: InlineReference[],
): Set<string> => {
  return references.reduce((acc, reference) => {
    acc.add(`acme:v1/${reference.reference_type}/${reference.id}`);
    return acc;
  }, new Set<string>());
};

export const renderExerciseChapterContext = (
  sectionId: string,
  exercise: ExerciseBodyItem,
  chapter: TextChapter,
): string => {
  const exerciseReferences = buildPinnedReferencesSet(
    getReferencesRecursive(exercise),
  );

  const contextRenderer = new TextbookContextRenderer(exerciseReferences);

  const singleSectionContext =
    contextRenderer.renderSingleSectionChapterContext(sectionId, chapter);

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
- Write references as follows:
  - Results (Theorems, Statements, Lemmas, Corollaries, Examples, etc.):\
 [[acme:v1/result/1.2.34]]
  - Sections: [[acme:v1/text/1.2.3]]
  - Proofs, Figures, Equations: [[acme:v1/{proof,figure,equation}/1.4]]`;
};
