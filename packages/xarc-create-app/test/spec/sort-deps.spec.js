"use strict";

const { expect } = require("chai");
const sortDeps = require("../../src/sort-deps");

describe("sort-deps", function () {
  it("should sort keys of all dependencies sections", () => {
    const pkg = {
      dependencies: { react: "1", "@xarc/app": "2" },
      devDependencies: { mocha: "1", chai: "2" },
      optionalDependencies: { z: "1", a: "2" },
      peerDependencies: { b: "1", a: "2" },
    };

    sortDeps(pkg);

    expect(Object.keys(pkg.dependencies)).to.deep.equal(["@xarc/app", "react"]);
    expect(Object.keys(pkg.devDependencies)).to.deep.equal(["chai", "mocha"]);
    expect(Object.keys(pkg.optionalDependencies)).to.deep.equal(["a", "z"]);
    expect(Object.keys(pkg.peerDependencies)).to.deep.equal(["a", "b"]);
  });

  it("should not add sections that don't exist", () => {
    const pkg = { name: "test", dependencies: { b: "1", a: "2" } };

    sortDeps(pkg);

    expect(Object.keys(pkg)).to.deep.equal(["name", "dependencies"]);
    expect(Object.keys(pkg.dependencies)).to.deep.equal(["a", "b"]);
  });

  it("should do nothing for a pkg without any dependencies", () => {
    const pkg = { name: "test" };
    sortDeps(pkg);
    expect(pkg).to.deep.equal({ name: "test" });
  });
});
