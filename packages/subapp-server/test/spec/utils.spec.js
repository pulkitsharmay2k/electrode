"use strict";

const chai = require('chai');
const expect = chai.expect;
const { until, setCSPNonce } = require("../../lib/utils");

describe('subapp-server utils', function() {
  this.timeout(8000);

  it('should resolve when the condition is met before the max wait time', async function() {
    let conditionMet = false;
    setTimeout(() => {
      conditionMet = true;
    }, 1000); 

    await until(() => conditionMet, 3000);
    expect(conditionMet).to.be.true;
  });

  describe("setCSPNonce", function() {
    it("should keep nonce of concurrent requests on their own request", function() {
      const routeOptions = { cspNonce: true };
      const request1 = {};
      const request2 = {};

      const nonce1 = setCSPNonce({ routeOptions, request: request1 });
      const nonce2 = setCSPNonce({ routeOptions, request: request2 });

      expect(nonce1.scriptNonce).to.not.equal(nonce2.scriptNonce);
      expect(request1.app.cspNonceValue).to.deep.equal(nonce1);
      expect(request2.app.cspNonceValue).to.deep.equal(nonce2);
      expect(routeOptions.cspNonceValue).to.equal(undefined);
    });

    it("should preserve other data on request.app", function() {
      const request = { app: { foo: "bar" } };
      setCSPNonce({ routeOptions: { cspNonce: true }, request });
      expect(request.app.foo).to.equal("bar");
      expect(request.app.cspNonceValue.scriptNonce).to.be.a("string");
    });

    it("should set nonce on routeOptions when there's no request", function() {
      const routeOptions = { cspNonce: true };
      const nonce = setCSPNonce({ routeOptions });
      expect(routeOptions.cspNonceValue).to.deep.equal(nonce);
    });
  });

});