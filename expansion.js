import {ITEMS,LOCATIONS,STAPLES} from './content.js';
export {STAPLES};
import {questActions} from './quests.js';

export const VERSION_EXPANSION=2;

export const DIFFICULTY={
 story:{id:'story',name:'Story',tag:'Read the Basin. The numbers still matter.',startCash:80,accuracy:8,spread:0.75,marginHp:2,deadline:52,loanPremium:0.15,detail:'A more forgiving clock, softer spreads and more forgiving aim. The writing is the same; the collectors give you more room.'},
 standard:{id:'standard',name:'Standard',tag:'Tense, but fair.',startCash:65,accuracy:0,spread:1,marginHp:4,deadline:44,loanPremium:0.25,detail:'The intended first playthrough. Cash is tight, fights are even, and Par Value’s deadline is 44 settlements.'},
 hard:{id:'hard',name:'Hard',tag:'Thin spreads. Shorter fuse.',startCash:45,accuracy:-6,spread:1.35,marginHp:6,deadline:36,loanPremium:0.40,detail:'Worse prices, worse aim, a 36-settlement clock, and margin calls that hurt. Side work still exists; wasted turns do not.'}
};

export const TRADE_GOODS={
 ink:{name:'Stamp ink',unit:'sealed pot',base:11,icon:'ledger',spread:5,wave:3,floor:4,region:{'The Fringe':0,'The Interior':-2,'The Delta':3,'The Gardens':1,'The Core':6},desc:'Courts, exchanges and forgers all buy the same pot. Interior clerks bid it down; Core porters pay in a hurry.'},
 fuel:{name:'Pump fuel',unit:'canister',base:14,icon:'tool',spread:6,wave:4,floor:5,region:{'The Fringe':1,'The Interior':0,'The Delta':-3,'The Gardens':2,'The Core':5},desc:'Keeps municipal pumps and barge motors turning. Cheap on the Delta, dear once it has been carried inland.'},
 scrip:{name:'Grain scrip',unit:'cooperative note',base:12,icon:'box',spread:7,wave:1,floor:3,region:{'The Fringe':2,'The Interior':-4,'The Delta':1,'The Gardens':-1,'The Core':4},desc:'A promise of grain, not the grain itself. The Interior prints it; everyone else argues about what it is worth.'},
 salt:{name:'Preserving salt',unit:'cloth bag',base:8,icon:'health',spread:4,wave:2,floor:3,region:{'The Fringe':-1,'The Interior':2,'The Delta':0,'The Gardens':-2,'The Core':3},desc:'Keeps rations honest in the heat. Gardens kitchens buy it steadily; Interior warehouses treat it as an afterthought.'}
};

export const LOAN_PRODUCTS={
 note:{id:'borrownote',name:'Short note',advance:40,balance:48,term:6,detail:'Receive 40 crowns. 48 fall due in six turns. A small, sharp debt.'},
 facility:{id:'borrow',name:'Credit facility',advance:80,balance:100,term:10,detail:'Receive 80 crowns. 100 fall due in ten turns. The Bid & Ask’s standard leverage.'},
 collateral:{id:'borrowlarge',name:'Collateralised loan',advance:150,balance:210,term:14,detail:'Receive 150 crowns against whatever the lender decides is yours. 210 fall due in fourteen turns.'}
};

export const FORWARD_PRODUCTS={
 rations:{id:'forward',item:'rations',qty:3,term:6,price:18,detail:'Pay 18 crowns for three ration packs in six turns.'},
 parts:{id:'forwardparts',item:'parts',qty:2,term:8,price:28,detail:'Pay 28 crowns for two salvaged assemblies in eight turns.'},
 scrip:{id:'forwardscrip',item:'scrip',qty:4,term:8,price:36,detail:'Pay 36 crowns for four grain notes in eight turns. They may be worth more or less than you paid.'}
};

export const EXTRA_FLAGS=[];

export function difficultyOf(s){return DIFFICULTY[s?.difficulty]||DIFFICULTY.standard;}
export function deadlineOf(s){return difficultyOf(s).deadline;}
export function regionName(s,location=s.location){return (LOCATIONS[location]||LOCATIONS.square).region;}

