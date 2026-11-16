import {weatherAt,weatherTravel} from './weather.js';
import {ROLES,LOCATIONS,ITEMS,BROTHERS,DIALOGUES} from './content.js';
import {OUTFITS,WEAPONS,defaultEquipment,validEquipment,equipmentStats,canEquip,packCapacity,packHasRoom} from './equipment.js';
import {difficultyOf,deadlineOf,quoteFor,settleFinance,rollEvent,migrateExpansion,validExpansion,extraActions,resolveEvent,applyLoan,FORWARD_PRODUCTS,DIFFICULTY} from './expansion.js';
import {QUEST_FLAGS,handleQuest,fringeLeadsDone,questObjectiveList} from './quests.js';
export const VERSION=2;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function newGame(role='auditor',name='Uygar',lead='uygar',difficulty='standard') {
 if(!Object.hasOwn(BROTHERS,lead))throw new Error('Unknown brother');
 if(!Object.hasOwn(ROLES,role)) throw new Error('Unknown background');
 if(!Object.hasOwn(DIFFICULTY,difficulty))difficulty='standard';
 const d=DIFFICULTY[difficulty];
 return {version:VERSION,gear:defaultEquipment(),role,lead,name:BROTHERS[lead].name,party:{mode:'follow',waitingAt:null,stress:0,bond:3,lastCare:-8},act:1,turn:0,hp:40,maxHp:40,cash:d.startCash,inventory:{rations:6,medicine:2,parts:role==='mechanic'?1:0,ink:0,fuel:0,scrip:0,salt:0},skills:{...ROLES[role].skills},xp:0,level:1,points:0,location:'square',flags:{},factions:{directorate:null,float:null,reserve:null},reputation:{directorate:0,float:0,reserve:0,public:0},loan:null,forward:null,combat:null,ending:null,difficulty,eventsSeen:[],pendingEvent:null,seed:7381,log:[{turn:0,text:'Uygar, Berkay and Pukie return to Par Value. A forged family guarantee has put the settlement into receivership. Director Venn is waiting.'}],choices:[],played:0};
}
export function random(s){s.seed=(s.seed*1664525+1013904223)>>>0;return s.seed/4294967296;}
export function log(s,text){s.log.unshift({turn:s.turn,text});s.log=s.log.slice(0,60);}
function reward(s,xp=2){s.xp+=xp;while(s.xp>=s.level*6){s.xp-=s.level*6;s.level++;s.points++;}}
export function region(s){return LOCATIONS[s.location].region;}
export function quote(s,item){return quoteFor(s,item);}
export function keys(s){return Object.values(s.factions).filter(Boolean).length;}
export function cooperative(s){return s.factions.directorate==='expose'&&s.factions.float==='workers'&&s.factions.reserve==='transparent';}
function mainObjectives(s){
 if(s.act===1)return [{text:'Meet Venn at the Counting House',done:!!s.flags.key},{text:'Find the original ledger at the bank',done:!!s.flags.ledger},{text:'Delay repossession: injunction, water bond, or 180 crowns',done:!!s.flags.townSaved}];
 if(s.act===2)return [{text:'Resolve the Directorate’s grain audit',done:!!s.factions.directorate},{text:'Settle the Free Float water dispute',done:!!s.factions.float},{text:'Resolve the Mutual Reserve pension crisis',done:!!s.factions.reserve}];
 return [{text:'Collect all three settlement keys',done:keys(s)===3},{text:'Enter the Central Clearing House',done:!!s.flags.coreAccess},{text:'Confront your father and choose a settlement',done:!!s.ending}];
}
export function objectives(s){
 const f=s.flags,extras=[];
 if(f.familyLetters)extras.push({text:f.familyResolved?'Family Guarantee · record witnessed':!f.familyRegister?'Family Guarantee · compare the Counting House register':!f.familyEscrow?'Family Guarantee · open the numbered bank envelope':'Family Guarantee · confront your father at Central Clearing',done:!!f.familyResolved});
 if(f.dogTag)extras.push({text:f.dogRefuge?'Small Mercies · refuge network open':!f.dogCheck?'Small Mercies · courtyard check at the clinic':!f.dogWater?'Small Mercies · repair the pump and build a water stop':'Small Mercies · charter refuges at the Mutual Reserve',done:!!f.dogRefuge});
 if(f.routePlan)extras.push({text:f.routeHome?'Common Carrier · waystation open':!f.routeClear?'Common Carrier · resolve the granary toll':!f.routeBridge?'Common Carrier · repair the Waterline crossing':!f.routeCharter?'Common Carrier · sign a charter at Free Float':!f.routeClinic?'Common Carrier · deliver the Reserve parcel':'Common Carrier · open the Par Value terminus',done:!!f.routeHome});
 return [...mainObjectives(s),...extras,...questObjectiveList(s)];
}
function advance(s,n=1){
 for(let i=0;i<n;i++){
 s.turn++;s.played++;
 if(s.turn%4===0&&s.party.stress>0)s.party.stress--;
 if(s.turn%(s.flags.dogRefuge?12:8)===0){if(s.inventory.rations>0){s.inventory.rations--;log(s,'A ration pack covers Pukie’s food and clean water, including supplies left with your brother.');}else{s.party.stress=clamp(s.party.stress+2,0,6);log(s,'No spare care ration. Pukie is unsettled; your brother protects her share, but she needs a proper rest.');}}
 if(s.turn%4===0){if(s.inventory.rations>0)s.inventory.rations--;else{s.hp=clamp(s.hp-3,0,s.maxHp);log(s,'No rations. Hunger costs 3 health.');}}
 settleFinance(s,log,clamp);
 if(s.hp===0){s.ending='death';s.combat=null;return;}
 if(s.act===1&&s.turn>=deadlineOf(s)){s.ending='receivership';s.combat=null;return;}
 rollEvent(s,log,weatherAt(s).kind);
 }
}
function req(ok,reason){return ok?null:reason;}
const action=(id,label,detail,cost=0,blocked=null,kind='normal')=>({id,label,detail,cost,blocked,kind});
export function partyStatus(s){
 const p=s.party,withGroup=p.mode==='follow',brother=BROTHERS[BROTHERS[s.lead].brother].name;
 return {brother,name:'Pukie',mode:p.mode,waitingAt:p.waitingAt,withGroup,stress:p.stress,bond:p.bond,
 perks:withGroup?[`${brother}: +4% accuracy and 1 less incoming damage.`,...(p.stress<4?['Pukie: first hostile hit reduced by 2 damage.']:[]),'Pukie can find finite caches and establish trust.']:[],
 drawbacks:['One extra care ration every '+(s.flags.dogRefuge?12:8)+' settlements, including while waiting.',...(withGroup?['No animals in clinic rooms or the ward; quiet infiltration requires waiting.',...(p.stress>=4?['Anxious Pukie: accuracy −5%. Rest or provide care.']:[])]:[ 'Brother support and Pukie’s warning, scent and social benefits are unavailable.'])],
 summary:withGroup?`${s.name}, ${brother} and Pukie are travelling together.`:`${brother} is sheltering with Pukie at ${LOCATIONS[p.waitingAt].name}. Return there to regroup.`};
}
export function partyActions(s){
 if(s.ending)return [];
 const p=s.party,brother=partyStatus(s).brother,busy=!!s.combat,a=[];
 if(p.mode==='follow')a.push(action('partywait',`Ask ${brother} to stay with Pukie`,'They wait together in the sheltered exterior. Return here to regroup; companion benefits stop while apart.',0,req(!busy,'Resolve the encounter first.')));
 else a.push(action('partyregroup',`Regroup with ${brother} and Pukie`,`They are waiting at ${LOCATIONS[p.waitingAt].name}.`,0,req(!busy&&p.waitingAt===s.location,busy?'Resolve the encounter first.':'Return to their waiting location.')));
 a.push(action('partycare','Share food and settle Pukie','One ration and one settlement. Stress −3, bond +1 (maximum 6). Once every 8 settlements.',1,req(!busy&&s.inventory.rations>0&&(p.mode==='follow'||p.waitingAt===s.location)&&s.turn-p.lastCare>=8,busy?'Resolve the encounter first.':s.inventory.rations<1?'Requires one ration.':p.mode==='wait'&&p.waitingAt!==s.location?'Return to Pukie first.':'Care is available every 8 settlements.')));
 return a;
}
function optionalActions(s){
 const f=s.flags,p=s.party,a=[];const add=(id,label,detail,ok=true,reason='Complete the earlier lead first.',kind='story')=>a.push(action(id,label,detail,1,req(ok,reason),kind));
 if(s.location==='square'){
 if(!f.familyLetters)add('familyletters','Read the brothers’ old letters','Begin Family Guarantee: why did your father keep a delivery manifest?',p.mode==='follow','Bring your brother back to read the letters together.');
 if(f.routeClinic&&!f.routeHome)add('routehome','Open the Par Value waystation','Finish Common Carrier: supplies, trust and a lasting route home.');
 }
 if(s.location==='office'&&f.familyLetters&&!f.familyRegister)add('familyregister','Compare the family guarantee','Trace a forged signature to a numbered escrow envelope.');
 if(s.location==='bank'&&f.bankAccess&&f.familyRegister&&!f.familyEscrow)add('familyescrow','Open the numbered escrow envelope','Recover 25 crowns, a route map and your father’s letter.');
 if(s.location==='clearing'&&f.father&&f.familyEscrow&&!f.familyResolved)add('familyresolve','Demand the unredacted family record','Finish Family Guarantee: make the brothers witnesses, not leverage.');
 if(s.location==='market'&&!f.dogTag)add('dogtag','Replace Pukie’s worn identity tag','Begin Small Mercies. Pay 8 crowns; register both brothers as contacts.',s.cash>=8&&p.mode==='follow','Need 8 crowns and Pukie with the group.');
 if(s.location==='clinic'&&f.dogTag&&!f.dogCheck)add('dogcheck','Arrange Pukie’s courtyard health check','Rusk checks her paws outside for 6 crowns; anxiety eases. Your brother stays beside her.',s.cash>=6&&p.waitingAt==='clinic','Need 6 crowns and your brother waiting with Pukie here.');
 if(s.location==='pump'&&f.dogCheck&&!f.dogWater)add('dogwater','Build a clean-water stop for animals','One part. A shaded trough helps Pukie and passing caravans.',f.pump&&s.inventory.parts>=1&&p.mode==='follow','Need the repaired pump, one part and Pukie with the group.');
 if(s.location==='reserve'&&f.dogWater&&!f.dogRefuge)add('dogrefuge','Charter a companion refuge network','Finish Small Mercies. Donate one ration; care costs now fall every 12 settlements.',s.inventory.rations>=1&&p.mode==='follow','Need one ration and Pukie with the group.');
 if(s.location==='granary'&&f.grain&&!f.routePlan)add('routeplan','Map the stalled grain deliveries','Begin Common Carrier. Survey the loading ramp with your brother.',p.mode==='follow','Regroup with your brother to survey the route.');
 if(s.location==='granary'&&f.routePlan&&!f.routeClear){
 add('routeargue','Challenge the private toll','Negotiation 3 or Accounting 3. Get an open freight permit and two rations.',s.skills.persuade>=3||s.skills.audit>=3,'Need Negotiation 3 or Accounting 3.');
 add('routepay','Buy a freight passage bond','Pay 18 crowns. Get a permit and two rations.',s.cash>=18,'Need 18 crowns.');
 add('routefight','Confront the toll enforcer','Optional combat. Victory recovers 18 crowns and two rations.',true,'','danger');
 }
 if(s.location==='levee'&&f.routeClear&&!f.routeBridge)add('routebridge','Repair the freight crossing','One part. Trace a safe route above contaminated runoff.',p.mode==='follow'&&s.inventory.parts>=1,'Need your brother with you and one part.');
 if(s.location==='river'&&f.routeBridge&&!f.routeCharter)add('routecharter','Negotiate a common-carrier charter','Freight cannot depend on allegiance. Earn 20 crowns in inspection fees.');
 if(s.location==='reserve'&&f.routeCharter&&!f.routeClinic)add('routeclinic','Deliver the first clinic parcel','One ration funds the pilot. Gain medicine; complete the route back at Par Value.',s.inventory.rations>=1,'Requires one ration.');
 if(s.location==='reserve'&&f.dogTag&&!f.dogWelcome)add('dogwelcome','Let Pukie meet the shelter keeper','Her calm presence opens a mutual-aid conversation: one ration and public trust +1.',p.mode==='follow'&&p.stress<4,'Pukie must be present and calm (stress below 4).');
 return a;
}
export function storyDialogue(s){
 const other=partyStatus(s).brother,lead=s.name,base=DIALOGUES[s.location];
 if(s.location==='square')return {speaker:other,lines:[`${lead} checks the family guarantee. ${s.party.mode==='follow'?`${other} checks the road. Pukie noses the door as if home should still smell the same.`:`The other pack is absent: ${other} is looking after Pukie at ${LOCATIONS[s.party.waitingAt].name}.`}`,s.party.mode==='follow'?`“We do this together,” ${other} says. “But if a doorway is unsafe for her, I stay. Come back for us.”`:`A chalk note marks the shelter at ${LOCATIONS[s.party.waitingAt].name}: your brother and Pukie are waiting there.`,`Uygar once assessed financial risk; Berkay kept projects and freight moving. Their father vanished seven years ago while auditing duplicate collateral claims.`]};
 if(['clinic','ward'].includes(s.location)&&s.party.mode==='follow')return {speaker:s.location==='clinic'?'Doctor Rusk':'Ward attendant',lines:[`“No animals in the treatment rooms. Infection control, not punishment. Your brother can wait with Pukie under the covered entrance; there is drinking water.”`,`Ask ${other} to stay with her before entering. Return and regroup here.`]};
 if(s.location==='bank'&&!s.flags.bankAccess)return {speaker:'Repossession officer',lines:[`A private officer has posted a senior claim on the vault door. “No key, no access. A processing fee might accelerate review.”`,`The brothers’ family audit is inside. You can pay, challenge the officer or take a quiet route. Pukie cannot accompany a silent infiltration; arrange a safe waiting place with ${other} first.`]};
 if(s.location==='clearing'&&!s.flags.coreAccess)return {speaker:'Clearing House intercom',lines:[`“Present three settlement keys. Access remains subject to the security mandate.”`,`Beyond the barrier, a familiar voice calls ${lead} by name. Audit the mandate, bypass its circuitry alone or challenge the sentinel.`,s.party.mode==='follow'?`${other} watches the exits. Pukie presses close to his boots beneath the machinery’s noise.`:`${other} is sheltering with Pukie at ${LOCATIONS[s.party.waitingAt].name}.`]};
 if(s.location==='clearing'&&!s.flags.father)return {speaker:'A familiar voice',lines:[`The barrier opens. Your father stands beside the settlement console, seven years after he vanished.`,`“I kept the claims alive because the hospitals and grain deliveries now depend on them,” he says. “Come closer. You deserve the whole record.”`,`Speak to him before committing the Basin to a final settlement.`]};
 if(s.location==='clearing'&&s.flags.father)return {speaker:'The brothers’ father',lines:[`“Uygar, I trusted you to see the exposure. Berkay, I trusted you to see what a frozen ledger would do to the roads.”`,`“You trusted us with everything except the truth,” ${lead} replies.`,s.party.mode==='follow'?`${other} puts the old manifest beside the console. Pukie settles between the brothers’ boots. “No more putting our family up as collateral.”`:`${other} is still protecting Pukie at ${LOCATIONS[s.party.waitingAt].name}. That promise must survive whatever happens here.`,`The final settlement can preserve the system, disclose its fraud, cancel its debts, sell its control, or distribute it through the institutions you built.`]};
 const scenes={
 market:{speaker:'The market keeper',lines:[`“Two brothers and a dog. Three mouths, one purse. Read the spread before you buy.”`,s.party.mode==='follow'?`The old exchange clock has stopped at the opening bell. Uygar watches prices; Berkay counts the sacks actually leaving the docks.`:`The old exchange clock has stopped at the opening bell. You compare prices with the delivery figures your brother recorded before you separated.`,s.flags.dogTag?`Pukie’s tag records both brothers as contacts. Neither is listed as her owner on a creditor’s register.`:`The keeper can replace Pukie’s tag for eight crowns when you return together. Both brothers would become contacts.`]},
 pump:{speaker:'The maintenance keeper',lines:[`The keeper shows you a rusted valve and a licence demanding royalties on every glass. “A covenant without a working pump is a claim on an empty pipe.”`,s.party.mode==='follow'?`Berkay can trace the repair. Uygar asks which creditors have priority over household supply. Neither answer can keep Par Value alive alone.`:`You compare Berkay’s repair notes with Uygar’s questions about creditor priority. A working valve and a defensible water covenant will both matter.`,s.flags.dogCheck?'Rusk recommends a shaded water stop. Once the pump works, a spare part could make one for passing animals.':'The keeper marks the runoff channel as unsafe for Pukie. There are gentler places to wait.']},
 granary:{speaker:'A cooperative loader',lines:[`“Four thousand ghosts on our books. Twelve thousand living people at our doors.”`,`Uygar’s accounting and Berkay’s freight experience give you two ways to read this shortage. Halden needs evidence; the loaders need the next lorry.`,s.flags.routeClear?'Your freight permit is pinned beside the loading schedule. The Waterline crossing is the next obstacle.':s.flags.routePlan?'A private enforcer claims the only exit. Challenge his contract, buy a bond or risk a fight.':'After investigating, survey the ramp with your brother to learn why its relief route was written off.']},
 levee:{speaker:'The shift forewoman',lines:[`“They can own the bonds. They cannot own what we know.”`,s.party.mode==='follow'?`The prospectus reports steady yield. Hungry technicians turn the leaking valves by hand. A low barrier marks contaminated runoff; Pukie stays behind it with one brother while the other inspects the machinery.`:`The prospectus reports steady yield. Hungry technicians turn the leaking valves by hand. You inspect the machinery alone; your brother and Pukie remain at ${LOCATIONS[s.party.waitingAt].name}.`,s.flags.routeBridge?'The repaired crossing carries medicine as well as grain. A Free Float charter could make that access permanent.':'An abandoned freight crossing matches Berkay’s old surveys. Its failure may have been physical, financial, or conveniently both.']},
 ward:{speaker:'The ward archivist',lines:[`“The treatment rooms are sterile. The courtyard is not a punishment.”`,`The archivist points out covered seating and water in the courtyard. Pension redemptions sit beside antibiotic receipts. Every cancelled coupon has a patient behind it.`,`Uygar can model the shortfall. Berkay can count the beds that will close. You must still choose which promises to keep.`]}
 };
 const dialogue=scenes[s.location]||base;
 if(dialogue)return {speaker:dialogue.speaker,lines:[...dialogue.lines,
`As ${lead}, you bring ${s.lead==='uygar'?'risk analysis':'field engineering'} to this decision. ${s.party.mode==='follow'?`${other} is beside you; Pukie listens at your feet.`:`${other} and Pukie remain at ${LOCATIONS[s.party.waitingAt].name}.`}`]};
 return null;
}

