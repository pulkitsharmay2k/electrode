"use strict";

const { expect } = require("chai");

describe("index", function () {
  const indexFile = require.resolve("../../src/index");
  const createFile = require.resolve("../../src/create");

  let saveCreate;

  beforeEach(() => {
    saveCreate = require.cache[createFile];
    delete require.cache[indexFile];
  });

  afterEach(() => {
    if (saveCreate) {
      require.cache[createFile] = saveCreate;
    } else {
      delete require.cache[createFile];
    }
    delete require.cache[indexFile];
  });

  it("should invoke create", () => {
    let called = 0;
    require.cache[createFile] = {
      id: createFile,
      filename: createFile,
      loaded: true,
      exports: () => {
        called++;
        return Promise.resolve();
      },
    };

    require(indexFile);

    expect(called).to.equal(1);
  });
});
