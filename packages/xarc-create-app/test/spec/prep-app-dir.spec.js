"use strict";

const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const { expect } = require("chai");
const sinon = require("sinon");
const prepareAppDir = require("../../src/prep-app-dir");

describe("prep-app-dir", function () {
  const saveCwd = process.cwd();
  const saveArgv = process.argv;
  let tmpDir;
  let logStub;
  let exitStub;

  beforeEach(() => {
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-prep-"));
    logStub = sinon.stub(console, "log");
    exitStub = sinon.stub(process, "exit");
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(saveCwd);
    process.argv = saveArgv;
    logStub.restore();
    exitStub.restore();
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const setAppDirArg = (dir) => {
    process.argv = [saveArgv[0], saveArgv[1], dir];
  };

  it("should show usage and exit when no app dir is given", async () => {
    process.argv = [saveArgv[0], saveArgv[1]];
    // process.exit is stubbed, so execution continues and eventually fails on chdir
    await prepareAppDir().catch(() => undefined);
    expect(exitStub.calledWith(1)).to.equal(true);
    expect(logStub.firstCall.args[0]).to.contain("Usage: @xarc/create-app <app-directory>");
  });

  it("should use current directory name when app dir is '.'", async () => {
    setAppDirArg(".");
    const dirName = await prepareAppDir();
    expect(dirName).to.equal(Path.basename(Fs.realpathSync(tmpDir)));
    expect(logStub.firstCall.args[0]).to.contain("Using current directory");
  });

  it("should create the app dir and chdir into it", async () => {
    setAppDirArg("my-app");
    const dirName = await prepareAppDir();
    expect(dirName).to.equal("my-app");
    expect(Fs.statSync(Path.join(tmpDir, "my-app")).isDirectory()).to.equal(true);
    expect(Path.basename(process.cwd())).to.equal("my-app");
  });

  it("should chdir into an existing app dir without exiting", async () => {
    Fs.mkdirSync(Path.join(tmpDir, "existing-app"));
    setAppDirArg("existing-app");
    const dirName = await prepareAppDir();
    expect(dirName).to.equal("existing-app");
    expect(exitStub.called).to.equal(false);
    expect(Path.basename(process.cwd())).to.equal("existing-app");
  });

  it("should exit when the app dir cannot be created", async () => {
    setAppDirArg("no-such-parent/my-app");
    await prepareAppDir().catch(() => undefined);
    expect(exitStub.calledWith(1)).to.equal(true);
    expect(logStub.lastCall.args[0]).to.contain("Failed to create app directory");
  });
});
