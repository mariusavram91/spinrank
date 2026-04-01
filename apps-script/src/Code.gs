var APP_VERSION = "0.3.0";
var SESSION_TTL_MS = 60 * 60 * 1000;
var USERS_SHEET_NAME = "users";
var MATCHES_SHEET_NAME = "matches";
var SEASONS_SHEET_NAME = "seasons";
var TOURNAMENTS_SHEET_NAME = "tournaments";
var ELO_SEGMENTS_SHEET_NAME = "elo_segments";
var AUDIT_LOG_SHEET_NAME = "audit_log";
var TOURNAMENT_PLANS_SHEET_NAME = "tournament_plans";

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
  "participant_ids_json",
  "created_by_user_id",
  "created_at",
];

var TOURNAMENTS_HEADERS = [
  "id",
  "name",
  "date",
  "season_id",
  "created_by_user_id",
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

var AUDIT_LOG_HEADERS = [
  "id",
  "action",
  "actor_user_id",
  "target_id",
  "payload_json",
  "created_at",
];

var TOURNAMENT_PLANS_HEADERS = [
  "id",
  "tournament_id",
  "participant_ids_json",
  "bracket_json",
  "created_by_user_id",
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

    if (request.action === "createMatch") {
      return jsonResponse_(handleCreateMatch_(request));
    }

    if (request.action === "createSeason") {
      return jsonResponse_(handleCreateSeason_(request));
    }

    if (request.action === "createTournament") {
      return jsonResponse_(handleCreateTournament_(request));
    }

    if (request.action === "getSeasons") {
      return jsonResponse_(handleGetSeasons_(request));
    }

    if (request.action === "getTournaments") {
      return jsonResponse_(handleGetTournaments_(request));
    }

    if (request.action === "getTournamentBracket") {
      return jsonResponse_(handleGetTournamentBracket_(request));
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

  requireSegmentAccess_(segmentType, segmentId, request.sessionUser.id);

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

  var sortedMatches = getVisibleMatchRecords_(request.sessionUser.id);
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
    seasons: getVisibleSeasonRecords_(request.sessionUser.id),
  });
}

function handleGetTournaments_(request) {
  var payload = request.payload || {};
  var seasonId = payload.seasonId || "";
  var tournaments = getVisibleTournamentRecords_(request.sessionUser.id);

  if (seasonId) {
    tournaments = tournaments.filter(function (record) {
      return record.seasonId === seasonId;
    });
  }

  return successResponse_(request.requestId, {
    tournaments: tournaments,
  });
}

function handleGetTournamentBracket_(request) {
  var payload = request.payload || {};
  var tournamentId = String(payload.tournamentId || "");

  if (!tournamentId) {
    return errorResponse_(
      request.requestId,
      "VALIDATION_ERROR",
      "getTournamentBracket requires tournamentId."
    );
  }

  var tournament = getTournamentById_(tournamentId);
  var plan = getTournamentPlanByTournamentId_(tournamentId);

  if (!tournament || !plan || !canAccessTournament_(tournament, plan, request.sessionUser.id)) {
    return errorResponse_(request.requestId, "NOT_FOUND", "Tournament bracket was not found.");
  }

  return successResponse_(request.requestId, {
    tournament: tournament,
    participantIds: parseJsonArray_(plan.participantIdsJson),
    rounds: parseJsonObject_(plan.bracketJson),
  });
}

function handleCreateMatch_(request) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var existingResult = getExistingCreateMatchResult_(request.requestId);
    if (existingResult) {
      return successResponse_(request.requestId, existingResult);
    }

    var payload = validateCreateMatchPayload_(request.payload || {});
    var context = buildCreateMatchContext_(payload, request.sessionUser, request.requestId);
    persistCreateMatch_(context);
    if (context.tournamentBracketMatchId) {
      updateTournamentBracketMatchLink_(
        context.match.tournamentId,
        context.tournamentBracketMatchId,
        context.match.id
      );
    }
    appendAuditLog_(
      "createMatch",
      request.sessionUser.id,
      context.match.id,
      {
        requestId: request.requestId,
        payloadHash: sha256Hex_(JSON.stringify(request.payload || {})),
        matchId: context.match.id,
      },
      context.nowIso
    );

    return successResponse_(request.requestId, {
      match: context.match,
    });
  } finally {
    lock.releaseLock();
  }
}

function handleCreateSeason_(request) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var payload = validateCreateSeasonPayload_(request.payload || {}, request.sessionUser.id);
    var season = persistSeason_(payload, request.sessionUser.id);

    appendAuditLog_(
      "createSeason",
      request.sessionUser.id,
      season.id,
      {
        requestId: request.requestId,
        payloadHash: sha256Hex_(JSON.stringify(request.payload || {})),
        seasonId: season.id,
      }
    );

    return successResponse_(request.requestId, {
      season: season,
    });
  } finally {
    lock.releaseLock();
  }
}

function handleCreateTournament_(request) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var payload = validateCreateTournamentPayload_(request.payload || {}, request.sessionUser.id);
    var tournament = persistTournamentPlan_(payload, request.sessionUser.id);

    appendAuditLog_(
      "createTournament",
      request.sessionUser.id,
      tournament.id,
      {
        requestId: request.requestId,
        payloadHash: sha256Hex_(JSON.stringify(request.payload || {})),
        tournamentId: tournament.id,
      }
    );

    return successResponse_(request.requestId, {
      tournament: tournament,
      rounds: payload.rounds,
    });
  } finally {
    lock.releaseLock();
  }
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

