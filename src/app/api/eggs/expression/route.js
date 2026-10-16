import { consumerContext } from "@/lib/eggs/consumerClient";
import { consumerFailure } from "@/lib/eggs/consumerResponse";
import { ConsumerError,readConsumerJson,requireSameOrigin } from "@/lib/eggs/consumerCore.mjs";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { expressionInput,hubEnabled } from "@/lib/hub/core.mjs";
import { hubRepository } from "@/lib/hub/repository.mjs";
export async function PUT(request) {
 let context;
 try {
  if(!hubEnabled()) throw new ConsumerError(503,"Profile expression is not available yet.");
  context=consumerContext(request.cookies); requireSameOrigin(request,context.config); await requireEggsUser(context);
  const expression=await hubRepository(context.client).saveExpression(expressionInput(await readConsumerJson(request)));
  return context.json({expression});
 } catch(error) {return consumerFailure(error,context);}
}
