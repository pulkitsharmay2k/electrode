"use strict";

const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const sinon = require("sinon");
const { expect } = require("chai");
const prepareAppDir = require("../../src/prep-app-dir");

describe("prep-app-dir", function () {
  let cwd;
  let tmpDir;
  let argv;
  let exitStub;
  let logStub;

  beforeEach(() => {
    cwd = process.cwd();
    argv = process.argv;
    process.argv = argv.slice(0, 2);
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-"));
    process.chdir(tmpDir);
    exitStub = sinon.stub(process, "exit").throws(new Error("test process.exit"));
    logStub = sinon.stub(console, "log");
  });

  afterEach(() => {
    logStub.restore();
    exitStub.restore();
    process.argv = argv;
    process.chdir(cwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should show usage and exit when no app dir is given", async () => {
    const err = await prepareAppDir().catch(e => e);
    expect(err.message).to.equal("test process.exit");
    expect(exitStub.calledWith(1)).to.equal(true);
    expect(logStub.firstCall.args[0]).to.contain("Usage: @xarc/create-app <app-directory>");
  });

  it("should use current directory when app dir is '.'", async () => {
    process.argv[2] = ".";
    expect(await prepareAppDir()).to.equal(Path.basename(tmpDir));
    expect(process.cwd()).to.equal(Fs.realpathSync(tmpDir));
  });

  it("should create the app dir and change into it", async () => {
    process.argv[2] = "my-app";
    expect(await prepareAppDir()).to.equal("my-app");
    expect(process.cwd()).to.equal(Fs.realpathSync(Path.join(tmpDir, "my-app")));
  });

  it("should change into an app dir that already exists", async () => {
    Fs.mkdirSync(Path.join(tmpDir, "my-app"));
    process.argv[2] = "my-app";
    expect(await prepareAppDir()).to.equal("my-app");
    expect(process.cwd()).to.equal(Fs.realpathSync(Path.join(tmpDir, "my-app")));
  });

  it("should exit when creating the app dir fails", async () => {
    process.argv[2] = "no-such-parent/my-app";
    const err = await prepareAppDir().catch(e => e);
    expect(err.message).to.equal("test process.exit");
    expect(exitStub.calledWith(1)).to.equal(true);
    expect(logStub.lastCall.args[0]).to.contain(
      "Failed to create app directory 'no-such-parent/my-app'"
    );
  });
});
