import katex from "katex"; // Make sure to import KaTeX

onmessage = function (e) {
  const { id, latex, displayMode = true } = e.data;

  try {
    const rendered = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
    });
    postMessage({ id, rendered });
  } catch (error) {
    postMessage({ id, error: true });
  }
};
