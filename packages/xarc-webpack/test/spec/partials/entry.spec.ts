/* eslint-env mocha */
/* eslint-disable max-nested-callbacks, @typescript-eslint/no-var-requires */
const { expect } = require("chai");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");

/**
 * load the partial from the typescript sources so it gets instrumented for coverage,
 * falling back to the compiled output on node versions whose native typescript loader
 * can't require src/partials/entry.ts from this commonjs spec
 */
function loadEntryModules() {
  for (const base of ["../../../src", "../../../lib"]) {
    try {
      const mod = require(`${base}/partials/entry`);
      const makeEntry = mod.default || mod;
      if (typeof makeEntry !== "function") continue;
      return {
        makeEntry,
        loadXarcOptions: require(`${base}/util/load-xarc-options`).loadXarcOptions,
        jsonpCdn: require.resolve(`${base}/client/webpack5-jsonp-cdn`)
      };
    } catch (err) {
      continue;
    }
  }
  throw new Error("unable to load partials/entry from src or lib");
}

const { makeEntry: makeEntryPartialFn, loadXarcOptions, jsonpCdn: JSONP_CDN } = loadEntryModules();

const DEV_HMR_DIR = ".__dev_hmr";
const PROD_DIR = ".__prod__";

type XarcOptions = {
  cwd?: string;
  AppMode?: any;
  options?: any;
  webpack?: any;
  babel?: any;
  mfeOptions?: any;
};

/**
 * create a temp app dir with a .etmp/xarc-options.json for loadXarcOptions to read
 */
function makeApp(options: XarcOptions = {}) {
  const cwd = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-webpack-entry-"));
  const xarcOptions = {
    cwd,
    AppMode: { src: { dir: "src", client: "src/client" }, subApps: {} },
    options: {},
    webpack: {},
    babel: { envTargets: { default: {}, node: {} }, target: "default" },
    ...options
  };
  xarcOptions.cwd = cwd;
  Fs.mkdirSync(Path.join(cwd, ".etmp"));
  Fs.mkdirSync(Path.join(cwd, "src", "client"), { recursive: true });
  Fs.writeFileSync(
    Path.join(cwd, ".etmp", "xarc-options.json"),
    JSON.stringify(xarcOptions, null, 2)
  );
  return cwd;
}

/**
 * point the entry partial at an app dir - loadXarcOptions memoizes its result for the
 * life of the process, so swap the content of the memoized object in place
 */
function makeEntryPartial(cwd: string) {
  process.env.XARC_CWD = cwd;
  const cached = loadXarcOptions(cwd);
  const options = JSON.parse(Fs.readFileSync(Path.join(cwd, ".etmp", "xarc-options.json"), "utf8"));
  Object.keys(cached).forEach(key => delete cached[key]);
  Object.assign(cached, options);
  return makeEntryPartialFn();
}

function subApp(name: string, extra: any = {}) {
  return { name, entry: "subapp.jsx", subAppDir: `client/${name}`, ...extra };
}

