"use strict";

const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const { expect } = require("chai");
const sinon = require("sinon");
const prompts = require("prompts");
const create = require("../../src/create");

describe("create", function () {
  this.timeout(20000);

  const saveCwd = process.cwd();
  const saveArgv = process.argv;
  let tmpDir;
  let logStub;

  beforeEach(() => {
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-create-"));
    logStub = sinon.stub(console, "log");
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(saveCwd);
    process.argv = saveArgv;
    logStub.restore();
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const setAppDirArg = (dir) => {
    process.argv = [saveArgv[0], saveArgv[1], dir];
  };

  it("should create an app in a new directory", async () => {
    setAppDirArg("my-app");
    await create();

    const appDir = Path.join(tmpDir, "my-app");
    const files = [
      "package.json",
      "babel.config.js",
      "xrun-tasks.ts",
      "src",
      "static",
      ".gitignore",
      "tsconfig.json",
      ".browserslistrc",
      "README.md",
    ];
    files.forEach((f) => expect(Fs.existsSync(Path.join(appDir, f)), f).to.equal(true));

    const pkg = JSON.parse(Fs.readFileSync(Path.join(appDir, "package.json"), "utf8"));
    expect(pkg.name).to.equal("my-x-app");
    expect(pkg.scripts.dev).to.equal("xrun -q electrode/dev");
    expect(Fs.existsSync(Path.join(appDir, "src/app.tsx"))).to.equal(true);

    expect(logStub.lastCall.args[0]).to.contain("Created react/node webapp in directory 'my-app'");
  });

  it("should create an app in the current directory with '.'", async () => {
    setAppDirArg(".");
    await create();

    expect(Fs.existsSync(Path.join(tmpDir, "package.json"))).to.equal(true);
    expect(Fs.existsSync(Path.join(tmpDir, "src"))).to.equal(true);
  });

  it("should not write anything when user declines to overwrite a non-empty dir", async () => {
    const appDir = Path.join(tmpDir, "my-app");
    Fs.mkdirSync(appDir);
    Fs.writeFileSync(Path.join(appDir, "foo.txt"), "hello");
    setAppDirArg("my-app");
    prompts.inject([false]);

    await create();

    expect(Fs.readdirSync(appDir)).to.deep.equal(["foo.txt"]);
    expect(logStub.lastCall.args[0]).to.contain("Not able to write to directory 'my-app'");
  });

  // NOTE: this test fails due to a real bug in src/create.js: it requires "./sort-obj-keys"
  // (which returns a sorted copy) as `sortDeps` instead of "./sort-deps" (which sorts the
  // dependencies fields in place), so `sortDeps(pkg)` is a no-op and dependency keys of the
  // generated package.json are never sorted. Left failing per instruction not to change
  // production code.
  it("should sort the dependencies of the generated package.json", async () => {
    setAppDirArg("my-app");

    require("../../template/_package");
    const templatePath = require.resolve("../../template/_package");
    const createPath = require.resolve("../../src/create");
    const origExports = require.cache[templatePath].exports;

    require.cache[templatePath].exports = () => ({
      name: "my-x-app",
      dependencies: { zzz: "^1.0.0", aaa: "^1.0.0" },
      devDependencies: { zzz: "^1.0.0", aaa: "^1.0.0" },
    });
    delete require.cache[createPath];

    try {
      await require("../../src/create")();

      const pkg = JSON.parse(Fs.readFileSync(Path.join(tmpDir, "my-app/package.json"), "utf8"));
      expect(Object.keys(pkg.dependencies)).to.deep.equal(["aaa", "zzz"]);
      expect(Object.keys(pkg.devDependencies)).to.deep.equal(["aaa", "zzz"]);
    } finally {
      require.cache[templatePath].exports = origExports;
      delete require.cache[createPath];
      require("../../src/create");
    }
  });
});
