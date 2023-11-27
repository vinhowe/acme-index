import { Compartment, Facet } from "@codemirror/state";
import { ReactNode } from "react";

export const createPortalMethodConf = new Compartment();
export const destroyPortalMethodConf = new Compartment();

export type CreatePortalMethod = (
  children: ReactNode,
  container: Element | DocumentFragment,
  key: string,
) => void;

export type DestroyPortalMethod = (key: string) => void;

export const createPortalMethod = Facet.define<
  CreatePortalMethod,
  CreatePortalMethod
>({
  combine: (values) => {
    return (
      children: ReactNode,
      container: Element | DocumentFragment,
      key: string,
    ) => {
      values.forEach((value) => value(children, container, key));
    };
  },
});
export const destroyPortalMethod = Facet.define<
  DestroyPortalMethod,
  DestroyPortalMethod
>({
  combine: (values) => {
    return (key: string) => {
      values.forEach((value) => value(key));
    };
  },
});
