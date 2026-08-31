"use strict";

const { load } = require("../../lib");
const utils = require("../../lib/util");
const Path = require("path");
const reserveSpot = require("../../lib/ReserveSpot");
const RenderOutput = require("electrode-react-webapp/lib/render-output");

describe("load", function () {
  const statsPath = Path.join(__dirname, "../data/dev-stats.json");
  const { assets } = utils.loadAssetsFromStats(statsPath);
  let context;
  let setUpContext;
  let props;

  beforeEach(() => {
    setUpContext = {
      routeOptions: {
        cdn: {},
        __internals: {
          assets
        }
      }
    };
    context = {
      user: {
        request: { app: {} },
        assets,
        includedBundles: {}
      },
      transform: x => x
    };
    props = {
      props: {
        serverSideRendering: false
      }
    };
    utils.resetCdn();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.APP_SRC_DIR;
  });

  it("should load bundles for the subapp", done => {
    process.env.APP_SRC_DIR = "test/subapps";
    const loadToken = load(setUpContext, { props: { name: "mainbody" } });

    context.send = results => {
      expect(results).to.not.be.empty;
      expect(context.user.includedBundles).to.include({ mainbody: true });
      // Remove HTML comments and normalize whitespace for comparison
      const cleanResults = results.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
      expect(cleanResults).to.include(`<script src="mainbody.bundle.dev.js" async></script>`);
      expect(cleanResults).to.include(
        `<script src="ae56dc06d35e1170d047.vendors~280289005828299c685d173f73011e79.js" async></script>`
      );
      expect(context.user.headEntries).to.not.be.ok;
    };
    context.output = new RenderOutput(context);

    loadToken.process(context, props);
    context.output.close();
    done();
  }).timeout(5000);

  it("should load preload tags for scripts", done => {
    process.env.APP_SRC_DIR = "test/subapps";
    const loadToken = load(setUpContext, { props: { name: "mainbody" } });

    context.send = results => {
      expect(results).to.not.be.empty;
      // Remove HTML comments and normalize whitespace for comparison
      const cleanResults = results.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
      expect(cleanResults).to.include(
        `<link rel="preload" href="mainbody.bundle.dev.js" as="script">`
      );
      expect(cleanResults).to.include(`<script src="mainbody.bundle.dev.js" async></script>`);
      expect(context.user.includedBundles).to.include({ mainbody: true });
    };
    context.output = new RenderOutput(context);
    reserveSpot({ saveId: "headEntries" }, context);

    loadToken.process(context, props);
    context.output.close();
    done();
  }).timeout(5000);

  it("should mark the async bootstrap chunk loaded once per render", async () => {
    process.env.APP_SRC_DIR = "test/subapps";
    const { assets: ownAssets } = utils.loadAssetsFromStats(statsPath);
    ownAssets.chunks.push({ id: "mainbody~.bootstrap", names: ["mainbody~.bootstrap"] });
    ownAssets.chunksById.js["mainbody~.bootstrap"] = "mainbody~.bootstrap.bundle.dev.js";

    const loadToken = load(
      {
        routeOptions: { cdn: {}, __internals: { assets: ownAssets } }
      },
      { props: { name: "mainbody" } }
    );

    const render = () =>
      new Promise(resolve => {
        const renderContext = {
          user: { request: { app: {} }, assets: ownAssets, includedBundles: {} },
          transform: x => x,
          send: resolve
        };
        renderContext.output = new RenderOutput(renderContext);
        loadToken.process(renderContext, props);
        renderContext.output.close();
      });

    const countBootstrap = results => (results.match(/"mainbody~\.bootstrap"/g) || []).length;

    expect(countBootstrap(await render())).to.equal(1);
    // the assets data is shared by every request and must not accumulate the chunk
    expect(ownAssets.entryPoints.mainbody).to.not.include("mainbody~.bootstrap");
    expect(countBootstrap(await render())).to.equal(1);
  }).timeout(5000);
});
