"use strict";

const Fs = require("fs");
const Os = require("os");
const Path = require("path");

describe("index", function () {
  this.timeout(10000);

  let saveCwd;
  let saveArgv;
  let tmpDir;
  let consoleStub;

  beforeEach(() => {
    saveCwd = process.cwd();
    saveArgv = process.argv;
    tmpDir = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-")));
    process.chdir(tmpDir);
    consoleStub = sinon.stub(console, "log");
  });

  afterEach(() => {
    consoleStub.restore();
    process.argv = saveArgv;
    process.chdir(saveCwd);
    Fs.rmSync(tmpDir, { recursive: true, force: true });
    delete require.cache[require.resolve("../../src/index")];
  });

  it("should create an app when required", async () => {
    process.argv = ["node", "create-app", "my-app"];

    require("../../src/index");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(Fs.existsSync(Path.join(tmpDir, "my-app", "package.json"))).to.equal(true);
  });
});
