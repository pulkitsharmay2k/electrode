"use strict";

const { expect } = require("chai");
const sortObjKeys = require("../../src/sort-obj-keys");

describe("sort-obj-keys", function () {
  it("should sort keys of an object alphabetically", () => {
    const sorted = sortObjKeys({ zoo: "1", apple: "2", Mango: "3" });
    expect(Object.keys(sorted)).to.deep.equal(["Mango", "apple", "zoo"]);
  });

  it("should keep values with their keys", () => {
    expect(sortObjKeys({ b: "2.0.0", a: "1.0.0" })).to.deep.equal({ a: "1.0.0", b: "2.0.0" });
  });

  it("should return an empty object for an empty object", () => {
    expect(sortObjKeys({})).to.deep.equal({});
  });
});
