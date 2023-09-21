import MarkdownIt from "markdown-it";
import toml from "toml";
import {
  BodyItem,
  EquationBodyItem,
  ExerciseBodyItem,
  FigureBodyItem,
  InlineItem,
  ListBodyItem,
  PageBreakItem,
  ProofBodyItem,
  ResultBodyItem,
  SectionSectionItem,
  SubsectionSectionItem,
  TextChapter,
  BaseChapter,
  InlineReference,
  InlineText,
  AlgorithmBodyItem,
  TableBodyItem,
} from "./types";

type Attributes = { [key: string]: string };

interface LightHTMLElement {
  body: string;
  attrs: Attributes;
}

function extractRefs(input: string): Array<InlineText | InlineReference> {
  function parseAttributes(tag: string) {
    const attributeRegex = /(\w+)\s*=\s*['"]([^'"]*)['"]/g;
    const attributes: Attributes = {};
    let match;

    while ((match = attributeRegex.exec(tag)) !== null) {
      attributes[match[1]] = match[2];
    }

    return attributes;
  }

  const tagRegex =
    /<(text|result|proof|exercise|figure|equation|algorithm)ref([^>]*)>(.*?)<\/\1ref>/g;

  const segments: Array<InlineText | InlineReference> = [];

  const matches = [];
  let match;
  while ((match = tagRegex.exec(input)) !== null) {
    matches.push(match);
  }

  let currentIndex = 0;

  for (const match of matches) {
    const offset = match.index;
    const bodySegment = input.slice(currentIndex, offset);
    if (bodySegment) {
      segments.push({ type: "inline", body: bodySegment });
    }
    const [, referenceType, tagAttributes, innerText] = match;
    const attributes: Attributes = parseAttributes(tagAttributes);
    segments.push({
      type: "reference",
      reference_type: referenceType,
      id: attributes.id || attributes.of,
      roman: attributes.roman,
      letter: attributes.letter,
      number: attributes.number ? parseInt(attributes.number) : undefined,
      book: attributes.book,
      body: innerText,
    });
    currentIndex = offset + match[0].length;
  }

  const lastSegment = input.slice(currentIndex);
  if (lastSegment) {
    segments.push({ type: "inline", body: lastSegment });
  }

  return segments;
}

function extractPageBreaks(input: string): Array<InlineText | PageBreakItem> {
  const pageBreakRegex = /(<pagebreak\s+page="(\d+)"[^>]*\/>)/g;
  const segments: Array<InlineText | PageBreakItem> = [];

  const matches = [];
  let match;
  while ((match = pageBreakRegex.exec(input)) !== null) {
    matches.push(match);
  }

  let currentIndex = 0;

  for (const match of matches) {
    const offset = match.index;
    const bodySegment = input.slice(currentIndex, offset);
    if (bodySegment) {
      segments.push({ type: "inline", body: bodySegment });
    }
    segments.push({ type: "pagebreak", page: parseInt(match[2]) });
    currentIndex = offset + match[0].length;
  }

  const lastSegment = input.slice(currentIndex);
  if (lastSegment) {
    segments.push({ type: "inline", body: lastSegment });
  }

  return segments;
}

function handleHTMLContent(
  content: string,
  selfClosing: boolean,
): LightHTMLElement {
  // Get tag attributes
  const attrs = {} as { [key: string]: string };
  const openingTagRegex = /<[^>]+?>/;
  const openingTagMatch = openingTagRegex.exec(content);

  if (openingTagMatch) {
    const openingTag = openingTagMatch[0];
    const attributeRegex =
      /(\w+)=(?:"((?:[^"\\]|\\.)*)"|(?:'((?:[^'\\]|\\.)*))')/g;
    let match;

    while ((match = attributeRegex.exec(openingTag)) !== null) {
      attrs[match[1]] = match[2];
    }
  }

  if (!selfClosing) {
    content = content
      .replace(/^[^/>]*>/, "")
      .replace(/<\/[^<]*$/, "")
      .trim();
  }

  return { attrs, body: content };
}

