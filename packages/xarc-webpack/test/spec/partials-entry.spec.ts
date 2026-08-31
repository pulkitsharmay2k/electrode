/* eslint-env mocha */
/* eslint-disable max-nested-callbacks, @typescript-eslint/no-var-requires */
// no ESM syntax here: the spec must load as CommonJS so it can bust require.cache
const { expect } = require("chai");
const Fs = require("fs");
const Path = require("path");
const Os = require("os");

// node's native typescript loader hands specs a require() without a cache
const nodeRequire = require("module").createRequire(__filename);

const ENTRY_MODULE = Path.resolve(__dirname, "../../src/partials/entry.ts");
const LOAD_OPTIONS_MODULE = Path.resolve(__dirname, "../../src/util/load-xarc-options.ts");

/**
 * entry.ts only exports makeEntryPartial, and it reads its options from
 * <cwd>/.etmp/xarc-options.json, so each test sets up a temp app dir and
 * loads a fresh copy of the module (load-xarc-options caches its result).
 */
function loadMakeEntryPartial(appDir: string, options: any) {
  const etmp = Path.join(appDir, ".etmp");
  Fs.mkdirSync(etmp, { recursive: true });
  Fs.writeFileSync(Path.join(etmp, "xarc-options.json"), JSON.stringify(options));
  process.env.XARC_CWD = appDir;
  delete nodeRequire.cache[ENTRY_MODULE];
  delete nodeRequire.cache[LOAD_OPTIONS_MODULE];
  return nodeRequire(ENTRY_MODULE);
}

function makeAppDir() {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-webpack-entry-"));
  Fs.mkdirSync(Path.join(dir, "src/client"), { recursive: true });
  return dir;
}

function baseOptions(appDir: string, overrides: any = {}) {
  return Object.assign(
    {
      cwd: appDir,
      AppMode: {
        src: { dir: "src", client: "src/client" },
        subApps: {}
      },
      webpack: {},
      babel: { envTargets: { default: {}, node: {} }, target: "default" },
      options: {}
    },
    overrides
  );
}

const JSONP_CDN = nodeRequire.resolve("../../src/client/webpack5-jsonp-cdn.ts");

