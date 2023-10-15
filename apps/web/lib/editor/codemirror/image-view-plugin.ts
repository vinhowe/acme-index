import { syntaxTree } from "@codemirror/language";
import {
  EditorState,
  Extension,
  Range,
  RangeSet,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";

interface ImageWidgetParams {
  url: string;
}

class ImageWidget extends WidgetType {
  readonly url;
  constructor({ url }: ImageWidgetParams) {
    super();
    this.url = url;
  }

  eq(imageWidget: ImageWidget) {
    return imageWidget.url === this.url;
  }

  toDOM() {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.className = "inline-block p-2";

    const img = document.createElement("img");
    img.src = this.url;
    img.className = "block";
    container.appendChild(img);

    return container;
  }
}

export const imageDisplay = (): Extension => {
  const decorate = (state: EditorState) => {
    const widgets: Range<Decoration>[] = [];

    syntaxTree(state).iterate({
      enter: ({ type, from, to: linkTo }) => {
        if (type.name === "Image") {
          // Get link url from syntax tree
          syntaxTree(state).iterate({
            enter: ({ type, from, to }) => {
              if (type.name === "URL") {
                const url = state.sliceDoc(from, to);
                widgets.push(
                  Decoration.widget({
                    widget: new ImageWidget({ url }),
                    side: 1,
                  }).range(linkTo),
                );
              }
            },
          });
        }
      },
    });

    return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
  };

  const imageTheme = EditorView.baseTheme({});

  const imageField = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state);
    },
    update(images, transaction) {
      if (transaction.docChanged) {
        return decorate(transaction.state);
      }

      return images.map(transaction.changes);
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });

  return [imageTheme, imageField];
};