function getVisibleMatchRecords_(userId) {
  var visibleSeasonIds = indexVisibleIds_(getVisibleSeasonRecords_(userId));
  var visibleTournamentIds = indexVisibleIds_(getVisibleTournamentRecords_(userId));

  return getMatchRecords_().filter(function (match) {
    if (!match.seasonId && !match.tournamentId) {
      return true;
    }

    if (match.tournamentId) {
      return !!visibleTournamentIds[match.tournamentId];
    }

    if (match.seasonId) {
      return !!visibleSeasonIds[match.seasonId];
    }

    return false;
  });
}

function getSeasonRecords_() {
  var sheet = getOrCreateSheet_(SEASONS_SHEET_NAME, SEASONS_HEADERS);
  var rows = getSheetData_(sheet, SEASONS_HEADERS.length);
  var seasons = rows.map(function (row) {
    var participantIds = [];
    var createdByUserId = null;
    var createdAt = "";
    var participantIdsRaw = row[6];
    var createdByRaw = row[7];
    var createdAtRaw = row[8];
    var hasNewPrivacyColumns =
      typeof participantIdsRaw === "string" &&
      participantIdsRaw &&
      participantIdsRaw.charAt(0) === "[";

    if (hasNewPrivacyColumns) {
      participantIds = parseJsonArray_(participantIdsRaw);
      createdByUserId = createdByRaw || null;
      createdAt = createdAtRaw || "";
    } else {
      // Legacy rows used column 7 for created_at before privacy fields existed.
      participantIds = [];
      createdByUserId = null;
      createdAt = participantIdsRaw || "";
    }

    return {
      id: row[0],
      name: row[1],
      startDate: row[2],
      endDate: row[3],
      isActive: row[4] === true || String(row[4]).toLowerCase() === "true",
      baseEloMode: row[5] || "carry_over",
      participantIds: participantIds,
      createdByUserId: createdByUserId,
      createdAt: createdAt,
    };
  });

  seasons.sort(function (left, right) {
    return String(right.startDate).localeCompare(String(left.startDate));
  });
  return seasons;
}

function getVisibleSeasonRecords_(userId) {
  return getSeasonRecords_().filter(function (season) {
    return canAccessSeason_(season, userId);
  });
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
      createdByUserId: row[4] || null,
    };
  });

  tournaments.sort(function (left, right) {
    return String(right.date).localeCompare(String(left.date));
  });
  return tournaments;
}

function getVisibleTournamentRecords_(userId) {
  return getTournamentRecords_().filter(function (tournament) {
    var plan = getTournamentPlanByTournamentId_(tournament.id);
    return canAccessTournament_(tournament, plan, userId);
  });
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

function validateCreateMatchPayload_(payload) {
  var matchType = payload.matchType;
  var formatType = payload.formatType;
  var pointsToWin = Number(payload.pointsToWin);
  var teamAPlayerIds = normalizePlayerIds_(payload.teamAPlayerIds);
  var teamBPlayerIds = normalizePlayerIds_(payload.teamBPlayerIds);
  var score = normalizeScore_(payload.score);
  var winnerTeam = payload.winnerTeam;
  var playedAt = String(payload.playedAt || "");
  var seasonId = payload.seasonId ? String(payload.seasonId) : null;
  var tournamentId = payload.tournamentId ? String(payload.tournamentId) : null;
  var tournamentBracketMatchId = payload.tournamentBracketMatchId
    ? String(payload.tournamentBracketMatchId)
    : null;

  if (matchType !== "singles" && matchType !== "doubles") {
    throw validationError_("createMatch requires matchType to be singles or doubles.");
  }

  if (formatType !== "single_game" && formatType !== "best_of_3") {
    throw validationError_("createMatch requires formatType to be single_game or best_of_3.");
  }

  if (pointsToWin !== 11 && pointsToWin !== 21) {
    throw validationError_("createMatch pointsToWin must be 11 or 21.");
  }

  if (winnerTeam !== "A" && winnerTeam !== "B") {
    throw validationError_("createMatch winnerTeam must be A or B.");
  }

  if (!playedAt || isNaN(Date.parse(playedAt))) {
    throw validationError_("createMatch playedAt must be a valid ISO-8601 timestamp.");
  }

  var expectedTeamSize = matchType === "singles" ? 1 : 2;
  if (teamAPlayerIds.length !== expectedTeamSize || teamBPlayerIds.length !== expectedTeamSize) {
    throw validationError_("Team sizes do not match the selected match type.");
  }

  var seenPlayers = {};
  var index;
  for (index = 0; index < teamAPlayerIds.length; index += 1) {
    seenPlayers[teamAPlayerIds[index]] = true;
  }
  for (index = 0; index < teamBPlayerIds.length; index += 1) {
    if (seenPlayers[teamBPlayerIds[index]]) {
      throw validationError_("A player cannot appear on both teams.");
    }
  }

  validateMatchScore_(formatType, pointsToWin, score, winnerTeam);

  return {
    matchType: matchType,
    formatType: formatType,
    pointsToWin: pointsToWin,
    teamAPlayerIds: teamAPlayerIds,
    teamBPlayerIds: teamBPlayerIds,
    score: score,
    winnerTeam: winnerTeam,
    playedAt: playedAt,
    seasonId: seasonId,
    tournamentId: tournamentId,
    tournamentBracketMatchId: tournamentBracketMatchId,
  };
}

function validateCreateSeasonPayload_(payload, sessionUserId) {
  var seasonId = payload.seasonId ? String(payload.seasonId) : null;
  var name = String(payload.name || "").trim();
  var startDate = String(payload.startDate || "").trim();
  var endDate = payload.endDate ? String(payload.endDate).trim() : "";
  var isActive = payload.isActive === true || String(payload.isActive).toLowerCase() === "true";
  var baseEloMode = String(payload.baseEloMode || "carry_over");
  var participantIds = normalizePlayerIds_(payload.participantIds || []);

  if (!name) {
    throw validationError_("createSeason requires a name.");
  }

  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || isNaN(Date.parse(startDate))) {
    throw validationError_("createSeason startDate must be a valid YYYY-MM-DD value.");
  }

  if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || isNaN(Date.parse(endDate)))) {
    throw validationError_("createSeason endDate must be a valid YYYY-MM-DD value.");
  }

  if (endDate && startDate > endDate) {
    throw validationError_("createSeason endDate cannot be earlier than startDate.");
  }

  if (baseEloMode !== "carry_over" && baseEloMode !== "reset_1200") {
    throw validationError_("createSeason baseEloMode must be carry_over or reset_1200.");
  }

  if (participantIds.indexOf(sessionUserId) === -1) {
    participantIds.unshift(sessionUserId);
  }

  validatePlayersExist_(participantIds, getUserMapById_());

  if (seasonId) {
    var existingSeason = getSeasonById_(seasonId);
    if (!existingSeason || !canAccessSeason_(existingSeason, sessionUserId)) {
      throw validationError_("You cannot update this season.");
    }
  }

  return {
    seasonId: seasonId,
    name: name,
    startDate: startDate,
    endDate: endDate,
    isActive: isActive,
    baseEloMode: baseEloMode,
    participantIds: participantIds,
  };
}