const ORIGINAL_REGION={'The Fringe':[0,2,0],'The Interior':[-3,3,1],'The Delta':[2,0,-3],'The Gardens':[0,-4,2],'The Core':[4,4,4]};

export function quoteFor(s,item){
 if(!Object.hasOwn(ITEMS,item))return {ask:4,bid:1,spread:3};
 const d=difficultyOf(s),phase=Math.floor(s.turn/4),reg=regionName(s);
 if(Object.hasOwn(TRADE_GOODS,item)){
  const g=TRADE_GOODS[item],wave=((phase*3+g.wave*2)%7)-3;
  let mid=g.base+(g.region[reg]||0)+wave;
  if(s.flags?.pump&&(item==='fuel'||item==='salt'))mid-=2;
  if(s.flags?.grainReserves&&item==='scrip')mid-=2;
  if(s.flags?.independentWater&&item==='fuel')mid-=1;
  mid=Math.max(g.floor,Math.round(mid));
  const spread=Math.max(2,Math.round(g.spread*d.spread));
  const ask=Math.max(g.floor+1,mid+Math.ceil(spread/2));
  return {ask,bid:Math.max(1,ask-spread),spread};
 }
 const keys=['rations','medicine','parts'],i=Math.max(0,keys.indexOf(item)),base=ITEMS[item].base;
 const wave=((phase*3+i*2)%7)-3;
 const ask=Math.max(4,base+(ORIGINAL_REGION[reg]?.[i]||0)+wave-(s.flags?.pump&&item==='rations'?2:0));
 const spread=Math.max(2,Math.round(4*d.spread));
 return {ask,bid:Math.max(1,ask-spread),spread};
}

export function loanTerms(kind,s){
 const table={note:LOAN_PRODUCTS.note,facility:LOAN_PRODUCTS.facility,collateral:LOAN_PRODUCTS.collateral};
 const p=table[kind]||LOAN_PRODUCTS.facility;
 const premium=difficultyOf(s).loanPremium??0.25;
 const balance=Math.round(p.advance*(1+premium)+(p.balance-p.advance));
 return {kind,advance:p.advance,balance,dueOffset:p.term,name:p.name};
}

export function applyLoan(s,kind){
 if(s.loan)return {error:'Settle your existing loan first.'};
 const t=loanTerms(kind,s);
 s.cash+=t.advance;
 s.loan={balance:t.balance,due:s.turn+t.dueOffset,kind:t.kind};
 return {text:`Received ${t.advance} crowns on a ${t.name.toLowerCase()}. ${t.balance} crowns fall due in ${t.dueOffset} turns.`};
}

export function settleFinance(s,log,clamp){
 if(s.forward&&s.turn>=s.forward.due){
  const item=s.forward.item||'rations',qty=s.forward.qty||3;
  if(Object.hasOwn(ITEMS,item))s.inventory[item]=(s.inventory[item]||0)+qty;
  const label=(ITEMS[item]?.name||item).toLowerCase();
  log(s,`Your ${label} forward settles: ${qty} delivered.`);
  s.forward=null;
 }
 if(s.loan&&s.turn>=s.loan.due){
  const paid=Math.min(s.cash,s.loan.balance);
  s.cash-=paid;s.loan.balance-=paid;
  if(s.loan.balance>0){
   const hp=difficultyOf(s).marginHp;
   s.hp=clamp(s.hp-hp,0,s.maxHp);
   s.loan.due=s.turn+4;
   log(s,`MARGIN CALL. ${paid} crowns seized; ${hp} health lost. ${s.loan.balance} still due.`);
  }else{
   log(s,'Your lender collected the outstanding balance.');
   s.loan=null;
  }
 }
}

