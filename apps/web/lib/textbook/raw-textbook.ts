import path from "path";
import fs from "fs/promises";
import { cache } from "react";
import { RawChapter } from "./types";

// export interface RawChapter {
// 	id: string;
// 	title: string;
// 	intro: string;
// 	sections: Array<RawSection>;
// }

// export interface RawSection {
// 	id: string;
// 	title: string;
// 	content: string;
// }

function parseRawTextbook(markdown: string): RawChapter[] {
  const rawChapters = markdown.split(/^(?=#\s+(?:\d+|[A-Z]):\s+.*)/gm);

  return rawChapters.map((rawChapter) => {
    const chapterRegex = /^#\s+(\d+|[A-Z]):\s+(.*)$/m;
    const chapterMatch = chapterRegex.exec(rawChapter);
    const id = chapterMatch ? chapterMatch[1] : "";
    const title = chapterMatch ? chapterMatch[2] : "";
    // Delete first line
    rawChapter = rawChapter.replace(chapterRegex, "").trim();

    const rawSections = rawChapter
      .split(/^(?=##\s+(?:\d+|[A-Z])\.(?:\d+):\s+.*)/gm)
      .map((rawSection) => rawSection.trim());
    const intro = rawSections.shift() || "";

    const sections = rawSections.map((rawSection) => {
      const sectionRegex = /^##\s+(?:\d+|[A-Z])\.(\d+):\s+(.*)$/m;
      const sectionMatch = sectionRegex.exec(rawSection);
      const sectionId = sectionMatch ? sectionMatch[1] : "";
      const sectionTitle = sectionMatch ? sectionMatch[2] : "";
      const content = rawSection.replace(sectionRegex, "").trim();

      return { id: sectionId, title: sectionTitle, content };
    });

    return { id, title, intro, sections };
  });
}

export const getRawTextbookChapters = cache(
  async (textbookFile: string): Promise<RawChapter[]> => {
    const response = await fs.readFile(
      path.join("./text", textbookFile),
      "utf8",
    );
    const chapters = parseRawTextbook(response);
    return chapters as RawChapter[];
  },
);

export const createPartialTextbookChapter = (
  chapter: RawChapter,
  sectionId: string,
): string => {
  const partialSections = chapter.sections.filter(
    (section) => section.id <= sectionId,
  );
  const sectionsText = partialSections
    .map(
      (section) =>
        `## ${chapter.id}.${section.id}: ${section.title}\n${section.content}`,
    )
    .join("\n");
  return `# ${chapter.id}: ${chapter.title}\n${chapter.intro}\n${sectionsText}`;
};
