export type SpeechRequest = {
  token: number;
  scopeId: string;
  itemId: string;
};

export function isSpeechRequestCurrent(
  request: SpeechRequest,
  currentToken: number,
  currentScopeId: string,
  currentItemId: string | undefined,
  mounted: boolean
) {
  return Boolean(
    mounted &&
    request.token === currentToken &&
    request.scopeId === currentScopeId &&
    request.itemId === currentItemId
  );
}
