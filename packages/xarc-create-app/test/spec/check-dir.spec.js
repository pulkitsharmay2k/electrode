"use strict";

const { expect } = require("chai");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const prompts = require("prompts");
const checkDir = require("../../src/check-dir");

describe("check-dir", function () {
  let cwd;
  let tmpDir;

  beforeEach(() => {
    cwd = process.cwd();
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-check-dir-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return true without prompting when dir is empty", async () => {
    expect(await checkDir("my-app")).to.equal(true);
  });

  it("should return the user's answer when dir is not empty", async () => {
    Fs.writeFileSync(Path.join(tmpDir, "foo.txt"), "foo");

    prompts.inject([true]);
    expect(await checkDir("my-app")).to.equal(true);

    prompts.inject([false]);
    expect(await checkDir("my-app")).to.equal(false);
  });
});
