import {getStored,setStored,nativeBridge} from './storage.js';
import {validateSave,upgradeSave} from './engine.js';
export const AUTO='tlc-campaign-v1',MANUAL='tlc-manual-v1',BACKUP='tlc-recovery-v1';
export const slotKey=slot=>slot===1?MANUAL:`tlc-manual-${slot}-v1`;
export function readSave(key){try{const s=JSON.parse(getStored(key));return upgradeSave(s);}catch{return null;}}
export function writeSave(key,state){
 if(!validateSave(state))return false;
 try{
  const old=readSave(key);
  // Preserve the prior valid state before replacing it, including imported campaigns.
  if(old&&JSON.stringify(old)!==JSON.stringify(state))setStored(BACKUP,JSON.stringify(old));
  setStored(key,JSON.stringify(state));return true;
 }catch{return false;}
}
