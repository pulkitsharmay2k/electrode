/* eslint-env mocha */
/* eslint-disable max-nested-callbacks, @typescript-eslint/no-var-requires */
import { expect } from "chai";
import * as sinon from "sinon";
import * as Fs from "fs";
import * as Os from "os";
import * as Path from "path";
import { logger } from "@xarc/dev-base";

import * as loadXarcOptionsMod from "../../src/util/load-xarc-options";

const makeEntryPartial = require("../../src/partials/entry");

const DEV_HMR_DIR = ".__dev_hmr";
const PROD_DIR = ".__prod__";

type Manifest = {
  name: string;
  entry: string;
  subAppDir: string;
  module?: string;
  reducers?: string;
  hmrSelfAccept?: boolean;
};

describe("partials/entry", () => {
  let sandbox: sinon.SinonSandbox;
  let cwd: string;
  const srcDir = "src";
  const clientDir = "src/client";
  const saveWebpackDev = process.env.WEBPACK_DEV;

  const makeOptions = (options: any = {}) => {
    return {
      cwd,
      AppMode: {
        src: { dir: srcDir, client: clientDir },
        subApps: options.subApps
      },
      options: { subapp: options.subapp },
      webpack: { enableBabelPolyfill: options.enableBabelPolyfill },
      babel: {
        envTargets: options.envTargets || { default: {}, node: {} },
        target: options.babelTarget
      },
      mfeOptions: options.mfeOptions
    };
  };

  const invoke = (options: any = {}) => {
    sandbox.stub(loadXarcOptionsMod, "loadXarcOptions").returns(makeOptions(options));
    return makeEntryPartial();
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, "info");
    sandbox.stub(logger, "error");
    cwd = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-webpack-entry-"));
    Fs.mkdirSync(Path.join(cwd, clientDir), { recursive: true });
    delete process.env.WEBPACK_DEV;
  });

  afterEach(() => {
    sandbox.restore();
    Fs.rmSync(cwd, { recursive: true, force: true });
    if (saveWebpackDev === undefined) {
      delete process.env.WEBPACK_DEV;
    } else {
      process.env.WEBPACK_DEV = saveWebpackDev;
    }
  });

  describe("makeEntryPartial", () => {
    it("sets webpack context to the app's client dir", () => {
      const partial = invoke();
      expect(partial.context).to.equal(Path.resolve(cwd, clientDir));
    });

    it("defaults entry to ./app.jsx when no app entry file exists", () => {
      const partial = invoke();
      expect(partial.entry).to.be.an("array");
      expect(partial.entry[partial.entry.length - 1]).to.equal("./app.jsx");
    });

    it("uses an app entry file found under the client context", () => {
      Fs.writeFileSync(Path.join(cwd, clientDir, "app.tsx"), "");
      const partial = invoke();
      expect(partial.entry).to.include("./app.tsx");
    });

    it("injects the jsonp cdn module for production builds", () => {
      const partial = invoke();
      expect(partial.entry[0]).to.match(/webpack5-jsonp-cdn/);
    });

    it("does not inject the jsonp cdn module in webpack dev mode", () => {
      process.env.WEBPACK_DEV = "true";
      const partial = invoke();
      expect(partial.entry).to.deep.equal(["./app.jsx"]);
    });
  });

  describe("polyfill injection", () => {
    it("injects core-js and regenerator when polyfill is enabled with a single target", () => {
      const partial = invoke({
        enableBabelPolyfill: true,
        envTargets: { default: {}, node: {} }
      });
      expect(partial.entry).to.include("core-js");
      expect(partial.entry).to.include("regenerator-runtime/runtime");
    });

    it("injects polyfill for multiple targets only when building the default target", () => {
      const partial = invoke({
        enableBabelPolyfill: true,
        envTargets: { default: {}, node: {}, es5: {} },
        babelTarget: "default"
      });
      expect(partial.entry).to.include("core-js");
    });

    it("skips polyfill for multiple targets when not building the default target", () => {
      const partial = invoke({
        enableBabelPolyfill: true,
        envTargets: { default: {}, node: {}, es5: {} },
        babelTarget: "es5"
      });
      expect(partial.entry).to.not.include("core-js");
    });

    it("skips polyfill when it's not enabled", () => {
      const partial = invoke({ enableBabelPolyfill: false });
      expect(partial.entry).to.not.include("core-js");
    });
  });

  describe("entry.config.js", () => {
    it("uses the custom entry config when it exists", () => {
      Fs.writeFileSync(
        Path.join(cwd, clientDir, "entry.config.js"),
        `module.exports = { foo: "./foo.js" };\n`
      );
      const partial = invoke();
      expect(partial.entry.foo).to.be.an("array");
      expect(partial.entry.foo).to.include("./foo.js");
    });

    it("exits the process when the custom entry config fails to load", () => {
      Fs.writeFileSync(
        Path.join(cwd, clientDir, "entry.config.js"),
        `throw new Error("bad entry config");\n`
      );
      const exit = sandbox.stub(process, "exit");
      invoke();
      expect(exit).to.have.been.calledWith(1);
    });
  });

  describe("subapps", () => {
    const subApp = (over: Partial<Manifest> = {}): Manifest => {
      return Object.assign(
        { name: "Home", entry: "entry.js", subAppDir: "client/subapps/home" },
        over
      );
    };

    it("skips subapp search when subapp is turned off", () => {
      const partial = invoke({ subapp: false, subApps: { home: subApp() } });
      expect(partial.entry).to.include("./app.jsx");
    });

    it("generates a prod entry file for each subapp in production mode", () => {
      const partial = invoke({ subApps: { home: subApp() } });
      const prodEntry = `prod-client-subapps-home.js`;
      expect(partial.entry.home).to.include(`./${PROD_DIR}/${prodEntry}`);
      const content = Fs.readFileSync(Path.join(cwd, srcDir, PROD_DIR, prodEntry), "utf-8");
      expect(content).to.contain(`require("client/subapps/home/entry.js")`);
      expect(content).to.contain("electrode auto-generated");
      expect(content).to.not.contain("webpackChunkName");
    });

    it("generates a dynamic import prod entry when MFE standalone is enabled", () => {
      invoke({
        subApps: { home: subApp() },
        mfeOptions: { MFE_STANDALONE_ENABLED: true }
      });
      const content = Fs.readFileSync(
        Path.join(cwd, srcDir, PROD_DIR, "prod-client-subapps-home.js"),
        "utf-8"
      );
      expect(content).to.contain(`webpackChunkName: "home~.bootstrap"`);
      expect(content).to.contain(`import(`);
    });

    it("uses the manifest module as the request for module subapps", () => {
      invoke({ subApps: { home: subApp({ module: "@my/subapp", entry: "@my/subapp/entry" }) } });
      const content = Fs.readFileSync(
        Path.join(cwd, srcDir, PROD_DIR, "prod-client-subapps-home.js"),
        "utf-8"
      );
      expect(content).to.contain(`require("@my/subapp/entry")`);
    });

    it("generates an hmr entry file and gitignore in dev mode", () => {
      process.env.WEBPACK_DEV = "true";
      const partial = invoke({ subApps: { home: subApp() } });
      const hmrEntry = "hmr-client-subapps-home.js";
      expect(partial.entry.home).to.deep.equal([`./${DEV_HMR_DIR}/${hmrEntry}`]);
      const hmrDir = Path.join(cwd, srcDir, DEV_HMR_DIR);
      expect(Fs.readFileSync(Path.join(hmrDir, ".gitignore"), "utf-8")).to.contain(
        "Please don't commit this"
      );
      const content = Fs.readFileSync(Path.join(hmrDir, hmrEntry), "utf-8");
      expect(content).to.contain(`import subApp from "../client/subapps/home/entry.js"`);
      expect(content).to.contain("hotReloadSubApp");
      expect(content).to.not.contain("subapp-redux");
    });

    it("keeps an existing gitignore in the hmr dir", () => {
      process.env.WEBPACK_DEV = "true";
      const hmrDir = Path.join(cwd, srcDir, DEV_HMR_DIR);
      Fs.mkdirSync(hmrDir, { recursive: true });
      Fs.writeFileSync(Path.join(hmrDir, ".gitignore"), "existing");
      invoke({ subApps: { home: subApp() } });
      expect(Fs.readFileSync(Path.join(hmrDir, ".gitignore"), "utf-8")).to.equal("existing");
    });

    it("generates redux reducer hmr code when the subapp has reducers", () => {
      process.env.WEBPACK_DEV = "true";
      invoke({ subApps: { home: subApp({ reducers: true as any }) } });
      const content = Fs.readFileSync(
        Path.join(cwd, srcDir, DEV_HMR_DIR, "hmr-client-subapps-home.js"),
        "utf-8"
      );
      expect(content).to.contain(`import("subapp-redux")`);
      expect(content).to.contain(`import("../client/subapps/home/reducers")`);
    });

    it("uses the manifest reducers module for module subapps", () => {
      process.env.WEBPACK_DEV = "true";
      invoke({
        subApps: {
          home: subApp({
            module: "@my/subapp",
            entry: "@my/subapp/entry",
            reducers: "@my/subapp/reducers"
          })
        },
        mfeOptions: { MFE_STANDALONE_ENABLED: true }
      });
      const content = Fs.readFileSync(
        Path.join(cwd, srcDir, DEV_HMR_DIR, "hmr-client-subapps-home.js"),
        "utf-8"
      );
      expect(content).to.contain(`import("@my/subapp/reducers")`);
      expect(content).to.contain(`import(/* webpackChunkName: "@my-subapp-entry" */ "@my/subapp/entry")`);
    });

    it("generates a standalone hmr entry when MFE standalone is enabled", () => {
      process.env.WEBPACK_DEV = "true";
      invoke({
        subApps: { home: subApp() },
        mfeOptions: { MFE_STANDALONE_ENABLED: true }
      });
      const content = Fs.readFileSync(
        Path.join(cwd, srcDir, DEV_HMR_DIR, "hmr-client-subapps-home.js"),
        "utf-8"
      );
      expect(content).to.contain(`webpackChunkName: "entry.js"`);
      expect(content).to.contain("module.hot.accept");
      expect(content).to.contain("window.xarcV1.getSubApp");
    });

    it("returns the subapp request directly when it self accepts hmr", () => {
      process.env.WEBPACK_DEV = "true";
      const partial = invoke({ subApps: { home: subApp({ hmrSelfAccept: true }) } });
      expect(partial.entry.home).to.deep.equal(["./client/subapps/home/entry.js"]);
      expect(Fs.existsSync(Path.join(cwd, srcDir, DEV_HMR_DIR, "hmr-client-subapps-home.js"))).to.equal(
        false
      );
    });

    it("returns the module name directly for self accepting module subapps", () => {
      process.env.WEBPACK_DEV = "true";
      const partial = invoke({
        subApps: {
          home: subApp({ hmrSelfAccept: true, module: "@my/subapp", entry: "@my/subapp/entry" })
        }
      });
      expect(partial.entry.home).to.deep.equal(["@my/subapp/entry"]);
    });

    it("sets webpack context to the app src dir when subapps are found", () => {
      const partial = invoke({ subApps: { home: subApp() } });
      expect(partial.context).to.equal(Path.resolve(cwd, srcDir));
    });
  });

  describe("app entry under src dir", () => {
    it("finds the app entry relative to the app src dir and updates the context", () => {
      const saveCwd = process.cwd();
      process.chdir(cwd);
      try {
        Fs.writeFileSync(Path.join(cwd, srcDir, "app.js"), "");
        const partial = invoke();
        expect(partial.entry).to.include("./app.js");
        expect(partial.context).to.equal(Path.join(cwd, srcDir));
      } finally {
        process.chdir(saveCwd);
      }
    });
  });
});
