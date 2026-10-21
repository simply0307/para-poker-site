import { ConsumerError, boundedText, onlyFields, uuid } from "../eggs/consumerCore.mjs";
import { categories, statuses, affiliations, accents } from "./catalog.mjs";
export const hubEnabled = (env=process.env) => env.EGGS_HUB_ENABLED === "true";
const fields=["title","summary","description","category","status","destination","participation","publication_label","publication_url","asset","featured","sort_order"];
export function safeLink(value) {
 return typeof value==="string" && value.length<=500 && !/[\u0000-\u001f\u007f]/u.test(value) && !/%0[ad]|%5c|%2f%2f/iu.test(value) &&
 (/^\/para\/poker(?:\/[a-zA-Z0-9_-]+)*$/u.test(value) || /^\/projects\/[a-z0-9-]+$/u.test(value) || /^https:\/\/[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?:\/[a-zA-Z0-9._~!$&()*+,;=:@%/-]*)?$/u.test(value));
}
export function projectContent(value) {
 if (!value || typeof value!=="object" || Array.isArray(value)) throw new ConsumerError(400,"Check the project fields.");
 onlyFields(value,fields);
 const result={};
 for (const [name,max,required] of [["title",80,true],["summary",240,true],["description",3000,true],["participation",500,false],["publication_label",80,false],["publication_url",500,false],["destination",500,false]]) result[name]=boundedText(value[name],name,max,{required}).trim();
 if (!Object.hasOwn(categories,value.category)||!Object.hasOwn(statuses,value.status)||!["monogram","para"].includes(value.asset)|| (value.asset==="para"&&value.category!=="league")) throw new ConsumerError(400,"Choose a listed category, status and visual.");
 if (typeof value.featured!=="boolean"||!Number.isInteger(value.sort_order)||value.sort_order<0||value.sort_order>9999) throw new ConsumerError(400,"Check project placement.");
 if ((result.destination&&!safeLink(result.destination))||(result.publication_url&&!safeLink(result.publication_url))||Boolean(result.publication_url)!==Boolean(result.publication_label)) throw new ConsumerError(400,"Use a safe HTTPS destination or an existing project/league path. Publication links need a label.");
 return {...result,category:value.category,status:value.status,asset:value.asset,featured:value.featured,sort_order:value.sort_order};
}
export function projectCommand(value) {
 onlyFields(value,["id","slug","content","version","action"]);
 if (!["save","publish","archive"].includes(value.action)||!Number.isInteger(value.version)||value.version<0) throw new ConsumerError(400,"Choose a project action and revision.");
 if (typeof value.slug!=="string"||value.slug.length<3||value.slug.length>64||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value.slug)) throw new ConsumerError(400,"Use a stable lowercase project slug.");
 if (!value.id&&(value.action!=="save"||value.version!==0)) throw new ConsumerError(400,"Create a draft first.");
 if (value.action!=="save"&&value.content!=null) throw new ConsumerError(400,"Save and preview this revision first.");
 return {p_id:value.id?uuid(value.id):null,p_slug:value.slug,p_content:value.action==="save"?projectContent(value.content):null,p_version:value.version,p_action:value.action};
}
export function expressionInput(value) {
 onlyFields(value,["favorite_project_ids","affiliation","pinned_project_id","featured_note","accent"]);
 if (!Array.isArray(value.favorite_project_ids)||value.favorite_project_ids.length>5||new Set(value.favorite_project_ids).size!==value.favorite_project_ids.length) throw new ConsumerError(400,"Choose up to five different favorites.");
 if (!Object.hasOwn(affiliations,value.affiliation)||!Object.hasOwn(accents,value.accent)) throw new ConsumerError(400,"Choose a listed affiliation and color.");
 return {p_favorites:value.favorite_project_ids.map(uuid),p_affiliation:value.affiliation,p_pin:value.pinned_project_id?uuid(value.pinned_project_id):null,p_note:boundedText(value.featured_note,"featured note",160),p_accent:value.accent};
}
export const emptyExpression={favorite_project_ids:[],affiliation:"",pinned_project_id:null,featured_note:"",accent:"sage"};
