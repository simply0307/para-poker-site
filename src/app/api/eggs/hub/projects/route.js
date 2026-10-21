import { consumerContext } from "@/lib/eggs/consumerClient";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import { readConsumerJson,requireSameOrigin } from "@/lib/eggs/consumerCore.mjs";
import { projectCommand } from "@/lib/hub/core.mjs";
import { requireHubEditor } from "@/lib/hub/server";
import { hubRepository } from "@/lib/hub/repository.mjs";
export async function POST(request) {
 let context;
 try {
  context=consumerContext(request.cookies); requireSameOrigin(request,context.config); await requireHubEditor(context);
  const command=projectCommand(await readConsumerJson(request));
  const project=await hubRepository(context.client).save(command);
  return context.json({project},command.p_id?200:201);
 } catch(error) {return consumerFailure(error,context);}
}