function validateCreateTournamentPayload_(payload, sessionUserId) {
  var tournamentId = payload.tournamentId ? String(payload.tournamentId) : null;
  var name = String(payload.name || "").trim();
  var seasonId = payload.seasonId ? String(payload.seasonId) : null;
  var participantIds = normalizePlayerIds_(payload.participantIds || []);
  var rounds = payload.rounds;

  if (!name) {
    throw validationError_("createTournament requires a name.");
  }

  if (participantIds.length < 2) {
    throw validationError_("A tournament needs at least 2 participants.");
  }

  if (Object.prototype.toString.call(rounds) !== "[object Array]" || !rounds.length) {
    throw validationError_("createTournament requires at least one round.");
  }

  if (participantIds.indexOf(sessionUserId) === -1) {
    participantIds.unshift(sessionUserId);
  }

  validatePlayersExist_(participantIds, getUserMapById_());

  if (seasonId) {
    var season = getSeasonById_(seasonId);
    if (!season || !canAccessSeason_(season, sessionUserId)) {
      throw validationError_("You cannot use the selected season.");
    }

    for (var participantIndex = 0; participantIndex < participantIds.length; participantIndex += 1) {
      if (season.participantIds.indexOf(participantIds[participantIndex]) === -1) {
        throw validationError_("Tournament participants must belong to the selected season.");
      }
    }
  }

  if (tournamentId) {
    var existingTournament = getTournamentById_(tournamentId);
    var existingPlan = getTournamentPlanByTournamentId_(tournamentId);
    if (!existingTournament || !existingPlan || !canAccessTournament_(existingTournament, existingPlan, sessionUserId)) {
      throw validationError_("You cannot update this tournament.");
    }
  }

  return {
    tournamentId: tournamentId,
    name: name,
    seasonId: seasonId,
    participantIds: participantIds,
    rounds: rounds,
  };
}

function normalizePlayerIds_(value) {
  if (Object.prototype.toString.call(value) !== "[object Array]") {
    throw validationError_("Player team lists must be arrays.");
  }

  var normalized = [];
  var seen = {};
  for (var index = 0; index < value.length; index += 1) {
    var playerId = String(value[index] || "").trim();
    if (!playerId) {
      throw validationError_("Player IDs cannot be empty.");
    }
    if (seen[playerId]) {
      throw validationError_("A team cannot contain the same player twice.");
    }
    seen[playerId] = true;
    normalized.push(playerId);
  }
  return normalized;
}

function normalizeScore_(value) {
  if (Object.prototype.toString.call(value) !== "[object Array]" || !value.length) {
    throw validationError_("Score must include at least one game.");
  }

  return value.map(function (game) {
    if (!game || typeof game !== "object") {
      throw validationError_("Each score entry must be an object.");
    }

    var teamA = Number(game.teamA);
    var teamB = Number(game.teamB);
    if (
      !isFinite(teamA) ||
      !isFinite(teamB) ||
      teamA < 0 ||
      teamB < 0 ||
      Math.floor(teamA) !== teamA ||
      Math.floor(teamB) !== teamB
    ) {
      throw validationError_("Game scores must be non-negative integers.");
    }

    return {
      teamA: teamA,
      teamB: teamB,
    };
  });
}

