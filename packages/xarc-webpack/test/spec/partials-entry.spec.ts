/* eslint-env mocha */
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
/* eslint-disable max-nested-callbacks, no-unused-expressions */

// keep this file free of `import` syntax so node parses it as CommonJS and
// ts-node handles it - the tests reload modules through require.cache
const { expect } = require("chai");
const Fs = require("fs");
const Os = require("os");
const Path = require("path");

const ENTRY_MODULE = "../../src/partials/entry";
const OPTIONS_MODULE = "../../src/util/load-xarc-options";

type XarcOptions = {
  cwd: string;
  AppMode: { src: { dir: string; client: string } };
  options?: any;
  webpack?: any;
  babel?: any;
  mfeOptions?: any;
};

let tmpDir: string;

/**
 * write the xarc options file that the entry partial loads through XARC_CWD
 */
function saveXarcOptions(options: XarcOptions) {
  const etmp = Path.join(tmpDir, ".etmp");
  Fs.mkdirSync(etmp, { recursive: true });
  Fs.writeFileSync(Path.join(etmp, "xarc-options.json"), JSON.stringify(options));
}

function makeOptions(override: Partial<XarcOptions> = {}): XarcOptions {
  return Object.assign(
    {
      cwd: tmpDir,
      AppMode: { src: { dir: "src", client: "src/client" } },
      options: { subapp: true },
      webpack: {},
      babel: { envTargets: { default: {}, node: {} }, target: "default" }
    },
    override
  );
}

/**
 * load a fresh copy of the entry partial so the cached xarc options don't leak
 */
function loadEntryPartial(options: XarcOptions) {
  saveXarcOptions(options);
  delete require.cache[require.resolve(ENTRY_MODULE)];
  delete require.cache[require.resolve(OPTIONS_MODULE)];
  return require(ENTRY_MODULE);
}

function writeFile(file: string, content = "") {
  const full = Path.join(tmpDir, file);
  Fs.mkdirSync(Path.dirname(full), { recursive: true });
  Fs.writeFileSync(full, content);
  return full;
}

const jsonpCdn = require.resolve("../../src/client/webpack5-jsonp-cdn");

