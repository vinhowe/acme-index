export type Point = [x: number, y: number];
export type Rect = [[x: number, y: number], [width: number, height: number]];
export type Range = [start: number, end: number];

export interface Drawing {
  strokes: Stroke[];
  bounds: Rect;
}

export interface Stroke {
  path: Path;
  maskedPathRanges: Array<Range>;
  mask: Mask;
  renderBounds: Rect;
  ink: Ink;
}

export interface Ink {
  color: Color;
  inkType: string;
}

export interface Color {
  red: number;
  alpha: number;
  blue: number;
  green: number;
}

export interface Mask {
  properties: DrawingProperties;
  elements: Element[];
}

export interface Element {
  type: PathElementType;
  point?: Point;
  controlPoint1?: Point;
  controlPoint2?: Point;
}

export enum PathElementType {
  MoveTo = "MoveTo",
  LineTo = "LineTo",
  QuadraticCurveTo = "QuadraticCurveTo",
  CubicCurveTo = "CubicCurveTo",
  ClosePath = "ClosePath",
}

export interface DrawingProperties {
  lineWidth: number;
  lineCapStyle: number;
  lineJoinStyle: number;
  miterLimit: number;
  flatness: number;
  usesEvenOddFillRule: boolean;
}

export interface Path {
  controlPoints: ControlPoint[];
  creationDate: number;
}

export interface ControlPoint {
  timeOffset: number;
  location: number[];
  force: number;
  size: number[];
  azimuth: number;
  opacity: number;
  altitude: number;
}