function validateMatchScore_(formatType, pointsToWin, score, winnerTeam) {
  var requiredWins = formatType === "single_game" ? 1 : 2;
  var maxGames = formatType === "single_game" ? 1 : 3;

  if (score.length < requiredWins || score.length > maxGames) {
    throw validationError_("Score length does not match the selected format.");
  }

  var teamAWins = 0;
  var teamBWins = 0;

  for (var index = 0; index < score.length; index += 1) {
    var game = score[index];
    var hasWinner = game.teamA >= pointsToWin || game.teamB >= pointsToWin;
    if (!hasWinner || game.teamA === game.teamB) {
      throw validationError_("Each game must have exactly one team reach the target score.");
    }

    if (game.teamA > pointsToWin || game.teamB > pointsToWin) {
      throw validationError_("Overtime scoring is not supported in the MVP.");
    }

    if (game.teamA >= pointsToWin && game.teamB >= pointsToWin) {
      throw validationError_("Only one team can reach the target score in a game.");
    }

    if (game.teamA > game.teamB) {
      teamAWins += 1;
    } else {
      teamBWins += 1;
    }

    if (index < score.length - 1 && (teamAWins === requiredWins || teamBWins === requiredWins)) {
      throw validationError_("Score includes games after the match winner was already decided.");
    }
  }

  var actualWinner = teamAWins > teamBWins ? "A" : "B";
  if (
    teamAWins !== requiredWins &&
    teamBWins !== requiredWins &&
    score.length !== maxGames
  ) {
    throw validationError_("Best-of-3 scores must produce a series winner.");
  }

  if ((actualWinner === "A" ? teamAWins : teamBWins) < requiredWins) {
    throw validationError_("Series winner does not match the required number of games.");
  }

  if (actualWinner !== winnerTeam) {
    throw validationError_("winnerTeam does not match the submitted score.");
  }
}

function buildCreateMatchContext_(payload, sessionUser, requestId) {
  var nowIso = new Date().toISOString();
  var usersById = getUserMapById_();
  var seasonsById = indexById_(getSeasonRecords_());
  var tournamentsById = indexById_(getTournamentRecords_());
  var latestActiveMatch = getLatestActiveMatch_();
  var segmentStates = {};
  var globalDelta = computeEloDeltaForTeams_(
    payload.teamAPlayerIds,
    payload.teamBPlayerIds,
    usersById,
    payload.winnerTeam
  );
  var segmentDelta = {};
  var participants = payload.teamAPlayerIds.concat(payload.teamBPlayerIds);
  var matchId = Utilities.getUuid();

  validatePlayersExist_(participants, usersById);
  validateSegmentSelection_(payload.seasonId, payload.tournamentId, seasonsById, tournamentsById);
  if (payload.seasonId) {
    requireSegmentAccess_("season", payload.seasonId, sessionUser.id);
  }
  if (payload.tournamentId) {
    requireSegmentAccess_("tournament", payload.tournamentId, sessionUser.id);
  }
  validateTournamentBracketMatch_(payload, participants);

  if (latestActiveMatch && String(payload.playedAt).localeCompare(String(latestActiveMatch.playedAt)) < 0) {
    throw validationError_("createMatch is append-only; playedAt cannot be earlier than the latest active match.");
  }

  applyDeltaToUsers_(
    payload.teamAPlayerIds,
    payload.teamBPlayerIds,
    usersById,
    globalDelta,
    nowIso,
    payload.winnerTeam
  );

  if (payload.seasonId) {
    segmentStates.season = getSegmentStateMap_("season", payload.seasonId, participants);
    segmentDelta[payload.seasonId] = computeEloDeltaForTeams_(
      payload.teamAPlayerIds,
      payload.teamBPlayerIds,
      segmentStates.season,
      payload.winnerTeam
    );
    applyDeltaToSegmentState_(
      payload.teamAPlayerIds,
      payload.teamBPlayerIds,
      segmentStates.season,
      segmentDelta[payload.seasonId],
      nowIso,
      payload.winnerTeam
    );
  }

  if (payload.tournamentId) {
    segmentStates.tournament = getSegmentStateMap_("tournament", payload.tournamentId, participants);
    segmentDelta[payload.tournamentId] = computeEloDeltaForTeams_(
      payload.teamAPlayerIds,
      payload.teamBPlayerIds,
      segmentStates.tournament,
      payload.winnerTeam
    );
    applyDeltaToSegmentState_(
      payload.teamAPlayerIds,
      payload.teamBPlayerIds,
      segmentStates.tournament,
      segmentDelta[payload.tournamentId],
      nowIso,
      payload.winnerTeam
    );
  }

  return {
    nowIso: nowIso,
    requestId: requestId,
    tournamentBracketMatchId: payload.tournamentBracketMatchId,
    usersById: usersById,
    segmentStates: segmentStates,
    match: {
      id: matchId,
      matchType: payload.matchType,
      formatType: payload.formatType,
      pointsToWin: payload.pointsToWin,
      teamAPlayerIds: payload.teamAPlayerIds,
      teamBPlayerIds: payload.teamBPlayerIds,
      score: payload.score,
      winnerTeam: payload.winnerTeam,
      playedAt: payload.playedAt,
      seasonId: payload.seasonId,
      tournamentId: payload.tournamentId,
      createdByUserId: sessionUser.id,
      status: "active",
      createdAt: nowIso,
    },
    globalDelta: globalDelta,
    segmentDelta: segmentDelta,
  };
}

function validateTournamentBracketMatch_(payload, participants) {
  if (!payload.tournamentBracketMatchId) {
    return;
  }

  if (payload.matchType !== "singles") {
    throw validationError_("Tournament bracket match creation currently supports singles only.");
  }

  var plan = getTournamentPlanByTournamentId_(payload.tournamentId);
  if (!plan) {
    throw validationError_("Tournament bracket plan was not found.");
  }

  var rounds = parseJsonObject_(plan.bracketJson) || [];
  var bracketMatch = findBracketMatch_(rounds, payload.tournamentBracketMatchId);

  if (!bracketMatch) {
    throw validationError_("Tournament bracket pairing was not found.");
  }

  if (bracketMatch.createdMatchId) {
    throw validationError_("This tournament bracket pairing already has a created match.");
  }

  var expectedPlayers = [bracketMatch.leftPlayerId, bracketMatch.rightPlayerId]
    .filter(function (value) {
      return !!value;
    })
    .sort();
  var actualPlayers = participants.slice().sort();

  if (expectedPlayers.length !== actualPlayers.length) {
    throw validationError_("Submitted players do not match the tournament bracket pairing.");
  }

  for (var index = 0; index < expectedPlayers.length; index += 1) {
    if (expectedPlayers[index] !== actualPlayers[index]) {
      throw validationError_("Submitted players do not match the tournament bracket pairing.");
    }
  }
}

