"use strict";

const Path = require("path");
const Fs = require("opfs");
const shcmd = require("shcmd");
const { stubModule, freshRequire } = require("../stub-module");

const createPath = require.resolve("../../src/create");
const prepAppDirPath = require.resolve("../../src/prep-app-dir");
const checkDirPath = require.resolve("../../src/check-dir");

describe("create", function () {
  let prepAppDirStub;
  let checkDirStub;
  let restores;
  let stubs;
  let logs;
  let create;

  beforeEach(() => {
    logs = [];
    prepAppDirStub = sinon.stub().resolves("my-app");
    checkDirStub = sinon.stub().resolves(true);
    restores = [
      stubModule(prepAppDirPath, prepAppDirStub),
      stubModule(checkDirPath, checkDirStub),
    ];
    stubs = [
      sinon.stub(Fs, "writeFileSync"),
      sinon.stub(shcmd, "cp"),
      sinon.stub(console, "log").callsFake((msg) => logs.push(msg)),
    ];
    create = freshRequire(createPath);
  });

  afterEach(() => {
    stubs.forEach((x) => x.restore());
    restores.forEach((x) => x());
  });

  it("should bail out when the app dir is not writable", async () => {
    checkDirStub.resolves(false);

    await create();

    expect(logs.join("\n")).to.contain("Not able to write to directory 'my-app'");
    expect(Fs.writeFileSync).to.have.not.been.called;
    expect(shcmd.cp).to.have.not.been.called;
  });

  it("should write the app's package.json from the template", async () => {
    await create();

    expect(prepAppDirStub).to.have.been.calledOnce;
    expect(checkDirStub).to.have.been.calledWith("my-app");
    expect(Fs.writeFileSync).to.have.been.calledOnce;

    const [file, contents] = Fs.writeFileSync.firstCall.args;
    expect(file).to.equal(Path.resolve("package.json"));
    expect(contents.endsWith("\n")).to.equal(true);

    const pkg = JSON.parse(contents);
    expect(pkg.name).to.equal("my-x-app");
    expect(pkg.scripts.dev).to.equal("xrun -q electrode/dev");
    expect(pkg.dependencies).to.be.an("object").that.is.not.empty;
  });

  it("should copy the template files into the app dir", async () => {
    const srcDir = Path.join(Path.dirname(createPath), "../template");

    await create();

    expect(shcmd.cp).to.have.been.calledWith(Path.join(srcDir, "babel.config.js"), process.cwd());
    expect(shcmd.cp).to.have.been.calledWith(Path.join(srcDir, "xrun-tasks.ts"), process.cwd());
    expect(shcmd.cp).to.have.been.calledWith("-R", Path.join(srcDir, "src"), process.cwd());
    expect(shcmd.cp).to.have.been.calledWith("-R", Path.join(srcDir, "static"), process.cwd());
    expect(shcmd.cp).to.have.been.calledWith(
      "-R",
      Path.join(srcDir, "_gitignore"),
      Path.resolve(".gitignore")
    );
    expect(shcmd.cp).to.have.been.calledWith(
      "-R",
      Path.join(srcDir, "_tsconfig.json"),
      Path.resolve("tsconfig.json")
    );
    expect(shcmd.cp).to.have.been.calledWith(
      "-R",
      Path.join(srcDir, "_browserslistrc"),
      Path.resolve(".browserslistrc")
    );
    expect(shcmd.cp).to.have.been.calledWith(
      "-R",
      Path.join(srcDir, "README.md"),
      Path.resolve("README.md")
    );
  });

  it("should print the next steps for the created app", async () => {
    await create();

    const output = logs.join("\n");
    expect(output).to.contain("Created react/node webapp in directory 'my-app'");
    expect(output).to.contain("cd my-app");
    expect(output).to.contain("npm run dev");
  });
});
