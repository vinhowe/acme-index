import { Processor } from "unified";
import { wikiLink } from "./syntax";
import { fromMarkdown } from "./mdast/from-markdown";

export default function wikiLinkPlugin(this: Processor, options = {}) {
  const data = this.data();

  function add(field: string, value: unknown) {
    // @ts-expect-error
    if (data[field]) data[field].push(value);
    else data[field] = [value];
  }

  add("micromarkExtensions", wikiLink());
  add("fromMarkdownExtensions", fromMarkdown());
}