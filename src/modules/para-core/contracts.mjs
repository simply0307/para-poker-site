/**
 * Future Para Core port contract, not a generic league engine.
 * Existing Poker repositories remain the sole authority for Poker results.
 *
 * @typedef {{id:string, slug:string, gameKey:string, title:string}} League
 * @typedef {{id:string, leagueId:string, code:string, rulesVersion:string}} Season
 * @typedef {{id:string, seasonId:string, sourceId:string, occurredAt:string}} Event
 * @typedef {{id:string, leagueId:string, gameAccountId:string|null}} Participant
 * @typedef {{eventId:string, sourceChecksum:string, adapterVersion:string,
 *   evidenceRef:string, participants:string[], warnings:string[]}} ResultPreview
 * @typedef {{eventId:string, previewChecksum:string, operatorId:string,
 *   decision:"approve"|"reject", reason:string}} ResultDecision
 * @typedef {{
 *   gameKey:string,
 *   previewResult:(source:unknown)=>Promise<ResultPreview>,
 *   commitEvidence:(preview:ResultPreview)=>Promise<{evidenceRef:string}>,
 *   reviewResult:(decision:ResultDecision)=>Promise<{revisionId:string}>,
 *   computeStandings:(seasonId:string, rulesVersion:string)=>Promise<unknown>,
 *   evaluateQualification:(seasonId:string, rulesVersion:string)=>Promise<unknown>,
 *   publicSummary:(participantId:string)=>Promise<unknown>,
 *   publications:(leagueId:string)=>Promise<unknown>,
 *   authorizeOperator:(userId:string, leagueId:string, action:string)=>Promise<boolean>
 * }} ParaAdapter
 */
// These capabilities are requirements for a future adapter, not implemented APIs.
export const paraCorePorts=Object.freeze(["leagues","seasons","events","participants","resultPreview","evidenceCommit","resultApproval","standings","qualification","publications","operatorAuthorization"]);
export const pokerBoundary=Object.freeze({
 key:"para-poker",publicRoot:"/para/poker",operatorRoot:"/admin",
 owns:Object.freeze(["players","sessions","hands","actions","imports","evidence","result-approval","poker-scoring","standings","newsroom","operator-profiles"]),
 hubMayUse:Object.freeze(["public-destination","published-project-description","reviewed-profile-link","opted-in-public-summary"]),
});
