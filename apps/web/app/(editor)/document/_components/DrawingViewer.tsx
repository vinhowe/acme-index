import {
  XYZ_to_Lab,
  lin_P3_to_XYZ,
  lin_P3,
  XYZ_to_lin_P3,
  Lab_to_XYZ,
  gam_P3,
  transformPoint,
} from "@/lib/editor/drawing-utils";
import { Drawing, Point, Rect } from "@acme-index/common";
import classNames from "classnames";
import { memo, useCallback, useState } from "react";

function SVGDrawing({ drawing, viewBox }: { drawing: Drawing; viewBox: Rect }) {
  const [minX, minY] = viewBox[0];
  const [width, height] = viewBox[1];

  const uniqueColors = new Set<string>();

  const generateClassName = (r: number, g: number, b: number, a: number) => {
    const safeString = `${r}_${g}_${b}_${a}`;
    return `color_${safeString.replace(/\./g, "p")}`; // replace '.' with 'p'
  };

  // Collect unique colors
  drawing.strokes.forEach((stroke) => {
    const { red, green, blue, alpha } = stroke.ink.color;
    const colorStr = `${red}_${green}_${blue}_${Math.round(alpha * 100)}`;
    uniqueColors.add(colorStr);
  });

  // Generate the CSS
  let css = "";
  let cssDark = "";

  uniqueColors.forEach((colorStr) => {
    const [red, green, blue, alpha] = colorStr.split("_").map(Number);
    const normalizedAlpha = Number(alpha) / 100;

    const className = generateClassName(red, green, blue, normalizedAlpha);
    css += `.${className} { stroke: color(display-p3 ${red} ${green} ${blue} / ${
      normalizedAlpha * 100
    }%); }\n`;

    let invertedRed, invertedGreen, invertedBlue;
    if (red === green && green === blue) {
      invertedRed = 1 - red;
      invertedGreen = 1 - green;
      invertedBlue = 1 - blue;
    } else {
      const [l, a, b] = XYZ_to_Lab(lin_P3_to_XYZ(lin_P3([red, green, blue])));
      const invertedLabColors = [100 - l, a, b] as [number, number, number];
      [invertedRed, invertedGreen, invertedBlue] = gam_P3(
        XYZ_to_lin_P3(Lab_to_XYZ(invertedLabColors)),
      );
    }
    cssDark += `.${className} { stroke: color(display-p3 ${invertedRed} ${invertedGreen} ${invertedBlue} / ${
      normalizedAlpha * 100
    }%); }\n`;
  });

  const fullCss = `
    ${css}
    @media (prefers-color-scheme: dark) {
      ${cssDark}
    }
  `;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: `${height}px` }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="break-before-avoid absolute top-0"
    >
      <style>{fullCss}</style>
      {drawing.strokes.map((stroke, index) => {
        const controlPoints = stroke.path.controlPoints.map(
          (cp) => cp.location,
        );

        const transform = stroke.transform;

        let startPoint = controlPoints[0];
        if (transform) {
          startPoint = transformPoint(startPoint as Point, transform);
        }
        let pathData = `M${startPoint[0]},${startPoint[1]} `;

        // Average instead:
        let strokeWidth = 0;
        for (let i = 0; i < stroke.path.controlPoints.length; i++) {
          strokeWidth += stroke.path.controlPoints[i].size[1];
        }
        strokeWidth /=
          stroke.path.controlPoints.length * window.devicePixelRatio;

        for (let i = 1; i < controlPoints.length - 2; i += 3) {
          let cp1 = controlPoints[i];
          let cp2 = controlPoints[i + 1];
          let end = controlPoints[i + 2];
          if (transform) {
            cp1 = transformPoint(cp1 as Point, transform);
            cp2 = transformPoint(cp2 as Point, transform);
            end = transformPoint(end as Point, transform);
          }
          pathData += `C${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${end[0]},${end[1]} `;
        }

        const { red, green, blue, alpha } = stroke.ink.color;
        const normalizedAlpha = Math.round(alpha * 100) / 100;
        const className = generateClassName(red, green, blue, normalizedAlpha);

        return (
          <path
            key={index}
            d={pathData}
            fill="none"
            className={className}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

const MemoizedSVGDrawing = memo(SVGDrawing);

export function DrawingViewer({
  selected = false,
  drawing,
}: {
  selected?: boolean;
  drawing?: Drawing;
}) {
  const [width, setWidth] = useState<number>(0);

  const setupPatternRef = useCallback((node: SVGElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {
        const boundingRect = node.getBoundingClientRect();
        setWidth(boundingRect.width);
      });

      observer.observe(node);

      // Cleanup logic:
      return () => {
        observer.unobserve(node);
      };
    }
  }, []);

  const patternSize = Math.max((width - 1) / 30, 5);
  const height = Math.max(
    drawing ? drawing.bounds[1][1] + drawing.bounds[0][1] + 20 : 0,
    patternSize * 4,
  );
  const drawingOffsetHeight = drawing ? drawing.bounds[1][1] : 0;

  return (
    <div
      className="relative break-before-avoid"
      style={
        drawing
          ? {
              height: `${height}px`,
            }
          : {}
      }
    >
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full print:hidden"
        style={{
          height: `${height}px`,
        }}
        ref={setupPatternRef}
      >
        <defs>
          <pattern
            id="drawing-grid"
            width={patternSize}
            height={patternSize}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={(width - 1) / 60}
              cy={(width - 1) / 60}
              r="1"
              className={classNames(
                selected
                  ? "dark:fill-neutral-500 fill-neutral-600"
                  : "dark:fill-neutral-700 fill-neutral-400",
              )}
              opacity="1"
            ></circle>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#drawing-grid)"></rect>
      </svg>
      {!selected && drawing && (
        <div
          className="absolute w-full pointer-events-none break-before-avoid"
          style={{
            top: `${drawing.bounds[0][1]}px`,
            height: `${drawingOffsetHeight}px`,
          }}
        >
          <div className="relative w-full h-full">
            <MemoizedSVGDrawing
              drawing={drawing}
              viewBox={[
                [0, drawing.bounds[0][1]],
                [width, drawing.bounds[1][1]],
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
