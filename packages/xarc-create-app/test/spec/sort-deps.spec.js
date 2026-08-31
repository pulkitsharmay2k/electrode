"use strict";

const { expect } = require("chai");
const sortDeps = require("../../src/sort-deps");

describe("sort-deps", function () {
  it("should sort keys of every dependency section in place", () => {
    const pkg = {
      name: "test",
      dependencies: { b: "1", a: "1" },
      devDependencies: { z: "1", y: "1" },
      optionalDependencies: { d: "1", c: "1" },
      peerDependencies: { f: "1", e: "1" },
    };

    sortDeps(pkg);

    expect(Object.keys(pkg.dependencies)).to.deep.equal(["a", "b"]);
    expect(Object.keys(pkg.devDependencies)).to.deep.equal(["y", "z"]);
    expect(Object.keys(pkg.optionalDependencies)).to.deep.equal(["c", "d"]);
    expect(Object.keys(pkg.peerDependencies)).to.deep.equal(["e", "f"]);
    expect(pkg.name).to.equal("test");
  });

  it("should skip dependency sections that don't exist", () => {
    const pkg = { dependencies: { b: "1", a: "1" } };

    sortDeps(pkg);

    expect(Object.keys(pkg)).to.deep.equal(["dependencies"]);
    expect(Object.keys(pkg.dependencies)).to.deep.equal(["a", "b"]);
  });
});
