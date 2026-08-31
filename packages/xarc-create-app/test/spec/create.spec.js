"use strict";

const { expect } = require("chai");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const prompts = require("prompts");
const sinon = require("sinon");
const create = require("../../src/create");

describe("create", function () {
  this.timeout(10000);

  const saveCwd = process.cwd();
  const saveArgv = process.argv;
  let tmpDir;
  let logs;

  beforeEach(() => {
    logs = [];
    tmpDir = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-create-")));
    process.chdir(tmpDir);
    sinon.stub(console, "log").callsFake(msg => logs.push(msg));
  });

  afterEach(() => {
    sinon.restore();
    process.argv = saveArgv;
    process.chdir(saveCwd);
    prompts.inject([]);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const setAppDir = dirName => {
    process.argv = [saveArgv[0], saveArgv[1], dirName];
  };

  it("should generate an app in a new directory", async () => {
    setAppDir("my-app");

    await create();

    const appDir = Path.join(tmpDir, "my-app");
    const files = [
      "package.json",
      "babel.config.js",
      "xrun-tasks.ts",
      "tsconfig.json",
      ".gitignore",
      ".browserslistrc",
      "README.md",
      "src",
      "static",
    ];
    files.forEach(f => {
      expect(Fs.existsSync(Path.join(appDir, f)), `${f} should exist`).to.equal(true);
    });
    expect(logs.join("\n")).to.contain("Created react/node webapp in directory 'my-app'");
  });

  it("should generate a package.json with sorted dependencies", async () => {
    setAppDir("my-app");

    await create();

    const pkg = JSON.parse(Fs.readFileSync(Path.join(tmpDir, "my-app", "package.json"), "utf8"));
    expect(pkg.name).to.equal("my-x-app");
    ["dependencies", "devDependencies"].forEach(section => {
      const keys = Object.keys(pkg[section]);
      expect(keys, `${section} should not be empty`).to.not.be.empty;
      expect(keys).to.deep.equal([].concat(keys).sort());
    });
  });

  it("should not write anything when user declines to overwrite a non empty dir", async () => {
    const appDir = Path.join(tmpDir, "my-app");
    Fs.mkdirSync(appDir);
    Fs.writeFileSync(Path.join(appDir, "foo.txt"), "hello");
    setAppDir("my-app");
    prompts.inject([false]);

    await create();

    expect(Fs.readdirSync(appDir)).to.deep.equal(["foo.txt"]);
    expect(logs.join("\n")).to.contain("Not able to write to directory 'my-app'");
  });

  it("should write to a non empty dir when user confirms overwrite", async () => {
    const appDir = Path.join(tmpDir, "my-app");
    Fs.mkdirSync(appDir);
    Fs.writeFileSync(Path.join(appDir, "foo.txt"), "hello");
    setAppDir("my-app");
    prompts.inject([true]);

    await create();

    expect(Fs.existsSync(Path.join(appDir, "package.json"))).to.equal(true);
    expect(Fs.existsSync(Path.join(appDir, "foo.txt"))).to.equal(true);
  });
});