function findBracketMatch_(rounds, bracketMatchId) {
  for (var roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    var matches = rounds[roundIndex].matches || [];
    for (var matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
      if (matches[matchIndex].id === bracketMatchId) {
        return matches[matchIndex];
      }
    }
  }

  return null;
}

function indexById_(records) {
  var result = {};
  for (var index = 0; index < records.length; index += 1) {
    result[records[index].id] = records[index];
  }
  return result;
}

function indexVisibleIds_(records) {
  var result = {};
  for (var index = 0; index < records.length; index += 1) {
    result[records[index].id] = true;
  }
  return result;
}

function validatePlayersExist_(playerIds, usersById) {
  for (var index = 0; index < playerIds.length; index += 1) {
    if (!usersById[playerIds[index]]) {
      throw validationError_("Unknown player ID: " + playerIds[index]);
    }
  }
}

function validateSegmentSelection_(seasonId, tournamentId, seasonsById, tournamentsById) {
  if (seasonId && !seasonsById[seasonId]) {
    throw validationError_("Unknown season ID.");
  }

  if (tournamentId) {
    var tournament = tournamentsById[tournamentId];
    if (!tournament) {
      throw validationError_("Unknown tournament ID.");
    }

    if (seasonId && tournament.seasonId && tournament.seasonId !== seasonId) {
      throw validationError_("Selected tournament does not belong to the selected season.");
    }
  }
}

function requireSegmentAccess_(segmentType, segmentId, userId) {
  if (segmentType === "season") {
    var season = getSeasonById_(segmentId);
    if (!season || !canAccessSeason_(season, userId)) {
      throw forbiddenError_("You do not have access to this season.");
    }
    return;
  }

  if (segmentType === "tournament") {
    var tournament = getTournamentById_(segmentId);
    var plan = getTournamentPlanByTournamentId_(segmentId);
    if (!tournament || !plan || !canAccessTournament_(tournament, plan, userId)) {
      throw forbiddenError_("You do not have access to this tournament.");
    }
  }
}

function canAccessSeason_(season, userId) {
  if (!season || !userId) {
    return false;
  }

  if (!season.createdByUserId && (!season.participantIds || season.participantIds.length === 0)) {
    return true;
  }

  return season.createdByUserId === userId || season.participantIds.indexOf(userId) !== -1;
}

function canAccessTournament_(tournament, plan, userId) {
  if (!tournament || !plan || !userId) {
    return false;
  }

  var participantIds = parseJsonArray_(plan.participantIdsJson);
  return tournament.createdByUserId === userId || participantIds.indexOf(userId) !== -1;
}

function getSeasonById_(seasonId) {
  var seasons = getSeasonRecords_();

  for (var index = 0; index < seasons.length; index += 1) {
    if (seasons[index].id === seasonId) {
      return seasons[index];
    }
  }

  return null;
}

function getTournamentById_(tournamentId) {
  var tournaments = getTournamentRecords_();

  for (var index = 0; index < tournaments.length; index += 1) {
    if (tournaments[index].id === tournamentId) {
      return tournaments[index];
    }
  }

  return null;
}

function getTournamentPlanByTournamentId_(tournamentId) {
  var sheet = getOrCreateSheet_(TOURNAMENT_PLANS_SHEET_NAME, TOURNAMENT_PLANS_HEADERS);
  var rows = getSheetData_(sheet, TOURNAMENT_PLANS_HEADERS.length);

  for (var index = 0; index < rows.length; index += 1) {
    if (rows[index][1] === tournamentId) {
      return {
        id: rows[index][0],
        tournamentId: rows[index][1],
        participantIdsJson: rows[index][2] || "[]",
        bracketJson: rows[index][3] || "[]",
        createdByUserId: rows[index][4],
        createdAt: rows[index][5],
        updatedAt: rows[index][6],
        rowNumber: index + 2,
      };
    }
  }

  return null;
}

function getLatestActiveMatch_() {
  var matches = getMatchRecords_().filter(function (match) {
    return match.status === "active";
  });
  return matches.length ? matches[0] : null;
}

function getSegmentStateMap_(segmentType, segmentId, participantIds) {
  var sheet = getOrCreateSheet_(ELO_SEGMENTS_SHEET_NAME, ELO_SEGMENTS_HEADERS);
  var rows = getSheetData_(sheet, ELO_SEGMENTS_HEADERS.length);
  var state = {};
  var nowIso = new Date().toISOString();
  var index;

  for (index = 0; index < rows.length; index += 1) {
    if (rows[index][1] !== segmentType || rows[index][2] !== segmentId) {
      continue;
    }

    state[rows[index][3]] = {
      id: rows[index][0],
      segmentType: rows[index][1],
      segmentId: rows[index][2],
      userId: rows[index][3],
      elo: Number(rows[index][4] || 1200),
      matchesPlayed: Number(rows[index][5] || 0),
      wins: Number(rows[index][6] || 0),
      losses: Number(rows[index][7] || 0),
      streak: Number(rows[index][8] || 0),
      updatedAt: rows[index][9] || nowIso,
    };
  }

  for (index = 0; index < participantIds.length; index += 1) {
    if (!state[participantIds[index]]) {
      state[participantIds[index]] = {
        id: Utilities.getUuid(),
        segmentType: segmentType,
        segmentId: segmentId,
        userId: participantIds[index],
        elo: 1200,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        streak: 0,
        updatedAt: nowIso,
      };
    }
  }

  return state;
}

