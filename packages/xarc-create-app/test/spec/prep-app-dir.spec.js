"use strict";

const { expect } = require("chai");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const sinon = require("sinon");
const prepareAppDir = require("../../src/prep-app-dir");

describe("prep-app-dir", function () {
  let cwd;
  let tmpDir;
  let argv;
  let logStub;
  let exitStub;

  beforeEach(() => {
    cwd = process.cwd();
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-prep-app-dir-"));
    process.chdir(tmpDir);
    argv = process.argv;
    process.argv = [argv[0], argv[1]];
    logStub = sinon.stub(console, "log");
    exitStub = sinon.stub(process, "exit");
  });

  afterEach(() => {
    logStub.restore();
    exitStub.restore();
    process.argv = argv;
    process.chdir(cwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should show usage and exit when no app dir is given", async () => {
    // process.exit is stubbed, so the function keeps going and fails later on
    // an undefined dir name - real runs terminate at the exit call.
    await prepareAppDir().catch(() => undefined);

    expect(exitStub).to.have.been.calledWith(1);
    expect(logStub.firstCall.args[0]).to.contain("Usage: @xarc/create-app <app-directory>");
  });

  it("should use the current directory when app dir is '.'", async () => {
    process.argv[2] = ".";

    expect(await prepareAppDir()).to.equal(Path.basename(tmpDir));
    expect(process.cwd()).to.equal(Fs.realpathSync(tmpDir));
  });

  it("should create the app dir and chdir into it", async () => {
    process.argv[2] = "my-app";

    expect(await prepareAppDir()).to.equal("my-app");
    expect(process.cwd()).to.equal(Fs.realpathSync(Path.join(tmpDir, "my-app")));
    expect(exitStub).to.have.not.been.called;
  });

  it("should reuse an existing app dir", async () => {
    process.argv[2] = "existing-app";
    Fs.mkdirSync(Path.join(tmpDir, "existing-app"));

    expect(await prepareAppDir()).to.equal("existing-app");
    expect(process.cwd()).to.equal(Fs.realpathSync(Path.join(tmpDir, "existing-app")));
    expect(exitStub).to.have.not.been.called;
  });

  it("should exit when the app dir can't be created", async () => {
    process.argv[2] = Path.join("no-such-parent", "my-app");

    await prepareAppDir().catch(() => undefined);

    expect(logStub).to.have.been.calledWith(
      `Failed to create app directory '${process.argv[2]}'`
    );
    expect(exitStub).to.have.been.calledWith(1);
  });
});
