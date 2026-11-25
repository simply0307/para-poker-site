export const divisions = [
  {id:"overview",label:"League home"},
  {id:"events",label:"Events"},
  {id:"seasons",label:"Season archive"},
  {id:"vanguards",label:"Vanguards"},
  {id:"factions",label:"Faction records"},
  {id:"rivalries",label:"Rivalries"},
  {id:"reath",label:"Reath desk"}
];

export const eventHub="https://gauntlet-online.vercel.app/?page=compete&view=para";

export function sectionUrl(section, filters={}) {
  const params=new URLSearchParams({section,...filters});
  return section==="overview"?"/suitfire":"/suitfire?"+params;
}

export function groupsByFaction(matches) {
  const factions=new Map();
  for(const match of matches) for(const player of match.players) {
    if(!player.faction) continue;
    const group=factions.get(player.faction) || {name:player.faction,win:0,loss:0,draw:0,appearances:0,games:new Set()};
    group.appearances++;
    if(["win","loss","draw"].includes(player.result)) group[player.result]++;
    group.games.add(match);
    factions.set(player.faction,group);
  }
  return [...factions.values()].sort((a,b)=>b.appearances-a.appearances || a.name.localeCompare(b.name));
}

export function repeatedPairings(matches) {
  const pairs=new Map();
  for(const game of matches) {
    const ids=game.players.map(p=>p.id);
    if(!ids.every(Boolean) || ids[0]===ids[1]) continue;
    const key=JSON.stringify(ids.sort());
    if(!pairs.has(key)) pairs.set(key,[]);
    pairs.get(key).push(game);
  }
  return [...pairs.values()].filter(games=>games.length>1).sort((a,b)=>b.length-a.length);
}
