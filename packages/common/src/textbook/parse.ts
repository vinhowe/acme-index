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
  BaseBodyItem,
  BaseBodyItemWithReference,
} from "./types";

type Attributes = { [key: string]: string };

interface LightHTMLElement {
  body: string;
  attrs: Attributes;
}

function extractRefs(input: string): Array<InlineText | InlineReference> {
  function parseAttributes(tag: string) {
    const attributeRegex =
      /(\w+)=(?:"((?:[^"\\]|\\.)*)"|(?:'((?:[^'\\]|\\.)*))')/g;
    const attributes: Attributes = {};
    let match;

    while ((match = attributeRegex.exec(tag)) !== null) {
      attributes[match[1]] = match[2] || match[3];
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
      attrs[match[1]] = match[2] || match[3];
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
  attrs: Attributes,
  context: ContextType,
) => BodyItem;

class TextbookFormatParser {
  private handlers: { [tagName: string]: HandlerFunction };

  constructor(
    private namespace: string,
    private book: string,
    private markdown: string,
  ) {
    this.buildTagHandler = this.buildTagHandler.bind(this);
    this.buildOlTagHandler = this.buildOlTagHandler.bind(this);
    // this.handleProofTag = this.handleProofTag.bind(this);
    this.handlePageBreak = this.handlePageBreak.bind(this);
    // this.handleEquationTag = this.handleEquationTag.bind(this);
    // this.handleAlgorithmTag = this.handleAlgorithmTag.bind(this);
    // this.handleTextTableTag = this.handleTextTableTag.bind(this);
    this.handleHtmlInnards = this.handleHtmlInnards.bind(this);

    this.handlers = {
      ol: this.buildOlTagHandler(),
      proof: this.buildTagHandler<ProofBodyItem, "of" | "page">(
        "proof",
        (key, value) => {
          switch (key) {
            case "of":
              return ["of", value];
            case "page":
              return ["page", parseInt(value, 10)];
          }
        },
        {
          referenceIdHandler: ({ of }) => of,
        },
      ),
      result: this.buildTagHandler<
        ResultBodyItem,
        "id" | "result_type" | "name" | "page"
      >(
        "result",
        (key, value) => {
          switch (key) {
            case "id":
              return ["id", value];
            case "type":
              return ["result_type", value];
            case "name":
              return ["name", value];
            case "page":
              return ["page", parseInt(value, 10)];
          }
        },
        {
          referenceIdHandler: ({ id }) => id,
        },
      ),
      equation: this.buildTagHandler<EquationBodyItem, "id" | "page">(
        "equation",
        (key, value) => {
          switch (key) {
            case "id":
              return ["id", value];
            case "page":
              return ["page", parseInt(value, 10)];
          }
        },
        {
          referenceIdHandler: ({ id }) => id,
        },
      ),
      algorithm: this.buildTagHandler<
        AlgorithmBodyItem,
        "id" | "name" | "page"
      >(
        "algorithm",
        (key, value) => {
          switch (key) {
            case "id":
              return ["id", value];
            case "name":
              return ["name", value];
            case "page":
              return ["page", parseInt(value, 10)];
          }
        },
        {
          referenceIdHandler: ({ id }) => id,
        },
      ),
      texttable: this.buildTagHandler<TableBodyItem, "id" | "name" | "page">(
        "table",
        (key, value) => {
          switch (key) {
            case "id":
              return ["id", value];
            case "name":
              return ["name", value];
            case "page":
              return ["page", parseInt(value, 10)];
          }
        },
        {
          referenceIdHandler: ({ id }) => id,
        },
      ),
      exercise: this.buildTagHandler<ExerciseBodyItem, "id" | "name" | "page">(
        "exercise",
        (key, value) => {
          switch (key) {
            case "id":
              return ["id", value];
            case "name":
              return ["name", value];
            case "page":
              return ["page", parseInt(value, 10)];
          }
        },
        {
          referenceIdHandler: ({ id }) => id,
        },
      ),
      figure: this.buildTagHandler<FigureBodyItem, "id" | "name" | "page">(
        "figure",
        (key, value) => {
          switch (key) {
            case "id":
              return ["id", value];
            case "name":
              return ["name", value];
            case "page":
              return ["page", parseInt(value, 10)];
          }
        },
        {
          referenceIdHandler: ({ id }) => id,
        },
      ),
      pagebreak: this.handlePageBreak,
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

  private buildOlTagHandler(): HandlerFunction {
    const olContentHandler = (
      htmlContent: string,
      _attributes: Attributes,
      { parentId, parentType }: ContextType,
    ): Pick<ListBodyItem, "body"> => {
      const listPartial: Pick<ListBodyItem, "body"> = {
        body: [],
      };
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
          const innards = this.handleHtmlInnards(body, {
            parentId,
            parentType,
          });
          listPartial.body.push({
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
          listPartial.body.push(pagebreak);
        }
      }
      return listPartial;
    };

    return this.buildTagHandler<ListBodyItem, "type" | "page">(
      "list",
      (key, value) => {
        switch (key) {
          case "type":
            if (value === "roman" || value === "letter") {
              return ["list_type", value];
            }
            return;
          case "page":
            return ["page", parseInt(value, 10)];
        }
      },
      {
        contentHandler: olContentHandler,
      },
    );
  }

  private buildTagHandler<
    T extends BaseBodyItem<unknown>,
    AttributeKeys extends keyof T,
  >(
    type: string,
    attributeHandler: (
      key: string,
      value: string,
    ) => [string, unknown] | undefined,
    {
      referenceIdHandler,
      contentHandler,
    }: {
      referenceIdHandler?: (attributes: Attributes) => string;
      contentHandler?: (
        content: string,
        attributes: Attributes,
        context: ContextType,
      ) => Partial<T>;
    } = {},
  ): HandlerFunction {
    return (
      content: string,
      attributes: Attributes,
      context: ContextType,
    ): BodyItem => {
      const referenceId = referenceIdHandler
        ? referenceIdHandler(attributes)
        : null;
      const item = {
        type,
        body: this.handleHtmlInnards(
          content,
          referenceId
            ? {
                parentType: type,
                parentId: referenceId,
              }
            : context,
        ),
        content,
        reference: referenceId
          ? this.buildReference(type, referenceId)
          : undefined,
        ...(Object.entries(attributes).reduce(
          (accumulator, [key, value]) => {
            const attributePair = attributeHandler(key, value);
            if (!attributePair) {
              return accumulator;
            }
            const [transformedKey, transformedValue] = attributePair;
            accumulator[transformedKey as AttributeKeys] =
              transformedValue as T[AttributeKeys];
            return accumulator;
          },
          {} as Pick<T, AttributeKeys>,
        ) as Pick<T, AttributeKeys>),
        ...(contentHandler ? contentHandler(content, attributes, context) : {}),
      } as Pick<T, "type" | "body" | "content"> &
        Partial<Pick<T, AttributeKeys>> &
        T extends BaseBodyItemWithReference<unknown>
        ? { reference: string }
        : {};
      // This isn't great
      return item as unknown as BodyItem;
    };
  }

  private handlePageBreak(_htmlContent: string, tagAttributes: Attributes) {
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

        htmlContent = body;

        const context = {
          parentType: "text",
          parentId: _currentSection.id,
        };

        let newBodyItems: Array<BodyItem> | null = null;
        if (tagName in this.handlers) {
          newBodyItems = [
            this.handlers[tagName](htmlContent, tagAttributes, context),
          ];
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
