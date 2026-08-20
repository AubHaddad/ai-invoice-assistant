import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

if (typeof globalThis.DOMMatrix === "undefined") {
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
}
