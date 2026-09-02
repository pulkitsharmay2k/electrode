"use strict";

const { expect } = require("chai");
const sortDeps = require("../../src/sort-deps");

describe("sort-deps", function () {
  it("should sort keys of all dependencies fields", () => {
    const pkg = {
      name: "test",
      dependencies: { b: "1.0.0", a: "2.0.0" },
      devDependencies: { z: "1.0.0", y: "2.0.0" },
      optionalDependencies: { d: "1.0.0", c: "2.0.0" },
      peerDependencies: { f: "1.0.0", e: "2.0.0" },
    };

    sortDeps(pkg);

    expect(Object.keys(pkg.dependencies)).to.deep.equal(["a", "b"]);
    expect(Object.keys(pkg.devDependencies)).to.deep.equal(["y", "z"]);
    expect(Object.keys(pkg.optionalDependencies)).to.deep.equal(["c", "d"]);
    expect(Object.keys(pkg.peerDependencies)).to.deep.equal(["e", "f"]);
    expect(pkg.dependencies).to.deep.equal({ a: "2.0.0", b: "1.0.0" });
  });

  it("should leave a pkg without any dependencies fields untouched", () => {
    const pkg = { name: "test" };
    sortDeps(pkg);
    expect(pkg).to.deep.equal({ name: "test" });
  });
});
