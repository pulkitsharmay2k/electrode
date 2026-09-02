"use strict";

const { expect } = require("chai");
const sortDeps = require("../../src/sort-deps");

describe("sort-deps", function () {
  it("should sort keys of all dependencies fields", () => {
    const pkg = {
      name: "test",
      dependencies: { b: "1", a: "2" },
      devDependencies: { d: "1", c: "2" },
      optionalDependencies: { f: "1", e: "2" },
      peerDependencies: { h: "1", g: "2" },
    };

    sortDeps(pkg);

    expect(Object.keys(pkg.dependencies)).to.deep.equal(["a", "b"]);
    expect(Object.keys(pkg.devDependencies)).to.deep.equal(["c", "d"]);
    expect(Object.keys(pkg.optionalDependencies)).to.deep.equal(["e", "f"]);
    expect(Object.keys(pkg.peerDependencies)).to.deep.equal(["g", "h"]);
    expect(pkg.name).to.equal("test");
  });

  it("should skip fields that don't exist", () => {
    const pkg = { dependencies: { b: "1", a: "2" } };

    sortDeps(pkg);

    expect(Object.keys(pkg)).to.deep.equal(["dependencies"]);
    expect(Object.keys(pkg.dependencies)).to.deep.equal(["a", "b"]);
  });
});