export const EVENTS=[
 {id:'postedbill',act:[1],region:'The Fringe',tease:'A collector has posted a new bill on the square notice board, written in two different hands.',a:{label:'Read both hands',detail:'Compare the figures. Public trust holds; you spend a settlement reading.',text:'The lower figure is in Venn’s clerk’s ink. The higher one has been added later, in a tighter, more expensive script. Nobody in the square pretends not to have seen it.',cash:0,rep:1},b:{label:'Tear the higher figure down',detail:'A small crowd notices. Public trust +1, but a collector remembers your face.',text:'You tear the inflated figure off the board. A child picks up the scraps to use as kindling. A man in a grey coat writes something down and does not introduce himself.',rep:1}},
 {id:'thirstprice',act:[1,2],region:'The Delta',tease:'A bargeman is auctioning a canteen of clean water to the people waiting at the quay steps.',a:{label:'Buy the canteen and pass it down',detail:'Pay 8 crowns. Stress −1 if Pukie is with you.',text:'You buy the canteen at the ask and hand it down the steps. Nobody thanks you for long; they are busy drinking. The bargeman already has another canteen.',cash:-8,stress:-1},b:{label:'Record the bid instead',detail:'Accounting practice. No purchase.',text:'You copy the bids. Thirst, it turns out, has a very orderly order book. The last successful bid is more than a day’s wages on the Float.'}},
 {id:'fogledger',act:[1,2,3],weather:'fog',tease:'In the fog, a courier asks you to initial a delivery you did not watch being loaded.',a:{label:'Refuse and take the number',detail:'You keep your name off the paper and gain a lead.',text:'“I don’t sign what I didn’t count,” you say. The courier is not offended. He gives you the consignment number anyway; someone else will be asked next.'},b:{label:'Initial the sheet for 6 crowns',detail:'A small fee. A small lie.',text:'You initial the sheet. Six crowns change hands. The boxes could be medicine, or paper, or nothing at all. Fog is useful to people who need signatures.',cash:6,rep:-1}},
 {id:'dustqueue',act:[1,2],weather:'dust',tease:'Dust drives a queue of porters into a covered doorway already full of people who were there first.',a:{label:'Give up your place',detail:'Public trust +1. The dust still gets in your teeth.',text:'You step back. A woman with a covered basket takes the space and mouths a thank you she does not have the breath to say.',rep:1},b:{label:'Hold your ground',detail:'You keep the cover. Stress unchanged.',text:'You hold the doorway. Nobody fights you for it; they simply remember that you did not move.'}},
 {id:'rainshelter',act:[1,2,3],weather:'rain',tease:'Rain turns a loading canopy into sudden, crowded shelter. A clerk is charging two crowns to stand under it.',a:{label:'Pay for the family',detail:'Two crowns if you are together; one if you are alone.',text:'You pay the clerk’s “canopy fee.” He has a laminated tariff. Rain, apparently, is now a service.',cash:-2},b:{label:'Point out the canopy is municipal',detail:'Negotiation. He lowers the board, not his eyes.',text:'You point to the municipal mark still visible under the new paint. The clerk lowers the tariff board and goes to find a different canopy.'}},
 {id:'emptycrate',act:[1,2],tease:'Pukie — or a passing dog, if she is waiting elsewhere — has taken a serious interest in a crate labelled agricultural samples.',a:{label:'Open it',detail:'Sometimes it is food. Sometimes it is a fine.',text:'Inside: two ration packs packed under a layer of straw and a sternly worded invoice to nobody. You take the packs. The invoice can find its own defendant.',rations:2},b:{label:'Leave it and note the sender',detail:'A name for later. No theft.',text:'You copy the sender’s mark: a cooperative that officially dissolved last year and is still somehow shipping samples.'}},
 {id:'pensionrumour',act:[2],region:'The Gardens',tease:'Two patients on a bench are arguing, quietly, about whether the Reserve still has a pension or only a story about one.',a:{label:'Sit and listen',detail:'You learn how the rumour travels.',text:'They do not lower their voices for you. One of them still has a contribution book. The stamps stop in the month the epidemic peaked. The other one says, “Then it was spent on us,” and neither of them looks comforted.'},b:{label:'Tell them to ask Rusk',detail:'It is his to answer. You will not answer for him.',text:'You tell them the founder is in the council room and still answers questions. They do not get up immediately. Courage, like credit, is sometimes delayed.'}},
 {id:'censusname',act:[2],region:'The Interior',tease:'A clerk at a folding table is adding names to a relief roll with the care of someone who knows some of them are invented.',a:{label:'Ask whose names they are',detail:'She will tell you, if you let her keep writing.',text:'“Some of them eat,” she says, without stopping. “Some of them only have to exist on paper so the ones who eat can be fed. I am not going to apologise to a form.”'},b:{label:'Offer to check the arithmetic',detail:'Accounting  — you catch a double entry, not a person.',text:'You check the totals, not the lives. One name has been entered twice. She thanks you for the arithmetic and leaves both entries where they are until someone with a seal decides otherwise.'}},
 {id:'quilltip',act:[2],region:'The Delta',tease:'A junior trader at Free Float offers you a “courtesy price” on pump fuel that will last until someone better informed arrives.',a:{label:'Buy one canister at the courtesy ask',detail:'Pay 9 crowns, below the going rate.',text:'You buy the canister. The junior trader looks pleased and slightly sick. Courtesy, on the Float, is usually an instrument.',cash:-9,fuel:1},b:{label:'Decline and watch who does buy',detail:'Information instead of inventory.',text:'You decline. A woman in a clean coat buys three canisters without checking the seal. The junior trader does not offer her a courtesy price.'}},
 {id:'haldencourt',act:[2],region:'The Interior',tease:'Outside Halden’s court, a petitioner is practising a sentence about fairness as if it were a foreign language.',a:{label:'Listen to the sentence',detail:'You do not correct it.',text:'“I would like the law to notice what happened,” he says, finally, to the door. It is not a bad sentence. Whether it is a useful one depends on the court.'},b:{label:'Warn him about the filing fee',detail:'Honesty, not comfort.',text:'You tell him the filing fee is real and the honesty of the court does not extend to waiving it. He counts his coins, then counts them again, as if the second count might take a different view.'}},
 {id:'corequeue',act:[3],region:'The Core',tease:'A line has formed at an unmarked kiosk that may or may not still process claims.',a:{label:'Take a number',detail:'The number is genuine. The queue is not obviously so.',text:'You take a number. The ticket is well printed. The kiosk window stays down. People keep arriving because a well-printed ticket still feels like progress.'},b:{label:'Walk the line and ask what they are owed',detail:'A pattern, not a ticket.',text:'You walk the line. Everyone is owed something slightly different, certified by the same authority, payable on a date that has already passed. The kiosk, if it ever opens, will be busy.'}},
 {id:'nightwatch',act:[1,2,3],tease:'A night watchman offers to sell you the next hour of “not seeing anything” for 5 crowns.',a:{label:'Pay for the hour',detail:'Five crowns. He is very professional about not looking.',text:'You pay him. He studies a point in the air with great concentration. You are not sure whether you have bought discretion or a story he will later sell to someone else.',cash:-5},b:{label:'Tell him you have nothing to hide',detail:'You keep the five crowns and get a long look.',text:'You tell him you have nothing that requires an hour of blindness. He nods, disappointed in a purely commercial way.'}},
 {id:'sharedmeal',act:[1,2,3],tease:'A family at a folding table is serving soup to anyone who will sit down and listen to a complaint about a levy.',a:{label:'Sit, eat, listen',detail:'Stress −1. You will hear the complaint in full.',text:'The soup is thin and honestly seasoned. The complaint is about a levy that was supposed to be temporary. Temporary, in the Basin, is a kind of interest rate.',stress:-1,rep:1},b:{label:'Leave a ration and walk on',detail:'One ration. You do not take a bowl.',text:'You leave a ration on the corner of the table. They do not make you sit. Someone else takes the bowl you did not use.',rations:-1,rep:1}},
 {id:'counterfeit',act:[2,3],tease:'A money-changer slides a note across and asks, almost kindly, whether you can tell it is wrong.',a:{label:'Examine it',detail:'You can. The paper is too eager.',text:'The paper is slightly too clean, the seal slightly too centred. You tell him so. He thanks you, pockets the note, and you have the uncomfortable sense that you have just trained a better forger.'},b:{label:'Refuse to touch it',detail:'You keep your hands empty.',text:'You do not take the note. He looks faintly proud of you, which is not the same as being on your side.'}}
];

