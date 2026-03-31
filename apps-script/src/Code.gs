var APP_VERSION = "0.1.0";

function doGet() {
  return jsonResponse_({
    ok: true,
    data: {
      status: "ok",
      environment: getEnvironment_(),
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    },
    error: null,
    requestId: "get-health",
  });
}

function doPost(e) {
  try {
    var request = parseRequest_(e);

    if (request.action === "health") {
      return jsonResponse_({
        ok: true,
        data: {
          status: "ok",
          environment: getEnvironment_(),
          timestamp: new Date().toISOString(),
          version: APP_VERSION,
        },
        error: null,
        requestId: request.requestId,
      });
    }

    return jsonResponse_({
      ok: false,
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Unknown action.",
      },
      requestId: request.requestId,
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: error && error.message ? error.message : "Unhandled backend error.",
      },
      requestId: "unknown",
    });
  }
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body.");
  }

  var request = JSON.parse(e.postData.contents);

  if (!request.action || !request.requestId) {
    throw new Error("Request must include action and requestId.");
  }

  return request;
}

function getEnvironment_() {
  var properties = PropertiesService.getScriptProperties();
  return properties.getProperty("APP_ENV") || "dev";
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
