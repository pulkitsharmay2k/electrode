"use strict";

const { expect } = require("chai");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");
const sinon = require("sinon");
const prepareAppDir = require("../../src/prep-app-dir");

describe("prep-app-dir", function () {
  const saveCwd = process.cwd();
  const saveArgv = process.argv;
  let tmpDir;
  let logs;
  let exitCodes;

  beforeEach(() => {
    logs = [];
    exitCodes = [];
    tmpDir = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-prep-")));
    process.chdir(tmpDir);
    sinon.stub(console, "log").callsFake(msg => logs.push(msg));
    sinon.stub(process, "exit").callsFake(code => {
      exitCodes.push(code);
      throw new Error("process.exit");
    });
  });

  afterEach(() => {
    sinon.restore();
    process.argv = saveArgv;
    process.chdir(saveCwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const expectExit = async () => {
    let error;
    try {
      await prepareAppDir();
    } catch (err) {
      error = err;
    }
    expect(error, "expected prepareAppDir to call process.exit").to.exist;
    expect(error.message).to.equal("process.exit");
  };

  const setArgv = dirName => {
    process.argv = [saveArgv[0], saveArgv[1]].concat(dirName === undefined ? [] : [dirName]);
  };

  it("should show usage and exit when no app directory is given", async () => {
    setArgv(undefined);
    await expectExit();
    expect(exitCodes).to.deep.equal([1]);
    expect(logs.join("\n")).to.contain("Usage: @xarc/create-app <app-directory>");
  });

  it("should use the current directory name when app dir is '.'", async () => {
    setArgv(".");
    const dirName = await prepareAppDir();
    expect(dirName).to.equal(Path.basename(tmpDir));
    expect(process.cwd()).to.equal(tmpDir);
    expect(logs.join("\n")).to.contain(`Using current directory '${dirName}'`);
  });

  it("should create the app directory and chdir into it", async () => {
    setArgv("my-app");
    const dirName = await prepareAppDir();
    expect(dirName).to.equal("my-app");
    expect(process.cwd()).to.equal(Path.join(tmpDir, "my-app"));
  });

  it("should chdir into an existing app directory", async () => {
    Fs.mkdirSync(Path.join(tmpDir, "existing-app"));
    setArgv("existing-app");
    const dirName = await prepareAppDir();
    expect(dirName).to.equal("existing-app");
    expect(process.cwd()).to.equal(Path.join(tmpDir, "existing-app"));
  });

  it("should exit when the app directory can't be created", async () => {
    setArgv(Path.join("no-such-parent", "my-app"));
    await expectExit();
    expect(exitCodes).to.deep.equal([1]);
    expect(logs.join("\n")).to.contain("Failed to create app directory");
  });
});