const EVENT_IDS=new Set(EVENTS.map(e=>e.id));

export function pickEvent(s){
 if(s.pendingEvent||s.ending||s.combat)return null;
 if(s.turn<3||s.turn%6!==3)return null;
 const seen=new Set(s.eventsSeen||[]);
 const region=regionName(s);
 const weather=s._weatherKind||null;
 const pool=EVENTS.filter(e=>{
  if(seen.has(e.id))return false;
  if(e.act&&!e.act.includes(s.act))return false;
  if(e.region&&e.region!==region)return false;
  if(e.weather&&e.weather!==weather)return false;
  return true;
 });
 const open=pool.length?pool:EVENTS.filter(e=>!e.region||e.region===region);
 if(!open.length)return null;
 const i=Math.floor((s.seed||1)%open.length);
 return open[i];
}

export function eventActions(s,action){
 if(!s.pendingEvent)return [];
 const ev=EVENTS.find(e=>e.id===s.pendingEvent);
 if(!ev)return [];
 return [
  action('event:'+ev.id+':a',ev.a.label,ev.a.detail,1,null,'story'),
  action('event:'+ev.id+':b',ev.b.label,ev.b.detail,1,null,'story')
 ];
}

export function resolveEvent(s,id,log,clamp){
 const m=id.match(/^event:([a-z]+):([ab])$/);
 if(!m)return null;
 const ev=EVENTS.find(e=>e.id===m[1]);
 if(!ev||s.pendingEvent!==ev.id)return {error:'That matter has already been settled.'};
 const choice=ev[m[2]];
 if(choice.cash)s.cash=Math.max(0,s.cash+choice.cash);
 if(choice.rations)s.inventory.rations=Math.max(0,(s.inventory.rations||0)+choice.rations);
 if(choice.fuel)s.inventory.fuel=(s.inventory.fuel||0)+choice.fuel;
 if(choice.rep)s.reputation.public+=choice.rep;
 if(choice.stress&&s.party)s.party.stress=clamp(s.party.stress+choice.stress,0,6);
 s.eventsSeen=[...(s.eventsSeen||[]),ev.id].slice(-40);
 s.pendingEvent=null;
 s._justResolvedEvent=true;
 return {text:choice.text,title:ev.tease};
}

