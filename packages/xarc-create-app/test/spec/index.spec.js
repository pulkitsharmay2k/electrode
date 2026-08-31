"use strict";

const { expect } = require("chai");
const { execFileSync } = require("child_process");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");

describe("index", function () {
  this.timeout(30000);

  let tmpDir;

  beforeEach(() => {
    tmpDir = Fs.realpathSync(Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-create-app-index-")));
  });

  afterEach(() => {
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create the app when the module is loaded", () => {
    const indexJs = Path.join(__dirname, "../../src/index.js");

    const output = execFileSync(process.execPath, [indexJs, "my-app"], {
      cwd: tmpDir,
      encoding: "utf8",
    });

    expect(output).to.contain("Created react/node webapp in directory 'my-app'");
    expect(Fs.existsSync(Path.join(tmpDir, "my-app", "package.json"))).to.equal(true);
  });

  it("should show usage and fail when no app directory is given", () => {
    const indexJs = Path.join(__dirname, "../../src/index.js");
    let error;

    try {
      execFileSync(process.execPath, [indexJs], { cwd: tmpDir, encoding: "utf8", stdio: "pipe" });
    } catch (err) {
      error = err;
    }

    expect(error, "expected create-app to exit with an error").to.exist;
    expect(error.status).to.equal(1);
    expect(error.stdout).to.contain("Usage: @xarc/create-app <app-directory>");
  });
});
