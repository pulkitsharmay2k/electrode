/* eslint-disable */
"use strict";

const url = require("url");
const React = require("react"); // eslint-disable-line
const lib = require("../../lib");
const { Routes, Route } = require("react-router"); // eslint-disable-line
const { asyncVerify } = require("run-verify");
const Redux = require("redux");
const { connect } = require("react-redux");

const getStreamWritable = (stream, next) => {
  let res = "";
  stream.on("data", data => (res += data.toString()));
  stream.on("end", () => next(null, res));
  stream.on("error", next);
  return res;
};

describe("SSR React framework", function () {
  it("should setup React framework", () => {
    expect(lib.React).to.be.ok;
    expect(lib.AppContext).to.be.ok;
    expect(lib.FrameworkLib).to.be.ok;
    expect(lib.loadSubApp).to.be.a("function");
  });

  it("should not do SSR without component", async () => {
    const framework = new lib.FrameworkLib({
      subApp: {},
      subAppServer: {},
      options: {}
    });
    const res = await framework.handleSSR();
    expect(res).contains("has no StartComponent");
  });

  it("should not do SSR if serverSideRendering is not true", async () => {
    const framework = new lib.FrameworkLib({
      subApp: { Component: () => {} },
      subAppServer: {},
      options: { serverSideRendering: false }
    });
    const res = await framework.handleSSR();
    expect(res).equals("");
  });

  it("should render subapp with w/o initial props if no prepare provided", () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        Component: props => {
          return <div>Hello {props.test}</div>;
        }
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      // renderToPipeableSrteam adds a <!-- --> before props
      res => expect(res).contains(`<div>Hello </div>`)
    );
  });

  it("should render Component from subapp with initial props from prepare", () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        prepare: () => ({ test: "foo bar" }),
        Component: props => {
          return <div>Hello {props.test}</div>;
        }
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      // renderToPipeableSrteam adds a <!-- --> before props
      res => expect(res).contains(`<div>Hello <!-- -->foo bar</div>`)
    );
  });

  it("should allow preparing data before SSR", async () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        prepare: () => ({ test: "foo bar" }),
        Component: props => {
          return <div>Hello {props.test}</div>;
        }
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    await framework.handlePrepare();
    expect(framework._initialProps).to.be.ok;
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      // renderToPipeableSrteam adds a <!-- --> before props
      res => expect(res).contains(`<div>Hello <!-- -->foo bar</div>`)
    );
  });

  it("should render Component with stream if enabled", () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        prepare: () => ({ test: "foo bar" }),
        Component: props => {
          return <div>Hello {props.test}</div>;
        }
      },
      subAppServer: {},
      options: { serverSideRendering: true, useStream: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      // renderToPipeableSrteam adds a <!-- --> before props
      res => expect(res).contains(`<div>Hello <!-- -->foo bar</div>`)
    );
  });

  it("should render Component from subapp with initial props from server's prepare", () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        Component: props => {
          return <div>Hello {props.test}</div>;
        }
      },
      subAppServer: {
        prepare: () => ({ test: "foo bar" })
      },
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      // renderToPipeableSrteam adds a <!-- --> before props
      res => expect(res).contains(`<div>Hello <!-- -->foo bar</div>`)
    );
  });

  it("should render Component from subapp with initial props from server's prepare while using attachInitialState", () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        Component: props => {
          return <div>Hello {props.test}</div>;
        }
      },
      subAppServer: {
        prepare: () => ({ test: "foo bar" }),
        attachInitialState: false
      },
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      // renderToPipeableSrteam adds a <!-- --> before props
      res => expect(res).contains(`<div>Hello <!-- -->foo bar</div>`)
    );
  });

  it("should init redux store in context and render Component", async () => {
    const Component = connect(x => x)(props => <div>Hello {props.test}</div>);
    let storeReady;

    const subApp = {
      __redux: true,
      Component,
      reduxCreateStore: (initState, container) => {
        // simulate sharing store in conainter (see subapp-redux/lib/shared)
        if (!container.store) {
          container.store = Redux.createStore(x => x, initState);
        }
        return container.store;
      },
      async reduxStoreReady() {
        storeReady = true;
      },

      prepare: () => ({ test: "foo bar" })
    };
    const context = { user: {} };
    const verify = async () => {
      const framework = new lib.FrameworkLib({
        subApp,
        subAppServer: {},
        options: { serverSideRendering: true },
        context
      });

      return asyncVerify(
        () => framework.handleSSR(),
        (stream, next) => {
          let res = "";
          stream.on("data", data => (res += data.toString()));
          stream.on("end", () => next(null, res));
          stream.on("error", next);
        },
        res => {
          expect(res).contains(`<div>Hello <!-- -->foo bar</div>`);
          expect(framework.initialStateStr).equals(`{"test":"foo bar"}`);
          expect(context.user).to.have.property("storeContainer");
          expect(storeReady).equal(true);
        }
      );
    };
    await verify();
    const store = context.user.storeContainer.store;
    // should be able to render again with the same store in context
    await verify();
    expect(store).to.equal(context.user.storeContainer.store);
  });

  it("should init redux store and render Component but doesn't attach initial state", () => {
    const Component = connect(x => x)(props => <div>Hello {props.test}</div>);

    const framework = new lib.FrameworkLib({
      subApp: {
        __redux: true,
        Component,
        reduxCreateStore: initState => Redux.createStore(x => x, initState),
        prepare: () => ({ test: "foo bar" })
      },
      subAppServer: { attachInitialState: false },
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      res => {
        // renderToPipeableSrteam adds a <!-- --> before props
        expect(res).contains(`<div>Hello <!-- -->foo bar</div>`);
        expect(framework.initialStateStr).equals(undefined);
      }
    );
  });

  it("should init redux store but doesn't render Component if serverSideRendering is not true", async () => {
    const Component = connect(x => x)(props => <div>Hello {props.test}</div>);

    const framework = new lib.FrameworkLib({
      subApp: {
        __redux: true,
        Component,
        reduxCreateStore: initState => Redux.createStore(x => x, initState),
        prepare: () => ({ test: "foo bar" })
      },
      subAppServer: { attachInitialState: false },
      options: { serverSideRendering: false },
      context: {
        user: {}
      }
    });
    const res = await framework.handleSSR();
    expect(res).equals("");
    expect(framework.initialStateStr).equals(undefined);
  });

  it("should init redux store with empty state without prepare and render Component", () => {
    const Component = connect(x => x)(props => <div>Hello {props.test}</div>);

    const framework = new lib.FrameworkLib({
      subApp: {
        __redux: true,
        Component,
        reduxCreateStore: initState => Redux.createStore(x => x, initState)
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      res => {
        expect(res).contains("Hello <");
        expect(framework.initialStateStr).equals(`{}`);
      }
    );
  });

  it("should render Component with suspense using react-async-ssr", () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        Component: props => {
          return (
            <React.Suspense fallback={<h1>Loading...</h1>}>
              <div>Hello {props.test}</div>
            </React.Suspense>
          );
        }
      },
      subAppServer: {
        prepare: () => ({ test: "foo bar" })
      },
      options: { serverSideRendering: true, suspenseSsr: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      // renderToPipeableSrteam adds a <!-- --> before props
      res => expect(res).contains(`<div>Hello <!-- -->foo bar</div>`)
    );
  });

  it("should render Component with react context containing request", () => {
    const request = {};
    const framework = new lib.FrameworkLib({
      subApp: {
        Component: () => {
          return (
            <lib.AppContext.Consumer>
              {({ isSsr, ssr }) => {
                ssr.request.foo = "bar";
                return (
                  <div>
                    IS_SSR: {`${Boolean(isSsr)}`} HAS_REQUEST: {ssr && ssr.request ? "yes" : "no"}
                  </div>
                );
              }}
            </lib.AppContext.Consumer>
          );
        }
      },
      subAppServer: {
        prepare: () => ({ test: "foo bar" })
      },
      options: { serverSideRendering: true },
      context: {
        user: { request }
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      res => {
        // renderToPipeableSrteam adds a <!-- --> before props
        expect(res).contains(`<div>IS_SSR: <!-- -->true<!-- --> HAS_REQUEST: <!-- -->yes</div>`);
        expect(request.foo).equals("bar");
      }
    );

  });

  it("should render subapp with react-router StaticRouter", async () => {
    /* eslint-disable no-unused-vars */
    const TestComponent = () => <div>Hello test path</div>;
    const FooBar = () => <div>foo</div>;
    /* eslint-enable no-unused-vars */

    const Component = () => (
      <Routes>
        <Route path="/test" element={<TestComponent />} />
        <Route path="/foo" element={<FooBar />} />
      </Routes>
    );

    const framework = new lib.FrameworkLib({
      subApp: {
        useReactRouter: true,
        Component
      },
      subAppServer: {
        prepare: () => ({ test: "foo bar" })
      },
      options: { serverSideRendering: true },
      context: {
        user: {
          request: { url: url.parse("http://localhost/test") }
        }
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      res => expect(res).contains("Hello test path<")
    );
  });

  it("should render server's StartComponent instead of subapp Component", () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        Component: () => <div>from subapp</div>
      },
      subAppServer: {
        StartComponent: () => <div>from server</div>
      },
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      res => expect(res).contains("<div>from server</div>")
    );
  });

  it("should not wrap react router when server provides StartComponent", async () => {
    const StartComponent = () => <div>from server</div>;
    const framework = new lib.FrameworkLib({
      subApp: {
        useReactRouter: true,
        Component: () => <div>from subapp</div>
      },
      subAppServer: { StartComponent },
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    await framework.handlePrepare();
    expect(framework.StartComponent).equals(StartComponent);
  });

  it("should render react router subapp with request path", () => {
    const Component = () => (
      <Routes>
        <Route path="/test" element={<div>Hello test path</div>} />
      </Routes>
    );

    const framework = new lib.FrameworkLib({
      subApp: {
        useReactRouter: true,
        Component
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {
          request: { path: "/test" }
        }
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      res => expect(res).contains("Hello test path<")
    );
  });

  it("should prepare data only once for a single SSR", async () => {
    let prepareCount = 0;
    const framework = new lib.FrameworkLib({
      subApp: {
        prepare: () => {
          prepareCount++;
          return { test: "foo bar" };
        },
        Component: props => <div>Hello {props.test}</div>
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    await framework.handlePrepare();
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      () => expect(prepareCount).equals(1)
    );
  });

  it("should not attach initial state if subapp asks to skip it", async () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        prepare: () => ({ test: "foo bar" }),
        Component: props => <div>Hello {props.test}</div>
      },
      subAppServer: { attachInitialState: false },
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    await framework.handlePrepare();
    expect(framework.initialState).to.deep.equal({ test: "foo bar" });
    expect(framework.initialStateStr).equals(undefined);
  });

  it("should use the store returned from prepare for redux subapp", () => {
    const Component = connect(x => x)(props => <div>Hello {props.test}</div>);
    const store = Redux.createStore(x => x, { test: "foo bar" });

    const framework = new lib.FrameworkLib({
      subApp: {
        __redux: true,
        Component,
        prepare: () => ({ initialState: { test: "foo bar" }, store })
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    return asyncVerify(
      () => framework.handleSSR(),
      (stream, next) => getStreamWritable(stream, next),
      res => {
        expect(res).contains(`<div>Hello <!-- -->foo bar</div>`);
        expect(framework.store).equals(store);
      }
    );
  });

  it("should call server's reduxStoreReady with the store", async () => {
    const Component = connect(x => x)(props => <div>Hello {props.test}</div>);
    let readyStore;

    const framework = new lib.FrameworkLib({
      subApp: {
        __redux: true,
        Component,
        reduxCreateStore: initState => Redux.createStore(x => x, initState),
        prepare: () => ({ test: "foo bar" })
      },
      subAppServer: {
        reduxStoreReady: ({ store }) => (readyStore = store)
      },
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    await framework.handlePrepare();
    expect(readyStore).equals(framework.store);
  });

  it("should fail redux subapp that doesn't provide a store", async () => {
    const framework = new lib.FrameworkLib({
      subApp: {
        __redux: true,
        name: "test-subapp",
        Component: () => <div>Hello</div>
      },
      subAppServer: {},
      options: { serverSideRendering: true },
      context: {
        user: {}
      }
    });
    let error;
    try {
      await framework.handleSSR();
    } catch (err) {
      error = err;
    }
    expect(error).to.be.an("error");
    expect(error.message).contains("test-subapp didn't provide store");
  });

  it("should render subapp with custom renderer e.g. css in js solution", async () => {
    const Component = () => {
      return <div>Hello test path</div>;
    };
    const framework = new lib.FrameworkLib({
      subApp: {
        Component
      },
      subAppServer: {
        renderer: () => {
          return "<h1>Rendered via Custom renderer</h1>";
        }
      },
      options: { serverSideRendering: true },
      context: {
        user: {
          request: { url: url.parse("http://localhost/test") }
        }
      }
    });
    const res = await framework.handleSSR();
    expect(res).contains("Rendered via Custom renderer");
  });
});
