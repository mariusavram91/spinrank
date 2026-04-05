describe("auth providers", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete window.google;
  });

  it("reports the Google provider as configured when a client id is present", async () => {
    const { isProviderConfigured } = await import("../../../src/auth/providers");

    expect(isProviderConfigured()).toBe(true);
  });

  it("fails when Google Identity Services never becomes available", async () => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.dataset.loaded = "true";
    document.head.append(script);

    const { renderGoogleButton } = await import("../../../src/auth/providers");

    await expect(renderGoogleButton(document.createElement("div"), vi.fn())).rejects.toThrow(
      "Google Identity Services did not initialize.",
    );
  });

  it("initializes GIS and forwards credentials to the success handler", async () => {
    const initialize = vi.fn();
    const renderButton = vi.fn((host: HTMLElement) => {
      host.append(document.createElement("button"));
    });

    window.google = {
      accounts: {
        id: {
          initialize,
          renderButton,
        },
      },
    };

    const { renderGoogleButton } = await import("../../../src/auth/providers");
    const host = document.createElement("div");
    host.append(document.createElement("span"));
    document.body.append(host);
    const onSuccess = vi.fn().mockResolvedValue(undefined);

    const renderPromise = renderGoogleButton(host, onSuccess);
    const script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (!script?.onload) {
      throw new Error("Expected GIS script to be appended.");
    }
    script.onload(new Event("load"));

    await renderPromise;

    expect(host.querySelector("span")).toBeNull();
    expect(renderButton).toHaveBeenCalledWith(
      host,
      expect.objectContaining({
        theme: "filled_black",
        width: 240,
      }),
    );
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-google-client-id",
        nonce: expect.any(String),
      }),
    );

    const [{ callback, nonce }] = initialize.mock.calls[0];
    callback({ credential: "google-id-token" });

    expect(onSuccess).toHaveBeenCalledWith({
      provider: "google",
      idToken: "google-id-token",
      nonce,
    });
  });

  it("surfaces script loading failures", async () => {
    const { renderGoogleButton } = await import("../../../src/auth/providers");

    const renderPromise = renderGoogleButton(document.createElement("div"), vi.fn());
    const script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (!script?.onerror) {
      throw new Error("Expected GIS script to be appended.");
    }
    script.onerror(new Event("error"));

    await expect(renderPromise).rejects.toThrow("Failed to load https://accounts.google.com/gsi/client.");
  });
});
