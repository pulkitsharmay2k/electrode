/* eslint-env mocha */
/* eslint-disable max-nested-callbacks, @typescript-eslint/no-var-requires */

import { expect } from "chai";
import * as sinon from "sinon";
import * as Fs from "fs";
import * as Os from "os";
import * as Path from "path";
import { logger } from "@xarc/dev-base";

const loadXarcOptionsMod = require("../../../src/util/load-xarc-options");
const makeEntryPartial = require("../../../src/partials/entry");

const DEV_HMR_DIR = ".__dev_hmr";
const PROD_DIR = ".__prod__";

type Manifest = {
  name: string;
  entry: string;
  subAppDir?: string;
  module?: boolean;
  reducers?: string | boolean;
  hmrSelfAccept?: boolean;
};

describe("partials/entry makeEntryPartial", () => {
  let sandbox: sinon.SinonSandbox;
  let cwd: string;
  let savedCwd: string;
  let savedWebpackDev: string;

  const makeOptions = (overrides: any = {}) => {
    return Object.assign(
      {
        cwd,
        AppMode: Object.assign(
          {
            src: { dir: "src", client: "src/client" },
            subApps: {}
          },
          overrides.AppMode
        ),
        options: Object.assign({}, overrides.options),
        webpack: Object.assign({}, overrides.webpack),
        babel: Object.assign({ envTargets: { default: {}, node: {} } }, overrides.babel),
        mfeOptions: overrides.mfeOptions
      },
      overrides.top
    );
  };

  const stubOptions = (overrides: any = {}) => {
    const xarcOptions = makeOptions(overrides);
    sandbox.stub(loadXarcOptionsMod, "loadXarcOptions").returns(xarcOptions);
    return xarcOptions;
  };

  const subAppOptions = (manifests: Manifest[], overrides: any = {}) => {
    const subApps = manifests.reduce((acc, ma) => {
      acc[ma.name] = ma;
      return acc;
    }, {});
    return stubOptions(Object.assign({}, overrides, { AppMode: { subApps } }));
  };

  const readEntryFile = (dir: string, file: string) =>
    Fs.readFileSync(Path.join(cwd, "src", dir, file), "utf-8");

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, "info");
    savedCwd = process.cwd();
    savedWebpackDev = process.env.WEBPACK_DEV;
    delete process.env.WEBPACK_DEV;
    cwd = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-webpack-entry-"));
    Fs.mkdirSync(Path.join(cwd, "src", "client"), { recursive: true });
  });

  afterEach(() => {
    sandbox.restore();
    process.chdir(savedCwd);
    if (savedWebpackDev === undefined) {
      delete process.env.WEBPACK_DEV;
    } else {
      process.env.WEBPACK_DEV = savedWebpackDev;
    }
    Fs.rmSync(cwd, { recursive: true, force: true });
  });

  describe("single app entry", () => {
    it("assumes ./app.jsx and injects the jsonp cdn module when no entry is found", () => {
      stubOptions();

      const partial = makeEntryPartial();

      expect(partial.context).to.equal(Path.join(cwd, "src", "client"));
      expect(partial.entry).to.have.lengthOf(2);
      expect(partial.entry[0]).to.include(Path.join("client", "webpack5-jsonp-cdn"));
      expect(partial.entry[1]).to.equal("./app.jsx");
    });

    it("does not inject the jsonp cdn module in webpack dev mode", () => {
      process.env.WEBPACK_DEV = "true";
      stubOptions();

      const partial = makeEntryPartial();

      expect(partial.entry).to.deep.equal(["./app.jsx"]);
    });

    it("uses an existing app file from the webpack context", () => {
      Fs.writeFileSync(Path.join(cwd, "src", "client", "app.tsx"), "");
      stubOptions();

      const partial = makeEntryPartial();

      expect(partial.entry[1]).to.equal("./app.tsx");
      expect(partial.context).to.equal(Path.join(cwd, "src", "client"));
    });

    it("sets context to AppMode src dir when the app file is only found there", () => {
      Fs.writeFileSync(Path.join(cwd, "src", "app.js"), "");
      stubOptions();
      process.chdir(cwd);

      const partial = makeEntryPartial();

      expect(partial.entry[1]).to.equal("./app.js");
      expect(partial.context).to.equal(Path.join(cwd, "src"));
    });
  });

  describe("entry.config.js", () => {
    it("uses the custom entry config when it exists", () => {
      Fs.writeFileSync(
        Path.join(cwd, "src", "client", "entry.config.js"),
        `module.exports = { home: "./home.js" };`
      );
      stubOptions();

      const partial = makeEntryPartial();

      expect(partial.entry.home).to.have.lengthOf(2);
      expect(partial.entry.home[1]).to.equal("./home.js");
    });

    it("logs the error and exits when the custom entry config fails to load", () => {
      Fs.writeFileSync(
        Path.join(cwd, "src", "client", "entry.config.js"),
        `throw new Error("bad entry config");`
      );
      const error = sandbox.stub(logger, "error");
      const exit = sandbox.stub(process, "exit");
      stubOptions();

      makeEntryPartial();

      expect(exit).to.have.been.calledWith(1);
      expect(error.firstCall.args[0]).to.include("entry.config.js");
    });
  });

  describe("subapps", () => {
    const home: Manifest = { name: "Home", entry: "index.js", subAppDir: "client/home" };

    it("skips subapps when the subapp option is turned off", () => {
      subAppOptions([home], { options: { subapp: false } });

      const partial = makeEntryPartial();

      expect(partial.entry[1]).to.equal("./app.jsx");
    });

    it("generates a prod entry file for each subapp", () => {
      subAppOptions([home]);

      const partial = makeEntryPartial();

      expect(partial.entry.home[1]).to.equal(`./${PROD_DIR}/prod-client-home.js`);
      const content = readEntryFile(PROD_DIR, "prod-client-home.js");
      expect(content).to.include(`const subApp = require("client/home/index.js");`);
      expect(content).to.include("export default subApp;");
    });

    it("generates a prod entry file with an async import when standalone MFE is enabled", () => {
      subAppOptions([home], { mfeOptions: { MFE_STANDALONE_ENABLED: true } });

      makeEntryPartial();

      const content = readEntryFile(PROD_DIR, "prod-client-home.js");
      expect(content).to.include(`webpackChunkName: "home~.bootstrap"`);
      expect(content).to.include(`import(/* webpackChunkName: "home~.bootstrap" */ "client/home/index.js")`);
    });

    it("uses the manifest entry directly for a module subapp", () => {
      subAppOptions([{ name: "Mod", entry: "@my/subapp", subAppDir: "client/mod", module: true }]);

      makeEntryPartial();

      const content = readEntryFile(PROD_DIR, "prod-client-mod.js");
      expect(content).to.include(`require("@my/subapp")`);
    });

    describe("in webpack dev mode", () => {
      beforeEach(() => {
        process.env.WEBPACK_DEV = "true";
      });

      it("generates an hmr entry file and a gitignore for the hmr dir", () => {
        subAppOptions([home]);

        const partial = makeEntryPartial();

        expect(partial.entry.home).to.deep.equal([`./${DEV_HMR_DIR}/hmr-client-home.js`]);
        const content = readEntryFile(DEV_HMR_DIR, "hmr-client-home.js");
        expect(content).to.include(`import subApp from "../client/home/index.js";`);
        expect(content).to.include(`module.hot.accept("../client/home/index.js"`);
        expect(content).to.include(`hotReloadSubApp`);
        expect(readEntryFile(DEV_HMR_DIR, ".gitignore")).to.include("Please don't commit this");
      });

      it("generates an hmr entry file with the standalone MFE import and chunk name", () => {
        subAppOptions([home], { mfeOptions: { MFE_STANDALONE_ENABLED: true } });

        makeEntryPartial();

        const content = readEntryFile(DEV_HMR_DIR, "hmr-client-home.js");
        expect(content).to.include(`webpackChunkName: "index.js"`);
        expect(content).to.include("window.xarcV1.getSubApp(info.name)");
        expect(content).to.not.include("subapp-redux");
      });

      it("adds the redux reducers hmr code when the subapp has reducers", () => {
        subAppOptions([Object.assign({ reducers: true }, home)]);

        makeEntryPartial();

        const content = readEntryFile(DEV_HMR_DIR, "hmr-client-home.js");
        expect(content).to.include(`import("../client/home/reducers")`);
        expect(content).to.include("store.replaceReducer(newReducer, subApp);");
      });

      it("adds the redux reducers hmr code inside the standalone MFE import", () => {
        subAppOptions([Object.assign({ reducers: true }, home)], {
          mfeOptions: { MFE_STANDALONE_ENABLED: true }
        });

        makeEntryPartial();

        const content = readEntryFile(DEV_HMR_DIR, "hmr-client-home.js");
        expect(content).to.include(`import(/* webpackChunkName: "index.js" */`);
        expect(content).to.include(`import("../client/home/reducers")`);
      });

      it("uses the subapp module reducers path for a module subapp with reducers", () => {
        subAppOptions([
          {
            name: "Mod",
            entry: "@my/subapp",
            subAppDir: "client/mod",
            module: true,
            reducers: "@my/subapp/reducers"
          }
        ]);

        makeEntryPartial();

        const content = readEntryFile(DEV_HMR_DIR, "hmr-client-mod.js");
        expect(content).to.include(`import("@my/subapp/reducers")`);
        expect(content).to.include(`import subApp from "@my/subapp";`);
      });

      it("does not generate an hmr entry file when the subapp self accepts hmr", () => {
        subAppOptions([Object.assign({ hmrSelfAccept: true }, home)]);

        const partial = makeEntryPartial();

        expect(partial.entry.home).to.deep.equal(["./client/home/index.js"]);
        expect(Fs.existsSync(Path.join(cwd, "src", DEV_HMR_DIR, "hmr-client-home.js"))).to.equal(
          false
        );
      });

      it("uses the module name when a self accepting subapp is a module", () => {
        subAppOptions([
          {
            name: "Mod",
            entry: "@my/subapp",
            subAppDir: "client/mod",
            module: true,
            hmrSelfAccept: true
          }
        ]);

        const partial = makeEntryPartial();

        expect(partial.entry.mod).to.deep.equal(["@my/subapp"]);
      });
    });
  });

  describe("babel polyfill", () => {
    it("does not inject polyfills by default", () => {
      stubOptions();

      const partial = makeEntryPartial();

      expect(partial.entry).to.not.include("core-js");
    });

    it("injects polyfills when enabled and there is only the default node targets", () => {
      stubOptions({ webpack: { enableBabelPolyfill: true } });

      const partial = makeEntryPartial();

      expect(partial.entry).to.include("core-js");
      expect(partial.entry).to.include("regenerator-runtime/runtime");
    });

    it("injects polyfills for multiple env targets only when building the default target", () => {
      stubOptions({
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { default: {}, node: {}, es5: {} }, target: "default" }
      });

      const partial = makeEntryPartial();

      expect(partial.entry).to.include("core-js");
    });

    it("does not inject polyfills for multiple env targets when building another target", () => {
      stubOptions({
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { default: {}, node: {}, es5: {} }, target: "es5" }
      });

      const partial = makeEntryPartial();

      expect(partial.entry).to.not.include("core-js");
    });
  });
});
