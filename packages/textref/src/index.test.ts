import { parseRef } from "./index";

test("Exact parsing", () => {
  expect(parseRef("acme:v1/text/1.1.3")).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItem: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEnd: undefined,
    listItemRangeStart: undefined,
    listItemRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/1")).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: undefined,
    subsection: undefined,
    listItem: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEnd: undefined,
    listItemRangeStart: undefined,
    listItemRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/1.2")).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "2",
    subsection: undefined,
    listItem: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEnd: undefined,
    listItemRangeStart: undefined,
    listItemRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/A.2")).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "A",
    section: "2",
    subsection: undefined,
    listItem: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEnd: undefined,
    listItemRangeStart: undefined,
    listItemRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/1.1.3(ii)..2.1.1(iii)")).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItem: "ii",
    chapterEnd: "2",
    sectionEnd: "1",
    subsectionEnd: "1",
    listItemEnd: "iii",
    listItemRangeStart: undefined,
    listItemRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/1.1.3(ii)")).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItem: "ii",
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEnd: undefined,
    listItemRangeStart: undefined,
    listItemRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/1.1.3(ii..xv)")).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItem: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEnd: undefined,
    listItemRangeStart: "ii",
    listItemRangeEnd: "xv",
  });
});

test("Partial parsing", () => {
  expect(parseRef("acme:v1/text/1.1.3", { partial: true })).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItemStartRangeStart: undefined,
    listItemStartRangeEnd: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEndRangeStart: undefined,
    listItemEndRangeEnd: undefined,
  });
  expect(parseRef("acme:v1/text/1", { partial: true })).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: undefined,
    subsection: undefined,
    listItemStartRangeStart: undefined,
    listItemStartRangeEnd: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEndRangeStart: undefined,
    listItemEndRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/1.2", { partial: true })).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "2",
    subsection: undefined,
    listItemStartRangeStart: undefined,
    listItemStartRangeEnd: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEndRangeStart: undefined,
    listItemEndRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/A.2", { partial: true })).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "A",
    section: "2",
    subsection: undefined,
    listItemStartRangeStart: undefined,
    listItemStartRangeEnd: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEndRangeStart: undefined,
    listItemEndRangeEnd: undefined,
  });

  expect(
    parseRef("acme:v1/text/1.1.3(ii)..2.1.1(iii)", { partial: true }),
  ).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItemStartRangeStart: "ii",
    listItemStartRangeEnd: undefined,
    chapterEnd: "2",
    sectionEnd: "1",
    subsectionEnd: "1",
    listItemEndRangeStart: "iii",
    listItemEndRangeEnd: undefined,
  });

  expect(parseRef("acme:v1/text/1.1.3(ii)", { partial: true })).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItemStartRangeStart: "ii",
    listItemStartRangeEnd: undefined,
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEndRangeStart: undefined,
    listItemEndRangeEnd: undefined,
  });

  expect(
    parseRef("acme:v1/text/1.1.3(ii..xv)", { partial: true }),
  ).toMatchObject({
    namespace: "acme",
    book: "v1",
    type: "text",
    chapter: "1",
    section: "1",
    subsection: "3",
    listItemStartRangeStart: "ii",
    listItemStartRangeEnd: "xv",
    chapterEnd: undefined,
    sectionEnd: undefined,
    subsectionEnd: undefined,
    listItemEndRangeStart: undefined,
    listItemEndRangeEnd: undefined,
  });
});
