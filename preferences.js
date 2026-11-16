import {getStored,setStored,nativeBridge} from './storage.js';
const KEY='tlc-preferences-v1';
const defaults={names:true,motion:false,sound:false,largeText:!!nativeBridge(),battery:!!nativeBridge()};
export function readPreferences(){try{const p=JSON.parse(getStored(KEY));return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,typeof p?.[k]==='boolean'?p[k]:v]));}catch{return {...defaults};}}
export function savePreference(key,value){const p=readPreferences();if(key in defaults)p[key]=!!value;try{setStored(KEY,JSON.stringify(p));}catch{}return p;}
