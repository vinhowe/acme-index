import { Drawing, Rect } from "@acme-index/common";

export function offsetDrawing(
  drawing: Drawing,
  offset: [width: number, height: number],
): Drawing {
  const newStrokes = drawing.strokes.map((stroke) => {
    const newStroke = { ...stroke };
    newStroke.path.controlPoints = stroke.path.controlPoints.map((cp) => {
      const newCP = { ...cp };
      newCP.location = [cp.location[0] + offset[0], cp.location[1] + offset[1]];
      return newCP;
    });
    // Update render bounds
    const [oldOrigin, oldSize] = stroke.renderBounds;
    const newOrigin = [oldOrigin[0] + offset[0], oldOrigin[1] + offset[1]] as [
      number,
      number,
    ];
    newStroke.renderBounds = [newOrigin, oldSize];
    // Update mask if it exists
    if (stroke.mask) {
      const newMask = { ...stroke.mask };
      newMask.elements = stroke.mask.elements.map((element) => {
        const newElement = { ...element };
        if (element.point) {
          newElement.point = [
            element.point[0] + offset[0],
            element.point[1] + offset[1],
          ];
        }
        if (element.controlPoint1) {
          newElement.controlPoint1 = [
            element.controlPoint1[0] + offset[0],
            element.controlPoint1[1] + offset[1],
          ];
        }
        if (element.controlPoint2) {
          newElement.controlPoint2 = [
            element.controlPoint2[0] + offset[0],
            element.controlPoint2[1] + offset[1],
          ];
        }
        return newElement;
      });
      newStroke.mask = newMask;
    }
    return newStroke;
  });
  // New bounds
  const [oldOrigin, oldSize] = drawing.bounds;
  const newOrigin = [oldOrigin[0] + offset[0], oldOrigin[1] + offset[1]];
  const newBounds = [newOrigin, oldSize] as Rect;
  return { ...drawing, strokes: newStrokes, bounds: newBounds };
}

export function convertToSVG(json: Drawing, viewBox: Rect): string {
  const [minX, minY] = viewBox[0];
  const [width, height] = viewBox[1];
  const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;" viewBox="${minX} ${minY} ${width} ${height}">`;
  const svgEnd = "</svg>";
  let svgContent = "";

  for (const stroke of json.strokes) {
    const controlPoints = stroke.path.controlPoints.map((cp) => cp.location);

    let pathData = `M${controlPoints[0][0]},${controlPoints[0][1]} `;

    let strokeWidth =
      stroke.path.controlPoints[0].size[0] / window.devicePixelRatio;

    for (let i = 1; i < controlPoints.length - 2; i += 3) {
      const cp1 = controlPoints[i];
      const cp2 = controlPoints[i + 1];
      const end = controlPoints[i + 2];
      pathData += `C${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${end[0]},${end[1]} `;
    }

    const color = stroke.ink.color;
    const strokeColor = `color(display-p3 ${color.red} ${color.green} ${
      color.blue
    } / ${color.alpha * 100}%)`;

    // svgContent += `<path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" />`;
    svgContent += `<path d="${pathData}" fill="none" class="invisible" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" />`;
  }

  return svgStart + svgContent + svgEnd;
}

const D50 = [0.3457 / 0.3585, 1.0, (1.0 - 0.3457 - 0.3585) / 0.3585];
const D65 = [0.3127 / 0.329, 1.0, (1.0 - 0.3127 - 0.329) / 0.329];

type Matrix = number[][];
type Vector = number[];

function multiplyMatrices(
  A: Matrix | Vector,
  B: Matrix | Vector,
): Matrix | Vector {
  let m = A.length;

  if (!Array.isArray((A as Matrix)[0])) {
    // A is vector, convert to [[a, b, c, ...]]
    A = [A as Vector];
  }

  if (!Array.isArray((B as Matrix)[0])) {
    // B is vector, convert to [[a], [b], [c], ...]]
    B = (B as Vector).map((x) => [x]);
  }

  let p = (B as Matrix)[0].length;
  let B_cols = (B as Matrix)[0].map((_, i) => (B as Matrix).map((x) => x[i])); // transpose B
  let product: Matrix | Vector = (A as Matrix).map((row) =>
    B_cols.map((col) => {
      if (!Array.isArray(row)) {
        return col.reduce((a, c) => a + c * (row as number), 0);
      }
      return row.reduce((a, c, i) => a + c * (col[i] || 0), 0);
    }),
  );

  if (m === 1) {
    product = product[0]; // Avoid [[a, b, c, ...]]
  }

  if (p === 1) {
    return (product as Matrix).map((x) => x[0]); // Avoid [[a], [b], [c], ...]]
  }

  return product;
}