type ContextType = { parentType: string; parentId: string };

type HandlerFunction = (
  body: string,
  attrs: { [key: string]: string },
  context: ContextType,
) => BodyItem;

class TextbookFormatParser {
  private handlers: { [tagName: string]: HandlerFunction };

  constructor(
    private namespace: string,
    private book: string,
    private markdown: string,
  ) {
    this.handleOlTag = this.handleOlTag.bind(this);
    this.handleProofTag = this.handleProofTag.bind(this);
    this.handlePageBreak = this.handlePageBreak.bind(this);
    this.handleEquationTag = this.handleEquationTag.bind(this);
    this.handleAlgorithmTag = this.handleAlgorithmTag.bind(this);
    this.handleTextTableTag = this.handleTextTableTag.bind(this);
    this.handleHtmlInnards = this.handleHtmlInnards.bind(this);

    this.handlers = {
      ol: this.handleOlTag,
      proof: this.handleProofTag,
      pagebreak: this.handlePageBreak,
      equation: this.handleEquationTag,
      algorithm: this.handleAlgorithmTag,
      texttable: this.handleTextTableTag,
    };
  }

  private buildReference(type: string, id: string): string {
    return `${this.namespace}:${this.book}/${type}/${id}`;
  }

  private handleHtmlInnards(
    htmlContent: string,
    context: ContextType,
  ): Array<BodyItem> {
    const bodyTypes: Array<BodyItem> = [];
    const chunks = htmlContent.split(/\n\n/).filter((p) => p.length > 0);

    for (let i = 0; i < chunks.length; i++) {
      let currentChunk = chunks[i];
      const currentChunkTrimmed = currentChunk.trimStart();
      const openingTagMatch = /^<([a-zA-Z0-9_-]+)[^>/]*(\/)?>/i.exec(
        currentChunkTrimmed,
      );
      // Includes language
      const codeBlockMatch = /^```/.exec(currentChunkTrimmed);

      // Handle opening tag
      if (openingTagMatch) {
        currentChunk = currentChunkTrimmed;
        const openingTag = openingTagMatch[1];
        const isSelfClosing = openingTagMatch[2] === "/";

        if (!isSelfClosing) {
          const closingTag = `</${openingTag}>`;

          if (!currentChunk.includes(closingTag)) {
            while (
              i < chunks.length - 1 &&
              !chunks[i + 1].includes(closingTag)
            ) {
              currentChunk += "\n\n" + chunks[++i];
            }
            currentChunk += "\n\n" + chunks[++i];
          }
        }

        const { attrs: tagAttributes, body: tagBody } = handleHTMLContent(
          currentChunk,
          isSelfClosing,
        );

        if (openingTag in this.handlers) {
          bodyTypes.push(
            this.handlers[openingTag](tagBody, tagAttributes, context),
          );
          continue;
        }
      }

      if (codeBlockMatch) {
        // Iterate through chunks until we find the closing tag
        const closingTag = "```";
        // This is a way to create the opening tag
        if (!currentChunk.replace("```", "").includes(closingTag)) {
          while (i < chunks.length - 1 && !chunks[i + 1].includes(closingTag)) {
            currentChunk += "\n\n" + chunks[++i];
          }
          currentChunk += "\n\n" + chunks[++i];
        }
        // Parse out language and content with regex
        const codeBlockRegex = /^```(\w+)?\n([\s\S]*)\n```$/;
        currentChunk = currentChunk.trim();
        const codeBlockMatch = codeBlockRegex.exec(currentChunk.trim());
        if (!codeBlockMatch) {
          continue;
        }
        const [, language, codeBlockContent] = codeBlockMatch;

        bodyTypes.push({
          type: "fence",
          info: language,
          body: codeBlockContent,
          content: currentChunk,
        });
        continue;
      }

      bodyTypes.push({
        type: "text",
        body: extractPageBreaks(currentChunk).reduce(
          (
            accumulator: Array<InlineItem>,
            currentItem: InlineText | PageBreakItem,
          ) => {
            if (currentItem.type === "pagebreak") {
              return accumulator.concat(currentItem);
            } else {
              return accumulator.concat(...extractRefs(currentItem.body));
            }
          },
          [] as Array<InlineItem>,
        ),
        content: currentChunk,
      });
    }

