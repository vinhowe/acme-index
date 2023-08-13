import MarkdownIt from "markdown-it";
import toml from "toml";
import {
  TextBodyItem,
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
    /<(text|result|proof|exercise|figure|equation)ref([^>]*)>(.*?)<\/\1ref>/g;

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
  selfClosing: boolean
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

function handleOlTag(
  htmlContent: string,
  tagAttributes: { [key: string]: string }
): ListBodyItem {
  const list = {
    type: "list",
    list_type: "roman",
    body: [],
  } as ListBodyItem;

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
        false
      );
      const innards = handleHtmlInnards(body);
      list.body.push({
        type: "list_item",
        number: parseInt(liAttrs?.value),
        roman: liAttrs?.roman,
        letter: liAttrs?.letter,
        body: innards,
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

function handleProofTag(
  htmlContent: string,
  tagAttributes: { [key: string]: string }
): ProofBodyItem {
  const proof = {
    type: "proof",
    body: handleHtmlInnards(htmlContent),
  } as ProofBodyItem;

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

  return proof;
}

function handleExerciseTag(
  htmlContent: string,
  tagAttributes: { [key: string]: string }
): ExerciseBodyItem {
  const exercise = {
    type: "exercise",
    body: handleHtmlInnards(htmlContent),
  } as ExerciseBodyItem;

  Object.entries(tagAttributes).forEach(([key, value]) => {
    switch (key) {
      case "id":
        exercise[key] = value;
        break;
      case "page":
        exercise[key] = parseInt(value, 10);
        break;
    }
  });

  return exercise;
}

function handleEquation(
  htmlContent: string,
  tagAttributes: { [key: string]: string }
): EquationBodyItem {
  const equation = {
    type: "equation",
    body: handleHtmlInnards(htmlContent),
  } as EquationBodyItem;

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

  return equation;
}

function handleFigureTag(
  htmlContent: string,
  tagAttributes: { [key: string]: string }
): FigureBodyItem {
  const figure = {
    type: "figure",
    body: handleHtmlInnards(htmlContent),
  } as FigureBodyItem;

  Object.entries(tagAttributes).forEach(([key, value]) => {
    switch (key) {
      case "id":
        figure[key] = value;
        break;
      case "page":
        figure[key] = parseInt(value, 10);
        break;
    }
  });

  return figure;
}

function handleResultTag(
  htmlContent: string,
  tagAttributes: { [key: string]: string }
): ResultBodyItem {
  const result = {
    type: "result",
    body: handleHtmlInnards(htmlContent),
  } as ResultBodyItem;

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

  return result;
}

function handlePageBreak(
  _htmlContent: string,
  tagAttributes: { [key: string]: string }
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

type HandlerFunction = (
  body: string,
  attrs: { [key: string]: string }
) => BodyItem;

const handlers: { [tagName: string]: HandlerFunction } = {
  ol: handleOlTag,
  proof: handleProofTag,
  pagebreak: handlePageBreak,
  equation: handleEquation,
};

function handleHtmlInnards(htmlContent: string): Array<BodyItem> {
  const bodyTypes: Array<BodyItem> = [];
  const chunks = htmlContent
    .split(/\n\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (let i = 0; i < chunks.length; i++) {
    let currentChunk = chunks[i];
    const openingTagMatch = /^<([a-zA-Z0-9_-]+)[^>/]*(\/)?>/i.exec(
      currentChunk
    );

    // Handle opening tag
    if (openingTagMatch) {
      const openingTag = openingTagMatch[1];
      const isSelfClosing = openingTagMatch[2] === "/";

      if (!isSelfClosing) {
        const closingTag = `</${openingTag}>`;

        if (!currentChunk.includes(closingTag)) {
          while (i < chunks.length - 1 && !chunks[i + 1].includes(closingTag)) {
            currentChunk += "\n\n" + chunks[++i];
          }
          currentChunk += "\n\n" + chunks[++i];
        }
      }

      const { attrs: tagAttributes, body: tagBody } = handleHTMLContent(
        currentChunk,
        isSelfClosing
      );

      if (openingTag in handlers) {
        bodyTypes.push(handlers[openingTag](tagBody, tagAttributes));
      }
    } else {
      bodyTypes.push({
        type: "text",
        body: extractPageBreaks(currentChunk).reduce(
          (
            accumulator: Array<InlineItem>,
            currentItem: InlineText | PageBreakItem
          ) => {
            if (currentItem.type === "pagebreak") {
              return accumulator.concat(currentItem);
            } else {
              return accumulator.concat(...extractRefs(currentItem.body));
            }
          },
          [] as Array<InlineItem>
        ),
      });
    }
  }

  return bodyTypes;
}

function parseTextbookMarkdown(markdown: string): Array<object> {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });
  const tokens = md.parse(markdown, {});
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
        currentChapter = {
          id: content.split(": ")[0],
          name: content.split(": ")[1],
          body: [],
          sections: [],
        };
        jsonOutput.push(currentChapter);
        currentSection = null;
        currentSubsection = null;
      } else if (level === "2") {
        currentSection = {
          type: "section",
          id: content.split(": ")[0],
          name: content.split(": ")[1],
          body: [],
          sections: [],
        };
        if (!currentChapter) {
          // Basically panic, we don't really care
          throw new Error("No current chapter");
        }
        currentChapter.sections.push(currentSection);
        currentSubsection = null;
      } else if (level === "3") {
        currentSubsection = {
          type: "subsection",
          id: content.split(": ")[0],
          name: content.split(": ")[1],
          body: [],
        };
        if (!currentSection) {
          throw new Error("No current section");
        }
        currentSection.sections.push(currentSubsection);
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
      let htmlContent = token.content;

      // Check for an opening tag
      const openingTagMatch = /<([a-zA-Z0-9_-]+)[^>/]*(\/)?>/i.exec(
        htmlContent
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
          if (htmlContent.length > 0) {
            htmlContent += "\n\n";
          }
          htmlContent += tokens[j].content;
          j++;
        }

        // Include the closing tag and update the main loop counter
        if (j < tokens.length && tokens[j].content.includes(closingTag)) {
          if (i !== j) {
            htmlContent += "\n\n";
          }
          htmlContent += tokens[j].content;
          i = j;
        }
      }
      // const oldHtmlContent = htmlContent;
      const { attrs: tagAttributes, body } = handleHTMLContent(
        htmlContent,
        selfClosing
      );

      // body = body.replaceAll("<", "YAY").replaceAll(">", "YAY");

      htmlContent = body;

      let newBodyItems: Array<BodyItem> | null = null;
      if (tagName === "result") {
        const bodyItem = handleResultTag(htmlContent, tagAttributes);
        newBodyItems = [bodyItem];
        // currentResult = bodyItem;
      } else if (tagName === "proof") {
        newBodyItems = [handleProofTag(htmlContent, tagAttributes)];
      } else if (tagName === "exercise") {
        newBodyItems = [handleExerciseTag(htmlContent, tagAttributes)];
      } else if (tagName === "figure") {
        newBodyItems = [handleFigureTag(htmlContent, tagAttributes)];
      } else if (tagName === "ol") {
        const bodyItem = handleOlTag(htmlContent, tagAttributes);
        newBodyItems = [bodyItem];
        // currentList = bodyItem;
      } else if (tagName === "pagebreak") {
        newBodyItems = [handlePageBreak(htmlContent, tagAttributes)];
      } else if (tagName === "context-optional") {
        newBodyItems = handleHtmlInnards(htmlContent);
        newBodyItems.forEach((bodyItem) => {
          if (bodyItem.type === "text") {
            bodyItem.context_optional = true;
          }
        });
      }

      if (newBodyItems) {
        (currentSubsection || currentSection || currentChapter)?.body.push(
          ...newBodyItems
        );
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
      const content = tokens[i + 1].content;
      const bodyItems = handleHtmlInnards(content);
      // const bodyContent: TextBodyItem = {
      //   type: "text",
      //   body: extractPageBreaks(content).map((content) => {
      //     if (content.type === "pagebreak") {
      //       return content;
      //     } else {
      //       return {
      //         type: "inline",
      //         body: linkifyRefs(content.body),
      //       };
      //     }
      //   }),
      // };

      (currentSubsection || currentSection || currentChapter)?.body.push(
        ...bodyItems
      );
    }
  }

  return jsonOutput;
}

export const parseTextbook = async <T extends BaseChapter>(
  text: string
): Promise<Record<string, T>> => {
  const chapters = parseTextbookMarkdown(text) as T[];
  const chapterObject = chapters.reduce((acc, chapter) => {
    acc[chapter.id] = chapter;
    return acc;
  }, {} as Record<string, T>);
  return chapterObject;
};