// Define a type for color represented as an array of three numbers
type Color3 = [number, number, number];

export function lin_sRGB(RGB: Color3) {
  // convert an array of sRGB values
  // where in-gamut values are in the range [0 - 1]
  // to linear light (un-companded) form.
  // https://en.wikipedia.org/wiki/SRGB
  // Extended transfer function:
  // for negative values,  linear portion is extended on reflection of axis,
  // then reflected power function is used.
  return RGB.map(function (val) {
    let sign = val < 0 ? -1 : 1;
    let abs = Math.abs(val);

    if (abs < 0.04045) {
      return val / 12.92;
    }

    return sign * Math.pow((abs + 0.055) / 1.055, 2.4);
  }) as Color3;
}

export function gam_sRGB(RGB: Color3) {
  // convert an array of linear-light sRGB values in the range 0.0-1.0
  // to gamma corrected form
  // https://en.wikipedia.org/wiki/SRGB
  // Extended transfer function:
  // For negative values, linear portion extends on reflection
  // of axis, then uses reflected pow below that
  return RGB.map(function (val) {
    let sign = val < 0 ? -1 : 1;
    let abs = Math.abs(val);

    if (abs > 0.0031308) {
      return sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
    }

    return 12.92 * val;
  }) as Color3;
}

export function lin_P3(RGB: Color3) {
  // convert an array of display-p3 RGB values in the range 0.0 - 1.0
  // to linear light (un-companded) form.

  return lin_sRGB(RGB); // same as sRGB
}

export function gam_P3(RGB: Color3) {
  // convert an array of linear-light display-p3 RGB  in the range 0.0-1.0
  // to gamma corrected form

  return gam_sRGB(RGB); // same as sRGB
}

export function lin_P3_to_XYZ(rgb: Color3) {
  // convert an array of linear-light display-p3 values to CIE XYZ
  // using  D65 (no chromatic adaptation)
  // http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
  var M = [
    [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
    [35783 / 156275, 247089 / 357200, 198249 / 2500400],
    [0 / 1, 32229 / 714400, 5220557 / 5000800],
  ];

  return multiplyMatrices(M, rgb) as Color3;
}

export function XYZ_to_Lab(XYZ: Color3) {
  // Assuming XYZ is relative to D50, convert to CIE Lab
  // from CIE standard, which now defines these as a rational fraction
  var ε = 216 / 24389; // 6^3/29^3
  var κ = 24389 / 27; // 29^3/3^3

  // compute xyz, which is XYZ scaled relative to reference white
  var xyz = XYZ.map((value, i) => value / D50[i]);

  // now compute f
  var f = xyz.map((value) =>
    value > ε ? Math.cbrt(value) : (κ * value + 16) / 116,
  );

  return [
    116 * f[1] - 16, // L
    500 * (f[0] - f[1]), // a
    200 * (f[1] - f[2]), // b
  ];
  // L in range [0,100]. For use in CSS, add a percent
}

export function Lab_to_XYZ(Lab: Color3) {
  // Convert Lab to D50-adapted XYZ
  // http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
  var κ = 24389 / 27; // 29^3/3^3
  var ε = 216 / 24389; // 6^3/29^3
  var f = [];

  // compute f, starting with the luminance-related term
  f[1] = (Lab[0] + 16) / 116;
  f[0] = Lab[1] / 500 + f[1];
  f[2] = f[1] - Lab[2] / 200;

  // compute xyz
  var xyz = [
    Math.pow(f[0], 3) > ε ? Math.pow(f[0], 3) : (116 * f[0] - 16) / κ,
    Lab[0] > κ * ε ? Math.pow((Lab[0] + 16) / 116, 3) : Lab[0] / κ,
    Math.pow(f[2], 3) > ε ? Math.pow(f[2], 3) : (116 * f[2] - 16) / κ,
  ];

  // Compute XYZ by scaling xyz by reference white
  return xyz.map((value, i) => value * D50[i]) as Color3;
}

export function XYZ_to_lin_P3(XYZ: Color3) {
  // convert XYZ to linear-light P3
  var M = [
    [446124 / 178915, -333277 / 357830, -72051 / 178915],
    [-14852 / 17905, 63121 / 35810, 423 / 17905],
    [11844 / 330415, -50337 / 660830, 316169 / 330415],
  ];

  return multiplyMatrices(M, XYZ) as Color3;
}