export function rollEvent(s,log,weatherKind){
 if(s._justResolvedEvent){s._justResolvedEvent=false;return;}
 s._weatherKind=weatherKind;
 const ev=pickEvent(s);
 if(!ev)return;
 s.pendingEvent=ev.id;
 log(s,ev.tease+' It will not wait indefinitely.');
}

export function migrateExpansion(s){
 if(!s.difficulty||!DIFFICULTY[s.difficulty])s.difficulty='standard';
 if(!s.inventory||typeof s.inventory!=='object'||Array.isArray(s.inventory))s.inventory={};
 for(const k of Object.keys(ITEMS))if(!Number.isInteger(s.inventory[k]))s.inventory[k]=0;
 if(s.forward&&!s.forward.item){s.forward={due:s.forward.due,item:'rations',qty:3};}
 if(s.loan&&!s.loan.kind)s.loan.kind='facility';
 if(!Array.isArray(s.eventsSeen))s.eventsSeen=[];
 if(s.pendingEvent&&!EVENT_IDS.has(s.pendingEvent))s.pendingEvent=null;
 if(s.pendingEvent===undefined)s.pendingEvent=null;
}

export function validExpansion(s){
 if(!DIFFICULTY[s.difficulty])return false;
 if(s.pendingEvent!=null&&!EVENT_IDS.has(s.pendingEvent))return false;
 if(!Array.isArray(s.eventsSeen)||s.eventsSeen.length>40||s.eventsSeen.some(id=>typeof id!=='string'||id.length>40))return false;
 if(s.loan&&s.loan.kind&&!['note','facility','collateral'].includes(s.loan.kind))return false;
 if(s.forward&&((s.forward.item&&!Object.hasOwn(ITEMS,s.forward.item))||(s.forward.qty!=null&&(!Number.isInteger(s.forward.qty)||s.forward.qty<1||s.forward.qty>20))))return false;
 return true;
}

export function extraActions(s,action){return [...eventActions(s,action),...questActions(s,action)];}
