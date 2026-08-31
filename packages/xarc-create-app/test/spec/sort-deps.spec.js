"use strict";

const { expect } = require("chai");
const sortDeps = require("../../src/sort-deps");

describe("sort-deps", function () {
  it("should sort all dependencies sections of a package", () => {
    const pkg = {
      name: "test-app",
      dependencies: { react: "16", "@xarc/app": "13" },
      devDependencies: { mocha: "10", chai: "4" },
      optionalDependencies: { z: "1", a: "1" },
      peerDependencies: { b: "1", a: "1" },
    };

    sortDeps(pkg);

    expect(Object.keys(pkg.dependencies)).to.deep.equal(["@xarc/app", "react"]);
    expect(Object.keys(pkg.devDependencies)).to.deep.equal(["chai", "mocha"]);
    expect(Object.keys(pkg.optionalDependencies)).to.deep.equal(["a", "z"]);
    expect(Object.keys(pkg.peerDependencies)).to.deep.equal(["a", "b"]);
  });

  it("should leave a package without dependencies sections untouched", () => {
    const pkg = { name: "test-app" };
    sortDeps(pkg);
    expect(pkg).to.deep.equal({ name: "test-app" });
  });
});
