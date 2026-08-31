"use strict";

const sortDeps = require("../../src/sort-deps");

describe("sort-deps", function () {
  it("should sort all dependency sections in place", () => {
    const pkg = {
      dependencies: { b: "1.0.0", a: "2.0.0" },
      devDependencies: { z: "1.0.0", y: "2.0.0" },
      optionalDependencies: { d: "1.0.0", c: "2.0.0" },
      peerDependencies: { g: "1.0.0", f: "2.0.0" },
    };

    sortDeps(pkg);

    expect(Object.keys(pkg.dependencies)).to.deep.equal(["a", "b"]);
    expect(Object.keys(pkg.devDependencies)).to.deep.equal(["y", "z"]);
    expect(Object.keys(pkg.optionalDependencies)).to.deep.equal(["c", "d"]);
    expect(Object.keys(pkg.peerDependencies)).to.deep.equal(["f", "g"]);
  });

  it("should keep dependency values intact", () => {
    const pkg = { dependencies: { b: "1.0.0", a: "2.0.0" } };
    sortDeps(pkg);
    expect(pkg.dependencies).to.deep.equal({ a: "2.0.0", b: "1.0.0" });
  });

  it("should skip sections that don't exist", () => {
    const pkg = { name: "foo" };
    sortDeps(pkg);
    expect(pkg).to.deep.equal({ name: "foo" });
    expect(pkg).to.not.have.property("dependencies");
  });
});
