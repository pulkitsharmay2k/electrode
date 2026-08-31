"use strict";

const { expect } = require("chai");
const sortObjKeys = require("../../src/sort-obj-keys");

describe("sort-obj-keys", function () {
  it("should sort an object's keys alphabetically", () => {
    const sorted = sortObjKeys({ zoo: 1, apple: 2, mango: 3 });
    expect(Object.keys(sorted)).to.deep.equal(["apple", "mango", "zoo"]);
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