function computeEloDeltaForTeams_(teamAPlayerIds, teamBPlayerIds, ratingMap, winnerTeam) {
  var teamARating = computeAverageRating_(teamAPlayerIds, ratingMap);
  var teamBRating = computeAverageRating_(teamBPlayerIds, ratingMap);
  var expectedA = 1 / (1 + Math.pow(10, (teamBRating - teamARating) / 400));
  var teamAK = computeTeamKFactor_(teamAPlayerIds, ratingMap);
  var teamBK = computeTeamKFactor_(teamBPlayerIds, ratingMap);
  var actualA = winnerTeam === "A" ? 1 : 0;
  var rawTeamDeltaA = ((teamAK + teamBK) / 2) * (actualA - expectedA);
  var teamDeltaA = Math.round(rawTeamDeltaA);
  var teamDeltaB = -teamDeltaA;

  return distributeTeamDelta_(teamAPlayerIds, teamBPlayerIds, teamDeltaA, teamDeltaB);
}

function computeAverageRating_(playerIds, ratingMap) {
  var total = 0;
  for (var index = 0; index < playerIds.length; index += 1) {
    total += Number(ratingMap[playerIds[index]].elo || ratingMap[playerIds[index]].globalElo || 1200);
  }
  return total / playerIds.length;
}

function computeTeamKFactor_(playerIds, ratingMap) {
  var total = 0;
  for (var index = 0; index < playerIds.length; index += 1) {
    var state = ratingMap[playerIds[index]];
    var matchesPlayed =
      state.matchesPlayed !== undefined
        ? Number(state.matchesPlayed || 0)
        : Number((state.wins || 0) + (state.losses || 0));
    total += matchesPlayed < 30 ? 40 : 24;
  }
  return total / playerIds.length;
}

function distributeTeamDelta_(teamAPlayerIds, teamBPlayerIds, teamDeltaA, teamDeltaB) {
  var result = {};
  distributeDeltaAcrossPlayers_(teamAPlayerIds, teamDeltaA, result);
  distributeDeltaAcrossPlayers_(teamBPlayerIds, teamDeltaB, result);
  return result;
}

function distributeDeltaAcrossPlayers_(playerIds, totalDelta, result) {
  var baseDelta = totalDelta >= 0 ? Math.floor(totalDelta / playerIds.length) : Math.ceil(totalDelta / playerIds.length);
  var remainder = totalDelta - baseDelta * playerIds.length;
  for (var index = 0; index < playerIds.length; index += 1) {
    var adjustment = 0;
    if (remainder > 0 && index < remainder) {
      adjustment = 1;
    }
    if (remainder < 0 && index < Math.abs(remainder)) {
      adjustment = -1;
    }
    result[playerIds[index]] = baseDelta + adjustment;
  }
}

function applyDeltaToUsers_(teamAPlayerIds, teamBPlayerIds, usersById, deltaMap, nowIso, winnerTeam) {
  applyDeltaToPlayerState_(
    teamAPlayerIds,
    teamBPlayerIds,
    usersById,
    deltaMap,
    nowIso,
    false,
    winnerTeam
  );
}

function applyDeltaToSegmentState_(
  teamAPlayerIds,
  teamBPlayerIds,
  segmentState,
  deltaMap,
  nowIso,
  winnerTeam
) {
  applyDeltaToPlayerState_(
    teamAPlayerIds,
    teamBPlayerIds,
    segmentState,
    deltaMap,
    nowIso,
    true,
    winnerTeam
  );
}

function applyDeltaToPlayerState_(
  teamAPlayerIds,
  teamBPlayerIds,
  stateMap,
  deltaMap,
  nowIso,
  isSegment,
  winnerTeam
) {
  updateTeamState_(teamAPlayerIds, stateMap, deltaMap, nowIso, isSegment, winnerTeam === "A");
  updateTeamState_(teamBPlayerIds, stateMap, deltaMap, nowIso, isSegment, winnerTeam === "B");
}

function updateTeamState_(teamPlayerIds, stateMap, deltaMap, nowIso, isSegment, isWinner) {
  for (var index = 0; index < teamPlayerIds.length; index += 1) {
    var state = stateMap[teamPlayerIds[index]];
    var currentElo = Number(isSegment ? state.elo : state.globalElo);
    var nextElo = currentElo + Number(deltaMap[teamPlayerIds[index]] || 0);
    var wins = Number(state.wins || 0);
    var losses = Number(state.losses || 0);
    var streak = Number(state.streak || 0);

    if (isWinner) {
      wins += 1;
      streak = streak >= 0 ? streak + 1 : 1;
    } else {
      losses += 1;
      streak = streak <= 0 ? streak - 1 : -1;
    }

    if (isSegment) {
      state.elo = nextElo;
      state.matchesPlayed = Number(state.matchesPlayed || 0) + 1;
      state.updatedAt = nowIso;
    } else {
      state.globalElo = nextElo;
      state.updatedAt = nowIso;
    }

    state.wins = wins;
    state.losses = losses;
    state.streak = streak;
  }
}