describe("@xarc/webpack partials/entry", () => {
  const saveEnv = { XARC_CWD: process.env.XARC_CWD, WEBPACK_DEV: process.env.WEBPACK_DEV };

  beforeEach(() => {
    tmpDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), "xarc-webpack-entry-"));
    process.env.XARC_CWD = tmpDir;
    delete process.env.WEBPACK_DEV;
  });

  afterEach(() => {
    Object.keys(saveEnv).forEach(k => {
      if (saveEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = saveEnv[k];
      }
    });
    delete require.cache[require.resolve(ENTRY_MODULE)];
    delete require.cache[require.resolve(OPTIONS_MODULE)];
    Fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("app entry detection", () => {
    it("sets context to the client dir and defaults to ./app.jsx when no entry file exists", () => {
      const makeEntryPartial = loadEntryPartial(makeOptions({ options: { subapp: false } }));
      const partial = makeEntryPartial();

      expect(partial.context).to.equal(Path.resolve(tmpDir, "src/client"));
      expect(partial.entry).to.deep.equal([jsonpCdn, "./app.jsx"]);
    });

    it("uses an app entry file found under the webpack context", () => {
      writeFile("src/client/app.tsx");
      const makeEntryPartial = loadEntryPartial(makeOptions({ options: { subapp: false } }));

      expect(makeEntryPartial().entry).to.deep.equal([jsonpCdn, "./app.tsx"]);
    });

    it("moves context to src dir when app entry is only found there", () => {
      writeFile("src/app.js");
      const cwd = process.cwd();
      process.chdir(tmpDir);
      try {
        const makeEntryPartial = loadEntryPartial(makeOptions({ options: { subapp: false } }));
        const partial = makeEntryPartial();
        expect(partial.context).to.equal(Path.join(tmpDir, "src"));
        expect(partial.entry).to.deep.equal([jsonpCdn, "./app.js"]);
      } finally {
        process.chdir(cwd);
      }
    });

    it("falls back to an app entry when subapp is on but no v1 subapps exist", () => {
      writeFile("src/client/app.js");
      const makeEntryPartial = loadEntryPartial(makeOptions({ AppMode: { src: { dir: "src", client: "src/client" }, subApps: {} } as any }));

      expect(makeEntryPartial().entry).to.deep.equal([jsonpCdn, "./app.js"]);
    });

    it("uses entry.config.js from the context when it exists", () => {
      writeFile("src/client/entry.config.js", `module.exports = { main: "./foo.js" };`);
      const makeEntryPartial = loadEntryPartial(makeOptions());

      expect(makeEntryPartial().entry).to.deep.equal({ main: [jsonpCdn, "./foo.js"] });
    });
  });

  describe("babel polyfill", () => {
    const polyfills = ["core-js", "regenerator-runtime/runtime"];

    it("does not inject polyfills by default", () => {
      const makeEntryPartial = loadEntryPartial(makeOptions({ options: { subapp: false } }));

      expect(makeEntryPartial().entry).to.deep.equal([jsonpCdn, "./app.jsx"]);
    });

    it("injects polyfills when enabled with a single target", () => {
      const makeEntryPartial = loadEntryPartial(
        makeOptions({
          options: { subapp: false },
          webpack: { enableBabelPolyfill: true },
          babel: { envTargets: { node: {}, default: {} }, target: "node" }
        })
      );

      expect(makeEntryPartial().entry).to.deep.equal([jsonpCdn, ...polyfills, "./app.jsx"]);
    });

    it("injects polyfills for multiple targets only when building the default target", () => {
      const options = makeOptions({
        options: { subapp: false },
        webpack: { enableBabelPolyfill: true },
        babel: { envTargets: { default: {}, node: {}, es5: {} }, target: "default" }
      });

      expect(loadEntryPartial(options)().entry).to.deep.equal([
        jsonpCdn,
        ...polyfills,
        "./app.jsx"
      ]);

      options.babel.target = "es5";
      expect(loadEntryPartial(options)().entry).to.deep.equal([jsonpCdn, "./app.jsx"]);
    });
  });

  describe("subapp entries", () => {
    const subApps = {
      Home: { name: "Home", subAppDir: "client/home", entry: "subapp.jsx" },
      Cart: { name: "Cart", subAppDir: "client/cart", entry: "subapp.jsx", reducers: true }
    };

    it("generates prod entries for each subapp when not in dev mode", () => {
      const makeEntryPartial = loadEntryPartial(makeOptions({ AppMode: { src: { dir: "src", client: "src/client" }, subApps } as any }));
      const partial = makeEntryPartial();

      expect(partial.entry).to.deep.equal({
        home: [jsonpCdn, "./.__prod__/prod-client-home.js"],
        cart: [jsonpCdn, "./.__prod__/prod-client-cart.js"]
      });

      const content = Fs.readFileSync(Path.join(tmpDir, "src/.__prod__/prod-client-home.js"), "utf-8");
      expect(content).to.contain(`require("client/home/subapp.jsx")`);
      expect(content).to.contain("export default subApp");
    });

    it("generates a dynamic import prod entry when MFE standalone is enabled", () => {
      const makeEntryPartial = loadEntryPartial(
        makeOptions({
          AppMode: { src: { dir: "src", client: "src/client" }, subApps } as any,
          mfeOptions: { MFE_STANDALONE_ENABLED: true }
        })
      );
      makeEntryPartial();

      const content = Fs.readFileSync(Path.join(tmpDir, "src/.__prod__/prod-client-home.js"), "utf-8");
      expect(content).to.contain(`webpackChunkName: "home~.bootstrap"`);
      expect(content).to.contain(`import(/* webpackChunkName: "home~.bootstrap" */ "client/home/subapp.jsx")`);
    });

    it("generates hmr entries, hmr accept code and a gitignore in dev mode", () => {
      process.env.WEBPACK_DEV = "true";
      const makeEntryPartial = loadEntryPartial(
        makeOptions({ AppMode: { src: { dir: "src", client: "src/client" }, subApps } as any })
      );
      const partial = makeEntryPartial();

      // no cdn jsonp module is injected in dev mode
      expect(partial.entry).to.deep.equal({
        home: ["./.__dev_hmr/hmr-client-home.js"],
        cart: ["./.__dev_hmr/hmr-client-cart.js"]
      });

      const hmrDir = Path.join(tmpDir, "src/.__dev_hmr");
      expect(Fs.readFileSync(Path.join(hmrDir, ".gitignore"), "utf-8")).to.contain("*");

      const home = Fs.readFileSync(Path.join(hmrDir, "hmr-client-home.js"), "utf-8");
      expect(home).to.contain(`import subApp from "../client/home/subapp.jsx"`);
      expect(home).to.contain(`module.hot.accept("../client/home/subapp.jsx"`);
      expect(home).to.not.contain("replaceReducer");

      const cart = Fs.readFileSync(Path.join(hmrDir, "hmr-client-cart.js"), "utf-8");
      expect(cart).to.contain(`import("../client/cart/reducers")`);
      expect(cart).to.contain("store.replaceReducer(newReducer, subApp)");
    });

    it("generates a dynamic import hmr entry when MFE standalone is enabled", () => {
      process.env.WEBPACK_DEV = "true";
      const makeEntryPartial = loadEntryPartial(
        makeOptions({
          AppMode: { src: { dir: "src", client: "src/client" }, subApps } as any,
          mfeOptions: { MFE_STANDALONE_ENABLED: true }
        })
      );
      makeEntryPartial();

      const home = Fs.readFileSync(
        Path.join(tmpDir, "src/.__dev_hmr/hmr-client-home.js"),
        "utf-8"
      );
      expect(home).to.contain(`webpackChunkName: "subapp.jsx"`);
      expect(home).to.contain(`window.xarcV1.getSubApp(info.name)`);
    });

    it("keeps the subapp module path as entry when hmrSelfAccept is set", () => {
      process.env.WEBPACK_DEV = "true";
      const makeEntryPartial = loadEntryPartial(
        makeOptions({
          AppMode: {
            src: { dir: "src", client: "src/client" },
            subApps: {
              Self: {
                name: "Self",
                subAppDir: "client/self",
                entry: "subapp.jsx",
                hmrSelfAccept: true
              },
              Mod: { name: "Mod", module: true, subAppDir: "client/mod", entry: "my-subapp" }
            }
          } as any
        })
      );

      expect(makeEntryPartial().entry).to.deep.equal({
        self: ["./client/self/subapp.jsx"],
        mod: ["./.__dev_hmr/hmr-client-mod.js"]
      });

      const mod = Fs.readFileSync(Path.join(tmpDir, "src/.__dev_hmr/hmr-client-mod.js"), "utf-8");
      expect(mod).to.contain(`import subApp from "my-subapp"`);
    });
  });
});
