"use strict";

const Fs = require("opfs");
const { stubModule, freshRequire } = require("../stub-module");

const checkDirPath = require.resolve("../../src/check-dir");
const promptsPath = require.resolve("prompts");

describe("check-dir", function () {
  let promptsStub;
  let readdirStub;
  let restorePrompts;
  let checkDir;

  beforeEach(() => {
    promptsStub = sinon.stub().resolves({ overwrite: true });
    readdirStub = sinon.stub(Fs, "readdir");
    restorePrompts = stubModule(promptsPath, promptsStub);
    checkDir = freshRequire(checkDirPath);
  });

  afterEach(() => {
    restorePrompts();
    readdirStub.restore();
  });

  it("should return true without prompting when dir is empty", async () => {
    readdirStub.resolves([]);

    expect(await checkDir("my-app")).to.equal(true);
    expect(promptsStub).to.have.not.been.called;
    expect(readdirStub).to.have.been.calledWith(process.cwd());
  });

  it("should prompt to confirm overwrite when dir is not empty", async () => {
    readdirStub.resolves(["package.json"]);

    expect(await checkDir("my-app")).to.equal(true);
    expect(promptsStub).to.have.been.calledOnce;
    const question = promptsStub.firstCall.args[0];
    expect(question.type).to.equal("confirm");
    expect(question.name).to.equal("overwrite");
    expect(question.message).to.contain("my-app");
  });

  it("should return false when user declines to overwrite", async () => {
    readdirStub.resolves(["package.json"]);
    promptsStub.resolves({ overwrite: false });

    expect(await checkDir("my-app")).to.equal(false);
  });
});