function persistCreateMatch_(context) {
  var usersSheet = getOrCreateSheet_(USERS_SHEET_NAME, USERS_HEADERS);
  var userRows = getSheetData_(usersSheet, USERS_HEADERS.length);
  var userRowIndexById = {};
  var index;

  for (index = 0; index < userRows.length; index += 1) {
    userRowIndexById[userRows[index][0]] = index + 2;
  }

  var userIds = Object.keys(context.usersById);
  for (index = 0; index < userIds.length; index += 1) {
    var userId = userIds[index];
    if (userRowIndexById[userId]) {
      usersSheet
        .getRange(userRowIndexById[userId], 1, 1, USERS_HEADERS.length)
        .setValues([userToRow_(context.usersById[userId])]);
    }
  }

  persistSegmentState_(context.segmentStates.season);
  persistSegmentState_(context.segmentStates.tournament);

  var matchesSheet = getOrCreateSheet_(MATCHES_SHEET_NAME, MATCHES_HEADERS);
  matchesSheet.appendRow(matchToRow_(context.match, context.globalDelta, context.segmentDelta));
}

function persistTournamentPlan_(payload, createdByUserId) {
  var nowIso = new Date().toISOString();
  var existingTournament = payload.tournamentId ? getTournamentById_(payload.tournamentId) : null;
  var tournament = existingTournament || {
    id: Utilities.getUuid(),
    name: payload.name,
    date: nowIso,
    seasonId: payload.seasonId || null,
    createdByUserId: createdByUserId,
  };

  tournament.name = payload.name;
  tournament.seasonId = payload.seasonId || null;
  tournament.createdByUserId = tournament.createdByUserId || createdByUserId;
  if (!existingTournament) {
    tournament.date = nowIso;
  }

  upsertTournamentRecord_(tournament, nowIso);
  upsertTournamentPlanRecord_(tournament.id, payload, createdByUserId, nowIso);

  return tournament;
}

function persistSeason_(payload, createdByUserId) {
  var sheet = getOrCreateSheet_(SEASONS_SHEET_NAME, SEASONS_HEADERS);
  var rows = getSheetData_(sheet, SEASONS_HEADERS.length);
  var nowIso = new Date().toISOString();
  var existingSeason = payload.seasonId ? getSeasonById_(payload.seasonId) : null;
  var season = existingSeason || {
    id: Utilities.getUuid(),
    name: payload.name,
    startDate: payload.startDate,
    endDate: payload.endDate || "",
    isActive: payload.isActive,
    baseEloMode: payload.baseEloMode,
    participantIds: payload.participantIds,
    createdByUserId: createdByUserId,
    createdAt: nowIso,
  };

  season.name = payload.name;
  season.startDate = payload.startDate;
  season.endDate = payload.endDate || "";
  season.isActive = payload.isActive;
  season.baseEloMode = payload.baseEloMode;
  season.participantIds = payload.participantIds;
  season.createdByUserId = season.createdByUserId || createdByUserId;

  if (payload.isActive) {
    for (var index = 0; index < rows.length; index += 1) {
      if (!rows[index][0]) {
        continue;
      }

      var existingSeason = [
        rows[index][0],
        rows[index][1],
        rows[index][2],
        rows[index][3],
        false,
        rows[index][5] || "carry_over",
        rows[index][6] || "[]",
        rows[index][7] || "",
        rows[index][8] || nowIso,
      ];
      sheet.getRange(index + 2, 1, 1, SEASONS_HEADERS.length).setValues([existingSeason]);
    }
  }

  upsertSeasonRecord_(season);
  return {
    id: season.id,
    name: season.name,
    startDate: season.startDate,
    endDate: season.endDate,
    isActive: season.isActive,
    baseEloMode: season.baseEloMode,
    participantIds: season.participantIds,
  };
}

function updateTournamentBracketMatchLink_(tournamentId, bracketMatchId, createdMatchId) {
  if (!tournamentId || !bracketMatchId || !createdMatchId) {
    return;
  }

  var plan = getTournamentPlanByTournamentId_(tournamentId);
  if (!plan) {
    return;
  }

  var rounds = parseJsonObject_(plan.bracketJson);
  var createdMatch = getMatchById_(createdMatchId);
  var updated = false;
  var winnerPlayerId = null;

  if (createdMatch) {
    winnerPlayerId =
      createdMatch.winnerTeam === "A"
        ? createdMatch.teamAPlayerIds[0] || null
        : createdMatch.teamBPlayerIds[0] || null;
  }

  for (var roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    var matches = rounds[roundIndex].matches || [];
    for (var matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
      if (matches[matchIndex].id === bracketMatchId) {
        matches[matchIndex].createdMatchId = createdMatchId;
        matches[matchIndex].winnerPlayerId = winnerPlayerId;
        propagateBracketWinner_(rounds, roundIndex, matchIndex, winnerPlayerId);
        updated = true;
      }
    }
  }

  if (!updated) {
    return;
  }

  var sheet = getOrCreateSheet_(TOURNAMENT_PLANS_SHEET_NAME, TOURNAMENT_PLANS_HEADERS);
  sheet
    .getRange(plan.rowNumber, 1, 1, TOURNAMENT_PLANS_HEADERS.length)
    .setValues([
      [
        plan.id,
        plan.tournamentId,
        plan.participantIdsJson,
        JSON.stringify(rounds),
        plan.createdByUserId,
        plan.createdAt,
        new Date().toISOString(),
      ],
    ]);
}

function propagateBracketWinner_(rounds, roundIndex, matchIndex, winnerPlayerId) {
  if (!winnerPlayerId) {
    return;
  }

  var nextRound = rounds[roundIndex + 1];
  if (!nextRound || !nextRound.matches || !nextRound.matches.length) {
    return;
  }

  var nextMatchIndex = Math.floor(matchIndex / 2);
  var nextMatch = nextRound.matches[nextMatchIndex];
  if (!nextMatch) {
    return;
  }

  if (matchIndex % 2 === 0) {
    nextMatch.leftPlayerId = winnerPlayerId;
  } else {
    nextMatch.rightPlayerId = winnerPlayerId;
  }
}

