/* eslint-env mocha */
/* eslint-disable @typescript-eslint/no-var-requires, max-nested-callbacks */
import { expect } from "chai";
import * as Fs from "fs";
import * as Os from "os";
import * as Path from "path";
import * as sinon from "sinon";
import { logger } from "@xarc/dev-base";

const SRC_DIR = Path.resolve(__dirname, "../../../src");
const ENTRY_MODULE = Path.join(SRC_DIR, "partials/entry");
const JSONP_CDN = require.resolve(Path.join(SRC_DIR, "client/webpack5-jsonp-cdn"));

type Manifest = {
  name: string;
  entry: string;
  subAppDir?: string;
  module?: boolean;
  reducers?: string | boolean;
  hmrSelfAccept?: boolean;
};

/**
 * entry.ts caches nothing itself, but load-xarc-options caches the options it
 * loads, so every test needs a fresh copy of the modules under src.
 */
function clearSrcModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(SRC_DIR + Path.sep)) {
      delete require.cache[key];
    }
  }
}

function makeFixture(options: any = {}, subApps: Record<string, Manifest> = {}) {
  const cwd = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-webpack-entry-"));
  const xarcOptions = Object.assign(
    {
      cwd,
      AppMode: {
        src: { dir: "src", client: "src/client" },
        subApps
      },
      options: { subapp: true },
      webpack: {},
      babel: { envTargets: { default: {}, node: {} }, target: "default" }
    },
    options
  );

  Fs.mkdirSync(Path.join(cwd, ".etmp"));
  Fs.mkdirSync(Path.join(cwd, "src/client"), { recursive: true });
  Fs.writeFileSync(
    Path.join(cwd, ".etmp/xarc-options.json"),
    JSON.stringify(xarcOptions, null, 2)
  );

  return cwd;
}

function makeEntryPartial(cwd: string) {
  process.env.XARC_CWD = cwd;
  clearSrcModuleCache();
  return require(ENTRY_MODULE)();
}

function readGenerated(cwd: string, dir: string, file: string) {
  return Fs.readFileSync(Path.join(cwd, "src", dir, file), "utf-8");
}

