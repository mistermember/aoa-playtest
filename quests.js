// Data-driven extra quests. Existing core actions in engine.js stay canon.
import {ITEMS} from './content.js';

export const QUEST_FLAGS=[
 'neighbour','debtboard','pumpshare','wharfwitness','foremanbook','venncompare',
 'widowclaim','dockwages','clinicrun','noticesdebt','noticespaid','eddaspread',
 'annexnames','quaybook','orchardfeed','dirhearing','maranote',
 'millwright','clerkfile','pumpworker','patientdebt','quillside','haldenprivate',
 'claimreview','maramargin','machinefloor'
];

export const QUEST_OBJECTIVES={
 fringeleads:{
  visible:s=>s.act===1&&s.flags.key&&!s.flags.townSaved,
  text:s=>`Local leads for the town save · ${['neighbour','debtboard','pumpshare','wharfwitness','foremanbook'].filter(k=>s.flags[k]).length}/5`,
  done:s=>s.flags.neighbour&&s.flags.debtboard&&s.flags.pumpshare&&s.flags.wharfwitness&&s.flags.foremanbook
 },
 annex:{visible:s=>s.act>=2&&s.flags.dirBrief&&!s.factions.directorate,text:()=>'Name the invented citizens at the Paper Annex',done:s=>!!s.flags.annexnames},
 quay:{visible:s=>s.act>=2&&s.flags.floatBrief&&!s.factions.float,text:()=>'Read the Night Quay’s unofficial book',done:s=>!!s.flags.quaybook},
 orchard:{visible:s=>s.act>=2&&s.flags.reserveBrief&&!s.factions.reserve,text:()=>'Walk the Allotment Orchard with the Reserve',done:s=>!!s.flags.orchardfeed},
 compare:{visible:s=>s.act===1&&s.flags.key&&s.flags.ledger&&s.flags.neighbour&&s.flags.debtboard&&s.flags.pumpshare&&s.flags.wharfwitness&&s.flags.foremanbook&&!s.flags.townSaved,text:()=>'Take the five leads back to Venn and compare the two amounts',done:s=>!!s.flags.venncompare},
 hearing:{visible:s=>s.act>=2&&s.flags.annexnames&&!s.factions.directorate,text:()=>'Sit the annex names through a formal hearing',done:s=>!!s.flags.dirhearing},
 packet:{visible:s=>s.act>=2&&s.flags.mara&&s.flags.dirBrief&&!s.flags.maranote,text:()=>'Open Mara’s courier packet at the ruined bank',done:s=>!!s.flags.maranote},
 claims:{visible:s=>s.act===3&&s.flags.coreAccess&&!s.flags.father,text:()=>'Review the six senior claims and Mara’s margins',done:s=>!!(s.flags.claimreview&&s.flags.maramargin)},
 machine:{visible:s=>s.act===3&&s.flags.coreAccess&&!s.flags.father,text:()=>'Ask what the Counterparty actually optimises',done:s=>!!s.flags.machinefloor}
};

const req=(ok,reason)=>ok?null:reason;

function addFlag(s,k){s.flags[k]=true;}

