"use strict";

const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const prompts = require("prompts");
const sinon = require("sinon");
const { expect } = require("chai");
const create = require("../../src/create");

describe("create", function () {
  let cwd;
  let tmpDir;
  let argv;
  let logStub;

  beforeEach(() => {
    cwd = process.cwd();
    argv = process.argv;
    process.argv = argv.slice(0, 2);
    process.argv[2] = ".";
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-"));
    process.chdir(tmpDir);
    logStub = sinon.stub(console, "log");
  });

  afterEach(() => {
    logStub.restore();
    process.argv = argv;
    process.chdir(cwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create an app in the current directory", async () => {
    await create();

    const pkg = JSON.parse(Fs.readFileSync(Path.join(tmpDir, "package.json"), "utf8"));
    expect(pkg.name).to.equal("my-x-app");
    expect(Object.keys(pkg.dependencies)).to.deep.equal(Object.keys(pkg.dependencies).sort());
    expect(Object.keys(pkg.devDependencies)).to.deep.equal(Object.keys(pkg.devDependencies).sort());

    for (const file of [
      "babel.config.js",
      "xrun-tasks.ts",
      "src",
      "static",
      ".gitignore",
      "tsconfig.json",
      ".browserslistrc",
      "README.md",
    ]) {
      expect(Fs.existsSync(Path.join(tmpDir, file)), `${file} should exist`).to.equal(true);
    }

    expect(logStub.lastCall.args[0]).to.contain(
      `Created react/node webapp in directory '${Path.basename(tmpDir)}'`
    );
  });

  it("should not create anything when user declines to write to a non-empty dir", async () => {
    Fs.writeFileSync(Path.join(tmpDir, "foo.txt"), "foo");
    prompts.inject([false]);

    await create();

    expect(Fs.readdirSync(tmpDir)).to.deep.equal(["foo.txt"]);
    expect(logStub.lastCall.args[0]).to.contain(
      `Not able to write to directory '${Path.basename(tmpDir)}'. bye.`
    );
  });
});
