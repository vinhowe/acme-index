import { buildDisplayReference, buildHref } from "@/lib/textbook/textbook-ref";
import { CompileContext, Token } from "mdast-util-from-markdown";
import { parseRef, ExactReferenceMatch } from "textref";

export function fromMarkdown() {
  function enterWikiLink(this: CompileContext, token: Token) {
    this.enter(
      {
        // @ts-expect-error
        type: "wikiLink",
        // @ts-expect-error
        value: null,
        data: {
          alias: null,
          permalink: null,
          exists: null,
        },
      },
      token,
    );
  }

  function top(stack: any[]) {
    return stack[stack.length - 1];
  }

  function exitWikiLinkAlias(this: CompileContext, token: Token) {
    const alias = this.sliceSerialize(token);
    const current = top(this.stack);
    current.data.alias = alias;
  }

  function exitWikiLinkTarget(this: CompileContext, token: Token) {
    const target = this.sliceSerialize(token);
    const current = top(this.stack);
    current.value = target;
  }

  function exitWikiLink(this: CompileContext, token: Token) {
    const wikiLink = this.exit(token) as any;

    const reference = parseRef(wikiLink.value)!;
    const displayValue =
      (reference && buildDisplayReference(reference)) || "Unknown reference";

    wikiLink.data.hName = "a";
    wikiLink.data.hProperties = {
      className: "acme-link",
      href: reference ? buildHref(reference) : "#",
    };
    wikiLink.data.hChildren = [
      {
        type: "text",
        value: displayValue,
      },
    ];
  }

  return {
    enter: {
      wikiLink: enterWikiLink,
    },
    exit: {
      wikiLinkTarget: exitWikiLinkTarget,
      wikiLinkAlias: exitWikiLinkAlias,
      wikiLink: exitWikiLink,
    },
  };
}
