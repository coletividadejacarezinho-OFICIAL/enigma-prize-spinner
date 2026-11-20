import { describe, expect, it } from "vitest";

import { isNewer, parseVersion, shortVersion } from "@/lib/enigma/app-version";

const page = (commit: string | null, entry: string) =>
  `<!DOCTYPE html><html><head>${
    commit ? `<script defer src="/__l5e/events.js" data-commit-sha="${commit}"></script>` : ""
  }<link rel="modulepreload" href="/assets/logic-abc.js"/></head><body><script type="module" async="" src="${entry}"></script></body></html>`;

describe("app version", () => {
  it("reads the published commit and the main script from the served page", () => {
    const v = parseVersion(page("E26B225B30554CBCB6ADD2FEF99D25E4930D73E9", "/assets/index-BhuQuYU3.js"));
    expect(v).toEqual({ commit: "e26b225b30554cbcb6add2fef99d25e4930d73e9", entry: "/assets/index-BhuQuYU3.js" });
    expect(shortVersion(v)).toBe("e26b225");
  });

  it("finds nothing on a page without a published version (dev server)", () => {
    const v = parseVersion('<html><body><script type="module" src="/@vite/client"></script></body></html>');
    expect(v).toEqual({ commit: null, entry: null });
    expect(shortVersion(v)).toBeNull();
  });

  it("says there is a new version only when the published commit changed", () => {
    const old = parseVersion(page("14298ec26cb10c4ff126990b8a327e6ee900718d", "/assets/index-A.js"));
    const same = parseVersion(page("14298ec26cb10c4ff126990b8a327e6ee900718d", "/assets/index-A.js"));
    const latest = parseVersion(page("e26b225b30554cbcb6add2fef99d25e4930d73e9", "/assets/index-B.js"));
    expect(isNewer(old, same)).toBe(false);
    expect(isNewer(old, latest)).toBe(true);
  });

  it("falls back to the main script file when no commit is stamped", () => {
    const a = parseVersion(page(null, "/assets/index-A.js"));
    const b = parseVersion(page(null, "/assets/index-B.js"));
    expect(isNewer(a, a)).toBe(false);
    expect(isNewer(a, b)).toBe(true);
    expect(shortVersion(b)).toBe("B");
  });

  it("never claims an update when the two versions cannot be compared", () => {
    expect(isNewer({ commit: "abc1234", entry: null }, { commit: null, entry: "/assets/index-B.js" })).toBe(false);
    expect(isNewer({ commit: null, entry: null }, { commit: null, entry: null })).toBe(false);
  });
});
