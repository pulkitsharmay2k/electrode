"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const Path = require("path");
const Fs = require("opfs");
const prepareAppDir = require("../../src/prep-app-dir");

describe("prep-app-dir", function () {
  let sandbox;
  let stubExit;
  let stubChdir;
  let stubMkdir;
  let messages;
  const saveArgv2 = process.argv[2];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    messages = [];
    sandbox.stub(console, "log").callsFake((...args) => messages.push(args.join(" ")));
    stubExit = sandbox.stub(process, "exit");
    stubChdir = sandbox.stub(process, "chdir");
    stubMkdir = sandbox.stub(Fs, "mkdir").resolves();
  });

  afterEach(() => {
    sandbox.restore();
    process.argv[2] = saveArgv2;
  });

  it("should show usage and exit when no app dir is given", async () => {
    process.argv[2] = undefined;

    await prepareAppDir();

    expect(stubExit).to.have.been.calledWith(1);
    expect(messages.join("\n")).to.contain("Usage: @xarc/create-app <app-directory>");
  });

  it("should use current directory when app dir is '.'", async () => {
    process.argv[2] = ".";

    const dirName = await prepareAppDir();

    expect(dirName).to.equal(Path.basename(process.cwd()));
    expect(stubMkdir).to.not.have.been.called;
    expect(stubChdir).to.not.have.been.called;
    expect(messages.join("\n")).to.contain("Using current directory");
  });

  it("should create the app dir and chdir into it", async () => {
    process.argv[2] = "my-new-app";

    const dirName = await prepareAppDir();

    expect(dirName).to.equal("my-new-app");
    expect(stubMkdir).to.have.been.calledWith("my-new-app");
    expect(stubChdir).to.have.been.calledWith("my-new-app");
    expect(stubExit).to.not.have.been.called;
  });

  it("should continue when the app dir already exists", async () => {
    process.argv[2] = "existing-app";
    const err = new Error("exist");
    err.code = "EEXIST";
    stubMkdir.rejects(err);

    const dirName = await prepareAppDir();

    expect(dirName).to.equal("existing-app");
    expect(stubChdir).to.have.been.calledWith("existing-app");
    expect(stubExit).to.not.have.been.called;
  });

  it("should exit when creating the app dir failed", async () => {
    process.argv[2] = "bad-app";
    const err = new Error("no access");
    err.code = "EACCES";
    stubMkdir.rejects(err);

    await prepareAppDir();

    expect(stubExit).to.have.been.calledWith(1);
    expect(messages.join("\n")).to.contain("Failed to create app directory 'bad-app'");
  });
});
