import type { ApiAction, ApiActionMap } from "../../../api/contract";

export type RunAuthedAction = <TAction extends ApiAction>(
  action: TAction,
  payload: ApiActionMap[TAction]["payload"],
  requestId?: string,
) => Promise<ApiActionMap[TAction]["data"]>;
