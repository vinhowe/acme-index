import { syntaxTree } from '@codemirror/language';
import { EditorState, Extension, Range, RangeSet, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import katex from 'katex';  // Make sure to import KaTeX

interface KaTeXWidgetParams {
  latex: string;
}

class KaTeXWidget extends WidgetType {
  readonly latex;

  constructor({ latex }: KaTeXWidgetParams) {
    super();
    this.latex = latex;
  }

  eq(kaTeXWidget: KaTeXWidget) {
    return kaTeXWidget.latex === this.latex;
  }

  toDOM() {
    const container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    container.className = 'cm-katex-container';

    try {
      const rendered = katex.renderToString(this.latex, {
        displayMode: true,
      });
      container.innerHTML = rendered;
    } catch (error) {
      // Ignore these because they will happen all the time
    }

    return container;
  }
}

export const katexDisplay = (): Extension => {
  const decorate = (state: EditorState) => {
    const widgets: Range<Decoration>[] = [];

    syntaxTree(state).iterate({
      enter: ({ type, from, to }) => {
        if (type.name === 'BlockMathDollar') {
          const latexString = state.doc.sliceString(from + 2, to - 2);
          widgets.push(Decoration.widget({
            widget: new KaTeXWidget({ latex: latexString }),
            side: 1,
            block: true,
          }).range(state.doc.lineAt(to).to));
        }
      },
    });

    return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
  }

  const katexTheme = EditorView.baseTheme({
    '.cm-katex-container': {
      // You can style the KaTeX display here if required
    },
  });

  const katexField = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state);
    },
    update(katexs, transaction) {
      if (transaction.docChanged) {
        return decorate(transaction.state);
      }

      return katexs.map(transaction.changes);
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });

  return [
    katexTheme,
    katexField,
  ];
};
