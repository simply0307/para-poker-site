import "server-only";
import { createClient } from "@supabase/supabase-js";
import { hubEnabled } from "./core.mjs";
import { roomsEnabled } from "../rooms/core.mjs";
import { readerProject } from "./destinations.mjs";
import { bootstrapProjects } from "./catalog.mjs";
import { hubRepository, orderProjects } from "./repository.mjs";
import { ConsumerError } from "../eggs/consumerCore.mjs";
import { requireEggsUser } from "../eggs/requireEggsUser";
export async function publicCatalog() {
 if (!hubEnabled() && !roomsEnabled()) return {projects:orderProjects(bootstrapProjects.map(readerProject)),unavailable:false};
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY) return {projects:[],unavailable:true};
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 try {return {projects:orderProjects((await hubRepository(client).published()).map(readerProject)),unavailable:false};} catch {return {projects:[],unavailable:true};}
}
export async function requireHubEditor(context) {
 if(!hubEnabled()) throw new ConsumerError(503,"The EGGS editor workspace is not available yet.");
 await requireEggsUser(context);
 const role=await hubRepository(context.client).role();
 if(!["editor","publisher"].includes(role)) throw new ConsumerError(403,"An EGGS editorial role is required.");
 return role;
}
