"use strict";

const { expect } = require("chai");
const sortObjKeys = require("../../src/sort-obj-keys");

describe("sort-obj-keys", function () {
  it("should sort an object's keys alphabetically", () => {
    const sorted = sortObjKeys({ zoo: 1, apple: 2, mango: 3 });
    expect(Object.keys(sorted)).to.deep.equal(["apple", "mango", "zoo"]);
  });

  it("should sort keys that share a common prefix", () => {
    const sorted = sortObjKeys({ zoo: 1, ziq: 2, zzz: 3, z: 4 });
    expect(Object.keys(sorted)).to.deep.equal(["z", "ziq", "zoo", "zzz"]);
  });

  it("should sort scoped and dashed package style keys", () => {
    const sorted = sortObjKeys({
      "@xarc/react": "1",
      "@xarc/app-dev": "2",
      "@xarc/app": "3",
      react: "4",
      "react-dom": "5",
    });
    expect(Object.keys(sorted)).to.deep.equal([
      "@xarc/app",
      "@xarc/app-dev",
      "@xarc/react",
      "react",
      "react-dom",
    ]);
  });

  it("should keep keys that are already sorted in the same order", () => {
    const sorted = sortObjKeys({ a: 1, b: 2, c: 3 });
    expect(Object.keys(sorted)).to.deep.equal(["a", "b", "c"]);
  });

  it("should keep integer like keys in JS numeric key order", () => {
    const sorted = sortObjKeys({ 10: "a", 9: "b", 100: "c" });
    expect(Object.keys(sorted)).to.deep.equal(["9", "10", "100"]);
  });

  it("should keep the values with their keys", () => {
    const sorted = sortObjKeys({ b: "2", a: "1" });
    expect(sorted).to.deep.equal({ a: "1", b: "2" });
  });

  it("should return a new object and not mutate the input", () => {
    const obj = { b: 1, a: 2 };
    const sorted = sortObjKeys(obj);
    expect(sorted).to.not.equal(obj);
    expect(Object.keys(obj)).to.deep.equal(["b", "a"]);
  });

  it("should return an empty object for an empty object", () => {
    expect(sortObjKeys({})).to.deep.equal({});
  });
});