describe("partials/entry", () => {
  const saveEnv = { XARC_CWD: process.env.XARC_CWD, WEBPACK_DEV: process.env.WEBPACK_DEV };

  beforeEach(() => {
    delete process.env.WEBPACK_DEV;
    sinon.stub(logger, "info");
  });

  afterEach(() => {
    sinon.restore();
    clearSrcModuleCache();
    Object.keys(saveEnv).forEach(k => {
      if (saveEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = saveEnv[k];
      }
    });
  });

  describe("single app entry", () => {
    it("assumes ./app.jsx and sets context to src/client when no entry file exists", () => {
      const cwd = makeFixture({ options: { subapp: false } });
      const partial = makeEntryPartial(cwd);

      expect(partial.context).to.equal(Path.join(cwd, "src/client"));
      expect(partial.entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });

    it("uses the app entry file found under the webpack context", () => {
      const cwd = makeFixture({ options: { subapp: false } });
      Fs.writeFileSync(Path.join(cwd, "src/client/app.tsx"), "");

      expect(makeEntryPartial(cwd).entry).to.deep.equal([JSONP_CDN, "./app.tsx"]);
    });

    it("moves the context to AppMode.src.dir when the app entry is found there", () => {
      const cwd = makeFixture({ options: { subapp: false } });
      Fs.writeFileSync(Path.join(cwd, "src/app.js"), "");
      const saveCwd = process.cwd();
      process.chdir(cwd);

      try {
        const partial = makeEntryPartial(cwd);
        expect(partial.context).to.equal(Path.join(cwd, "src"));
        expect(partial.entry).to.deep.equal([JSONP_CDN, "./app.js"]);
      } finally {
        process.chdir(saveCwd);
      }
    });

    it("does not inject the jsonp cdn module in dev mode", () => {
      process.env.WEBPACK_DEV = "1";
      const cwd = makeFixture({ options: { subapp: false } });

      expect(makeEntryPartial(cwd).entry).to.deep.equal(["./app.jsx"]);
    });
  });

  describe("entry.config.js", () => {
    it("uses the entry exported by entry.config.js in the context dir", () => {
      const cwd = makeFixture();
      Fs.writeFileSync(
        Path.join(cwd, "src/client/entry.config.js"),
        `module.exports = { main: "./main.js" };`
      );

      expect(makeEntryPartial(cwd).entry).to.deep.equal({ main: [JSONP_CDN, "./main.js"] });
    });

    it("logs and exits when entry.config.js fails to load", () => {
      const cwd = makeFixture({ options: { subapp: false } });
      Fs.writeFileSync(Path.join(cwd, "src/client/entry.config.js"), `throw new Error("boom");`);
      const error = sinon.stub(logger, "error");
      const exit = sinon.stub(process, "exit");

      makeEntryPartial(cwd);

      expect(exit).to.have.been.calledWith(1);
      expect(error.firstCall.args[0]).to.contain("entry.config.js");
    });
  });

  describe("subapp entries", () => {
    it("falls back to the single app entry when there are no subapps", () => {
      const cwd = makeFixture();

      expect(makeEntryPartial(cwd).entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });

    it("generates a prod entry file for each subapp", () => {
      const cwd = makeFixture({}, {
        Home: { name: "Home", entry: "index.js", subAppDir: "client/subapps/home" }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.context).to.equal(Path.join(cwd, "src"));
      expect(partial.entry).to.deep.equal({
        home: [JSONP_CDN, "./.__prod__/prod-client-subapps-home.js"]
      });
      const content = readGenerated(cwd, ".__prod__", "prod-client-subapps-home.js");
      expect(content).to.contain(`require("client/subapps/home/index.js")`);
      expect(content).to.contain("export default subApp");
    });

    it("generates a prod entry with a dynamic import when MFE standalone is enabled", () => {
      const cwd = makeFixture(
        { mfeOptions: { MFE_STANDALONE_ENABLED: true } },
        { Home: { name: "Home", entry: "index.js", subAppDir: "client/subapps/home", module: true } }
      );

      makeEntryPartial(cwd);

      const content = readGenerated(cwd, ".__prod__", "prod-client-subapps-home.js");
      expect(content).to.contain(`webpackChunkName: "home~.bootstrap"`);
      expect(content).to.contain(`import(/* webpackChunkName: "home~.bootstrap" */ "index.js")`);
    });

    it("generates an hmr entry file and a .gitignore in dev mode", () => {
      process.env.WEBPACK_DEV = "1";
      const cwd = makeFixture({}, {
        Home: { name: "Home", entry: "index.js", subAppDir: "client/subapps/home" }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal({ home: ["./.__dev_hmr/hmr-client-subapps-home.js"] });
      const content = readGenerated(cwd, ".__dev_hmr", "hmr-client-subapps-home.js");
      expect(content).to.contain(`import subApp from "../client/subapps/home/index.js"`);
      expect(content).to.contain(`module.hot.accept("../client/subapps/home/index.js"`);
      expect(content).to.contain("hotReloadSubApp");
      expect(content).to.not.contain("subapp-redux");
      expect(Fs.readFileSync(Path.join(cwd, "src/.__dev_hmr/.gitignore"), "utf-8")).to.contain("*");
    });

    it("adds redux reducer hmr code when a subapp has reducers", () => {
      process.env.WEBPACK_DEV = "1";
      const cwd = makeFixture({}, {
        Home: {
          name: "Home",
          entry: "index.js",
          subAppDir: "client/subapps/home",
          reducers: true
        }
      });

      makeEntryPartial(cwd);

      const content = readGenerated(cwd, ".__dev_hmr", "hmr-client-subapps-home.js");
      expect(content).to.contain(`import("subapp-redux")`);
      expect(content).to.contain(`import("../client/subapps/home/reducers")`);
      expect(content).to.contain("store.replaceReducer(newReducer, subApp)");
    });

    it("generates a dynamic import hmr entry when MFE standalone is enabled", () => {
      process.env.WEBPACK_DEV = "1";
      const cwd = makeFixture(
        { mfeOptions: { MFE_STANDALONE_ENABLED: true } },
        {
          Home: {
            name: "Home",
            entry: "@my/home",
            subAppDir: "client/subapps/home",
            module: true,
            reducers: "@my/home/reducers"
          }
        }
      );

      makeEntryPartial(cwd);

      const content = readGenerated(cwd, ".__dev_hmr", "hmr-client-subapps-home.js");
      expect(content).to.contain(`webpackChunkName: "@my-home"`);
      expect(content).to.contain(
        `import(/* webpackChunkName: "@my-home" */ "@my/home").then(({ default: subApp })`
      );
      expect(content).to.contain(`import("@my/home/reducers")`);
      expect(content).to.contain("window.xarcV1.getSubApp(info.name)");
    });

    it("omits the reducer hmr code from a standalone hmr entry without reducers", () => {
      process.env.WEBPACK_DEV = "1";
      const cwd = makeFixture(
        { mfeOptions: { MFE_STANDALONE_ENABLED: true } },
        { Home: { name: "Home", entry: "index.js", subAppDir: "client/subapps/home" } }
      );

      makeEntryPartial(cwd);

      const content = readGenerated(cwd, ".__dev_hmr", "hmr-client-subapps-home.js");
      expect(content).to.contain(`import(/* webpackChunkName: "index.js" */`);
      expect(content).to.not.contain("subapp-redux");
    });

    it("uses the subapp module directly when it self accepts hmr", () => {
      process.env.WEBPACK_DEV = "1";
      const cwd = makeFixture({}, {
        Home: {
          name: "Home",
          entry: "index.js",
          subAppDir: "client/subapps/home",
          hmrSelfAccept: true
        },
        Nav: { name: "Nav", entry: "@my/nav", subAppDir: "client/subapps/nav", module: true, hmrSelfAccept: true }
      });

      expect(makeEntryPartial(cwd).entry).to.deep.equal({
        home: ["./client/subapps/home/index.js"],
        nav: ["@my/nav"]
      });
      expect(Fs.existsSync(Path.join(cwd, "src/.__dev_hmr/hmr-client-subapps-home.js"))).to.equal(
        false
      );
    });

    it("ignores subapps when the subapp option is turned off", () => {
      const cwd = makeFixture({ options: { subapp: false } }, {
        Home: { name: "Home", entry: "index.js", subAppDir: "client/subapps/home" }
      });

      expect(makeEntryPartial(cwd).entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });
  });

  describe("babel polyfill", () => {
    const polyfills = ["core-js", "regenerator-runtime/runtime"];

    it("does not inject polyfills when enableBabelPolyfill is off", () => {
      const cwd = makeFixture({ options: { subapp: false } });

      expect(makeEntryPartial(cwd).entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });

    it("injects polyfills when there is only the default env target", () => {
      const cwd = makeFixture({
        options: { subapp: false },
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { node: {}, default: {} }, target: "node" }
      });

      expect(makeEntryPartial(cwd).entry).to.deep.equal([JSONP_CDN, ...polyfills, "./app.jsx"]);
    });

    it("injects polyfills for the default target when there are multiple env targets", () => {
      const cwd = makeFixture({
        options: { subapp: false },
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { default: {}, node: {}, es5: {} }, target: "default" }
      });

      expect(makeEntryPartial(cwd).entry).to.deep.equal([JSONP_CDN, ...polyfills, "./app.jsx"]);
    });

    it("skips polyfills for a non default target when there are multiple env targets", () => {
      const cwd = makeFixture({
        options: { subapp: false },
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { default: {}, node: {}, es5: {} }, target: "es5" }
      });

      expect(makeEntryPartial(cwd).entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });
  });
});