describe("partials/entry", () => {
  const saveEnv = { ...process.env };
  const saveCwd = process.cwd();
  const tmpDirs: string[] = [];

  function app(options: XarcOptions = {}) {
    const cwd = makeApp(options);
    tmpDirs.push(cwd);
    return cwd;
  }

  beforeEach(() => {
    delete process.env.WEBPACK_DEV;
  });

  afterEach(() => {
    process.env = { ...saveEnv };
    process.chdir(saveCwd);
  });

  after(() => {
    tmpDirs.forEach(dir => Fs.rmSync(dir, { recursive: true, force: true }));
  });

  describe("entry.config.js", () => {
    it("uses a custom entry config when one exists in the client dir", () => {
      const cwd = app();
      Fs.writeFileSync(
        Path.join(cwd, "src", "client", "entry.config.js"),
        `module.exports = { main: "./main.js" };`
      );

      const partial = makeEntryPartial(cwd);

      expect(partial.context).to.equal(Path.join(cwd, "src", "client"));
      expect(partial.entry).to.deep.equal({ main: [JSONP_CDN, "./main.js"] });
    });
  });

  describe("app entry search", () => {
    it("uses app.js from the client dir when there're no subapps", () => {
      const cwd = app();
      Fs.writeFileSync(Path.join(cwd, "src", "client", "app.js"), "");

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal([JSONP_CDN, "./app.js"]);
      expect(partial.context).to.equal(Path.join(cwd, "src", "client"));
    });

    it("skips subapp search and switches context when app entry is under src dir", () => {
      const cwd = app({
        options: { subapp: false },
        AppMode: { src: { dir: "src", client: "src/client" }, subApps: { home: subApp("Home") } }
      });
      Fs.mkdirSync(Path.join(cwd, "src"), { recursive: true });
      Fs.writeFileSync(Path.join(cwd, "src", "app.tsx"), "");
      process.chdir(cwd);

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal([JSONP_CDN, "./app.tsx"]);
      expect(partial.context).to.equal(Path.join(cwd, "src"));
    });

    it("defaults to ./app.jsx when no app entry file is found", () => {
      const cwd = app();

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });
  });

  describe("babel polyfill", () => {
    it("injects core-js and regenerator when polyfill enabled with default targets", () => {
      const cwd = app({ webpack: { enableBabelPolyfill: true } });

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal([
        JSONP_CDN,
        "core-js",
        "regenerator-runtime/runtime",
        "./app.jsx"
      ]);
    });

    it("injects polyfill for multiple env targets only when building the default target", () => {
      const cwd = app({
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { default: {}, node: {}, modern: {} }, target: "default" }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.include("core-js");
    });

    it("skips polyfill for multiple env targets when building a non-default target", () => {
      const cwd = app({
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { default: {}, node: {}, modern: {} }, target: "modern" }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });
  });

  describe("subapp entries in dev mode", () => {
    beforeEach(() => {
      process.env.WEBPACK_DEV = "true";
    });

    it("generates a HMR entry file with reducer HMR code for a subapp", () => {
      const cwd = app({
        AppMode: {
          src: { dir: "src", client: "src/client" },
          subApps: { home: subApp("Home", { reducers: true }) }
        }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.context).to.equal(Path.join(cwd, "src"));
      expect(partial.entry).to.deep.equal({
        home: [`./${DEV_HMR_DIR}/hmr-client-home.js`]
      });

      const hmrDir = Path.join(cwd, "src", DEV_HMR_DIR);
      const content = Fs.readFileSync(Path.join(hmrDir, "hmr-client-home.js"), "utf8");
      expect(content).to.contain("// Do not modify - electrode auto-generated.");
      expect(content).to.contain(`import subApp from "../client/Home/subapp.jsx";`);
      expect(content).to.contain(`module.hot.accept("../client/Home/subapp.jsx"`);
      expect(content).to.contain(`hotReloadSubApp`);
      expect(content).to.contain(`import("../client/Home/reducers")`);
      expect(content).to.contain(`store.replaceReducer(newReducer, subApp)`);

      const gitIgnore = Fs.readFileSync(Path.join(hmrDir, ".gitignore"), "utf8");
      expect(gitIgnore).to.contain("Please don't commit this");
    });

    it("generates a standalone MFE HMR entry that dynamically imports the subapp", () => {
      const cwd = app({
        mfeOptions: { MFE_STANDALONE_ENABLED: true },
        AppMode: {
          src: { dir: "src", client: "src/client" },
          subApps: { home: subApp("Home") }
        }
      });

      makeEntryPartial(cwd);

      const content = Fs.readFileSync(
        Path.join(cwd, "src", DEV_HMR_DIR, "hmr-client-home.js"),
        "utf8"
      );
      expect(content).to.contain(`webpackChunkName: "subapp.jsx"`);
      expect(content).to.contain(`import(/* webpackChunkName: "subapp.jsx" */ "../client/Home/subapp.jsx")`);
      expect(content).to.contain(`window.xarcV1.getSubApp(info.name)`);
      expect(content).to.not.contain("replaceReducer");
    });

    it("uses the subapp's module id directly when the manifest is a module", () => {
      const cwd = app({
        AppMode: {
          src: { dir: "src", client: "src/client" },
          subApps: {
            home: subApp("Home", { module: true, entry: "@my/home", reducers: "@my/home/reducers" })
          }
        }
      });

      makeEntryPartial(cwd);

      const content = Fs.readFileSync(
        Path.join(cwd, "src", DEV_HMR_DIR, "hmr-client-home.js"),
        "utf8"
      );
      expect(content).to.contain(`import subApp from "@my/home";`);
      expect(content).to.contain(`import("@my/home/reducers")`);
    });

    it("returns the subapp file directly when it self accepts HMR", () => {
      const cwd = app({
        AppMode: {
          src: { dir: "src", client: "src/client" },
          subApps: { home: subApp("Home", { hmrSelfAccept: true }) }
        }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal({ home: ["./client/Home/subapp.jsx"] });
      expect(Fs.existsSync(Path.join(cwd, "src", DEV_HMR_DIR, "hmr-client-home.js"))).to.equal(
        false
      );
    });

    it("returns the module id directly when a module subapp self accepts HMR", () => {
      const cwd = app({
        AppMode: {
          src: { dir: "src", client: "src/client" },
          subApps: {
            home: subApp("Home", { module: true, entry: "@my/home", hmrSelfAccept: true })
          }
        }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal({ home: ["@my/home"] });
    });
  });

  describe("subapp entries in production mode", () => {
    it("generates a prod entry file that requires the subapp", () => {
      const cwd = app({
        AppMode: {
          src: { dir: "src", client: "src/client" },
          subApps: { home: subApp("Home") }
        }
      });

      const partial = makeEntryPartial(cwd);

      expect(partial.entry).to.deep.equal({
        home: [JSONP_CDN, `./${PROD_DIR}/prod-client-home.js`]
      });

      const content = Fs.readFileSync(
        Path.join(cwd, "src", PROD_DIR, "prod-client-home.js"),
        "utf8"
      );
      expect(content).to.contain(`const subApp = require("client/Home/subapp.jsx");`);
      expect(content).to.contain("export default subApp;");
    });

    it("generates a standalone MFE prod entry with a bootstrap chunk", () => {
      const cwd = app({
        mfeOptions: { MFE_STANDALONE_ENABLED: true },
        AppMode: {
          src: { dir: "src", client: "src/client" },
          subApps: { home: subApp("Home", { module: true, entry: "@my/home" }) }
        }
      });

      makeEntryPartial(cwd);

      const content = Fs.readFileSync(
        Path.join(cwd, "src", PROD_DIR, "prod-client-home.js"),
        "utf8"
      );
      expect(content).to.contain(`webpackChunkName: "home~.bootstrap"`);
      expect(content).to.contain(`import(/* webpackChunkName: "home~.bootstrap" */ "@my/home")`);
    });
  });
});
