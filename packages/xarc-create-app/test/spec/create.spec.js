"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const prompts = require("prompts");
const create = require("../../src/create");

describe("create", function () {
  this.timeout(10000);

  let sandbox;
  let messages;
  let tmpDir;
  const saveCwd = process.cwd();
  const saveArgv2 = process.argv[2];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    messages = [];
    sandbox.stub(console, "log").callsFake((...args) => messages.push(args.join(" ")));
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-"));
  });

  afterEach(() => {
    sandbox.restore();
    process.chdir(saveCwd);
    process.argv[2] = saveArgv2;
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create an app in an empty directory", async () => {
    process.argv[2] = Path.join(tmpDir, "my-app");

    await create();

    const appDir = Path.join(tmpDir, "my-app");
    const files = Fs.readdirSync(appDir).sort();
    expect(files).to.deep.equal(
      [
        ".browserslistrc",
        ".gitignore",
        "README.md",
        "babel.config.js",
        "package.json",
        "src",
        "static",
        "tsconfig.json",
        "xrun-tasks.ts",
      ].sort()
    );

    const pkg = JSON.parse(Fs.readFileSync(Path.join(appDir, "package.json"), "utf8"));
    expect(pkg.name).to.equal("my-x-app");
    expect(pkg.scripts.dev).to.equal("xrun -q electrode/dev");
    expect(pkg.dependencies).to.have.property("@xarc/app");
    expect(messages.join("\n")).to.contain("Created react/node webapp in directory");
  });

  it("should write sorted dependencies to package.json", async () => {
    process.argv[2] = Path.join(tmpDir, "sorted-app");

    await create();

    const pkg = JSON.parse(
      Fs.readFileSync(Path.join(tmpDir, "sorted-app", "package.json"), "utf8")
    );
    const check = (field) => {
      const keys = Object.keys(pkg[field]);
      expect(keys, field).to.deep.equal([].concat(keys).sort());
    };
    check("dependencies");
    check("devDependencies");
  });

  it("should not create anything when user declines a non empty directory", async () => {
    const appDir = Path.join(tmpDir, "used-app");
    Fs.mkdirSync(appDir);
    Fs.writeFileSync(Path.join(appDir, "some-file.txt"), "hello\n");
    process.argv[2] = appDir;
    prompts.inject([false]);

    await create();

    expect(Fs.readdirSync(appDir)).to.deep.equal(["some-file.txt"]);
    expect(messages.join("\n")).to.contain("Not able to write to directory");
  });

  it("should create the app when user confirms a non empty directory", async () => {
    const appDir = Path.join(tmpDir, "reuse-app");
    Fs.mkdirSync(appDir);
    Fs.writeFileSync(Path.join(appDir, "some-file.txt"), "hello\n");
    process.argv[2] = appDir;
    prompts.inject([true]);

    await create();

    const files = Fs.readdirSync(appDir);
    expect(files).to.contain("some-file.txt");
    expect(files).to.contain("package.json");
  });
});
