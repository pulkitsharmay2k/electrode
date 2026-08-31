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

  it("should not mutate the shared entry points when a subapp is rendered again", () => {
    const { assets } = loadAssetsFromStats(Path.join(__dirname, "../data/prod-stats.json"));
    assets.chunks = assets.chunks.concat({ id: 100, names: ["mainbody~.bootstrap"] });
    const entryPoints = assets.entryPoints.mainbody.slice();

    getSubAppBundle("MainBody", assets);
    getSubAppBundle("MainBody", assets);

    expect(assets.entryPoints.mainbody).to.deep.equal(entryPoints);
  });
});

describe("getSubAppEntryPoints", function () {
  const makeAssets = () => ({
    entryPoints: { mainbody: [0, 1] },
    chunks: [
      { id: 0, names: ["vendors"] },
      { id: 5, names: ["mainbody~.bootstrap"] }
    ]
  });

  it("should add the async bootstrap chunk without mutating the entry points", () => {
    const assets = makeAssets();

    expect(getSubAppEntryPoints("mainbody", assets)).to.deep.equal([0, 1, 5]);
    expect(getSubAppEntryPoints("mainbody", assets)).to.deep.equal([0, 1, 5]);
    expect(assets.entryPoints.mainbody).to.deep.equal([0, 1]);
  });

  it("should return the entry points as is when there's no async bootstrap chunk", () => {
    const assets = makeAssets();
    assets.chunks = [{ id: 0, names: ["vendors"] }];

    expect(getSubAppEntryPoints("mainbody", assets)).to.deep.equal([0, 1]);
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
