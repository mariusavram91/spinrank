var APP_VERSION = "0.3.0";
var SESSION_TTL_MS = 60 * 60 * 1000;
var USERS_SHEET_NAME = "users";
var MATCHES_SHEET_NAME = "matches";
var SEASONS_SHEET_NAME = "seasons";
var TOURNAMENTS_SHEET_NAME = "tournaments";
var ELO_SEGMENTS_SHEET_NAME = "elo_segments";

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

var MATCHES_HEADERS = [
  "id",
  "match_type",
  "format_type",
  "points_to_win",
  "team_a_player_ids",
  "team_b_player_ids",
  "score_json",
  "winner_team",
  "global_elo_delta_json",
  "segment_elo_delta_json",
  "played_at",
  "season_id",
  "tournament_id",
  "created_by_user_id",
  "status",
  "deactivated_at",
  "deactivated_by_user_id",
  "deactivation_reason",
  "created_at",
];

var SEASONS_HEADERS = [
  "id",
  "name",
  "start_date",
  "end_date",
  "is_active",
  "base_elo_mode",
  "created_at",
];

var TOURNAMENTS_HEADERS = [
  "id",
  "name",
  "date",
  "season_id",
  "created_at",
];

var ELO_SEGMENTS_HEADERS = [
  "id",
  "segment_type",
  "segment_id",
  "user_id",
  "elo",
  "matches_played",
  "wins",
  "losses",
  "streak",
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

    request.sessionUser = requireSessionUser_(request.sessionToken);

    if (request.action === "getLeaderboard") {
      return jsonResponse_(handleGetLeaderboard_(request));
    }

    if (request.action === "getSegmentLeaderboard") {
      return jsonResponse_(handleGetSegmentLeaderboard_(request));
    }

    if (request.action === "getMatches") {
      return jsonResponse_(handleGetMatches_(request));
    }

    if (request.action === "getSeasons") {
      return jsonResponse_(handleGetSeasons_(request));
    }

    if (request.action === "getTournaments") {
      return jsonResponse_(handleGetTournaments_(request));
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
    user: serializeAppUser_(userRecord),
  });
}

function handleGetLeaderboard_(request) {
  var leaderboard = buildGlobalLeaderboard_();
  return successResponse_(request.requestId, {
    leaderboard: leaderboard,
    updatedAt: leaderboard.length ? leaderboard[0].updatedAt : new Date().toISOString(),
  });
}

function handleGetSegmentLeaderboard_(request) {
  var payload = request.payload || {};
  var segmentType = payload.segmentType;
  var segmentId = payload.segmentId;

  if ((segmentType !== "season" && segmentType !== "tournament") || !segmentId) {
    return errorResponse_(
      request.requestId,
      "VALIDATION_ERROR",
      "getSegmentLeaderboard requires segmentType and segmentId."
    );
  }

  var leaderboard = buildSegmentLeaderboard_(segmentType, segmentId);
  return successResponse_(request.requestId, {
    segmentType: segmentType,
    segmentId: segmentId,
    leaderboard: leaderboard,
    updatedAt: leaderboard.length ? leaderboard[0].updatedAt : new Date().toISOString(),
  });
}

function handleGetMatches_(request) {
  var payload = request.payload || {};
  var limit = Number(payload.limit || 20);
  var cursor = payload.cursor || "";

  if (!limit || limit < 1 || limit > 50) {
    return errorResponse_(
      request.requestId,
      "VALIDATION_ERROR",
      "getMatches limit must be between 1 and 50."
    );
  }

  var sortedMatches = getMatchRecords_();
  var startIndex = 0;

  if (cursor) {
    startIndex = decodeMatchCursor_(cursor, sortedMatches);
  }

  var page = sortedMatches.slice(startIndex, startIndex + limit);
  var nextCursor = null;
  var nextIndex = startIndex + page.length;

  if (nextIndex < sortedMatches.length) {
    nextCursor = encodeMatchCursor_(sortedMatches[nextIndex - 1]);
  }

  return successResponse_(request.requestId, {
    matches: page,
    nextCursor: nextCursor,
  });
}

function handleGetSeasons_(request) {
  return successResponse_(request.requestId, {
    seasons: getSeasonRecords_(),
  });
}

