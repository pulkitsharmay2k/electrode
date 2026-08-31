"use strict";

const Path = require("path");
const Fs = require("opfs");
const prepareAppDir = require("../../src/prep-app-dir");

describe("prep-app-dir", function () {
  let stubs;
  let logs;
  let argv;

  beforeEach(() => {
    logs = [];
    argv = process.argv;
    stubs = [
      sinon.stub(Fs, "readFile").resolves(JSON.stringify({ name: "@xarc/create-app" })),
      sinon.stub(Fs, "mkdir").resolves(),
      sinon.stub(process, "chdir"),
      sinon.stub(process, "exit"),
      sinon.stub(console, "log").callsFake((msg) => logs.push(msg)),
    ];
  });

  afterEach(() => {
    stubs.forEach((x) => x.restore());
    process.argv = argv;
  });

  const setAppDirArg = (dir) => {
    process.argv = [process.argv[0], process.argv[1], dir];
  };

  it("should show usage and exit when no app dir is given", async () => {
    process.argv = [process.argv[0], process.argv[1]];

    await prepareAppDir();

    expect(process.exit).to.have.been.calledWith(1);
    expect(logs.join("\n")).to.contain("Usage: @xarc/create-app <app-directory>");
    expect(Fs.readFile).to.have.been.calledWith(
      Path.join(__dirname, "../../src", "..", "package.json")
    );
  });

  it("should use current directory name when app dir is '.'", async () => {
    setAppDirArg(".");

    const dirName = Path.basename(process.cwd());
    expect(await prepareAppDir()).to.equal(dirName);
    expect(logs.join("\n")).to.contain(`Using current directory '${dirName}'`);
    expect(Fs.mkdir).to.have.not.been.called;
    expect(process.chdir).to.have.not.been.called;
  });

  it("should create the app dir and chdir into it", async () => {
    setAppDirArg("my-app");

    expect(await prepareAppDir()).to.equal("my-app");
    expect(Fs.mkdir).to.have.been.calledWith("my-app");
    expect(process.chdir).to.have.been.calledWith("my-app");
    expect(process.exit).to.have.not.been.called;
  });

  it("should continue when the app dir already exists", async () => {
    setAppDirArg("my-app");
    const err = new Error("exist");
    err.code = "EEXIST";
    Fs.mkdir.rejects(err);

    expect(await prepareAppDir()).to.equal("my-app");
    expect(process.chdir).to.have.been.calledWith("my-app");
    expect(process.exit).to.have.not.been.called;
  });

  it("should exit when creating the app dir fails", async () => {
    setAppDirArg("my-app");
    const err = new Error("denied");
    err.code = "EACCES";
    Fs.mkdir.rejects(err);

    await prepareAppDir();

    expect(logs.join("\n")).to.contain("Failed to create app directory 'my-app'");
    expect(process.exit).to.have.been.calledWith(1);
  });
});
