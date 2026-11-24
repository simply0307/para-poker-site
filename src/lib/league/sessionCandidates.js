import { supabase } from "@/lib/supabase";

export async function sessionCandidates() {
  const rows = [];
  for (let offset=0; ; offset+=100) {
    const {data,error} = await supabase.from("sessions")
      .select("id,session_code,season_code,format,played_at,status,result_review_status,first:hands(start_time),last:hands(start_time),session_results(finish,final_stack),revision:session_evidence_revisions!sessions_current_evidence_revision_id_fkey(contract:parsed_manifest->sourceContract->>schemaVersion,evidence:parsed_manifest->authorityConsequences->recapEvidence->perspectives->0,players:parsed_manifest->sourceParticipants)")
      .order("played_at",{ascending:false}).order("id")
      .order("start_time",{referencedTable:"first",ascending:true}).limit(1,{referencedTable:"first"})
      .order("start_time",{referencedTable:"last",ascending:false}).limit(1,{referencedTable:"last"}).range(offset,offset+99);
    if(error) throw error;
    for(const session of data) {
      const suitfire = session.revision?.contract === "gauntlet.para-match.v2" || /suitfire|gauntlet/i.test(session.format||"");
      const span=Date.parse(session.last?.[0]?.start_time)-Date.parse(session.first?.[0]?.start_time);
      rows.push({id:session.id,sessionId:session.id,title:session.session_code || session.id,game:suitfire?"SuitFire":"Poker",season:session.season_code,date:session.played_at,
        finished:["completed","finished"].includes(session.status) || (suitfire ? Number.isFinite(Date.parse(session.revision?.evidence?.completedAt)) && !["abandoned","cancelled"].includes(session.revision.evidence.completionReason) : session.session_results?.length>1 && session.session_results.every(r=>r.final_stack!=null) && session.session_results.filter(r=>Number(r.final_stack)>0).length===1 && session.session_results.some(r=>r.finish===1 && Number(r.final_stack)>0)),
        durationMs:suitfire && Number.isFinite(Date.parse(session.revision?.evidence?.completedAt)-Date.parse(session.revision?.evidence?.startedAt)) ? Date.parse(session.revision.evidence.completedAt)-Date.parse(session.revision.evidence.startedAt) : Number.isFinite(span) && span>0 ? span : null,minimumDuration:!suitfire,opposition:!suitfire ? 'Human opponents' : session.revision?.players?.some(p=>p.identityType==='ai') ? 'AI opponent' : session.revision?.players?.length===2 && session.revision.players.every(p=>['account','guest','human','player'].includes(p.identityType)) ? 'Human opponents':'Opponent type unconfirmed'});
    }
    if(data.length<100) return rows;
  }
}
