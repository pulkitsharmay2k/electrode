"use strict";

const { expect } = require("chai");
const sortObjKeys = require("../../src/sort-obj-keys");

describe("sort-obj-keys", function () {
  it("should return a new object with keys sorted", () => {
    const obj = { c: 3, a: 1, b: 2 };
    const sorted = sortObjKeys(obj);

    expect(Object.keys(sorted)).to.deep.equal(["a", "b", "c"]);
    expect(sorted).to.deep.equal({ a: 1, b: 2, c: 3 });
  });

  it("should not mutate the original object", () => {
    const obj = { c: 3, a: 1 };
    sortObjKeys(obj);

    expect(Object.keys(obj)).to.deep.equal(["c", "a"]);
  });

  it("should handle an empty object", () => {
    expect(sortObjKeys({})).to.deep.equal({});
  });

  it("should keep each key's own value when values are duplicated", () => {
    const sorted = sortObjKeys({ zzz: "2", zoo: "1", abc: "2" });

    expect(Object.keys(sorted)).to.deep.equal(["abc", "zoo", "zzz"]);
    expect(sorted.abc).to.equal("2");
    expect(sorted.zoo).to.equal("1");
    expect(sorted.zzz).to.equal("2");
  });

  it("should keep keys with a shared prefix distinct", () => {
    const sorted = sortObjKeys({ "a-b": 1, "a-b-c": 2, a: 3 });

    expect(Object.keys(sorted)).to.deep.equal(["a", "a-b", "a-b-c"]);
    expect(sorted.a).to.equal(3);
    expect(sorted["a-b"]).to.equal(1);
    expect(sorted["a-b-c"]).to.equal(2);
  });

  it("should keep numeric-like keys distinct from their string forms", () => {
    const sorted = sortObjKeys({ 10: "ten", 2: "two", "02": "zero-two" });

    expect(Object.keys(sorted).sort()).to.deep.equal(["02", "10", "2"]);
    expect(sorted["10"]).to.equal("ten");
    expect(sorted["2"]).to.equal("two");
    expect(sorted["02"]).to.equal("zero-two");
  });
});
