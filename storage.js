// Android uses private native storage. Browsers retain their existing save keys.
export const nativeBridge=()=>globalThis.AndroidGame||null;
const allowed=/^tlc-(campaign|manual(?:-[23])?|recovery|preferences)-v1$/;
export function getStored(key){
 if(!allowed.test(key))throw Error('Unknown storage key');
 const native=nativeBridge();
 if(native){const value=native.getItem(key);if(value!==null&&value!==undefined)return value;
  const legacy=localStorage.getItem(key);if(legacy!==null&&native.setItem(key,legacy)!==true)throw Error('Save migration failed');return legacy;}
 return localStorage.getItem(key);
}
export function setStored(key,value){
 if(!allowed.test(key)||typeof value!=='string'||value.length>250000)throw Error('Invalid save data');
 const native=nativeBridge();if(native){if(native.setItem(key,value)!==true)throw Error('Native storage unavailable');}else localStorage.setItem(key,value);
}