describe("partials/entry", () => {
  let appDir: string;
  const savedEnv = { XARC_CWD: process.env.XARC_CWD, WEBPACK_DEV: process.env.WEBPACK_DEV };

  beforeEach(() => {
    appDir = makeAppDir();
    delete process.env.WEBPACK_DEV;
  });

  afterEach(() => {
    Fs.rmSync(appDir, { recursive: true, force: true });
    for (const k of Object.keys(savedEnv)) {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    }
  });

  describe("makeEntryPartial with a custom entry.config.js", () => {
    it("uses the app's entry.config.js and injects the jsonp cdn module", () => {
      Fs.writeFileSync(
        Path.join(appDir, "src/client/entry.config.js"),
        `module.exports = { main: "./main.js" };\n`
      );
      const makeEntryPartial = loadMakeEntryPartial(appDir, baseOptions(appDir));

      const partial = makeEntryPartial();

      expect(partial.context).to.equal(Path.join(appDir, "src/client"));
      expect(partial.entry).to.deep.equal({ main: [JSONP_CDN, "./main.js"] });
    });
  });

  describe("makeEntryPartial with a single app entry", () => {
    it("finds app.js under the webpack context", () => {
      Fs.writeFileSync(Path.join(appDir, "src/client/app.js"), "");
      const makeEntryPartial = loadMakeEntryPartial(appDir, baseOptions(appDir));

      expect(makeEntryPartial().entry).to.deep.equal([JSONP_CDN, "./app.js"]);
    });

    it("prefers app.js over app.jsx and app.tsx", () => {
      for (const f of ["app.js", "app.jsx", "app.tsx"]) {
        Fs.writeFileSync(Path.join(appDir, "src/client", f), "");
      }
      const makeEntryPartial = loadMakeEntryPartial(appDir, baseOptions(appDir));

      expect(makeEntryPartial().entry).to.deep.equal([JSONP_CDN, "./app.js"]);
    });

    it("defaults to ./app.jsx when no app entry file exists", () => {
      const makeEntryPartial = loadMakeEntryPartial(appDir, baseOptions(appDir));

      expect(makeEntryPartial().entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });

    it("finds an app entry under AppMode.src.dir and moves the context there", () => {
      Fs.writeFileSync(Path.join(appDir, "src/app.jsx"), "");
      const makeEntryPartial = loadMakeEntryPartial(appDir, baseOptions(appDir));
      const savedCwd = process.cwd();

      let partial;
      try {
        process.chdir(appDir);
        partial = makeEntryPartial();
      } finally {
        process.chdir(savedCwd);
      }

      expect(partial.context).to.equal(Path.join(appDir, "src"));
      expect(partial.entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });

    it("skips subapp detection when options.subapp is false", () => {
      Fs.writeFileSync(Path.join(appDir, "src/client/app.tsx"), "");
      const options = baseOptions(appDir, { options: { subapp: false } });
      options.AppMode.subApps = {
        Home: { name: "Home", subAppDir: "src/client/subapps/home", entry: "index.js" }
      };
      const makeEntryPartial = loadMakeEntryPartial(appDir, options);

      expect(makeEntryPartial().entry).to.deep.equal([JSONP_CDN, "./app.tsx"]);
    });
  });

  describe("makeEntryPartial with babel polyfill", () => {
    it("injects core-js and regenerator-runtime when polyfill is enabled", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        baseOptions(appDir, { webpack: { enableBabelPolyfill: true } })
      );

      expect(makeEntryPartial().entry).to.deep.equal([
        JSONP_CDN,
        "core-js",
        "regenerator-runtime/runtime",
        "./app.jsx"
      ]);
    });

    it("injects polyfills regardless of babel target when only default and node targets exist", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        baseOptions(appDir, {
          webpack: { enableBabelPolyfill: true },
          babel: { envTargets: { node: {}, default: {} }, target: "node" }
        })
      );

      expect(makeEntryPartial().entry).to.include("core-js");
    });

    it("does not inject polyfills when building for a non-default target", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        baseOptions(appDir, {
          webpack: { enableBabelPolyfill: true },
          babel: { envTargets: { default: {}, node: {}, es5: {} }, target: "es5" }
        })
      );

      expect(makeEntryPartial().entry).to.deep.equal([JSONP_CDN, "./app.jsx"]);
    });
  });

  describe("makeEntryPartial with subapps in production mode", () => {
    function prodOptions(overrides: any = {}) {
      const options = baseOptions(appDir, overrides);
      options.AppMode.subApps = {
        Home: { name: "Home", subAppDir: "src/client/subapps/home", entry: "index.js" }
      };
      return options;
    }

    it("generates one lower cased entry per subapp with a generated prod entry file", () => {
      const makeEntryPartial = loadMakeEntryPartial(appDir, prodOptions());

      const partial = makeEntryPartial();

      expect(partial.context).to.equal(Path.join(appDir, "src"));
      expect(partial.entry).to.deep.equal({
        home: [JSONP_CDN, "./.__prod__/prod-src-client-subapps-home.js"]
      });

      const generated = Fs.readFileSync(
        Path.join(appDir, "src/.__prod__/prod-src-client-subapps-home.js"),
        "utf8"
      );
      expect(generated).to.include("// Do not modify - electrode auto-generated.");
      expect(generated).to.include(`const subApp = require("src/client/subapps/home/index.js");`);
      expect(generated).to.include("export default subApp;");
    });

    it("uses a lazy import with a bootstrap chunk name when MFE standalone is enabled", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        prodOptions({ mfeOptions: { MFE_STANDALONE_ENABLED: true } })
      );

      makeEntryPartial();

      const generated = Fs.readFileSync(
        Path.join(appDir, "src/.__prod__/prod-src-client-subapps-home.js"),
        "utf8"
      );
      expect(generated).to.include(
        `import(/* webpackChunkName: "home~.bootstrap" */ "src/client/subapps/home/index.js")`
      );
    });

    it("requires the entry directly for a subapp declared as a module", () => {
      const options = baseOptions(appDir);
      options.AppMode.subApps = {
        Home: {
          name: "Home",
          module: true,
          subAppDir: "src/client/subapps/home",
          entry: "@my/home-subapp"
        }
      };
      const makeEntryPartial = loadMakeEntryPartial(appDir, options);

      makeEntryPartial();

      const generated = Fs.readFileSync(
        Path.join(appDir, "src/.__prod__/prod-src-client-subapps-home.js"),
        "utf8"
      );
      expect(generated).to.include(`const subApp = require("@my/home-subapp");`);
    });
  });

  describe("makeEntryPartial with subapps in dev mode", () => {
    beforeEach(() => {
      process.env.WEBPACK_DEV = "true";
    });

    function devOptions(subApp: any, overrides: any = {}) {
      const options = baseOptions(appDir, overrides);
      options.AppMode.subApps = { Home: subApp };
      return options;
    }

    it("generates an hmr entry file and a .gitignore for the hmr dir", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        devOptions({ name: "Home", subAppDir: "src/client/subapps/home", entry: "index.js" })
      );

      const partial = makeEntryPartial();

      expect(partial.entry).to.deep.equal({
        home: ["./.__dev_hmr/hmr-src-client-subapps-home.js"]
      });

      const hmrDir = Path.join(appDir, "src/.__dev_hmr");
      expect(Fs.readFileSync(Path.join(hmrDir, ".gitignore"), "utf8")).to.include("*");

      const generated = Fs.readFileSync(
        Path.join(hmrDir, "hmr-src-client-subapps-home.js"),
        "utf8"
      );
      expect(generated).to.include(`import subApp from "../src/client/subapps/home/index.js";`);
      expect(generated).to.include(`module.hot.accept("../src/client/subapps/home/index.js"`);
      expect(generated).to.include("hotReloadSubApp");
      expect(generated).to.not.include("getReduxCreateStore");
    });

    it("adds redux reducer hmr code when the subapp has reducers", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        devOptions({
          name: "Home",
          subAppDir: "src/client/subapps/home",
          entry: "index.js",
          reducers: true
        })
      );

      makeEntryPartial();

      const generated = Fs.readFileSync(
        Path.join(appDir, "src/.__dev_hmr/hmr-src-client-subapps-home.js"),
        "utf8"
      );
      expect(generated).to.include(`import("subapp-redux").then(({ getReduxCreateStore })`);
      expect(generated).to.include(`import("../src/client/subapps/home/reducers")`);
      expect(generated).to.include("store.replaceReducer(newReducer, subApp);");
    });

    it("wraps the subapp in a dynamic import when MFE standalone is enabled", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        devOptions(
          { name: "Home", subAppDir: "src/client/subapps/home", entry: "index.js" },
          { mfeOptions: { MFE_STANDALONE_ENABLED: true } }
        )
      );

      makeEntryPartial();

      const generated = Fs.readFileSync(
        Path.join(appDir, "src/.__dev_hmr/hmr-src-client-subapps-home.js"),
        "utf8"
      );
      expect(generated).to.include(
        `import(/* webpackChunkName: "index.js" */ "../src/client/subapps/home/index.js")`
      );
      expect(generated).to.include("window.xarcV1.getSubApp(info.name)");
    });

    it("points at the subapp file itself when it self accepts hmr", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        devOptions({
          name: "Home",
          subAppDir: "src/client/subapps/home",
          entry: "index.js",
          hmrSelfAccept: true
        })
      );

      const partial = makeEntryPartial();

      expect(partial.entry).to.deep.equal({ home: ["./src/client/subapps/home/index.js"] });
      expect(
        Fs.existsSync(Path.join(appDir, "src/.__dev_hmr/hmr-src-client-subapps-home.js"))
      ).to.equal(false);
    });

    it("points at the module name when a self accepting subapp is a module", () => {
      const makeEntryPartial = loadMakeEntryPartial(
        appDir,
        devOptions({
          name: "Home",
          module: true,
          subAppDir: "src/client/subapps/home",
          entry: "@my/home-subapp",
          hmrSelfAccept: true
        })
      );

      expect(makeEntryPartial().entry).to.deep.equal({ home: ["@my/home-subapp"] });
    });
  });
});
