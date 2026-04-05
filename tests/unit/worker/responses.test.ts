import { applySecurityHeaders, cors, errorResponse, getCorsOrigin, json, successResponse } from "../../../worker/src/responses";
import { makeTestEnv } from "../../helpers/worker/make-test-env";

describe("worker responses", () => {
  it("prefers the request origin outside production", () => {
    const env = makeTestEnv({
      APP_ENV: "dev",
      APP_ORIGIN: "https://app.spinrank.test/base",
    });

    expect(getCorsOrigin(env, "https://preview.spinrank.test/path")).toBe("https://preview.spinrank.test");
  });

  it("falls back to the configured app origin in production", () => {
    const env = makeTestEnv({
      APP_ENV: "prod",
      APP_ORIGIN: "https://app.spinrank.test/base",
    });

    expect(getCorsOrigin(env, "https://preview.spinrank.test/path")).toBe("https://app.spinrank.test");
    expect(getCorsOrigin(makeTestEnv({ APP_ENV: "prod", APP_ORIGIN: "" }), "notaurl")).toBe("notaurl");
    expect(getCorsOrigin(makeTestEnv({ APP_ENV: "prod", APP_ORIGIN: "" }), null)).toBe("*");
  });

  it("builds success and error envelopes with the request id intact", () => {
    expect(successResponse("req_ok", { status: "ok" })).toEqual({
      ok: true,
      data: { status: "ok" },
      error: null,
      requestId: "req_ok",
    });

    expect(errorResponse("req_err", "BAD_REQUEST", "Broken", { field: "name" })).toEqual({
      ok: false,
      data: null,
      error: {
        code: "BAD_REQUEST",
        message: "Broken",
        details: { field: "name" },
      },
      requestId: "req_err",
    });
  });

  it("adds CORS and security headers to json responses without replacing existing security overrides", async () => {
    const env = makeTestEnv({
      APP_ENV: "prod",
      APP_ORIGIN: "https://app.spinrank.test",
    });

    const response = json(
      env,
      { ok: true },
      201,
      "https://preview.spinrank.test",
      { "x-content-type-options": "custom", "x-extra": "1" },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.spinrank.test");
    expect(response.headers.get("x-content-type-options")).toBe("custom");
    expect(response.headers.get("x-extra")).toBe("1");

    const headers = new Headers({ "referrer-policy": "custom-policy" });
    applySecurityHeaders(headers);
    expect(headers.get("referrer-policy")).toBe("custom-policy");
    expect(headers.get("strict-transport-security")).toContain("max-age");

    const corsHeaders = cors(env, "https://preview.spinrank.test");
    expect(corsHeaders).toMatchObject({
      "access-control-allow-origin": "https://app.spinrank.test",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    });
  });
});
