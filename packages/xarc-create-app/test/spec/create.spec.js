"use strict";

const { expect } = require("chai");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const sinon = require("sinon");
const prompts = require("prompts");
const create = require("../../src/create");

describe("create", function () {
  this.timeout(20000);

  let cwd;
  let tmpDir;
  let argv;
  let logStub;

  beforeEach(() => {
    cwd = process.cwd();
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-"));
    process.chdir(tmpDir);
    argv = process.argv;
    process.argv = [argv[0], argv[1]];
    logStub = sinon.stub(console, "log");
  });

  afterEach(() => {
    logStub.restore();
    process.argv = argv;
    process.chdir(cwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const appDir = () => Path.join(tmpDir, "my-app");

  it("should create the app files in a new directory", async () => {
    process.argv[2] = "my-app";

    await create();

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

    files.forEach((f) => expect(Fs.existsSync(Path.join(appDir(), f)), f).to.equal(true));

    const pkg = JSON.parse(Fs.readFileSync(Path.join(appDir(), "package.json"), "utf8"));
    expect(pkg.name).to.equal("my-x-app");
    expect(pkg.dependencies).to.have.property("@xarc/app");
    expect(pkg.devDependencies).to.have.property("@xarc/app-dev");

    const message = logStub.lastCall.args[0];
    expect(message).to.contain("Created react/node webapp in directory 'my-app'");
  });

  it("should copy the template src files", async () => {
    process.argv[2] = "my-app";

    await create();

    expect(Fs.existsSync(Path.join(appDir(), "src/app.tsx"))).to.equal(true);
    expect(Fs.existsSync(Path.join(appDir(), "src/server"))).to.equal(true);
  });

  it("should use the version of xarc packages from create-app's own package.json", async () => {
    process.argv[2] = "my-app";

    await create();

    const myPkg = require("../../package.json");
    const pkg = JSON.parse(Fs.readFileSync(Path.join(appDir(), "package.json"), "utf8"));

    expect(pkg.dependencies["@xarc/app"]).to.equal(myPkg.devDependencies["@xarc/app"]);
    expect(pkg.devDependencies["@xarc/app-dev"]).to.equal(myPkg.devDependencies["@xarc/app-dev"]);
  });

  it("should not write anything when user declines an existing non-empty dir", async () => {
    process.argv[2] = "my-app";
    Fs.mkdirSync(appDir());
    Fs.writeFileSync(Path.join(appDir(), "existing.txt"), "hello");

    prompts.inject([false]);
    await create();

    expect(Fs.readdirSync(appDir())).to.deep.equal(["existing.txt"]);
    expect(logStub.lastCall.args[0]).to.contain("Not able to write to directory 'my-app'");
  });

  it("should write to an existing non-empty dir when user confirms", async () => {
    process.argv[2] = "my-app";
    Fs.mkdirSync(appDir());
    Fs.writeFileSync(Path.join(appDir(), "existing.txt"), "hello");

    prompts.inject([true]);
    await create();

    expect(Fs.existsSync(Path.join(appDir(), "package.json"))).to.equal(true);
    expect(Fs.existsSync(Path.join(appDir(), "existing.txt"))).to.equal(true);
  });
});
