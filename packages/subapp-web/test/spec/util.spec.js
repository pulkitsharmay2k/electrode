"use strict";

const Path = require("path");
const Fs = require("fs");

const {
  resetCdn,
  loadAssetsFromStats,
  getSubAppBundle,
  getSubAppEntryPoints,
  getChunksById,
  getBundleBase,
  loadCdnAssets,
  getCdnJsBundles,
  getFramework,
  setupFramework
} = require("../../lib/util");

describe("loadAssetsFromStats", () => {
  it("should load assets", () => {
    const assets = loadAssetsFromStats("./test/data/prod-stats.json");
    expect(assets).be.not.empty;
  });

  it("should load assets without manifest if no such asset exists", () => {
    const assets = loadAssetsFromStats("./test/data/prod-stats-no-manifest.json");
    expect(assets).be.not.empty;
    expect(assets).to.not.have.own.property("manifest");
  });

  it("should throw if stats.json does not exist", () => {
    expect(() => loadAssetsFromStats("some path")).to.throw();
  });
});

describe("getChunksById", function () {
  const prodStats = JSON.parse(Fs.readFileSync(Path.join(__dirname, "../data/prod-stats.json")));
  const devStats = JSON.parse(Fs.readFileSync(Path.join(__dirname, "../data/dev-stats.json")));

  it("should handle production stats", () => {
    const result = getChunksById(prodStats);

    expect(result).to.have.property("_names_");
    expect(result).to.have.property("js");
    expect(result).to.have.property("map");
    expect(result.js).contains("mainbody.bundle.js");
    expect(result.map).contains("../map/mainbody.bundle.js.map");
  });

  it("should handle development stats", () => {
    const result = getChunksById(devStats);

    expect(result).to.not.have.property("_names_");
    expect(result).to.have.property("js");
    expect(result).to.not.have.property("map");
    expect(result.js).to.have.property("mainbody");
  });
});

describe("getSubAppBundle", function () {
  it("should get bundles for a subapp by name", () => {
    // load prod-stats.json
    const { assets } = loadAssetsFromStats(Path.join(__dirname, "../data/prod-stats.json"));
    const bundles = getSubAppBundle("MainBody", assets);
    expect(bundles.name).equal("mainbody.bundle.js");
    expect(bundles.size).to.be.above(0);
    expect(bundles.chunks).to.be.an("array");
    expect(bundles.chunkNames).to.be.an("array");
  });
});

describe("getSubAppEntryPoints", function () {
  const makeAssets = () => ({
    entryPoints: { mainbody: ["vendors", "mainbody"] },
    chunks: [
      { id: "mainbody", names: ["mainbody"] },
      { id: "bootstrap-chunk", names: ["mainbody~.bootstrap"] },
      { id: "no-names" }
    ]
  });

  it("should append the async bootstrap chunk", () => {
    const assets = makeAssets();
    expect(getSubAppEntryPoints(assets, "mainbody")).to.deep.equal([
      "vendors",
      "mainbody",
      "bootstrap-chunk"
    ]);
  });

  it("should not mutate the shared assets data on repeated calls", () => {
    const assets = makeAssets();
    getSubAppEntryPoints(assets, "mainbody");
    getSubAppEntryPoints(assets, "mainbody");
    expect(assets.entryPoints.mainbody).to.deep.equal(["vendors", "mainbody"]);
    expect(getSubAppEntryPoints(assets, "mainbody")).to.deep.equal([
      "vendors",
      "mainbody",
      "bootstrap-chunk"
    ]);
  });

  it("should return a copy when there's no async bootstrap chunk", () => {
    const assets = makeAssets();
    assets.entryPoints.header = ["vendors", "header"];
    const entryPoints = getSubAppEntryPoints(assets, "header");
    entryPoints.push("extra");
    expect(assets.entryPoints.header).to.deep.equal(["vendors", "header"]);
  });

  it("should return undefined for an unknown entry", () => {
    expect(getSubAppEntryPoints(makeAssets(), "unknown")).to.equal(undefined);
  });
});

describe("getBundleBase", function () {
  it("should get base url for bundles in prod mode", () => {
    expect(getBundleBase({ prodBundleBase: "http://prod", devBundleBase: "http://dev" })).to.equal(
      "http://prod"
    );
  });

  it("should get base url for bundles in dev mode", () => {
    expect(
      getBundleBase({
        webpackDev: true,
        prodBundleBase: "http://prod",
        devBundleBase: "http://dev"
      })
    ).to.equal("http://dev");
  });
});

describe("getCdnJsBundles", function () {
  it("should generate mapping of chunk ID to CDN URLs", () => {
    resetCdn();
    const { assets } = loadAssetsFromStats(Path.join(__dirname, "../data/prod-stats.json"));
    const options = { cdn: { enable: true } };
    loadCdnAssets(options, "test/data/cdn-assets.json");
    const cdnJsBundles = getCdnJsBundles(assets, options);
    expect(cdnJsBundles[7]).contains("http://cdnasset.com/hash-123.js");
  });
});

describe("get/set framework", function () {
  it("should allow set/get framework lib", () => {
    function FL(ref) {
      this.ref = ref;
    }

    setupFramework(FL);
    const lib = getFramework({ test: "framework setup" });
    expect(lib.ref.test).to.equal("framework setup");
  });
});
