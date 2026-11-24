import { supabase } from "@/lib/supabase";

export async function sessionCandidates() {
  const rows = [];
  for (let offset=0; ; offset+=100) {
    const {data,error} = await supabase.from("sessions")
      .select("id,session_code,season_code,format,played_at,status,result_review_status,first:hands(start_time),last:hands(start_time),session_results(finish),revision:session_evidence_revisions!sessions_current_evidence_revision_id_fkey(contract:parsed_manifest->sourceContract->>schemaVersion,evidence:parsed_manifest->authorityConsequences->recapEvidence->perspectives->0,players:parsed_manifest->sourceParticipants)")
      .order("played_at",{ascending:false}).order("id")
      .order("start_time",{referencedTable:"first",ascending:true}).limit(1,{referencedTable:"first"})
      .order("start_time",{referencedTable:"last",ascending:false}).limit(1,{referencedTable:"last"}).range(offset,offset+99);
    if(error) throw error;
    for(const session of data) {
      const suitfire = session.revision?.contract === "gauntlet.para-match.v2" || /suitfire|gauntlet/i.test(session.format||"");
      const span=Date.parse(session.last?.[0]?.start_time)-Date.parse(session.first?.[0]?.start_time);
      rows.push({id:session.id,sessionId:session.id,title:session.session_code || session.id,game:suitfire?"SuitFire":"Poker",season:session.season_code,date:session.played_at,
        finished:session.result_review_status==="approved" || ["completed","finished"].includes(session.status) || session.session_results?.some(r=>r.finish===1),
        durationMs:suitfire && Number.isFinite(Date.parse(session.revision?.evidence?.completedAt)-Date.parse(session.revision?.evidence?.startedAt)) ? Date.parse(session.revision.evidence.completedAt)-Date.parse(session.revision.evidence.startedAt) : Number.isFinite(span) && span>0 ? span : null,minimumDuration:!suitfire,opposition:!suitfire ? 'Human opponents' : session.revision?.players?.some(p=>p.identityType==='ai') ? 'AI opponent' : session.revision?.players?.length===2 && session.revision.players.every(p=>['account','guest','human','player'].includes(p.identityType)) ? 'Human opponents':'Opponent type unconfirmed'});
    }
    if(data.length<100) return rows;
  }
}
