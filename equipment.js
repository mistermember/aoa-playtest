import {hoodRaised} from './weather.js';
// Equipment is owned per brother. Consumables remain in the shared supply inventory.
export const OUTFITS={
 trail:{name:'Trail clothes',price:0,armor:0,accuracy:0,detail:'Light travelling clothes. No aim penalty or additional protection.'},
 rain:{name:'Hooded raincoat',price:28,armor:1,accuracy:-2,detail:'Waterproof shell. Hood rises in rain. Prevents rain exposure on crossings; incoming damage −1, accuracy −2 points.'}
};
export const WEAPONS={
 pistol:{name:'Settlement pistol',price:0,damage:0,accuracy:0,magazine:6,detail:'Reliable sidearm. Six rounds; standard damage and accuracy.'},
 carbine:{name:'Survey carbine',price:48,damage:3,accuracy:4,magazine:4,detail:'+3 damage, +4 accuracy points. Four rounds before reloading.'},
 shotgun:{name:'Breaching shotgun',price:38,damage:6,accuracy:-6,magazine:2,detail:'+6 damage, −6 accuracy points. Two rounds before reloading.'},
 baton:{name:'Receiver’s baton',price:22,damage:3,accuracy:-4,magazine:1,detail:'Close work. +3 damage, −4 accuracy. One committed swing, then recover.'},
 bonded:{name:'Bonded sidearm',price:64,damage:2,accuracy:6,magazine:5,detail:'A certified barrel with a paper trail. +2 damage, +6 accuracy, five rounds.'},
 longun:{name:'Clearing long-gun',price:90,damage:5,accuracy:2,magazine:3,detail:'Issued, then unofficially reissued. +5 damage, +2 accuracy. Three rounds.'}
};
export function defaultEquipment(){return {
 uygar:{outfits:['trail'],weapons:['pistol'],outfit:'trail',weapon:'pistol',hat:false,glasses:false},
 berkay:{outfits:['trail','rain'],weapons:['pistol'],outfit:'rain',weapon:'pistol',hat:true,glasses:true}
};}
export function validEquipment(gear){
 if(!gear||typeof gear!=='object'||Array.isArray(gear)||Object.keys(gear).length!==2)return false;
 for(const id of ['uygar','berkay']){
 const g=gear[id];if(!g||typeof g!=='object'||Array.isArray(g)||Object.keys(g).sort().join(',')!=='glasses,hat,outfit,outfits,weapon,weapons')return false;
 for(const [key,catalog,selected] of [['outfits',OUTFITS,'outfit'],['weapons',WEAPONS,'weapon']]){
 const owned=g[key];if(!Array.isArray(owned)||owned.length<1||owned.length>Object.keys(catalog).length||new Set(owned).size!==owned.length||owned.some(x=>typeof x!=='string'||!Object.hasOwn(catalog,x))||!owned.includes(g[selected]))return false;
 }
 if(typeof g.hat!=='boolean'||typeof g.glasses!=='boolean'||id==='uygar'&&(g.hat||g.glasses))return false;
 }
 return true;
}
export function equipmentStats(s){const g=s.gear[s.lead],w=WEAPONS[g.weapon],o=OUTFITS[g.outfit];return {weapon:w,outfit:o,accuracy:w.accuracy+o.accuracy,damage:w.damage,armor:o.armor,magazine:w.magazine};}
export function equipmentAtlas(s,id){
 if(id==='berkay'){
  const g=s?.gear?.berkay||defaultEquipment().berkay;
  if(s&&hoodRaised(s,id))return 'berkay-rain-hood-walk';
  const rain=g.outfit==='rain';
  if(g.hat)return rain?(g.glasses?'berkay-rain-hat-glasses-walk':'berkay-rain-hat-walk'):(g.glasses?'berkay-hat-glasses-walk':'berkay-hat-walk');
  return rain?'berkay-rain-walk':'berkay-walk';
 }
 return id+(s.gear?.[id]?.outfit==='rain'?'-rain-walk':'-walk');
}
export function equipmentPortrait(s,id){if(id!=='berkay')return id+'-portrait';const g=s?.gear?.berkay||defaultEquipment().berkay;if(s&&hoodRaised(s,id))return 'berkay-style-'+(g.glasses?5:4);return 'berkay-style-'+((g.hat?1:0)+(g.glasses?2:0));}
export function canEquip(s,id){return !s.ending&&!s.combat&&(id===s.lead||s.party.mode==='follow'||s.party.waitingAt===s.location);}

export function packCapacity(id){return id==='berkay'?4:8;}
export function packUsed(s,id){const g=s.gear[id];return g.outfits.length+g.weapons.length;}
export function packHasRoom(s,id){return packUsed(s,id)<packCapacity(id);}
