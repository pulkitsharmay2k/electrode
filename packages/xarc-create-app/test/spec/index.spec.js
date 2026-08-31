"use strict";

const { stubModule, freshRequire } = require("../stub-module");

const indexPath = require.resolve("../../src/index");
const createPath = require.resolve("../../src/create");

describe("index", function () {
  it("should invoke create when loaded", () => {
    const createStub = sinon.stub().resolves();
    const restore = stubModule(createPath, createStub);

    try {
      freshRequire(indexPath);
    } finally {
      restore();
    }

    expect(createStub).to.have.been.calledOnce;
  });
});