function handleGetTournaments_(request) {
  var payload = request.payload || {};
  var seasonId = payload.seasonId || "";
  var tournaments = getTournamentRecords_();

  if (seasonId) {
    tournaments = tournaments.filter(function (record) {
      return record.seasonId === seasonId;
    });
  }

  return successResponse_(request.requestId, {
    tournaments: tournaments,
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

function requireSessionUser_(sessionToken) {
  if (!sessionToken) {
    throw unauthorizedError_("Session token is required.");
  }

  var secret = requireProperty_("APP_SESSION_SECRET");
  var tokenParts = String(sessionToken).split(".");
  if (tokenParts.length !== 3) {
    throw unauthorizedError_("Malformed session token.");
  }

  var signingInput = tokenParts[0] + "." + tokenParts[1];
  var expectedSignature = base64UrlEncodeBytes_(
    Utilities.computeHmacSha256Signature(signingInput, secret)
  );

  if (expectedSignature !== tokenParts[2]) {
    throw unauthorizedError_("Session token signature mismatch.");
  }

  var payload = JSON.parse(base64UrlDecodeToString_(tokenParts[1]));
  if (!payload.sub || !payload.exp) {
    throw unauthorizedError_("Session token payload is invalid.");
  }

  if (Number(payload.exp) * 1000 <= Date.now()) {
    throw unauthorizedError_("Session token has expired.");
  }

  var userRecord = getUserById_(String(payload.sub));
  if (!userRecord) {
    throw unauthorizedError_("Session user no longer exists.");
  }

  return userRecord;
}

function upsertUser_(identity) {
  var sheet = getOrCreateSheet_(USERS_SHEET_NAME, USERS_HEADERS);
  var values = getSheetData_(sheet, USERS_HEADERS.length);
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

    sheet.appendRow(userToRow_(userRecord));
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

    sheet.getRange(rowNumber, 1, 1, USERS_HEADERS.length).setValues([userToRow_(userRecord)]);
  }

  return userRecord;
}

function buildGlobalLeaderboard_() {
  var users = getUserRecords_();
  users.sort(function (left, right) {
    return compareLeaderboardRows_(
      {
        elo: left.globalElo,
        wins: left.wins,
        losses: left.losses,
        displayName: left.displayName,
      },
      {
        elo: right.globalElo,
        wins: right.wins,
        losses: right.losses,
        displayName: right.displayName,
      }
    );
  });

  return users.map(function (user, index) {
    return {
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      elo: user.globalElo,
      wins: user.wins,
      losses: user.losses,
      streak: user.streak,
      rank: index + 1,
      updatedAt: user.updatedAt,
    };
  });
}

function buildSegmentLeaderboard_(segmentType, segmentId) {
  var usersById = getUserMapById_();
  var sheet = getOrCreateSheet_(ELO_SEGMENTS_SHEET_NAME, ELO_SEGMENTS_HEADERS);
  var rows = getSheetData_(sheet, ELO_SEGMENTS_HEADERS.length);
  var filtered = [];

  for (var index = 0; index < rows.length; index += 1) {
    if (rows[index][1] !== segmentType || rows[index][2] !== segmentId) {
      continue;
    }

    var user = usersById[rows[index][3]];
    if (!user) {
      continue;
    }

    filtered.push({
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      elo: Number(rows[index][4] || 1200),
      wins: Number(rows[index][6] || 0),
      losses: Number(rows[index][7] || 0),
      streak: Number(rows[index][8] || 0),
      updatedAt: rows[index][9] || new Date().toISOString(),
    });
  }

  filtered.sort(compareLeaderboardRows_);

  return filtered.map(function (entry, index) {
    return {
      userId: entry.userId,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      elo: entry.elo,
      wins: entry.wins,
      losses: entry.losses,
      streak: entry.streak,
      rank: index + 1,
      updatedAt: entry.updatedAt,
    };
  });
}

function getMatchRecords_() {
  var sheet = getOrCreateSheet_(MATCHES_SHEET_NAME, MATCHES_HEADERS);
  var rows = getSheetData_(sheet, MATCHES_HEADERS.length);
  var matches = rows.map(function (row) {
    return {
      id: row[0],
      matchType: row[1],
      formatType: row[2],
      pointsToWin: Number(row[3] || 11),
      teamAPlayerIds: parseJsonArray_(row[4]),
      teamBPlayerIds: parseJsonArray_(row[5]),
      score: parseJsonArray_(row[6]),
      winnerTeam: row[7],
      playedAt: row[10],
      seasonId: row[11] || null,
      tournamentId: row[12] || null,
      createdByUserId: row[13],
      status: row[14] || "active",
      createdAt: row[18] || row[10] || "",
    };
  });

  matches.sort(compareMatchRowsDesc_);
  return matches;
}

function getSeasonRecords_() {
  var sheet = getOrCreateSheet_(SEASONS_SHEET_NAME, SEASONS_HEADERS);
  var rows = getSheetData_(sheet, SEASONS_HEADERS.length);
  var seasons = rows.map(function (row) {
    return {
      id: row[0],
      name: row[1],
      startDate: row[2],
      endDate: row[3],
      isActive: row[4] === true || String(row[4]).toLowerCase() === "true",
      baseEloMode: row[5] || "carry_over",
    };
  });

  seasons.sort(function (left, right) {
    return String(right.startDate).localeCompare(String(left.startDate));
  });
  return seasons;
}

function getTournamentRecords_() {
  var sheet = getOrCreateSheet_(TOURNAMENTS_SHEET_NAME, TOURNAMENTS_HEADERS);
  var rows = getSheetData_(sheet, TOURNAMENTS_HEADERS.length);
  var tournaments = rows.map(function (row) {
    return {
      id: row[0],
      name: row[1],
      date: row[2],
      seasonId: row[3] || null,
    };
  });

  tournaments.sort(function (left, right) {
    return String(right.date).localeCompare(String(left.date));
  });
  return tournaments;
}

function getUserRecords_() {
  var sheet = getOrCreateSheet_(USERS_SHEET_NAME, USERS_HEADERS);
  var rows = getSheetData_(sheet, USERS_HEADERS.length);

  return rows
    .filter(function (row) {
      return !!row[0];
    })
    .map(function (row) {
      return {
        id: row[0],
        provider: row[1],
        providerUserId: row[2],
        email: row[3] || null,
        displayName: row[4] || "Unnamed player",
        avatarUrl: row[5] || null,
        globalElo: Number(row[6] || 1200),
        wins: Number(row[7] || 0),
        losses: Number(row[8] || 0),
        streak: Number(row[9] || 0),
        createdAt: row[10] || "",
        updatedAt: row[11] || new Date().toISOString(),
      };
    });
}

function getUserMapById_() {
  var users = getUserRecords_();
  var result = {};

  for (var index = 0; index < users.length; index += 1) {
    result[users[index].id] = users[index];
  }

  return result;
}

function getUserById_(userId) {
  var users = getUserRecords_();

  for (var index = 0; index < users.length; index += 1) {
    if (users[index].id === userId) {
      return users[index];
    }
  }

  return null;
}

function userToRow_(userRecord) {
  return [
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
  ];
}

function serializeAppUser_(userRecord) {
  return {
    id: userRecord.id,
    provider: userRecord.provider,
    displayName: userRecord.displayName,
    email: userRecord.email,
    avatarUrl: userRecord.avatarUrl,
  };
}

function getOrCreateSheet_(sheetName, headers) {
  var spreadsheetId = requireProperty_("DATA_SPREADSHEET_ID");
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    var currentHeaders = headerRange.getValues()[0];
    var needsHeaderReset = false;

    for (var index = 0; index < headers.length; index += 1) {
      if (currentHeaders[index] !== headers[index]) {
        needsHeaderReset = true;
        break;
      }
    }

    if (needsHeaderReset) {
      headerRange.setValues([headers]);
    }
  }

  return sheet;
}

function getSheetData_(sheet, width) {
  var rowCount = sheet.getLastRow();
  if (rowCount <= 1) {
    return [];
  }

  return sheet.getRange(2, 1, rowCount - 1, width).getValues();
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
    throw validationError_("Missing request body.");
  }

  if (e.postData.contents.length > 32 * 1024) {
    throw validationError_("Request body exceeds the 32KB limit.");
  }

  var request = JSON.parse(e.postData.contents);

  if (!request.action || !request.requestId) {
    throw validationError_("Request must include action and requestId.");
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

function compareLeaderboardRows_(left, right) {
  if (right.elo !== left.elo) {
    return right.elo - left.elo;
  }

  if (right.wins !== left.wins) {
    return right.wins - left.wins;
  }

  if (left.losses !== right.losses) {
    return left.losses - right.losses;
  }

  return String(left.displayName).localeCompare(String(right.displayName));
}

function compareMatchRowsDesc_(left, right) {
  if (left.playedAt !== right.playedAt) {
    return String(right.playedAt).localeCompare(String(left.playedAt));
  }

  if (left.createdAt !== right.createdAt) {
    return String(right.createdAt).localeCompare(String(left.createdAt));
  }

  return String(right.id).localeCompare(String(left.id));
}

function encodeMatchCursor_(match) {
  return base64UrlEncodeString_(
    JSON.stringify({
      playedAt: match.playedAt,
      createdAt: match.createdAt,
      id: match.id,
    })
  );
}

function decodeMatchCursor_(cursor, sortedMatches) {
  try {
    var decoded = JSON.parse(base64UrlDecodeToString_(cursor));

    for (var index = 0; index < sortedMatches.length; index += 1) {
      if (
        sortedMatches[index].id === decoded.id &&
        sortedMatches[index].playedAt === decoded.playedAt &&
        sortedMatches[index].createdAt === decoded.createdAt
      ) {
        return index + 1;
      }
    }

    return sortedMatches.length;
  } catch (error) {
    throw validationError_("Invalid matches cursor.");
  }
}

function parseJsonArray_(value) {
  if (!value) {
    return [];
  }

  if (Object.prototype.toString.call(value) === "[object Array]") {
    return value;
  }

  return JSON.parse(value);
}

function base64UrlEncodeString_(value) {
  return base64UrlEncodeBytes_(Utilities.newBlob(value).getBytes());
}

function base64UrlEncodeBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function base64UrlDecodeToString_(value) {
  var padded = String(value);
  while (padded.length % 4 !== 0) {
    padded += "=";
  }

  return Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString();
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

function validationError_(message) {
  var error = new Error(message);
  error.code = "VALIDATION_ERROR";
  return error;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
