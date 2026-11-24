import { supabase } from "@/lib/supabase";
import { matchRecord } from "./records.mjs";

const fields = [
  "id,session_id",
  "matchId:parsed_manifest->sourceIdentity->>matchId",
  "season:parsed_manifest->session->>seasonCode",
  "playedAt:parsed_manifest->session->>playedAt",
  "format:parsed_manifest->session->>format",
  "participants:parsed_manifest->sourceParticipants",
  "mappings:parsed_manifest->players",
  "campaign:parsed_manifest->authorityConsequences->recapEvidence->campaignEncounter",
  "decisiveTurn:parsed_manifest->authorityConsequences->recapEvidence->decisiveTurn",
  "largestAttack:parsed_manifest->authorityConsequences->recapEvidence->largestAttack",
].join(",");

function revisions(join = "") {
  return supabase.from("session_evidence_revisions").select(fields + join)
    .eq("status", "current").eq("parsed_manifest->sourceContract->>schemaVersion", "gauntlet.para-match.v2");
}

export async function getSuitFireMatch(revisionId) {
  const { data, error } = await revisions().eq("id", revisionId).maybeSingle();
  if (error) throw error;
  return data && matchRecord(data);
}

export async function approvedMatches(season) {
  const matches = [];
  for (let offset = 0; ; offset += 100) {
    let query = revisions(",sessions!session_evidence_revisions_session_id_fkey!inner(result_review_status)")
      .eq("sessions.result_review_status", "approved");
    if (season) query = query.eq("parsed_manifest->session->>seasonCode", season);
    const { data, error } = await query.order("id").range(offset, offset + 99);
    if (error) throw error;
    matches.push(...data.map(matchRecord).filter(Boolean));
    if (data.length < 100) break;
  }
  return matches.sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));
}

export async function approvedMatch(sessionId) {
  const { data, error } = await revisions(",sessions!session_evidence_revisions_session_id_fkey!inner(result_review_status)")
    .eq("sessions.result_review_status", "approved").eq("session_id", sessionId).maybeSingle();
  if (error) throw error;
  return data && matchRecord(data);
}
