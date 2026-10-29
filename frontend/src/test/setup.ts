import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

import { installFakeIntersectionObserver } from "./fakeIntersectionObserver";

beforeEach(installFakeIntersectionObserver);
