"use strict";

const React = require("react"); // eslint-disable-line
const { act } = require("react");
const feLib = require("../../src");
const { JSDOM } = require("jsdom");

describe("FE React framework", function () {
  //
  it("should setup FrameworkLib", () => {
    expect(feLib.React).to.be.ok;
    expect(feLib.AppContext).to.be.ok;
    expect(feLib.loadSubApp).to.be.a("function");
    expect(feLib.FrameworkLib).to.be.ok;
  });

  it("should render component into DOM element", () => {
    const dom = new JSDOM(`<div id="test"></div>`);
    global.window = dom.window;
    const element = dom.window.document.getElementById("test");
    const framework = new feLib.FrameworkLib({
      subApp: {
        info: {
          Component: props => <p>hello {props.foo}</p>
        }
      },
      element,
      options: { props: { foo: "bar" } }
    });

    act(() => framework.renderStart());

    expect(element.innerHTML).equals(`<p>hello bar</p>`);
  });

  it("should hydrate render component into DOM element", () => {
    const dom = new JSDOM(`<div id="test"><p>hello <!-- -->bar</p></div>`);
    global.window = dom.window;
    const element = dom.window.document.getElementById("test");
    const framework = new feLib.FrameworkLib({
      subApp: {
        info: {
          Component: props => <p>hello {props.foo}</p>
        }
      },
      element,
      options: { props: { foo: "bar" }, serverSideRendering: true }
    });
    framework.renderStart();
    expect(element.innerHTML).equals(`<p>hello <!-- -->bar</p>`);
  });

  it("should render StartComponent over Component when both are provided", () => {
    const dom = new JSDOM(`<div id="test"></div>`);
    global.window = dom.window;
    const element = dom.window.document.getElementById("test");
    const framework = new feLib.FrameworkLib({
      subApp: {
        info: {
          Component: props => <p>component {props.foo}</p>,
          StartComponent: props => <p>start {props.foo}</p>
        }
      },
      element,
      options: { props: { foo: "bar" } }
    });

    act(() => framework.renderStart());

    expect(element.innerHTML).equals(`<p>start bar</p>`);
  });

  it("should render with prepared props overridden by options props", () => {
    const dom = new JSDOM(`<div id="test"></div>`);
    global.window = dom.window;
    const element = dom.window.document.getElementById("test");
    const framework = new feLib.FrameworkLib({
      subApp: {
        info: {
          Component: props => (
            <p>
              {props.hello} {props.foo}
            </p>
          )
        }
      },
      element,
      options: { _prepared: { hello: "world", foo: "prepared" }, props: { foo: "bar" } }
    });

    act(() => framework.renderStart());

    expect(element.innerHTML).equals(`<p>world bar</p>`);
  });

  it("should save the subapp root on the subapp info", () => {
    const dom = new JSDOM(`<div id="test"></div>`);
    global.window = dom.window;
    const element = dom.window.document.getElementById("test");
    const info = {
      Component: props => <p>hello {props.foo}</p>
    };
    const framework = new feLib.FrameworkLib({
      subApp: { info },
      element,
      options: { props: { foo: "bar" } }
    });

    act(() => framework.renderStart());

    expect(info.subappRoot).to.be.ok;
    expect(info.subappRoot.render).to.be.a("function");
  });

  it("should not set subapp root when there's no DOM element", () => {
    const info = { Component: () => <p>hello</p> };
    const framework = new feLib.FrameworkLib({
      subApp: { info },
      options: { props: {} }
    });

    framework.renderStart();

    expect(info.subappRoot).to.equal(undefined);
  });

  it("should just return the component without DOM element", () => {
    const Component = props => <p>hello {props.foo}</p>;

    const framework = new feLib.FrameworkLib({
      subApp: {
        info: { Component }
      },
      options: { props: { foo: "bar" }, serverSideRendering: true }
    });
    const c = framework.renderStart();
    expect(c.type).equals(Component);
  });

  it("should render and unmount component into DOM element", () => {
    const dom = new JSDOM(`<div id="test"><p>Hello bar</p></div>`);
    global.window = dom.window;
    const element = dom.window.document.getElementById("test");
    const framework = new feLib.FrameworkLib({
      subApp: {
        info: {
          Component: props => <p>Hello {props.foo}</p>,
          subappRoot: {}
        }
      },
      element,
      options: { props: { foo: "bar" } }
    });

    framework.renderStart();
    const root = framework.ref.subApp.info.subappRoot;

    expect(element.innerHTML).to.equal(`<p>Hello bar</p>`);

    act(() => {
      root.unmount();
    });

    expect(element.innerHTML).to.equal("");
  });

  it("should hydrate and unmount a server-side rendered component", () => {
    const dom = new JSDOM(`<div id="test"><p>Hello bar</p></div>`);
    global.window = dom.window;
    const element = dom.window.document.getElementById("test");
    const framework = new feLib.FrameworkLib({
      subApp: {
        info: {
          Component: props => <p>Hello {props.foo}</p>,
          subappRoot: {}
        }
      },
      element,
      options: { props: { foo: "bar" }, serverSideRendering: true }
    });

    framework.renderStart();
    const root = framework.ref.subApp.info.subappRoot;

    expect(element.innerHTML).to.equal("<p>Hello bar</p>");

    act(() => {
      root.unmount();
    });

    expect(element.innerHTML).to.equal("");
  });
});
