import { createApiClient } from "../../../src/api/client";

describe("api client", () => {
  it("posts the action envelope with an injected request id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { status: "ok", environment: "test", timestamp: "2026-04-04T00:00:00.000Z", version: "1" },
          error: null,
          requestId: "req_fixed",
        }),
        { status: 200 },
      ),
    );

    const client = createApiClient({
      backendUrl: "https://api.example.test",
      fetchImpl,
      createRequestId: () => "req_fixed",
    });

    const response = await client.postAction("health", {});

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.test", {
      method: "POST",
      headers: {
        "content-type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "health",
        payload: {},
        requestId: "req_fixed",
      }),
    });
    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({ status: "ok" });
  });

  it("surfaces backend errors from the parsed envelope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Bad payload",
          },
          requestId: "req_fixed",
        }),
        { status: 400, statusText: "Bad Request" },
      ),
    );

    const client = createApiClient({
      backendUrl: "https://api.example.test",
      fetchImpl,
    });

    await expect(client.postAction("health", {})).rejects.toThrow("Bad payload (status 400)");
  });

  it("rejects unexpected successful responses with no valid envelope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    const client = createApiClient({
      backendUrl: "https://api.example.test",
      fetchImpl,
    });

    await expect(client.postAction("health", {})).rejects.toThrow(
      "Backend returned an unexpected response.",
    );
  });

  it("throws when the backend URL is missing", async () => {
    const client = createApiClient({
      backendUrl: "",
      fetchImpl: vi.fn(),
    });

    await expect(client.postAction("health", {})).rejects.toThrow(
      "VITE_API_BASE_URL is not configured.",
    );
  });
});
