import { successResponse } from "../responses";
import { findDuplicateMatches, loadPlayersForDuplicateMatches } from "../services/matchGuards";
import type { ApiRequest, CheckMatchDuplicatePayload, Env, UserRow } from "../types";

export async function handleCheckMatchDuplicate(
  request: ApiRequest<"checkMatchDuplicate", CheckMatchDuplicatePayload>,
  _sessionUser: UserRow,
  env: Env,
) {
  const duplicates = await findDuplicateMatches(env, request.payload);
  const players = await loadPlayersForDuplicateMatches(env, duplicates);

  return successResponse(request.requestId, {
    matches: duplicates,
    players,
  });
}
