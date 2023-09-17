import katex from "katex"; // Make sure to import KaTeX

onmessage = function (e) {
  const { id, latex } = e.data;

  try {
    const rendered = katex.renderToString(latex, {
      displayMode: true,
    });
    postMessage({ id, rendered });
  } catch (error) {
    postMessage({ id, error: true });
  }
};
