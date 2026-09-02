"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const Fs = require("opfs");
const prompts = require("prompts");
const checkDir = require("../../src/check-dir");

describe("check-dir", function () {
  let stubReaddir;

  afterEach(() => {
    if (stubReaddir) {
      stubReaddir.restore();
      stubReaddir = undefined;
    }
  });

  it("should return true without prompting when dir is empty", async () => {
    stubReaddir = sinon.stub(Fs, "readdir").resolves([]);

    expect(await checkDir("my-app")).to.equal(true);
    expect(stubReaddir.args[0][0]).to.equal(process.cwd());
  });

  it("should return true when user confirms overwriting a non empty dir", async () => {
    stubReaddir = sinon.stub(Fs, "readdir").resolves(["package.json"]);
    prompts.inject([true]);

    expect(await checkDir("my-app")).to.equal(true);
  });

  it("should return false when user declines overwriting a non empty dir", async () => {
    stubReaddir = sinon.stub(Fs, "readdir").resolves(["package.json"]);
    prompts.inject([false]);

    expect(await checkDir("my-app")).to.equal(false);
  });
});
