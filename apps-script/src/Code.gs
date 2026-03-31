var APP_VERSION = "0.2.0";
var SESSION_TTL_MS = 60 * 60 * 1000;
var USERS_SHEET_NAME = "users";
var USERS_HEADERS = [
  "id",
  "provider",
  "provider_user_id",
  "email",
  "display_name",
  "avatar_url",
  "global_elo",
  "wins",
  "losses",
  "streak",
  "created_at",
  "updated_at",
];

function doGet() {
  return jsonResponse_(successResponse_("get-health", buildHealthData_()));
}

function doPost(e) {
  try {
    var request = parseRequest_(e);

    if (request.action === "health") {
      return jsonResponse_(successResponse_(request.requestId, buildHealthData_()));
    }

    if (request.action === "bootstrapUser") {
      return jsonResponse_(handleBootstrapUser_(request));
    }

    return jsonResponse_(errorResponse_(request.requestId, "NOT_FOUND", "Unknown action."));
  } catch (error) {
    var errorCode = error && error.code ? error.code : "INTERNAL_ERROR";
    return jsonResponse_(
      errorResponse_(
        "unknown",
        errorCode,
        error && error.message ? error.message : "Unhandled backend error."
      )
    );
  }
}

function handleBootstrapUser_(request) {
  var payload = request.payload || {};
  var provider = payload.provider;
  var idToken = payload.idToken;
  var nonce = payload.nonce;
  var profileHint = payload.profile || {};

  if (!provider || !idToken || !nonce) {
    return errorResponse_(
      request.requestId,
      "VALIDATION_ERROR",
      "bootstrapUser requires provider, idToken, and nonce."
    );
  }

  var identity;
  if (provider === "google") {
    identity = verifyGoogleIdToken_(idToken, nonce);
  } else {
    return errorResponse_(
      request.requestId,
      "VALIDATION_ERROR",
      "Unsupported auth provider. Apple is deferred in the current scope."
    );
  }

  var userRecord = upsertUser_(identity);
  var session = createSessionToken_(userRecord.id);

  return successResponse_(request.requestId, {
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: userRecord.id,
      provider: userRecord.provider,
      displayName: userRecord.displayName,
      email: userRecord.email,
      avatarUrl: userRecord.avatarUrl,
    },
  });
}

function verifyGoogleIdToken_(idToken, nonce) {
  var clientId = requireProperty_("GOOGLE_CLIENT_ID");
  var response = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );

  if (response.getResponseCode() !== 200) {
    throw unauthorizedError_("Google rejected the supplied ID token.");
  }

  var tokenInfo = JSON.parse(response.getContentText());
  validateIdTokenClaims_(tokenInfo, {
    provider: "google",
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    nonce: nonce,
  });

  return {
    provider: "google",
    providerUserId: tokenInfo.sub,
    email: tokenInfo.email || null,
    displayName: tokenInfo.name || tokenInfo.email || "Google user",
    avatarUrl: tokenInfo.picture || null,
  };
}

function validateIdTokenClaims_(claims, options) {
  if (!claims.sub) {
    throw unauthorizedError_(options.provider + " token is missing sub.");
  }

  if (String(claims.aud) !== options.audience) {
    throw unauthorizedError_(options.provider + " token audience mismatch.");
  }

  if (options.issuer.indexOf(String(claims.iss)) === -1) {
    throw unauthorizedError_(options.provider + " token issuer mismatch.");
  }

  var expiresAtMs = Number(claims.exp) * 1000;
  if (!expiresAtMs || expiresAtMs <= Date.now()) {
    throw unauthorizedError_(options.provider + " token has expired.");
  }

  if (options.nonce) {
    var actualNonce = claims.nonce ? String(claims.nonce) : "";
    var expectedNonce = String(options.nonce);
    var hashedNonce = sha256Hex_(expectedNonce);

    if (
      !actualNonce ||
      (actualNonce !== expectedNonce &&
        (!options.allowHashedNonce || actualNonce !== hashedNonce))
    ) {
      throw unauthorizedError_(options.provider + " token nonce mismatch.");
    }
  }
}

