export interface CodeCell {
  type: "code";
  content: string;
  output: string;
  language: string;
}