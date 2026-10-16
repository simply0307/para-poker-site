import { workspace } from "@/lib/hub/workspace";
import { ProjectEditor } from "@/components/hub/ProjectEditor";
export default async function NewProject(){const access=await workspace();if(access.error)return <p role="alert">{access.error}</p>;return <><div className="hub-page-heading"><p className="eggs-eyebrow">New project</p><h1>Start with a draft.</h1><p>Use approved facts and existing visuals. Concept entries need no invented launch date.</p></div><ProjectEditor/></>;}
