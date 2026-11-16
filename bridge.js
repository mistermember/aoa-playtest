// Native save export/import for Capacitor (Filesystem + Share) and the legacy AndroidGame bridge.
// Browsers keep the existing Blob download and hidden file input.

function capacitor(){
 const cap=globalThis.Capacitor;
 return cap?.isNativePlatform?.()?cap:null;
}

function plugins(){
 return capacitor()?.Plugins||{};
}

export function isNativeApp(){
 return !!(globalThis.AndroidGame||capacitor());
}

function webDownload(json,filename){
 const blob=new Blob([json],{type:'application/json'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download=filename;
 a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

async function capacitorExport(json,filename){
 const {Filesystem,Share}=plugins();
 if(!Filesystem?.writeFile||!Share?.share)throw new Error('Capacitor Filesystem or Share is unavailable');
 const written=await Filesystem.writeFile({path:filename,data:json,directory:'CACHE',encoding:'utf8'});
 const uri=written?.uri||(await Filesystem.getUri({path:filename,directory:'CACHE'}))?.uri;
 if(!uri)throw new Error('Save file URI was not returned');
 await Share.share({title:'Age of Abundance save',text:filename,files:[uri],dialogTitle:'Export save file'});
}

function decodePickerFile(file){
 if(!file)return null;
 if(typeof file.data==='string'&&file.data){
  try{return decodeURIComponent(escape(atob(file.data)));}catch{return atob(file.data);}
 }
 return null;
}

async function capacitorImport(){
 const {FilePicker,Filesystem}=plugins();
 if(FilePicker?.pickFiles){
  const result=await FilePicker.pickFiles({types:['application/json','public.json','text/plain'],limit:1,readData:true});
  const file=result?.files?.[0];
  const fromData=decodePickerFile(file);
  if(fromData!=null)return fromData;
  const path=file?.path||file?.uri;
  if(path&&Filesystem?.readFile){
   const read=await Filesystem.readFile({path,encoding:'utf8'});
   if(typeof read?.data==='string')return read.data;
  }
 }
 return null;
}

export async function exportCampaign(json,filename){
 const android=globalThis.AndroidGame;
 if(android?.exportSave){android.exportSave(json,filename);return 'android';}
 if(capacitor()){
  try{await capacitorExport(json,filename);return 'capacitor';}
  catch(error){console.warn('Native export failed; using the web fallback.',error);}
 }
 webDownload(json,filename);
 return 'web';
}

export async function importCampaign(restore){
 const android=globalThis.AndroidGame;
 if(android?.importSave){android.importSave();return 'android';}
 if(capacitor()){
  try{
   const text=await capacitorImport();
   if(text!=null){restore(text);return 'capacitor';}
  }catch(error){console.warn('Native import failed; using the file picker.',error);}
 }
 document.querySelector('#save-import')?.click();
 return 'web';
}

export function listenForNativeImports(restore,notice){
 const onImport=e=>restore(e.detail);
 window.addEventListener('androidsaveimport',onImport);
 window.addEventListener('nativesaveimport',onImport);
 window.addEventListener('androidfilemessage',e=>notice?.(e.detail));
 window.AgeOfAbundanceImport=text=>restore(text);
}