    return bodyTypes;
  }

  private handleOlTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    { parentId, parentType }: ContextType,
  ): ListBodyItem {
    const list: Omit<ListBodyItem, "page"> &
      Partial<Pick<ListBodyItem, "page">> = {
      type: "list",
      list_type: "roman",
      body: [],
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "type":
          if (value === "roman" || value === "letter") {
            list.list_type = value;
          }
          break;
        case "page":
          list.page = parseInt(value, 10);
          break;
      }
    });

    // Handle li and pagebreak tags
    const liAndPagebreakRegex = /(<li[^>]*>.*?<\/li>|<pagebreak[^>]*\/>)/gms;
    let liAndPagebreakMatch;
    while (
      (liAndPagebreakMatch = liAndPagebreakRegex.exec(htmlContent)) !== null
    ) {
      const liAndPagebreakContent = liAndPagebreakMatch[1];
      if (/^<li[^>]*>.*?<\/li>$/gms.test(liAndPagebreakContent)) {
        const { attrs: liAttrs, body } = handleHTMLContent(
          liAndPagebreakContent,
          false,
        );
        const innards = this.handleHtmlInnards(body, { parentId, parentType });
        list.body.push({
          type: "list_item",
          number: parseInt(liAttrs?.value),
          roman: liAttrs?.roman,
          letter: liAttrs?.letter,
          body: innards,
          content: liAndPagebreakContent,
          reference: this.buildReference(
            parentType,
            `${parentId}(${liAttrs?.roman || liAttrs?.letter})`,
          ),
        });
      } else if (/^<pagebreak[^>]*\/>$/gms.test(liAndPagebreakContent)) {
        const pagebreakAttrMatch = /page="(\d+)"/.exec(liAndPagebreakContent);
        const pageNumber =
          pagebreakAttrMatch?.[1] && parseInt(pagebreakAttrMatch[1], 10);

        if (!pageNumber) {
          continue;
        }

        const pagebreak: PageBreakItem = {
          type: "pagebreak",
          page: pageNumber,
        };
        list.body.push(pagebreak);
      }
    }

    return list;
  }

  private handleProofTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    context: ContextType,
  ): ProofBodyItem {
    const proof: Omit<ProofBodyItem, "of" | "page"> &
      Partial<Pick<ProofBodyItem, "of" | "page">> = {
      type: "proof",
      body: this.handleHtmlInnards(
        htmlContent,
        tagAttributes?.of
          ? {
              parentType: "proof",
              parentId: tagAttributes.of,
            }
          : context,
      ),
      reference: this.buildReference("proof", tagAttributes.of),
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "of":
          proof[key] = value;
          break;
        case "page":
          proof[key] = parseInt(value, 10);
          break;
      }
    });

    return proof as ProofBodyItem;
  }

  private handleExerciseTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    context: ContextType,
  ): ExerciseBodyItem {
    const exercise: Omit<ExerciseBodyItem, "id" | "name" | "page"> &
      Partial<Pick<ExerciseBodyItem, "id" | "name" | "page">> = {
      type: "exercise",
      body: this.handleHtmlInnards(
        htmlContent,
        tagAttributes?.id
          ? {
              parentType: "exercise",
              parentId: tagAttributes.id,
            }
          : context,
      ),
      reference: this.buildReference("exercise", tagAttributes.id),
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "id":
          exercise[key] = value;
          break;
        case "name":
          exercise[key] = value;
          break;
        case "page":
          exercise[key] = parseInt(value, 10);
          break;
      }
    });

    return exercise as ExerciseBodyItem;
  }

  private handleEquationTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    context: ContextType,
  ): EquationBodyItem {
    const equation: Omit<EquationBodyItem, "id" | "page"> &
      Partial<Pick<EquationBodyItem, "id" | "page">> = {
      type: "equation",
      body: this.handleHtmlInnards(
        htmlContent,
        tagAttributes?.id
          ? {
              parentType: "equation",
              parentId: tagAttributes.id,
            }
          : context,
      ),
      reference: this.buildReference("equation", tagAttributes.id),
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "id":
          equation[key] = value;
          break;
        case "page":
          equation[key] = parseInt(value, 10);
          break;
      }
    });

    return equation as EquationBodyItem;
  }

  private handleAlgorithmTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    context: ContextType,
  ): AlgorithmBodyItem {
    const algorithm: Omit<AlgorithmBodyItem, "id" | "name" | "page"> &
      Partial<Pick<AlgorithmBodyItem, "id" | "name" | "page">> = {
      type: "algorithm",
      body: this.handleHtmlInnards(
        htmlContent,
        tagAttributes?.id
          ? {
              parentType: "algorithm",
              parentId: tagAttributes.id,
            }
          : context,
      ),
      reference: this.buildReference("algorithm", tagAttributes.id),
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "id":
          algorithm[key] = value;
          break;
        case "name":
          algorithm[key] = value;
          break;
        case "page":
          algorithm[key] = parseInt(value, 10);
          break;
      }
    });

    return algorithm as AlgorithmBodyItem;
  }

  private handleTextTableTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    context: ContextType,
  ): TableBodyItem {
    const table: Omit<TableBodyItem, "id" | "page"> &
      Partial<Pick<TableBodyItem, "id" | "page">> = {
      type: "table",
      body: this.handleHtmlInnards(
        htmlContent,
        tagAttributes?.id
          ? {
              parentType: "table",
              parentId: tagAttributes.id,
            }
          : context,
      ),
      reference: this.buildReference("table", tagAttributes.id),
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "id":
          table[key] = value;
          break;
        case "name":
          table[key] = value;
          break;
        case "page":
          table[key] = parseInt(value, 10);
          break;
      }
    });

    return table as TableBodyItem;
  }

  private handleFigureTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    context: ContextType,
  ): FigureBodyItem {
    const figure: Omit<FigureBodyItem, "id" | "name" | "page"> &
      Partial<Pick<FigureBodyItem, "id" | "name" | "page">> = {
      type: "figure",
      body: this.handleHtmlInnards(
        htmlContent,
        tagAttributes?.id
          ? {
              parentType: "figure",
              parentId: tagAttributes.id,
            }
          : context,
      ),
      reference: this.buildReference("figure", tagAttributes.id),
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "id":
          figure[key] = value;
          break;
        case "name":
          figure[key] = value;
          break;
        case "page":
          figure[key] = parseInt(value, 10);
          break;
      }
    });

    return figure as FigureBodyItem;
  }

  private handleResultTag(
    htmlContent: string,
    tagAttributes: { [key: string]: string },
    context: ContextType,
  ): ResultBodyItem {
    const result: Omit<ResultBodyItem, "id" | "result_type" | "name" | "page"> &
      Partial<Pick<ResultBodyItem, "id" | "result_type" | "name" | "page">> = {
      type: "result",
      body: this.handleHtmlInnards(
        htmlContent,
        tagAttributes?.id
          ? {
              parentType: "result",
              parentId: tagAttributes.id,
            }
          : context,
      ),
      reference: this.buildReference("result", tagAttributes.id),
      content: htmlContent,
    };

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "id":
          result[key] = value;
          break;
        case "type":
          // Convert to result_type
          result.result_type = value;
          break;
        case "name":
          result[key] = value;
          break;
        case "page":
          result[key] = parseInt(value, 10);
          break;
      }
    });

    return result as ResultBodyItem;
  }

  private handlePageBreak(
    _htmlContent: string,
    tagAttributes: { [key: string]: string },
  ) {
    const pageBreak = {
      type: "pagebreak",
    } as PageBreakItem;

    Object.entries(tagAttributes).forEach(([key, value]) => {
      switch (key) {
        case "page":
          pageBreak[key] = parseInt(value, 10);
          break;
      }
    });

    return pageBreak;
  }

  parseTextbookMarkdown(): Array<object> {
    const md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    });
    const tokens = md.parse(this.markdown, {});
    const jsonOutput = [];
    let currentChapter: TextChapter | null = null;
    let currentSection: SectionSectionItem | null = null;
    let currentSubsection: SubsectionSectionItem | null = null;
    // let currentResult: ResultBodyItem | null = null;
    // let currentList: ListBodyItem | null = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === "heading_open") {
        const level = token.tag.substring(1);
        const content = tokens[i + 1].content;

        if (level === "1") {
          const id = content.split(": ", 2)[0];
          currentChapter = {
            id,
            reference: this.buildReference("text", id),
            name: content.split(": ").slice(1).join(": "),
            body: [],
            content: "",
            sections: [],
          };
          jsonOutput.push(currentChapter);
          currentSection = null;
          currentSubsection = null;
        } else if (level === "2") {
          const id = content.split(": ", 2)[0];
          currentSection = {
            type: "section",
            id,
            reference: this.buildReference("text", id),
            name: content.split(": ").slice(1).join(": "),
            body: [],
            content: "",
            sections: [],
          };
          if (!currentChapter) {
            // Basically panic, we don't really care
            throw new Error("No current chapter");
          }
          currentChapter.sections.push(currentSection);
          currentSubsection = null;
        } else if (level === "3") {
          const id = content.split(": ", 2)[0];
          currentSubsection = {
            type: "subsection",
            id,
            reference: this.buildReference("text", id),
            name: content.split(": ").slice(1).join(": "),
            content: "",
            body: [],
          };
          if (!currentSection) {
            throw new Error("No current section");
          }
          currentSection.sections.push(currentSubsection);
        } else if (level >= "4") {
          (currentSubsection || currentSection || currentChapter)?.body.push({
            type: "standalone_heading",
            level: parseInt(level),
            body: content,
            content,
          });
        }
      } else if (token.type === "fence" && token.info === "toml") {
        const metadata = toml.parse(token.content) as Record<
          string,
          unknown
        > | null;
        if (!metadata) {
          throw new Error("No metadata");
        }
        if (metadata?.page === undefined) {
          throw new Error("No page property in metadata");
        }
        const page = metadata.page as number | undefined;
        // Check that metadata has a page property
        if (currentChapter && !currentSection && !currentSubsection) {
          currentChapter.page = page;
        } else if (currentSection && !currentSubsection) {
          currentSection.page = page;
        } else if (currentSubsection) {
          currentSubsection.page = page;
        }
      } else if (token.type === "html_block") {
        const _currentSection =
          currentSubsection ?? currentSection ?? currentChapter;

        if (!_currentSection) {
          continue;
        }

        let htmlContent = token.content;

        // Check for an opening tag
        const openingTagMatch = /<([a-zA-Z0-9_-]+)[^>/]*(\/)?>/i.exec(
          htmlContent,
        );
        if (!openingTagMatch) {
          continue;
        }

        const tagName = openingTagMatch[1];
        const selfClosing = openingTagMatch[2] === "/";

        if (!selfClosing) {
          const closingTag = `</${tagName}>`;
          // Search for the closing tag while iterating through tokens and concatenate content
          let j = i;
          htmlContent = "";
          while (j < tokens.length && !tokens[j].content.includes(closingTag)) {
            if (htmlContent.length > 0 && !htmlContent.endsWith("\n\n")) {
              htmlContent += "\n";
            }
            // Extremely hacky but I have no time
            if (tokens[j].type === "fence") {
              htmlContent += tokens[j].markup + tokens[j].info + "\n";
            }
            htmlContent += tokens[j].content;
            if (tokens[j].type === "fence") {
              htmlContent += tokens[j].markup;
            }
            j++;
          }

          // Include the closing tag and update the main loop counter
          if (j < tokens.length && tokens[j].content.includes(closingTag)) {
            if (i !== j && !htmlContent.endsWith("\n\n")) {
              htmlContent += "\n";
            }
            htmlContent += tokens[j].content;
            i = j;
          }
        }
        // const oldHtmlContent = htmlContent;
        const { attrs: tagAttributes, body } = handleHTMLContent(
          htmlContent,
          selfClosing,
        );

        // body = body.replaceAll("<", "YAY").replaceAll(">", "YAY");

        htmlContent = body;

        const context = {
          parentType: "text",
          parentId: _currentSection.id,
        };

        let newBodyItems: Array<BodyItem> | null = null;
        if (tagName === "result") {
          const bodyItem = this.handleResultTag(
            htmlContent,
            tagAttributes,
            context,
          );
          newBodyItems = [bodyItem];
          // currentResult = bodyItem;
        } else if (tagName === "proof") {
          newBodyItems = [
            this.handleProofTag(htmlContent, tagAttributes, context),
          ];
        } else if (tagName === "exercise") {
          newBodyItems = [
            this.handleExerciseTag(htmlContent, tagAttributes, context),
          ];
        } else if (tagName === "figure") {
          newBodyItems = [
            this.handleFigureTag(htmlContent, tagAttributes, context),
          ];
        } else if (tagName === "equation") {
          newBodyItems = [
            this.handleEquationTag(htmlContent, tagAttributes, context),
          ];
        } else if (tagName === "algorithm") {
          newBodyItems = [
            this.handleAlgorithmTag(htmlContent, tagAttributes, context),
          ];
        } else if (tagName === "texttable") {
          newBodyItems = [
            this.handleTextTableTag(htmlContent, tagAttributes, context),
          ];
        } else if (tagName === "ol") {
          const bodyItem = this.handleOlTag(
            htmlContent,
            tagAttributes,
            context,
          );
          newBodyItems = [bodyItem];
          // currentList = bodyItem;
        } else if (tagName === "pagebreak") {
          newBodyItems = [this.handlePageBreak(htmlContent, tagAttributes)];
        } else if (tagName === "context-optional") {
          newBodyItems = this.handleHtmlInnards(htmlContent, context);
          newBodyItems.forEach((bodyItem) => {
            if (bodyItem.type === "text") {
              bodyItem.context_optional = true;
            }
          });
        }

        if (newBodyItems) {
          const targetSectionItem =
            currentSubsection || currentSection || currentChapter;
          if (targetSectionItem) {
            targetSectionItem.body.push(...newBodyItems);
            targetSectionItem.content += htmlContent;
          }
        }
      } else if (token.type === "inline" && token.content.startsWith("```")) {
        const codeBlock = token.content.replace(/`/g, "");
        const page = parseInt(codeBlock.split("page = ")[1]);

        const _currentSection =
          currentSubsection ?? currentSection ?? currentChapter;
        if (_currentSection) {
          _currentSection.page = page;
        }
      } else if (token.type === "paragraph_open") {
        const _currentSection =
          currentSubsection ?? currentSection ?? currentChapter;

        if (!_currentSection) {
          continue;
        }

        const context = {
          parentType: "text",
          parentId: _currentSection.id,
        };

        const content = tokens[i + 1].content;
        const bodyItems = this.handleHtmlInnards(content, context);

        _currentSection.body.push(...bodyItems);
        _currentSection.content += content;
      }
    }

    return jsonOutput;
  }
}

export const parseTextbook = async <T extends BaseChapter>(
  namespace: string,
  book: string,
  text: string,
): Promise<Record<string, T>> => {
  const chapters = new TextbookFormatParser(
    namespace,
    book,
    text,
  ).parseTextbookMarkdown() as T[];
  const chapterObject = chapters.reduce(
    (acc, chapter) => {
      acc[chapter.id] = chapter;
      return acc;
    },
    {} as Record<string, T>,
  );
  return chapterObject;
};
