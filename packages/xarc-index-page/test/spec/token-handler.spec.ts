"use strict";

import { describe, it } from "mocha";
import { getNonceValue } from "../../src/token-handlers";
import { expect } from "chai";

describe("subapp-server token-handler", () => {
  describe("getNonceValue", () => {
    const random = "random-text";
    const routeOptions = {
      cspNonceValue: {
        scriptNonce: random,
        styleNonce: random
      }
    };

    it("should get nonce from routeOptions", () => {
      expect(getNonceValue(routeOptions).scriptNonce).to.equal(` nonce="${random}"`);
    });

    it("should get nonce of the request being rendered", () => {
      const request = {
        app: { cspNonceValue: { scriptNonce: "req-script", styleNonce: "req-style" } }
      };
      expect(getNonceValue(routeOptions, request)).to.deep.equal({
        scriptNonce: ` nonce="req-script"`,
        styleNonce: ` nonce="req-style"`
      });
    });

    it("should return empty nonce when there's none", () => {
      expect(getNonceValue({}, {})).to.deep.equal({ scriptNonce: "", styleNonce: "" });
    });
  });
});
