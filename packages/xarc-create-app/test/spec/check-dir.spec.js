"use strict";

const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const { expect } = require("chai");
const prompts = require("prompts");
const checkDir = require("../../src/check-dir");

describe("check-dir", function () {
  const saveCwd = process.cwd();
  let tmpDir;

  beforeEach(() => {
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-check-dir-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(saveCwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return true without prompting when dir is empty", async () => {
    expect(await checkDir("my-app")).to.equal(true);
  });

  it("should return true when dir is not empty and user confirms overwrite", async () => {
    Fs.writeFileSync(Path.join(tmpDir, "foo.txt"), "hello");
    prompts.inject([true]);
    expect(await checkDir("my-app")).to.equal(true);
  });

  it("should return false when dir is not empty and user declines overwrite", async () => {
    Fs.writeFileSync(Path.join(tmpDir, "foo.txt"), "hello");
    prompts.inject([false]);
    expect(await checkDir("my-app")).to.equal(false);
  });
});
