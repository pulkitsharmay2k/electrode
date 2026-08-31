"use strict";

const sortObjKeys = require("../../src/sort-obj-keys");

describe("sort-obj-keys", function () {
  it("should sort an object's keys alphabetically", () => {
    const sorted = sortObjKeys({ c: 3, a: 1, b: 2 });
    expect(Object.keys(sorted)).to.deep.equal(["a", "b", "c"]);
    expect(sorted).to.deep.equal({ a: 1, b: 2, c: 3 });
  });

  it("should return an empty object for an empty object", () => {
    expect(sortObjKeys({})).to.deep.equal({});
  });

  it("should not mutate the original object", () => {
    const obj = { b: 1, a: 2 };
    sortObjKeys(obj);
    expect(Object.keys(obj)).to.deep.equal(["b", "a"]);
  });
});