function upsertTournamentRecord_(tournament, nowIso) {
  var sheet = getOrCreateSheet_(TOURNAMENTS_SHEET_NAME, TOURNAMENTS_HEADERS);
  var rows = getSheetData_(sheet, TOURNAMENTS_HEADERS.length);
  var rowNumber = null;

  for (var index = 0; index < rows.length; index += 1) {
    if (rows[index][0] === tournament.id) {
      rowNumber = index + 2;
      break;
    }
  }

  var row = [
    tournament.id,
    tournament.name,
    tournament.date,
    tournament.seasonId || "",
    tournament.createdByUserId || "",
    nowIso,
  ];

  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, TOURNAMENTS_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function upsertSeasonRecord_(season) {
  var sheet = getOrCreateSheet_(SEASONS_SHEET_NAME, SEASONS_HEADERS);
  var rows = getSheetData_(sheet, SEASONS_HEADERS.length);
  var rowNumber = null;

  for (var index = 0; index < rows.length; index += 1) {
    if (rows[index][0] === season.id) {
      rowNumber = index + 2;
      break;
    }
  }

  var row = seasonToRow_(season);
  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, SEASONS_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function upsertTournamentPlanRecord_(tournamentId, payload, createdByUserId, nowIso) {
  var sheet = getOrCreateSheet_(TOURNAMENT_PLANS_SHEET_NAME, TOURNAMENT_PLANS_HEADERS);
  var existing = getTournamentPlanByTournamentId_(tournamentId);

  var row = [
    existing ? existing.id : Utilities.getUuid(),
    tournamentId,
    JSON.stringify(payload.participantIds),
    JSON.stringify(payload.rounds),
    existing ? existing.createdByUserId : createdByUserId,
    existing ? existing.createdAt : nowIso,
    nowIso,
  ];

  if (existing) {
    sheet.getRange(existing.rowNumber, 1, 1, TOURNAMENT_PLANS_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function persistSegmentState_(segmentState) {
  if (!segmentState) {
    return;
  }

  var sheet = getOrCreateSheet_(ELO_SEGMENTS_SHEET_NAME, ELO_SEGMENTS_HEADERS);
  var rows = getSheetData_(sheet, ELO_SEGMENTS_HEADERS.length);
  var rowIndexByKey = {};
  var stateKeys = Object.keys(segmentState);
  var index;

  for (index = 0; index < rows.length; index += 1) {
    rowIndexByKey[rows[index][1] + "::" + rows[index][2] + "::" + rows[index][3]] = index + 2;
  }

  for (index = 0; index < stateKeys.length; index += 1) {
    var key = stateKeys[index];
    var record = segmentState[key];
    var rowKey = record.segmentType + "::" + record.segmentId + "::" + record.userId;
    var row = segmentStateToRow_(record);
    if (rowIndexByKey[rowKey]) {
      sheet.getRange(rowIndexByKey[rowKey], 1, 1, ELO_SEGMENTS_HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  }
}

function matchToRow_(match, globalDelta, segmentDelta) {
  return [
    match.id,
    match.matchType,
    match.formatType,
    match.pointsToWin,
    JSON.stringify(match.teamAPlayerIds),
    JSON.stringify(match.teamBPlayerIds),
    JSON.stringify(match.score),
    match.winnerTeam,
    JSON.stringify(globalDelta),
    JSON.stringify(segmentDelta),
    match.playedAt,
    match.seasonId || "",
    match.tournamentId || "",
    match.createdByUserId,
    match.status,
    "",
    "",
    "",
    match.createdAt,
  ];
}

function segmentStateToRow_(record) {
  return [
    record.id,
    record.segmentType,
    record.segmentId,
    record.userId,
    record.elo,
    record.matchesPlayed,
    record.wins,
    record.losses,
    record.streak,
    record.updatedAt,
  ];
}

function seasonToRow_(season) {
  return [
    season.id,
    season.name,
    season.startDate,
    season.endDate || "",
    season.isActive,
    season.baseEloMode,
    JSON.stringify(season.participantIds || []),
    season.createdByUserId || "",
    season.createdAt,
  ];
}

function appendAuditLog_(action, actorUserId, targetId, payload, createdAt) {
  var sheet = getOrCreateSheet_(AUDIT_LOG_SHEET_NAME, AUDIT_LOG_HEADERS);
  sheet.appendRow([
    Utilities.getUuid(),
    action,
    actorUserId,
    targetId,
    JSON.stringify(payload),
    createdAt || new Date().toISOString(),
  ]);
}

function getExistingCreateMatchResult_(requestId) {
  var sheet = getOrCreateSheet_(AUDIT_LOG_SHEET_NAME, AUDIT_LOG_HEADERS);
  var rows = getSheetData_(sheet, AUDIT_LOG_HEADERS.length);

  for (var index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index][1] !== "createMatch") {
      continue;
    }

    var payload = JSON.parse(rows[index][4] || "{}");
    if (payload.requestId !== requestId) {
      continue;
    }

    var match = getMatchById_(payload.matchId);
    if (match) {
      return { match: match };
    }
  }

  return null;
}

function getMatchById_(matchId) {
  var matches = getMatchRecords_();
  for (var index = 0; index < matches.length; index += 1) {
    if (matches[index].id === matchId) {
      return matches[index];
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

function parseJsonObject_(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
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

function forbiddenError_(message) {
  var error = new Error(message);
  error.code = "FORBIDDEN";
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
