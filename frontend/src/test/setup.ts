import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

import { installFakeIntersectionObserver } from "./fakeIntersectionObserver";

beforeEach(installFakeIntersectionObserver);

// jsdom draws nothing: say so quietly, instead of logging "not implemented" for every canvas.
HTMLCanvasElement.prototype.getContext = () => null;
