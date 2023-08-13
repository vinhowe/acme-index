import { CompileContext, Token, Handle as _Handle } from "micromark-util-types";

function html(this: CompileContext) {
  function enterWikiLink(this: CompileContext) {
    // @ts-expect-error
    let stack: {}[] = this.getData("wikiLinkStack");
    // @ts-expect-error
    if (!stack) this.setData("wikiLinkStack", (stack = []));

    stack.push({});
  }

  function top(this: CompileContext, stack: any[]) {
    return stack[stack.length - 1];
  }

  function exitWikiLinkAlias(this: CompileContext, token: Token) {
    const alias = this.sliceSerialize(token);
    // @ts-expect-error
    const current = top(this.getData("wikiLinkStack") as any[]);
    current.alias = alias;
  }

  function exitWikiLinkTarget(this: CompileContext, token: Token) {
    const target = this.sliceSerialize(token);
    // @ts-expect-error
    const current = top(this.getData("wikiLinkStack"));
    current.target = target;
  }

  function exitWikiLink(this: CompileContext) {
    // @ts-expect-error
    const wikiLink = this.getData("wikiLinkStack").pop();

    this.tag('<a href="' + wikiLink.target + '">');
    this.raw(wikiLink.target);
    this.tag("</a>");
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

export { html };
