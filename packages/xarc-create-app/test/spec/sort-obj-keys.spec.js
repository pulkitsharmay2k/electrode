"use strict";

const { expect } = require("chai");
const sortObjKeys = require("../../src/sort-obj-keys");

describe("sort-obj-keys", function () {
  it("should return a new object with keys sorted", () => {
    const obj = { c: 3, a: 1, b: 2 };
    const sorted = sortObjKeys(obj);
    expect(Object.keys(sorted)).to.deep.equal(["a", "b", "c"]);
    expect(sorted).to.deep.equal({ a: 1, b: 2, c: 3 });
    expect(Object.keys(obj)).to.deep.equal(["c", "a", "b"]);
  });

  it("should handle an empty object", () => {
    expect(sortObjKeys({})).to.deep.equal({});
  });
});