function upsertUser_(identity) {
  var sheet = getUsersSheet_();
  var values = getSheetData_(sheet);
  var now = new Date().toISOString();
  var rowIndex = findUserRow_(values, identity.provider, identity.providerUserId);
  var userRecord;

  if (rowIndex === -1) {
    userRecord = {
      id: Utilities.getUuid(),
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      email: identity.email,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      globalElo: 1200,
      wins: 0,
      losses: 0,
      streak: 0,
      createdAt: now,
      updatedAt: now,
    };

    sheet.appendRow([
      userRecord.id,
      userRecord.provider,
      userRecord.providerUserId,
      userRecord.email,
      userRecord.displayName,
      userRecord.avatarUrl,
      userRecord.globalElo,
      userRecord.wins,
      userRecord.losses,
      userRecord.streak,
      userRecord.createdAt,
      userRecord.updatedAt,
    ]);
  } else {
    var rowNumber = rowIndex + 2;
    var existing = values[rowIndex];
    userRecord = {
      id: existing[0],
      provider: existing[1],
      providerUserId: existing[2],
      email: identity.email,
      displayName: identity.displayName || existing[4],
      avatarUrl: identity.avatarUrl,
      globalElo: Number(existing[6] || 1200),
      wins: Number(existing[7] || 0),
      losses: Number(existing[8] || 0),
      streak: Number(existing[9] || 0),
      createdAt: existing[10] || now,
      updatedAt: now,
    };

    sheet
      .getRange(rowNumber, 1, 1, USERS_HEADERS.length)
      .setValues([[
        userRecord.id,
        userRecord.provider,
        userRecord.providerUserId,
        userRecord.email,
        userRecord.displayName,
        userRecord.avatarUrl,
        userRecord.globalElo,
        userRecord.wins,
        userRecord.losses,
        userRecord.streak,
        userRecord.createdAt,
        userRecord.updatedAt,
      ]]);
  }

  return userRecord;
}

function getUsersSheet_() {
  var spreadsheetId = requireProperty_("DATA_SPREADSHEET_ID");
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(USERS_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(USERS_HEADERS);
  } else {
    var headerRange = sheet.getRange(1, 1, 1, USERS_HEADERS.length);
    var currentHeaders = headerRange.getValues()[0];
    var needsHeaderReset = false;

    for (var i = 0; i < USERS_HEADERS.length; i += 1) {
      if (currentHeaders[i] !== USERS_HEADERS[i]) {
        needsHeaderReset = true;
        break;
      }
    }

    if (needsHeaderReset) {
      headerRange.setValues([USERS_HEADERS]);
    }
  }

  return sheet;
}

function getSheetData_(sheet) {
  var rowCount = sheet.getLastRow();
  if (rowCount <= 1) {
    return [];
  }

  return sheet.getRange(2, 1, rowCount - 1, USERS_HEADERS.length).getValues();
}

function findUserRow_(values, provider, providerUserId) {
  for (var index = 0; index < values.length; index += 1) {
    if (values[index][1] === provider && values[index][2] === providerUserId) {
      return index;
    }
  }

  return -1;
}

function createSessionToken_(userId) {
  var secret = requireProperty_("APP_SESSION_SECRET");
  var now = Date.now();
  var header = { alg: "HS256", typ: "JWT" };
  var payload = {
    sub: userId,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + SESSION_TTL_MS) / 1000),
  };

  var encodedHeader = base64UrlEncodeString_(JSON.stringify(header));
  var encodedPayload = base64UrlEncodeString_(JSON.stringify(payload));
  var signingInput = encodedHeader + "." + encodedPayload;
  var signatureBytes = Utilities.computeHmacSha256Signature(signingInput, secret);
  var encodedSignature = base64UrlEncodeBytes_(signatureBytes);

  return {
    token: signingInput + "." + encodedSignature,
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body.");
  }

  if (e.postData.contents.length > 32 * 1024) {
    throw new Error("Request body exceeds the 32KB limit.");
  }

  var request = JSON.parse(e.postData.contents);

  if (!request.action || !request.requestId) {
    throw new Error("Request must include action and requestId.");
  }

  return request;
}

function buildHealthData_() {
  return {
    status: "ok",
    environment: getEnvironment_(),
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
  };
}

function getEnvironment_() {
  var properties = PropertiesService.getScriptProperties();
  return properties.getProperty("APP_ENV") || "dev";
}

function requireProperty_(name) {
  var properties = PropertiesService.getScriptProperties();
  var value = properties.getProperty(name);

  if (!value) {
    throw new Error("Missing required script property: " + name);
  }

  return value;
}

function base64UrlEncodeString_(value) {
  return base64UrlEncodeBytes_(Utilities.newBlob(value).getBytes());
}

function base64UrlEncodeBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function sha256Hex_(value) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  var output = "";

  for (var i = 0; i < digest.length; i += 1) {
    var current = digest[i];
    if (current < 0) {
      current += 256;
    }
    var hex = current.toString(16);
    output += hex.length === 1 ? "0" + hex : hex;
  }

  return output;
}

function successResponse_(requestId, data) {
  return {
    ok: true,
    data: data,
    error: null,
    requestId: requestId,
  };
}

function errorResponse_(requestId, code, message) {
  return {
    ok: false,
    data: null,
    error: {
      code: code,
      message: message,
    },
    requestId: requestId,
  };
}

function unauthorizedError_(message) {
  var error = new Error(message);
  error.code = "UNAUTHORIZED";
  return error;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
