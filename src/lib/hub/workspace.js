import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { pageConsumerContext } from "../eggs/consumerClient";
import { requireHubEditor } from "./server";
import { hubRepository } from "./repository.mjs";
export const workspace=cache(async()=>{
 let context,role,error;
 try {context=await pageConsumerContext();role=await requireHubEditor(context);} catch(e){error=e;}
 if(error?.status===401) redirect("/login");
 if(error) return {error:error.status===403?"An explicit EGGS editorial role is required. Consumer membership and Poker operator access do not grant this role.":"The EGGS editor workspace is unavailable."};
 return {role,repository:hubRepository(context.client),client:context.client};
});