export function locationActions(s){
 const f=s.flags, sk=s.skills, a=[];
 if(s.ending)return a;
 if(s.combat)return combatActions(s);
 a.push(...extraActions(s,action));
 switch(s.location){
 case 'square':
 a.push(action('work','Take a dock shift','Earn 24 crowns. Someone has to move the collateral.',1));
 a.push(action('rest','Rest at the boarding house','Recover 10 health. Food is consumed as usual.',1,req(s.hp<s.maxHp||((s.party.mode==='follow'||s.party.waitingAt===s.location)&&s.party.stress>0),'Already rested: full health and no accessible companion stress')));break;
 case 'office':
 if(!f.key)a.push(action('venn','Ask about the forged signatures','Venn has a brass key and an uncomfortable favor.',0));
 if(s.act===1){a.push(action('injunction','File an injunction','Ledger, four local leads, and Negotiation 3 or public trust 2.',0,req(f.ledger&&fringeLeadsDone(s)&&(sk.persuade>=3||s.reputation.public>=2),'Find the ledger, finish the square, market, pump and wharf leads, and gain enough influence'),'story'));
 a.push(action('waterbond','Issue the water covenant','Operating pump, clinic seal, and the four local leads.',0,req(f.pump&&f.seal&&fringeLeadsDone(s),'Repair the pump, obtain the clinic seal, and finish the four local leads'),'story'));
 a.push(action('extension','Buy ninety more days','Pay 180 crowns after the four local leads. The principal remains.',0,req(s.cash>=180&&fringeLeadsDone(s),'Requires 180 crowns and the four local leads'),'story'));}
 else a.push(action('vennnews','Ask Venn about the Basin','Your father’s trail leads to the Clearing House.'));break;
 case 'market':a.push(action('openmarket','Browse the order book','Buy supplies, sell inventory, or arrange a loan.'));break;
 case 'clinic':
 if(!f.seal)a.push(action('donate','Donate a trauma kit','Gain the witness seal and +2 public trust.',1,req(s.inventory.medicine>0,'Requires one medicine')));
 a.push(action('treatment','Get medical treatment','Restore all health for 14 crowns.',1,req(s.hp<s.maxHp&&s.cash>=14,'Need injury and 14 crowns')));
 if(!f.training)a.push(action('training','Learn to negotiate','Negotiation +1. Pay 20 crowns.',1,req(s.cash>=20,'Requires 20 crowns')));break;
 case 'bank':
 if(!f.bankAccess){const key=f.key;
 a.push(action('sneakbank','Slip past the repossession officer','Stealth 3. Quiet entry, no blood on the ledger.',1,req(key&&sk.stealth>=3,'Requires Venn’s key and Stealth 3')));
 a.push(action('bribebank','Pay the administrative fee','The officer’s asking price is 30 crowns.',1,req(key&&s.cash>=30,'Requires Venn’s key and 30 crowns')));
 a.push(action('fightbank','Challenge the repossession officer','A turn-based encounter. Your health is at risk.',0,req(key,'Get Venn’s key first'),'danger'));}
 else {if(!f.ledger)a.push(action('ledger','Recover your father’s audit','Six senior claims against the same collateral.',1,null,'story'));
 if(!f.mara)a.push(action('mara','Help the wounded courier','One medicine. Mara shares survival training; Combat +1.',1,req(s.inventory.medicine>0,'Requires one medicine')));}
 break;
 case 'pump':if(!f.pump){a.push(action('repair','Repair the municipal pump','Two parts + Engineering 3. Public trust +1.',1,req(s.inventory.parts>=2&&sk.repair>=3,'Requires two parts and Engineering 3')));a.push(action('hire','Hire a pump engineer','Two parts + 25 crowns. Public trust +1.',1,req(s.inventory.parts>=2&&s.cash>=25,'Requires two parts and 25 crowns')));}break;
 case 'directorate':
 if(!f.dirBrief)a.push(action('dirbrief','Accept Halden’s audit','Investigate the grain cooperative. Earn a settlement key.',0,null,'story'));
 else if(!s.factions.directorate){a.push(action('dirprosecute','Prosecute the cooperative','Enforce the law. The relief fraud stops; so does the food.',1,req(f.grain&&f.annexnames&&f.dirhearing,'Investigate the Paper Harvest, the Paper Annex, and sit the hearing first'),'danger'));a.push(action('direxpose','Expose the ministry’s lending scheme','Present the grain records in open court. Protect the cooperative.',1,req(f.grain&&f.annexnames&&f.dirhearing,'Investigate the Paper Harvest, the Paper Annex, and sit the hearing first'),'story'));a.push(action('dircover','Seal the evidence','Keep people fed. Let the ministry continue its speculation.',1,req(f.grain&&f.annexnames&&f.dirhearing,'Investigate the Paper Harvest, the Paper Annex, and sit the hearing first')));}break;
 case 'granary':if(!f.grain)a.push(action('grain','Follow the missing grain','Accounting 3, or hire a local clerk for 15 crowns.',1,req(f.dirBrief&&(sk.audit>=3||s.cash>=15),'Accept Halden’s audit; need Accounting 3 or 15 crowns'),'story'));break;
 case 'river':
 if(!f.floatBrief)a.push(action('floatbrief','Hear Quill’s proposal','Investigate the water monopoly. Her key is your fee.',0,null,'story'));
 else if(!s.factions.float){a.push(action('floatbuy','Arrange Quill’s acquisition','Sell the monopoly’s weakness. Earn 55 crowns.',1,req(f.waterFiles&&f.quaybook,'Investigate the Waterline and the Night Quay first')));a.push(action('floatworkers','Finance a worker-owned competitor','Two parts + 30 crowns. Create independent water supply.',1,req(f.waterFiles&&f.quaybook&&s.inventory.parts>=2&&s.cash>=30,'Need Waterline records, the Night Quay book, two parts and 30 crowns'),'story'));a.push(action('floatbreak','Sabotage the monopoly’s station','Collapse its valuation. Quill pays 80 crowns; households lose water.',1,req(f.waterFiles&&f.quaybook,'Investigate the Waterline and the Night Quay first'),'danger'));}break;
 case 'levee':if(!f.waterFiles)a.push(action('waterfiles','Inspect the bond register','Find out who owns both sides of the river.',1,req(f.floatBrief,'Hear Quill’s proposal first'),'story'));break;
 case 'reserve':
 if(!f.reserveBrief)a.push(action('reservebrief','Investigate the missing pensions','Rusk asks you to read before you judge.',0,null,'story'));
 else if(!s.factions.reserve){a.push(action('reservewithdraw','Recover the remaining reserve','Protect the pensions. Three clinics must close.',1,req(f.pension&&f.orchardfeed,'Read the ward accounts and walk the Allotment Orchard first')));a.push(action('reservetransparent','Negotiate an open restructuring','One medicine + 20 crowns. Savers accept a haircut; clinics stay open.',1,req(f.pension&&f.orchardfeed&&s.inventory.medicine>0&&s.cash>=20,'Need ward records, the Orchard walk, one medicine and 20 crowns'),'story'));a.push(action('reservecover','Conceal the shortfall','Keep clinics open today. The next redemption cycle will be worse.',1,req(f.pension&&f.orchardfeed,'Read the ward accounts and walk the Allotment Orchard first'),'danger'));}break;
 case 'ward':if(!f.pension)a.push(action('pension','Read the epidemic accounts','Every missing crown has a patient’s name beside it.',1,req(f.reserveBrief,'Meet the Mutual Reserve council first'),'story'));break;
 case 'clearing':
 if(!f.coreAccess){a.push(action('coreaudit','Challenge the security mandate','Accounting 4 or Negotiation 4; present all three keys.',1,req(keys(s)===3&&(sk.audit>=4||sk.persuade>=4),'Need three keys and Accounting 4 or Negotiation 4'),'story'));a.push(action('corebypass','Bypass the security system','Engineering 4 or Stealth 4.',1,req(keys(s)===3&&(sk.repair>=4||sk.stealth>=4),'Need three keys and Engineering 4 or Stealth 4')));a.push(action('fightcore','Force entry into the machine chamber','Defeat the Clearing House sentinel.',0,req(keys(s)===3,'Requires three keys'),'danger'));}
 else if(!f.father)a.push(action('father','Find the beneficial owner','Review the six claims, then sit with him at the console.',0,req(f.claimreview&&f.maramargin&&f.machinefloor,'Review the claims, Mara’s margins, and the machine floor first'),'story'));
 else {a.push(action('endreform','Reform the Counterparty','Preserve settlement. Replace the people who control it.',0,null,'ending'));a.push(action('endtruth','Publish the entire ledger','Let everyone see who profited. Justice will depend on local institutions.',0,null,'ending'));a.push(action('endjubilee','Declare a universal jubilee','Cancel every debt. Food and trust will decide what follows.',0,null,'ending'));a.push(action('endsell','Sell control of the system','Guarantee your family’s safety. Leave everyone else on the balance sheet.',0,null,'danger'));a.push(action('endmutual','Build a mutual clearing network','Distribute power, with courts, worker supply and transparent reserves.',0,req(cooperative(s),'Requires public grain inquiry, worker water network and open pension restructuring'),'ending'));}
 break;
 }
 const restricted=['clinic','ward'].includes(s.location)&&s.party.mode==='follow';
 const partyLock=(entry,msg)=>{if(!entry.blocked)entry.blocked=msg;};
 for(const entry of a){if(restricted)partyLock(entry,'No animals in treatment rooms. Ask your brother to stay with Pukie outside first.');if(['sneakbank','corebypass'].includes(entry.id)&&s.party.mode==='follow')partyLock(entry,'Quiet infiltration needs your brother to wait with Pukie in shelter first.');}
 const extras=optionalActions(s);for(const entry of extras)if(restricted)partyLock(entry,'Ask your brother to stay with Pukie at the covered entrance first.');
 const w=weatherAt(s);if(w.exposed&&w.kind!=='clear')extras.push(action('shelter','Wait out the weather under cover','One settlement. Ease nearby Pukie’s stress by 2; weather changes every six settlements. Food and deadlines still advance.',1));
 return [...a,...extras];
}
export function combatActions(s){const c=s.combat;return [action('attack','Take the shot',`${c.ammo?`${c.ammo} rounds ready`:'Reload first'}. Hit chance ${hitChance(s)}%.`,1,req(c.ammo>0,'No rounds loaded')),action('aim','Aim carefully','Raise your next shot’s accuracy and damage.',1),action('cover','Move into cover','Reduce the next incoming hit to 1–3 damage before party and outfit protection.',1),action('reload','Reload',`Load ${equipmentStats(s).magazine} rounds. The opponent gets a turn.`,1,req(c.ammo<equipmentStats(s).magazine,'Magazine is full')),action('combatmed','Use a trauma kit','Recover 16 health before the opponent acts.',1,req(s.inventory.medicine>0,'No medicine')),action('flee','Withdraw','Escape with 4 damage. You can try another route.',1,null,'danger')];}
export function hitChance(s){return clamp(62+s.skills.combat*5+equipmentStats(s).accuracy+(s.combat?weatherAt(s).accuracy:0)+(s.combat?.aim?22:0)+(s.party.mode==='follow'?4:0)-(s.party.mode==='follow'&&s.party.stress>=4?5:0)+difficultyOf(s).accuracy,5,98);}
const ENEMIES={bank:{name:'Repossession officer',hp:30,flag:'bankAccess'},core:{name:'Clearing House sentinel',hp:45,flag:'coreAccess'},convoy:{name:'Toll enforcer',hp:36,flag:'routeClear'}};
function startCombat(s,kind){if(s.party.mode==='follow')s.party.stress=clamp(s.party.stress+1,0,6);s.combat={kind,name:ENEMIES[kind].name,hp:ENEMIES[kind].hp,maxHp:ENEMIES[kind].hp,ammo:equipmentStats(s).magazine,aim:false,round:1,last:'The opposing party has rejected arbitration.',position:1};}
function fight(s,id){const c=s.combat;let text='';if(id==='flee'){s.hp=clamp(s.hp-4,0,40);s.combat=null;advance(s);return 'You withdraw, losing 4 health. The way is still blocked.';}
 if(id==='attack'){c.ammo--;if(random(s)*100<hitChance(s)){const damage=6+s.skills.combat+equipmentStats(s).damage+Math.floor(random(s)*5)+(c.aim?5:0);c.hp=Math.max(0,c.hp-damage);text=`Your shot deals ${damage} damage. `;}else text='Your shot ricochets off the concrete. ';c.aim=false;}
 if(id==='aim'){c.aim=true;text='You steady your aim. ';}
 if(id==='cover'){c.position=c.position===0?2:0;text='You move behind a concrete divider. ';}
 if(id==='reload'){c.ammo=equipmentStats(s).magazine;text=`${c.ammo} rounds loaded. `;}
 if(id==='combatmed'){s.inventory.medicine--;s.hp=clamp(s.hp+16,0,40);text='You apply a trauma dressing. ';}
 if(c.hp===0){const kind=c.kind;s.combat=null;s.flags[ENEMIES[kind].flag]=true;if(kind==='convoy'){s.cash+=18;s.inventory.rations+=2;}reward(s,3);text+='The passage is clear.';}
 else{let damage=id==='cover'?1+Math.floor(random(s)*3):(c.kind==='bank'?3:4)+Math.floor(random(s)*4);if(s.party.mode==='follow'){damage=Math.max(0,damage-1);if(c.round===1&&s.party.stress<4){damage=Math.max(0,damage-2);text+='Pukie barks a warning; you reach cover before the shot. ';}if(c.round%3===0)s.party.stress=clamp(s.party.stress+1,0,6);}damage=Math.max(0,damage-equipmentStats(s).armor);s.hp=clamp(s.hp-damage,0,40);text+=`The opponent deals ${damage} damage.`;c.round++;c.last=text;}
 advance(s);return text;
}
export function dispatch(original,id,arg){
 const s=upgradeSave(original);if(!s)return {state:structuredClone(original),error:'The campaign state is invalid.'};let text='',title='',cost=0;
 if(s.ending)return {state:s,error:'This run has ended. Begin a new run to play again.'};
 if(id==='travel'){
 if(s.combat)return {state:s,error:'Resolve the encounter before travelling.'};
 if(!Object.hasOwn(LOCATIONS,arg)||LOCATIONS[arg].act>s.act)return {state:s,error:'That destination is not yet available.'};
 if(arg===s.location)return {state:s};
 const oldRegion=region(s),exposure=weatherTravel(s,arg);s.location=arg;if(s.party.mode==='follow'&&['bank','levee','clearing'].includes(arg))s.party.stress=clamp(s.party.stress+1,0,6);if(exposure.health){s.hp=clamp(s.hp-exposure.health,0,40);log(s,'Cold rain finds the gaps in your travelling clothes. The exposed crossing costs 1 health; a raincoat would protect you.');}if(exposure.stress){s.party.stress=clamp(s.party.stress+exposure.stress,0,6);log(s,'The exposed crossing unsettles Pukie. Stress +1; your brother keeps her close.');}cost=oldRegion===region(s)?0:1;text=`Arrived at ${LOCATIONS[arg].name}.`;if(cost)advance(s);log(s,text);return {state:s,text};
 }
 if(id==='equip'||id==='buygear'||id==='sellgear'){
 if(!arg||typeof arg!=='object'||!Object.hasOwn(BROTHERS,arg.brother)||!['outfit','weapon','hat','glasses','face'].includes(arg.slot))return {state:s,error:'Unknown equipment choice.'};
 const brother=arg.brother,g=s.gear[brother];
 if(!canEquip(s,brother))return {state:s,error:s.combat?'Equipment cannot change during an encounter.':`Return to ${BROTHERS[brother].name} before changing his gear.`};
 if(['hat','glasses','face'].includes(arg.slot)){
 if(id!=='equip'||brother!=='berkay'||(arg.slot!=='face'&&typeof arg.value!=='boolean'))return {state:s,error:'Unknown accessory choice.'};
 if(arg.slot==='face'){g.hat=false;g.glasses=false;}else g[arg.slot]=arg.value;
 text=arg.slot==='face'?'Berkay removes his cap and sunglasses. His full face is visible.':`Berkay ${arg.value?'puts on':'removes'} his ${arg.slot==='hat'?'cap':'sunglasses'}.`;
 }else{
 const catalog=arg.slot==='outfit'?OUTFITS:WEAPONS,owned=g[arg.slot==='outfit'?'outfits':'weapons'];
 if(typeof arg.value!=='string'||!Object.hasOwn(catalog,arg.value))return {state:s,error:'Unknown equipment item.'};
 const item=catalog[arg.value];
 if(id==='buygear'){
 if(!['market','river'].includes(s.location))return {state:s,error:'Equipment is sold at the Bid & Ask or Free Float. Travel there first.'};
 if(owned.includes(arg.value))return {state:s,error:'This brother already owns that item.'};
 if(!packHasRoom(s,brother))return {state:s,error:`${BROTHERS[brother].name}’s pack is full (${packCapacity(brother)} gear slots). Sell an unequipped item at a trader first.`};
 if(s.cash<item.price)return {state:s,error:'Not enough crowns.'};
 s.cash-=item.price;owned.push(arg.value);advance(s);text=`${BROTHERS[brother].name} acquires ${item.name.toLowerCase()} for ${item.price} crowns. Equip it from Character → Equipment.`;
 }else if(id==='sellgear'){
 if(!['market','river'].includes(s.location))return {state:s,error:'Return to an equipment trader to sell spare gear.'};
 if(!owned.includes(arg.value))return {state:s,error:'This brother does not own that item.'};
 if(g[arg.slot]===arg.value)return {state:s,error:'Equip another item before selling this one.'};
 owned.splice(owned.indexOf(arg.value),1);const proceeds=Math.floor(item.price/2);s.cash+=proceeds;advance(s);text=`${BROTHERS[brother].name} ${proceeds?'sells':'donates'} ${item.name.toLowerCase()}${proceeds?' for '+proceeds+' crowns':''}. His load is one item lighter. A settlement passes.`;
 }else{
 if(!owned.includes(arg.value))return {state:s,error:'This brother does not own that item.'};
 g[arg.slot]=arg.value;text=`${BROTHERS[brother].name} equips ${item.name.toLowerCase()}.`;
 }
 }
 log(s,text);return {state:s,text};
 }
 if(id==='skill'){
 if(s.combat)return {state:s,error:'Training is unavailable during an encounter.'};
 if(!Object.hasOwn(s.skills,arg)||s.points<1||s.skills[arg]>=5)return {state:s,error:'No available skill point or skill already mastered.'};s.skills[arg]++;s.points--;text='Training recorded. Your capabilities have improved.';log(s,text);return {state:s,text};}
 if(typeof id==='string'&&id.startsWith('event:')){
 if(s.combat)return {state:s,error:'Use the encounter actions first.'};
 const ev=resolveEvent(s,id,log,clamp);
 if(!ev)return {state:s,error:'That matter is not available.'};
 if(ev.error)return {state:s,error:ev.error};
 advance(s,1);if(ev.text)log(s,ev.text);return {state:s,text:ev.text,title:ev.title};
 }
 if(id==='buy'||id==='sell'){
 if(s.combat)return {state:s,error:'Trading is unavailable during an encounter.'};
 if(!Object.hasOwn(ITEMS,arg))return {state:s,error:'Unknown commodity.'};const q=quote(s,arg);
 if(id==='buy'){if(s.cash<q.ask||s.inventory[arg]>=30)return {state:s,error:'Insufficient cash or inventory is full (30 units).'};s.cash-=q.ask;s.inventory[arg]++;text=`Bought ${ITEMS[arg].name.toLowerCase()} at ${q.ask} crowns.`;}
 else{if(s.inventory[arg]<1)return {state:s,error:'No units available to sell.'};s.cash+=q.bid;s.inventory[arg]--;text=`Sold ${ITEMS[arg].name.toLowerCase()} at ${q.bid} crowns.`;}advance(s);log(s,text);return {state:s,text};}
 if(['borrow','borrownote','borrowlarge','repay','forward','forwardparts','forwardscrip','medkit'].includes(id)){
 if(s.combat)return {state:s,error:'Use the encounter actions first.'};
 if(id==='borrow'||id==='borrownote'||id==='borrowlarge'){
  const kind=id==='borrownote'?'note':id==='borrowlarge'?'collateral':'facility';
  const r=applyLoan(s,kind);if(r.error)return {state:s,error:r.error};text=r.text;
 }
 if(id==='repay'){if(!s.loan||s.cash<s.loan.balance)return {state:s,error:'Insufficient cash to repay the balance.'};s.cash-=s.loan.balance;s.loan=null;text='Loan settled. Your collateral is released.';}
 if(id==='forward'||id==='forwardparts'||id==='forwardscrip'){
  const key=id==='forwardparts'?'parts':id==='forwardscrip'?'scrip':'rations';
  const p=FORWARD_PRODUCTS[key];
  if(s.forward||s.cash<p.price)return {state:s,error:`Need ${p.price} crowns and no outstanding forward.`};
  s.cash-=p.price;s.forward={due:s.turn+p.term,item:p.item,qty:p.qty};text=`Forward purchased. ${p.qty} ${ITEMS[p.item].name.toLowerCase()} will arrive in ${p.term} turns.`;
 }
 if(id==='medkit'){if(s.inventory.medicine<1||s.hp===40)return {state:s,error:'You need a medicine and an injury.'};s.inventory.medicine--;s.hp=clamp(s.hp+16,0,40);text='Trauma kit used. Recovered up to 16 health.';}
 advance(s);log(s,text);return {state:s,text};}
 const available=[...locationActions(s),...partyActions(s)].find(a=>a.id===id);
 if(!available||available.blocked)return {state:s,error:available?.blocked||'That choice is not available here.'};
 if(s.combat){text=fight(s,id);log(s,text);return {state:s,text};}
 const f=s.flags;cost=available.cost;
 switch(id){
 case 'shelter':if(s.party.mode==='follow'||s.party.waitingAt===s.location)s.party.stress=clamp(s.party.stress-2,0,6);text='You wait beneath a covered awning as the weather passes over the district. Nearby companions rest out of the wind; a settlement passes and supplies are consumed as usual.';break;
 case 'partywait':s.party.mode='wait';s.party.waitingAt=s.location;text=`${partyStatus(s).brother} stays with Pukie at the sheltered entrance of ${LOCATIONS[s.location].name}. Return here to regroup. Companion support is unavailable while apart.`;break;
 case 'partyregroup':s.party.mode='follow';s.party.waitingAt=null;text='The brothers reunite. Pukie circles both of you, then falls into step.';break;
 case 'partycare':s.inventory.rations--;s.party.stress=clamp(s.party.stress-3,0,6);s.party.bond=clamp(s.party.bond+1,0,6);s.party.lastCare=s.turn;text='You share clean water, food and a quiet moment with Pukie. Stress falls by up to 3; bond rises by 1.';break;
 case 'familyletters':f.familyLetters=true;reward(s);text='Uygar finds an unsigned guarantee. Berkay recognizes the freight notation beneath it. Their father left two halves of one warning: compare the Counting House register.';break;
 case 'familyregister':f.familyRegister=true;reward(s);text='The guarantee predates its witness stamp. Venn points to a numbered envelope in the bank: the family became collateral after your father disappeared.';break;
 case 'familyescrow':f.familyEscrow=true;s.cash+=25;reward(s,3);text='The envelope holds 25 crowns and a letter to both sons: “The asset is the road, not the toll. Keep a route open even if you cannot keep the currency alive.” Ask him about it at Central Clearing.';break;
 case 'familyresolve':f.familyResolved=true;s.reputation.public++;reward(s,3);text='Both family signatures are struck from the guarantee. You preserve the unredacted record and demand independent witnesses. Your father admits that using his sons as leverage repeated the crime he meant to expose.';break;
 case 'dogtag':f.dogTag=true;s.cash-=8;s.party.bond=clamp(s.party.bond+1,0,6);reward(s);text='The tag reads PUKIE, with both brothers listed as contacts. A market keeper points you toward Rusk’s courtyard health checks. Small mercies survive on ordinary paperwork.';break;
 case 'dogcheck':f.dogCheck=true;s.cash-=6;s.party.stress=clamp(s.party.stress-3,0,6);reward(s);text='Rusk checks Pukie’s paws in the courtyard while your brother stays beside her. “Clean water matters more than a fancy harness. Make a stop at your municipal pump.”';break;
 case 'dogwater':f.dogWater=true;s.inventory.parts--;s.party.stress=0;reward(s,3);text='Berkay fits a spare valve; Uygar writes an unrestricted access notice. Pukie tries the shaded trough first. The next caravan asks whether the Gardens could adopt it.';break;
 case 'dogrefuge':f.dogRefuge=true;s.inventory.rations--;s.party.bond=clamp(s.party.bond+1,0,6);s.party.stress=0;s.reputation.public++;reward(s,3);text='The Reserve marks sheltered courtyards and water stops along the route. Small Mercies complete: Pukie’s care ration is now due every 12 settlements, not 8. Other travellers can use the shelters too.';break;
 case 'dogwelcome':f.dogWelcome=true;s.inventory.rations++;s.reputation.public++;reward(s);text='Pukie settles beside the shelter keeper rather than barking at his walking frame. He introduces the brothers to the local aid circle and shares a ration pack. Public trust +1. This welcome can happen once.';break;
 case 'routeplan':f.routePlan=true;reward(s);text='Berkay’s freight map and Uygar’s grain audit reveal the same bottleneck: a condemned crossing. But first, a private enforcer has imposed an unlicensed toll on the grain yard. Challenge the contract, pay a passage bond, or fight.';break;
 case 'routeargue':case 'routepay':if(id==='routepay')s.cash-=18;f.routeClear=true;s.inventory.rations+=2;reward(s,3);text=id==='routeargue'?'You prove that the toll contract excludes emergency grain. The enforcer signs a freight permit and releases two ration packs.':'The 18-crown passage bond buys a freight permit and releases two ration packs. The private toll survives your bargain.';break;
 case 'routefight':startCombat(s,'convoy');text='The toll enforcer draws a weapon. '+(s.party.mode==='follow'?'Pukie shelters behind your brother; she never attacks.':`Your brother is keeping Pukie safe at ${LOCATIONS[s.party.waitingAt].name}. You face the enforcer without their support.`);cost=0;break;
 case 'routebridge':f.routeBridge=true;s.inventory.parts--;reward(s,3);text='The brothers brace the crossing above contaminated runoff. Pukie stays behind the marked work line with one brother while the other fits the supports. A common-carrier charter could keep the route open.';break;
 case 'routecharter':f.routeCharter=true;s.cash+=20;reward(s);text='You secure an open freight charter and 20 crowns in inspection fees. No faction can exclude a clinic parcel for lack of allegiance. The first delivery must prove the promise.';break;
 case 'routeclinic':f.routeClinic=true;s.inventory.rations--;s.inventory.medicine++;reward(s);text='The clinic parcel arrives. The Reserve returns a trauma kit for the road. Establish the Par Value terminus so the common-carrier route has a home.';break;
 case 'routehome':f.routeHome=true;s.inventory.rations+=3;s.reputation.public+=2;reward(s,4);text='Common Carrier complete. Three ration packs arrive at the new waystation. Couriers, clinics and neighbours have a route that survives changes of ownership and currency.';break;
 case 'openmarket':return {state:s,open:'market'};
 case 'work':s.cash+=24;text='You earn 24 crowns moving repossessed furniture. One desk still has a child’s drawing inside.';break;
 case 'rest':if(s.party.mode==='follow'||s.party.waitingAt===s.location)s.party.stress=clamp(s.party.stress-2,0,6);s.hp=clamp(s.hp+10,0,40);text='You sleep beneath a billboard promising guaranteed returns. Recovered up to 10 health.';break;
 case 'venn':f.key=true;reward(s,1);title='A third document';text='Venn gives you the ruined bank’s brass key. “Your father did not default. He found the beneficial owner.” The collectors arrive at settlement '+deadlineOf(s)+'. Find the ledger, rebuild the water supply, or buy an extension.';break;
 case 'vennnews':text='“Three seals,” Venn says. “The Directorate, the Free Float and the Mutual Reserve. Together they authorize entry to Central Clearing.”';break;
 case 'sneakbank':f.bankAccess=true;reward(s);text='You slip past the officer during a mandatory compliance break. The vault is open.';break;
 case 'bribebank':s.cash-=30;f.bankAccess=true;reward(s);text='The officer pockets an administrative processing fee. No receipt is offered.';break;
 case 'fightbank':startCombat(s,'bank');text='The officer raises a collection baton. Arbitration has failed.';break;
 case 'ledger':if(s.party.mode==='follow'&&!f.scentBank){f.scentBank=true;s.inventory.rations+=2;log(s,'Pukie follows a food scent behind a filing cabinet. You recover two sealed ration packs; the cache is now empty.');}f.ledger=true;reward(s,3);if(s.skills.audit>=4)s.cash+=25;title='Six senior claims';text='Your father’s audit proves that six institutions hold senior claims on the same assets. Someone has been manufacturing ownership. The final page reads: FIND THE BENEFICIAL OWNER.'+(s.skills.audit>=4?' Your accounting skill also recovers 25 crowns from escrow.':'');break;
 case 'mara':s.inventory.medicine--;f.mara=true;s.skills.combat=Math.min(5,s.skills.combat+1);reward(s);title='A contract unfinished';text='Mara Voss becomes an independent courier ally and shares training. Combat +1. She keeps her own route; the brothers and Pukie travel together. “Your father paid in advance,” she says. When you ask for what, she looks away.';break;
 case 'donate':s.inventory.medicine--;f.seal=true;s.reputation.public+=2;reward(s);text='Rusk signs your covenant. Household water must be protected before creditors receive a single coupon. Public trust +2.';break;
 case 'treatment':s.cash-=14;s.hp=40;text='Rusk restores your health. His invoice includes an apology.';break;
 case 'training':s.cash-=20;f.training=true;s.skills.persuade=Math.min(5,s.skills.persuade+1);text='Negotiation +1. You learn to ask who benefits from the definition.';break;
 case 'repair':case 'hire':s.inventory.parts-=2;if(id==='hire')s.cash-=25;f.pump=true;s.reputation.public++;reward(s,3);text='Water flows again. Public trust +1. Local supply improves; commodity prices fall.';break;
 case 'injunction':case 'waterbond':case 'extension':
 if(id==='extension')s.cash-=180;f.townSaved=id;s.act=2;reward(s,4);title='Act II · A market for everything';
 text=id==='injunction'?'The claims cannot all be senior. Venn grants ninety days. Your family and neighbours remain citizens, not collateral. The original creditor is still out there.':id==='waterbond'?'A witnessed water bond keeps the collectors away. Household supply comes first. The town has a future, and that future has a coupon.':'You buy ninety days. Your family guarantee is stayed. Across the Basin, someone is still manufacturing the claims that nearly took your home.';
 text+=' Three powers hold the keys to the Central Clearing House. The world map is now open.';break;
 case 'dirbrief':f.dirBrief=true;text='Halden asks you to audit the Paper Harvest. Resolve its fraud and the Directorate key is yours.';break;
 case 'grain':if(s.skills.audit<3)s.cash-=15;f.grain=true;reward(s);title='Yield on starvation';text='The cooperative invented four thousand citizens to claim food for twelve thousand real people. Upstream, the transport ministry has lent emergency grain to speculators for yield. Halden does not know. You have proof of both schemes.';break;
 case 'dirprosecute':s.factions.directorate='prosecute';s.reputation.directorate+=3;s.reputation.public-=2;s.inventory.rations+=3;reward(s,3);text='The cooperative is closed. Halden gives you the Directorate key and three rations as an official allowance. Outside, families wait for a distribution that will never come.';break;
 case 'direxpose':s.factions.directorate='expose';s.reputation.directorate++;s.reputation.public+=2;f.grainReserves=true;reward(s,3);text='You present the ministry’s lending records in open court. Halden prosecutes his own officials. Emergency grain is restored and the cooperative becomes a recognized relief network. He hands you the key without meeting your eyes.';break;
 case 'dircover':s.factions.directorate='cover';s.cash+=35;reward(s,3);text='You seal the audit and receive 35 crowns in expenses. Food keeps moving. The ministry keeps speculating. Halden grants the key on the strength of your signature.';break;
 case 'floatbrief':f.floatBrief=true;text='Quill sends you to the Waterline. Find the weakness in the monopoly’s capital structure.';break;
 case 'waterfiles':if(s.party.mode==='follow'&&!f.scentLevee){f.scentLevee=true;s.inventory.parts++;log(s,'Pukie pauses beside an abandoned workers’ satchel. Beneath its old lunch tin you recover one usable machine part.');}f.waterFiles=true;reward(s);title='Both sides of the trade';text='Quill owns the bonds financing the monopoly and the debt of its would-be competitors. Its workers know how to run an independent supply line. They need equipment and working capital.';break;
 case 'floatbuy':s.factions.float='buy';s.reputation.float+=2;s.cash+=55;reward(s,3);text='Quill acquires the monopoly at a discount. The signs change. The prices do not. She pays 55 crowns and places her settlement key on the table.';break;
 case 'floatworkers':s.inventory.parts-=2;s.cash-=30;s.factions.float='workers';s.reputation.public+=2;f.independentWater=true;reward(s,3);text='The workers open their own supply line. Quill loses control of the spread, but honors her contract. “Competition,” she says, handing you the key, “is becoming inconveniently literal.”';break;
 case 'floatbreak':s.factions.float='break';s.cash+=80;s.reputation.float+=3;s.reputation.public-=2;reward(s,3);text='The pumping station fails. Its valuation collapses before its last reservoir empties. Quill pays 80 crowns and delivers the key. You hear the household taps run dry.';break;
 case 'reservebrief':f.reserveBrief=true;text='The council grants access to the Redemption Ward. Rusk asks you to read every line before you decide what he is.';break;
 case 'pension':f.pension=true;reward(s);title='A different kind of debt';text='Every missing crown paid for antibiotics. Rusk saved the patients and falsified the accounts. Recovering the remaining reserve will save pensions but close three clinics. Transparency could keep both alive if people accept less than they were promised.';break;
 case 'reservewithdraw':s.factions.reserve='withdraw';s.reputation.reserve+=2;reward(s,3);text='The remaining money returns to the pension reserve. Three clinics close. The council gives you its settlement key, calling the loss of beds an unfortunate adjustment.';break;
 case 'reservetransparent':s.inventory.medicine--;s.cash-=20;s.factions.reserve='transparent';s.reputation.reserve++;s.reputation.public+=2;f.mutualGuarantees=true;reward(s,3);text='You fund emergency care and publish the accounts. Savers accept a haircut in exchange for independent oversight. Rusk resigns as treasurer and stays as a doctor. The council gives you the key.';break;
 case 'reservecover':s.factions.reserve='cover';s.inventory.medicine+=2;reward(s,3);text='The council buries the loss. The clinics stay open. Rusk gives you two trauma kits and the key, then asks you never to call him a hero.';break;
 case 'coreaudit':case 'corebypass':f.coreAccess=true;reward(s,3);text=id==='coreaudit'?'The security mandate contains an exception for independent audit. Three keys authenticate your challenge. The sentinel stands down.':'You route the three keys through an obsolete maintenance circuit. The vault opens without an alarm.';break;
 case 'fightcore':startCombat(s,'core');text='The sentinel classifies you as an impaired asset. The vault doors close behind you.';break;
 case 'father':f.father=true;reward(s,2);title='The beneficial owner';text='Your father kept the fraudulent claims alive because they now back everyone’s savings. He tried cancellation once. Food shipments froze when nobody could prove who owned the cargo. “I needed someone who would keep going after they found me.” The console is yours.';break;
 case 'endreform':s.ending='reform';break;
 case 'endtruth':s.ending='truth';break;
 case 'endjubilee':s.ending='jubilee';break;
 case 'endsell':s.ending='sell';break;
 case 'endmutual':s.ending='mutual';break;
 default:{
  const q=handleQuest(s,id);
  if(!q)break;
  if(q.error)return {state:s,error:q.error};
  text=q.text||'';title=q.title||'';
  if(q.xp)reward(s,q.xp);
  break;
 }
 }
 if(cost)advance(s,cost);
 if(keys(s)===3&&s.act===2){s.act=3;title='Act III · The beneficial owner';text+=' All three keys are yours. The Central Clearing House is now accessible.';}
 if(text)log(s,text);
 if(available.kind==='story'||available.kind==='danger'||available.kind==='ending')s.choices.push({id,turn:s.turn});
 return {state:s,text,title};
}
export function epilogue(s){
 const endings={
 reform:['THE NEW GOVERNORS','You preserve the Counterparty and replace the people who control it. Trade stabilizes. The machine learns new limits, written by people who remember what the old ones cost.'],
 truth:['THE OPEN LEDGER','Every settlement learns who profited from its suffering. The evidence belongs to everyone now. What comes next depends on what you built before you published it.'],
 jubilee:['ZERO BALANCE','Every inherited obligation is canceled. For one extraordinary morning, nobody owes the past a thing. The next delivery of grain still needs someone to arrange it.'],
 sell:['A CONTROLLING INTEREST','You sell the Clearing House to a consortium that promises competent management. Your family receives lifetime protection. Other families inherit obligations carrying your seal.'],
 mutual:['NOBODY OWNS TOMORROW','The Clearing House becomes a network of regional institutions. Courts check the ledgers. Workers control essential supply. Mutual reserves publish their accounts. Nobody gets everything back. Nobody gets to own everything either.'],
 death:['WRITTEN OFF','The clinic records your death as an unrecoverable expense. Your unfinished audit is sold by weight. Someone uses it to wrap bread. For one morning, the accounts feed somebody.'],
 receivership:['RECEIVERSHIP','When the deadline closed, the collectors arrived. The water tanks received new numbers. Your family and neighbours left the citizen roll and entered an asset register. Venn offered you a job managing the transition.']
 };
 const [title,text]=endings[s.ending]||['UNSETTLED','Your story continues.'];
 const segments=[];
 if(s.ending==='death')segments.push({name:'The ones who remain',text:`${partyStatus(s).brother} survives with Pukie. They carry ${s.name}’s unfinished family record back to the waystation. Pukie sleeps beside the remaining brother’s pack on the journey home.`});
 if(s.ending==='receivership')segments.push({name:'The road ahead',text:'Uygar and Berkay leave with Pukie before the new asset register closes. The settlement is lost, but the group survives together.'});
 if(!['death','receivership'].includes(s.ending)){
 segments.push({name:'Par Value',text:s.flags.pump?'The repaired pump keeps running. Children repaint the tanks. The brothers keep the first brass valve they replaced above the waystation door.':'The town survives. Its pump still coughs at sunrise. Your neighbours ask whether fixing the accounts means someone will finally fix the pipes.'});
 segments.push({name:'The Basin',text:s.ending==='jubilee'?(s.flags.grainReserves&&s.flags.independentWater&&s.flags.mutualGuarantees?'The food reserves, independent water supply and mutual guarantees carry the Basin through the currency transition. Freedom lasts beyond breakfast.':'Debt disappears faster than the delivery networks can adapt. Shortages follow. New councils struggle to turn freedom into a functioning supply chain.'):s.ending==='truth'?(s.factions.directorate==='expose'?'Independent courts turn the ledger into restitution hearings. It is slow, imperfect work. People show up anyway.':'Without trusted courts, the ledger becomes a list of targets. Some recover what was stolen. Others settle older scores.'):'Your faction choices become institutions. Every agreement you signed now has to survive the people who signed it.'});
 segments.push({name:'Mara Voss',text:s.flags.mara?(s.ending==='sell'?'Mara leaves your fee on the desk. “The contract was to stop him becoming part of it,” she says. “I should have read the assignment clause.”':'When the news reaches Mara, she tears up your father’s contract and asks what the group should do tomorrow. For once, nobody has prepaid the answer.'):'The courier leaves the Basin. Somewhere on the river, a contract remains unfinished.'});
 }
 if(!['death','receivership'].includes(s.ending)){
 segments.push({name:'Uygar & Berkay',text:`${s.name} made the final choice. ${partyStatus(s).brother} ${s.party.mode==='follow'?'stood beside the console':'kept a different promise, protecting Pukie at '+LOCATIONS[s.party.waitingAt].name}. ${s.flags.familyResolved?'Their father’s record becomes public testimony; their names are no longer anybody’s collateral.':'Their father’s methods remain an unfinished family reckoning.'}`});
 segments.push({name:'Pukie · Small Mercies',text:s.flags.dogRefuge?'Marked water stops and sheltered courtyards outlive the settlement. Pukie travels the route with both brothers; other companions find welcome there too.':`Pukie stays with the brothers. ${s.party.bond>=5?'Patient care has made their camp a place she trusts.':'They learn that a companion needs food, patience and a place at the fire.'} Her small needs keep their grand promises grounded.`});
 segments.push({name:'Common Carrier',text:s.flags.routeHome?'The independent freight route keeps clinics and kitchens supplied when ownership papers change. The brothers’ work becomes a safeguard against the next settlement crisis.':'Freight still depends on the factions’ bargains. An unfinished crossing or missing charter remains work for another journey.'});
 }
 return {title,text,segments};
}
export function upgradeSave(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;let s;try{s=structuredClone(input);}catch{return null;}
 if(!Object.hasOwn(s,'lead')&&!Object.hasOwn(s,'party')){s.lead='uygar';s.name='Uygar';s.party={mode:'follow',waitingAt:null,stress:0,bond:3,lastCare:-8};}
 if(!Object.hasOwn(s,'gear'))s.gear=defaultEquipment();
 migrateExpansion(s);
 s.version=VERSION;
 return validateSave(s)?s:null;
}
export function validateSave(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||!validEquipment(s.gear)||s.version!==VERSION||!Object.hasOwn(ROLES,s.role)||!Object.hasOwn(LOCATIONS,s.location)||LOCATIONS[s.location].act>s.act)return false;
 const ints={act:[1,3],turn:[0,100000],hp:[0,40],maxHp:[40,40],cash:[0,10000000],xp:[0,100000],level:[1,1000],points:[0,1000],seed:[0,4294967295],played:[0,100000]};
 for(const [k,[lo,hi]] of Object.entries(ints))if(!Number.isInteger(s[k])||s[k]<lo||s[k]>hi)return false;
 if(!Object.hasOwn(BROTHERS,s.lead)||s.name!==BROTHERS[s.lead].name)return false;
 const p=s.party;if(!p||!['follow','wait'].includes(p.mode)||!Number.isInteger(p.stress)||p.stress<0||p.stress>6||!Number.isInteger(p.bond)||p.bond<0||p.bond>6||!Number.isInteger(p.lastCare)||p.lastCare< -8||p.lastCare>s.turn||(p.mode==='follow'?p.waitingAt!==null:!Object.hasOwn(LOCATIONS,p.waitingAt)||LOCATIONS[p.waitingAt].act>s.act))return false;
 if(Object.keys(p).some(k=>!['mode','waitingAt','stress','bond','lastCare'].includes(k)))return false;
 if(typeof s.name!=='string'||s.name.length>32||!s.flags||typeof s.flags!=='object'||Array.isArray(s.flags))return false;
 for(const key of Object.keys(s.flags))if(!['key','bankAccess','ledger','mara','seal','training','pump','townSaved','dirBrief','grain','grainReserves','floatBrief','waterFiles','independentWater','reserveBrief','pension','mutualGuarantees','coreAccess','father','familyLetters','familyRegister','familyEscrow','familyResolved','dogTag','dogWelcome','dogCheck','dogWater','dogRefuge','routePlan','routeClear','routeBridge','routeCharter','routeClinic','routeHome','scentBank','scentLevee',...QUEST_FLAGS].includes(key))return false;
 for(const [k,v] of Object.entries(s.flags))if(k==='townSaved'?!['injunction','waterbond','extension'].includes(v):typeof v!=='boolean')return false;
 const dependencies={familyRegister:['familyLetters'],familyEscrow:['familyRegister','bankAccess'],familyResolved:['familyEscrow','father'],dogCheck:['dogTag'],dogWater:['dogCheck','pump'],dogRefuge:['dogWater'],dogWelcome:['dogTag'],routePlan:['grain'],routeClear:['routePlan'],routeBridge:['routeClear'],routeCharter:['routeBridge'],routeClinic:['routeCharter'],routeHome:['routeClinic'],scentBank:['ledger'],scentLevee:['waterFiles']};
 for(const [flag,needs] of Object.entries(dependencies))if(s.flags[flag]&&needs.some(k=>!s.flags[k]))return false;
 for(const k of Object.keys(ITEMS))if(!Number.isInteger(s.inventory?.[k])||s.inventory[k]<0||s.inventory[k]>1000)return false;
 for(const k of ['audit','persuade','repair','stealth','combat'])if(!Number.isInteger(s.skills?.[k])||s.skills[k]<1||s.skills[k]>5)return false;
 for(const k of ['directorate','float','reserve','public'])if(!Number.isInteger(s.reputation?.[k])||Math.abs(s.reputation[k])>1000)return false;
 if(!s.factions||![null,'prosecute','expose','cover'].includes(s.factions.directorate)||![null,'buy','workers','break'].includes(s.factions.float)||![null,'withdraw','transparent','cover'].includes(s.factions.reserve))return false;
 if(![null,'reform','truth','jubilee','sell','mutual','death','receivership'].includes(s.ending))return false;
 if(s.loan&&(!Number.isInteger(s.loan.balance)||s.loan.balance<1||s.loan.balance>500||!Number.isInteger(s.loan.due)||s.loan.due<0||s.loan.due>100010))return false;
 if(s.forward&&(!Number.isInteger(s.forward.due)||s.forward.due<0||s.forward.due>100006))return false;
 if(!validExpansion(s))return false;
 if(s.combat){const c=s.combat;if(!Object.hasOwn(ENEMIES,c.kind)||c.name!==ENEMIES[c.kind].name||c.maxHp!==ENEMIES[c.kind].hp||!Number.isInteger(c.hp)||c.hp<1||c.hp>c.maxHp||!Number.isInteger(c.ammo)||c.ammo<0||c.ammo>equipmentStats(s).magazine||typeof c.aim!=='boolean'||!Number.isInteger(c.round)||c.round<1||c.round>100000||![0,1,2].includes(c.position)||typeof c.last!=='string'||c.last.length>1000)return false;}
 if(!Array.isArray(s.log)||s.log.length>60||s.log.some(l=>!l||typeof l!=='object'||!Number.isInteger(l.turn)||typeof l.text!=='string'||l.text.length>3000))return false;
 if(!Array.isArray(s.choices)||s.choices.length>1000||s.choices.some(c=>!c||typeof c!=='object'||typeof c.id!=='string'||c.id.length>50||!Number.isInteger(c.turn)))return false;
 if(!s.ending&&(s.hp===0||(s.act===1&&s.turn>=deadlineOf(s))))return false;
 if(s.act>=2&&!s.flags.townSaved)return false;
 if(s.act===3&&keys(s)!==3)return false;
 if(s.ending&&s.combat)return false;
 return true;
}