export const QUESTS=[
 // —— Act I required leads ——
 {id:'neighbour',loc:'square',label:'Ask who can tell the two amounts apart',detail:'A neighbour has paid both figures, on different weeks. Required before a town save.',cost:1,kind:'story',
  available:s=>s.act===1&&s.flags.key&&!s.flags.neighbour,
  apply(s){addFlag(s,'neighbour');s.reputation.public+=1;return {title:'Two amounts, one street',text:'Ilya Sen has the receipts. One week the levy was forty thousand. The next, after a man in a grey coat visited the Counting House, it was written as forty million — and they still tried to collect the second number from a house that could barely pay the first. Public trust +1. Venn, she says, looked sick when she showed him both papers.',xp:2};}},
 {id:'debtboard',loc:'market',label:'Read the posted town paper',detail:'What the Bid & Ask already thinks Par Value is worth. Required before a town save.',cost:1,kind:'story',
  available:s=>s.act===1&&s.flags.key&&!s.flags.debtboard,
  apply(s){addFlag(s,'debtboard');return {title:'A market for a town',text:'Edda has posted Par Value as a line, not a place. Bid: a number that would keep the pump running. Ask: a number that would buy the pump, the well, and the people who still call it home. “I did not invent the spread,” she says. “I only wrote it where people can see it.”',xp:2};}},
 {id:'pumpshare',loc:'pump',label:'Read the shareholder plate',detail:'The municipal pump still has a plate saying who owns thirst. Required before a town save.',cost:1,kind:'story',
  available:s=>s.act===1&&s.flags.key&&!s.flags.pumpshare,
  apply(s){addFlag(s,'pumpshare');return {title:'Proprietary thirst',text:'Under the warning about proprietary technology, a second plate lists beneficial interests. Several names have been struck through. One remains: THE COUNTERPARTY, in the same hand as the higher figure on Ilya’s receipt. The engineer will not touch the plate. “I repair valves,” he says. “I do not repair owners.”',xp:2};}},
 {id:'wharfwitness',loc:'wharf',label:'Take Nalin’s witness statement',detail:'A dock clerk who can remember both cargo and unpaid wages. Required before a town save.',cost:1,kind:'story',
  available:s=>s.act===1&&s.flags.key&&!s.flags.wharfwitness,
  apply(s){addFlag(s,'wharfwitness');s.reputation.public+=1;return {title:'A memory with an abacus',text:'Nalin Ost writes a statement in a hand too careful for the paper she can afford. She lists the landings that arrived, the fees that were not paid, and the afternoon a collector tried to count the sacks as collateral. “I will sign this in front of Venn,” she says. “I have already signed worse things in front of worse people.” Public trust +1.',xp:2};}},
 {id:'foremanbook',loc:'square',label:'Read the foreman’s shift book',detail:'Who is being collected, and at which of the two amounts. Required before a town save.',cost:1,kind:'story',
  available:s=>s.act===1&&s.flags.key&&!s.flags.foremanbook,
  apply(s){addFlag(s,'foremanbook');return {title:'A book that only closes at dusk',text:'The dock foreman does not give speeches. He opens a shift book whose binding has been repaired with the same twine they use on the sacks. Each line is a household, a due date, and one of two figures. The lower figure is what a neighbour can pay without selling a bed. The higher figure is what a collector can demand if the first payment is late by a week. “They print both,” he says, “and then they wait to see which one you are.” He lets you copy four names, including a junior claim that has already been posted twice. The handwriting is ugly and exact. It will stand up in a room that prefers pretty numbers.',xp:3};}},
 {id:'venncompare',loc:'office',label:'Compare the two amounts with Venn',detail:'Bring the five local leads into the Counting House before you file a stay. Required before a town save.',cost:1,kind:'story',
  available:s=>s.act===1&&s.flags.key&&s.flags.ledger&&s.flags.neighbour&&s.flags.debtboard&&s.flags.pumpshare&&s.flags.wharfwitness&&s.flags.foremanbook&&!s.flags.venncompare,
  apply(s){addFlag(s,'venncompare');s.reputation.public+=1;return {title:'Two figures, one town',text:'Venn lays your papers on the same desk as the forged guarantee. The neighbour’s two payments. Edda’s posted bid and ask. The pump’s shareholder plate. Nalin’s landings. The foreman’s shift book. The bank ledger that still uses your names as collateral. “This is not a mystery,” he says. “It is a method. The town is priced twice so that it can be collected once.” He makes you walk the discrepancies out loud, line by line, until the room contains only one usable story: the lower figure is a living cost, the higher figure is an extraction, and the family guarantee was written to make the second look like the first. Public trust +1. He will not file a stay until you have said it clearly enough to be minuted.',xp:3};}},

 // —— Act I sides ——
 {id:'widowclaim',loc:'bank',label:'Open Ilya’s junior claim',detail:'After you have vault access. A junior claim is still a claim.',cost:1,kind:'story',
  available:s=>s.flags.bankAccess&&!s.flags.widowclaim,
  apply(s){addFlag(s,'widowclaim');s.cash+=12;return {title:'Junior, not imaginary',text:'Ilya’s envelope is thinner than the senior files and better organised. Inside: a twelve-crown residual, a name, and a note that the residual was “too small to administer.” You administer it anyway. She does not cry. She counts.',xp:2};}},
 {id:'dockwages',loc:'wharf',label:'Settle the unpaid landing shift',detail:'Pay 16 crowns to clear a week of dock wages, or leave the invoice on the nail.',cost:1,kind:'story',
  available:s=>s.flags.wharfwitness&&!s.flags.dockwages&&s.cash>=16,
  blocked:s=>s.cash<16?'Need 16 crowns.':null,
  apply(s){addFlag(s,'dockwages');s.cash-=16;s.reputation.public+=2;return {title:'Wages, not goodwill',text:'You pay sixteen crowns into Nalin’s cash box. She crosses a week off the board in one straight line. “This is not charity,” she says, in case you were about to call it that. Public trust +2.',xp:2};}},
 {id:'clinicrun',loc:'clinic',label:'Run a salt-and-medicine errand',detail:'Deliver one salt and one medicine from your pack, or buy them first at the Bid & Ask.',cost:1,kind:'story',
  available:s=>s.flags.seal&&!s.flags.clinicrun,
  blocked:s=>(s.inventory.salt<1||s.inventory.medicine<1)?'Need one bag of salt and one trauma kit.':null,
  apply(s){addFlag(s,'clinicrun');s.inventory.salt--;s.inventory.medicine--;s.reputation.public+=1;s.inventory.rations+=1;return {title:'Availability, in kind',text:'Rusk does not give speeches about donations he asked for. He puts the salt in the cabinet, the kit on the shelf, and a ration pack in your hand because the errand took a settlement and he can count as well as anyone. Public trust +1.',xp:2};}},
 {id:'noticesdebt',loc:'square',label:'Read the household notice debt',detail:'A posted arrears list. You can buy one name off it for 10 crowns.',cost:1,kind:'story',
  available:s=>s.act===1&&!s.flags.noticesdebt,
  apply(s){addFlag(s,'noticesdebt');return {title:'Names on a nail',text:'The board lists arrears in a civic hand. One name has been underlined twice. You can pay ten crowns to take it off, or walk away knowing exactly who the collectors will visit first. The underlined name is Ilya Sen.',xp:1};}},
 {id:'noticespaid',loc:'square',label:'Buy Ilya’s name off the board',detail:'Pay 10 crowns. The collectors can find another list; they cannot find this one.',cost:1,kind:'story',
  available:s=>s.flags.noticesdebt&&!s.flags.noticespaid&&s.cash>=10,
  blocked:s=>s.cash<10?'Need 10 crowns.':null,
  apply(s){addFlag(s,'noticespaid');s.cash-=10;s.reputation.public+=1;s.party.bond=Math.min(6,s.party.bond+1);return {title:'A name taken down',text:'You pay, fold the scrap, and give it to Ilya rather than to the board. She nods once, which in Par Value is a long speech. Public trust +1. Your brother, watching, says nothing, and that is also a speech.',xp:2};}},
 {id:'eddaspread',loc:'market',label:'Sit with Edda through a spread',detail:'Watch a full bid/ask cycle. Optional, and useful.',cost:1,kind:'story',
  available:s=>s.flags.debtboard&&!s.flags.eddaspread,
  apply(s){addFlag(s,'eddaspread');s.cash+=6;return {title:'Narrow margins',text:'Edda lets you sit on the bid side of a salt trade and the ask side of the same salt, ten minutes later, in the same stall. The difference is six crowns, which she splits with you because you asked the right question: “Who is the spread for?” “For the stall still being here tomorrow.”',xp:2};}},

 // —— Act II required mid-beats ——
 {id:'annexnames',loc:'archive',label:'Name the invented citizens',detail:'Kett will show you which names eat and which names only exist so that others can. Required before you resolve the grain audit.',cost:1,kind:'story',
  available:s=>s.flags.dirBrief&&!s.flags.annexnames,
  apply(s){addFlag(s,'annexnames');s.flags.grain=s.flags.grain||false;return {title:'A roll with two kinds of ink',text:'Kett Mari walks you through the relief roll. Four thousand names were added in a single month. About a third, she thinks, are children who eat under a neighbour’s roof and were never registered. The rest are a method: “If I write a person, the ministry releases grain. If I do not, a real mouth stays empty.” Halden will want this in a form he can file. Kett wants it in a form that keeps feeding people.',xp:3};}},
 {id:'quaybook',loc:'quay',label:'Read Brin’s unofficial book',detail:'The night book prices what Quill left on the table. Required before you settle the water dispute.',cost:1,kind:'story',
  available:s=>s.flags.floatBrief&&!s.flags.quaybook,
  apply(s){addFlag(s,'quaybook');return {title:'After hours',text:'Brin Havel’s book is neater than the official one. It shows the monopoly’s water priced twice: once for Quill’s afternoon buyers, and once for people who can only come at night. “She knows I do this,” he says. “She prefers competition she can see.” The spread between the two prices would buy a pump, or a funeral, depending on the week.',xp:3};}},
 {id:'orchardfeed',loc:'orchard',label:'Walk the allotment with Orel',detail:'A reserve that does not appear on the pension ledger. Required before you resolve the pension crisis.',cost:1,kind:'story',
  available:s=>s.flags.reserveBrief&&!s.flags.orchardfeed,
  apply(s){addFlag(s,'orchardfeed');s.inventory.rations+=2;return {title:'Accounts you can eat',text:'Orel Voss will not give you a speech about hope. He gives you two ration packs of dried fruit and a view of the trees that were planted when the Reserve still believed a winter was a problem you could store your way through. “Rusk knows they are here,” he says. “The council prefers the kind of reserve you can print.”',xp:3};}},
 {id:'dirhearing',loc:'directorate',label:'Sit the annex names through a hearing',detail:'A formal record of which names eat and which names only exist. Required before you resolve the grain audit.',cost:1,kind:'story',
  available:s=>s.flags.annexnames&&!s.flags.dirhearing,
  apply(s){addFlag(s,'dirhearing');return {title:'A hearing with two inks',text:'Halden’s clerk prepares a transcript as if the room were already a verdict. Kett’s roll is read twice: once as a list of mouths, once as a list of instruments. You are asked, not kindly, to say which column a child belongs in when the child eats under a neighbour’s roof and the ministry will only release grain for a name that has been invented. The argument takes the afternoon. Halden does not raise his voice. He wants a form he can file without admitting that the law has been hungry. You make him record both inks in the same minute, including the sentence Kett will not apologise for. The cooperative will live or starve on what this paper is allowed to mean.',xp:3};}},
 {id:'maranote',loc:'bank',label:'Open Mara’s courier packet',detail:'She left a sealed packet on the vault stair once the Directorate had opened its doors. Required before you sit with your father.',cost:1,kind:'story',
  available:s=>s.act>=2&&s.flags.mara&&s.flags.dirBrief&&!s.flags.maranote,
  apply(s){addFlag(s,'maranote');return {title:'A packet with no invoice',text:'Mara does not come in person. The packet is tied with the same twine she uses on contracts she does not trust. Inside: a copy of a Clearing House routing slip, six file numbers, and a note in her tight courier hand. They are already printing the final view. He is in all six. I was paid to stop him becoming part of it. I was late. If you go in, read the margins before you let him speak. The routing slip shows the same underlying assets certified under six seals, dated after your father disappeared and before the collectors reached Par Value. It is not proof that would satisfy Halden. It is proof that would satisfy you.',xp:3};}},

 // —— Act II sides ——
 {id:'millwright',loc:'granary',label:'Help the millwright re-weight a sack',detail:'The weights are correct. The people are what went missing.',cost:1,kind:'story',
  available:s=>s.flags.grain&&!s.flags.millwright,
  apply(s){addFlag(s,'millwright');s.inventory.scrip+=2;return {title:'A correct weight',text:'You and a millwright re-weight a sack that has been honest all year. It is still honest. The relief roll is what changed. She pays you in grain scrip and in a look that says she would rather have been cheated by a scale than by a census.',xp:2};}},
 {id:'clerkfile',loc:'archive',label:'File Kett’s dissenting footnote',detail:'A footnote is not a rebellion. It is a place to put the truth until a seal is ready.',cost:1,kind:'story',
  available:s=>s.flags.annexnames&&!s.flags.clerkfile,
  apply(s){addFlag(s,'clerkfile');s.reputation.directorate+=1;return {title:'Ink in the margin',text:'You help Kett write a footnote that will survive a filing. Halden can ignore it. He cannot pretend it was never entered. Directorate reputation +1 — which, in this building, is the same as being slightly harder to dismiss.',xp:2};}},
 {id:'pumpworker',loc:'levee',label:'Hear out a waterline steward',detail:'The workers keep the pumps running. The bondholders keep the workers hungry.',cost:1,kind:'story',
  available:s=>s.flags.waterFiles&&!s.flags.pumpworker,
  apply(s){addFlag(s,'pumpworker');s.reputation.float+=1;return {title:'Someone who knows the valves',text:'The steward will not be organised like a slogan. She shows you a valve that fails every eleventh day and a roster that pretends it does not. “Quill can buy this station,” she says. “She cannot buy the day it breaks, unless she also buys us.”',xp:2};}},
 {id:'quillside',loc:'river',label:'Ask Quill what she does not want priced',detail:'She will answer, if you ask in the language of a market.',cost:1,kind:'story',
  available:s=>s.flags.floatBrief&&!s.flags.quillside,
  apply(s){addFlag(s,'quillside');return {title:'A liquid smile, slightly less liquid',text:'“I do not want the night quay priced into my afternoon,” Sera says, which is as close as she comes to a confession. “Competition is beautiful. Shadow books are messy. I prefer messy things I own.” She does not ask you to close Brin’s book. She also does not ask you to keep it open.',xp:2};}},
 {id:'patientdebt',loc:'ward',label:'Sit with Tess and her contribution book',detail:'The stamps stop in the epidemic month. The patient did not.',cost:1,kind:'story',
  available:s=>s.flags.pension&&!s.flags.patientdebt,
  apply(s){addFlag(s,'patientdebt');s.reputation.reserve+=1;return {title:'A life on the debit side',text:'Tess Quinn keeps her contribution book the way other people keep a photograph. The stamps stop in the month Rusk bought the antibiotics. “I am glad I am alive,” she says, very carefully, as if the sentence might be entered against her. “I would still like the accounts to admit what I cost.”',xp:2};}},
 {id:'haldenprivate',loc:'directorate',label:'Ask Halden what the law cannot afford to see',detail:'After the annex. A private answer, not a ruling.',cost:1,kind:'story',
  available:s=>s.flags.annexnames&&!s.flags.haldenprivate,
  apply(s){addFlag(s,'haldenprivate');return {title:'Order, itemised',text:'Halden listens. He is better at it than his reputation for speeches suggests. “If I recognise invented citizens, I break the roll,” he says. “If I do not, I break the people the roll was for. I asked for an auditor who cannot be bought. I did not promise I would like the audit.”',xp:2};}},

 // —— Act III ——
 {id:'claimreview',loc:'antechamber',label:'Review the six senior claims',detail:'Required before you sit with your father. The machine already has a view.',cost:1,kind:'story',
  available:s=>s.flags.coreAccess&&!s.flags.claimreview,
  apply(s){addFlag(s,'claimreview');return {title:'Six seals, one pattern',text:'Six folders. Six institutions. The same underlying assets, certified six times by THE COUNTERPARTY, in language so clean it almost looks like honesty. Mara has written in the margin of the third file: He knew, and he went further in. Your father’s hand is in all six, including the one that used your names as guarantee. The clerk does not offer an opinion. Opinions are not his product.',xp:3};}},
 {id:'maramargin',loc:'antechamber',label:'Read Mara’s margins properly',detail:'The clerk will not interpret them. You will. Required before you sit with your father.',cost:1,kind:'story',
  available:s=>s.flags.claimreview&&!s.flags.maramargin,
  apply(s){addFlag(s,'maramargin');return {title:'Ink in the margin',text:'The clerk stays in the doorway and will not come closer to another courier’s handwriting. Mara’s notes are short, dated, and angry in the way of someone who was paid to be precise. File three: he knew. File four: the guarantee uses both brothers. File five: a hospital draw sits on the same asset as a grain shipment that never left the dock. File six: he asked the machine to keep matching after the matches were already a lie, and then he signed the request in his own name. You copy the dates into your journal. They sit between the disappearance and the day the collectors reached Par Value. When you look up, the clerk has found something to do with a stamp.',xp:3};}},
 {id:'machinefloor',loc:'clearing',label:'Ask what the Counterparty actually optimises',detail:'Required before you sit with your father. A technician will tell you, in the voice of someone who has stopped being surprised.',cost:1,kind:'story',
  available:s=>s.flags.coreAccess&&!s.flags.machinefloor,
  apply(s){addFlag(s,'machinefloor');return {title:'A function, not a villain',text:'The technician does not lower their voice, and they do not look at the sealed chamber as if it were a person. “It minimises unsettled claims across the network,” they say. “It does not know what a town is. It knows what a mismatch is. Your father asked it to keep matching after the matches became fraud. It was very, very good at being asked.” They show you a short log: the same six assets, certified whenever a clinic, a granary or a water bond needed the ledger to say yes. “If you shut it off cold, deliveries stop until someone else is willing to be the match. If you leave it as it is, it will keep doing the only job it has.” The console is still waiting. Now you know what it is waiting for.',xp:3};}}
];

export function questActions(s,action){
 const a=[];
 for(const q of QUESTS){
  if(q.loc!==s.location)continue;
  if(!q.available(s))continue;
  const blocked=q.blocked?q.blocked(s):null;
  a.push(action(q.id,q.label,q.detail,q.cost,blocked,q.kind||'story'));
 }
 return a;
}

export function handleQuest(s,id){
 const q=QUESTS.find(x=>x.id===id);
 if(!q)return null;
 if(!q.available(s))return {error:'That choice is not available here.'};
 const blocked=q.blocked?q.blocked(s):null;
 if(blocked)return {error:blocked};
 return q.apply(s);
}

export function fringeLeadsDone(s){
 return !!(s.flags.neighbour&&s.flags.debtboard&&s.flags.pumpshare&&s.flags.wharfwitness&&s.flags.foremanbook&&s.flags.venncompare);
}

export function questObjectiveList(s){
 return Object.values(QUEST_OBJECTIVES).filter(q=>q.visible(s)).map(q=>({text:typeof q.text==='function'?q.text(s):q.text,done:q.done(s)}));
}
