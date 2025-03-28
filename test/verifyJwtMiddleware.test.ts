import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const { expect } = chai;

import sinon from "sinon";
import jwt from "jsonwebtoken";
import * as jwksClient from "jwks-rsa";
import http from "http";
import { verifyJwtMiddleware } from "../src/index.ts";

describe("verifyJwtMiddleware", () => {
  beforeEach(() => {
    sinon.stub(jwksClient.JwksClient.prototype, "getSigningKeys").resolves([
      { getPublicKey: () => "fake-public-key" } as any,
    ]);
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.REQUIRED_GROUPS;
  });

  it("should throw on missing Authorization header", async () => {
    const req = { headers: {} } as http.IncomingMessage;

    await expect(verifyJwtMiddleware(req)).to.be.rejectedWith("Missing or invalid Authorization header");
  });

  it("should reject JWT without required group", async () => {
    process.env.REQUIRED_GROUPS = "uniteddd";
    sinon.stub(jwt, "verify").callsFake((_token, _key, _opts, cb?: jwt.VerifyCallback) => {
      if (cb) cb(null, { sub: "user", groups: ["sre", "sandbox"] }); 
    });
  
    const req = {
      headers: {
        authorization: "Bearer dummy-token",
      },
    } as http.IncomingMessage;
  
    await expect(verifyJwtMiddleware(req)).to.be.rejectedWith("User does not belong to any required group");
  });
  
  it("should accept a valid JWT with a matching group", async () => {
    process.env.REQUIRED_GROUPS = "sandbox,sre";

    sinon.stub(jwt, "verify").callsFake((_token, _key, _opts, cb?: jwt.VerifyCallback) => {
        if (cb) cb(null, { sub: "user", groups: ["sre", "sandbox"] });
    });      

    const req = {
      headers: {
        authorization: "Bearer dummy-token",
      },
    } as http.IncomingMessage;

    const user = await verifyJwtMiddleware(req);
    expect(user).to.have.property("sub", "user");
  });
});
