import {gaitPose,spritePose,boneAffine,kneeFor,footTargets} from './animation.js';
import {weatherAt,regionalWeather,hoodRaised} from './weather.js';
import {equipmentAtlas} from './equipment.js';
import {readPreferences,savePreference} from './preferences.js';
import {WORLD_W,WORLD_H,distance,buildGrid,isWalkable,nearestCell,cellCenter,findPath,approachPoint,stepActor,coastTarget,resolveSeparation,separateCrowd,blockActors} from './navigation.js';
import {SCENES,sceneId,combatSceneId,combatStaging,makeActors} from './world-data.js';

const imageCache=new Map(),memories=new Map();
let metadataPromise;
export function resetWorldMemory(){memories.clear();}
function loadImage(name){if(!imageCache.has(name)){imageCache.set(name,new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>{imageCache.delete(name);reject(new Error(`Could not load ${name}`));};i.src=`assets/${name}.webp`;}));}return imageCache.get(name);}
function loadMetadata(){return metadataPromise??=fetch('assets/sprite-frames.json').then(r=>{if(!r.ok)throw Error('Sprite data unavailable');return r.json();}).catch(e=>{metadataPromise=null;throw e;});}
function annotateFootPads(meta,atlases){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 for(const [name,image] of Object.entries(atlases)){
  const pack=meta[name];if(!pack?.frames||!image)continue;
  for(const frame of pack.frames){
   const w=frame.w,h=frame.h;
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   ctx.clearRect(0,0,w,h);
   ctx.drawImage(image,frame.x,frame.y,w,h,0,0,w,h);
   const data=ctx.getImageData(0,0,w,h).data,b=frame.bounds||{x:0,y:0,w,h};
   let foot=-1;
   for(let y=h-1;y>=0;y--){
    for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>80){foot=y;break;}
    if(foot>=0)break;
   }
   frame.footPad=foot<0?0:(b.y+b.h-1)-foot;
  }
 }
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rounded(ctx,x,y,w,h,r=5){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function polygon(ctx,points){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}

export class IsometricWorld {
 constructor(root,state,callbacks){
 this.root=root;this.canvas=root.querySelector('.actors-layer');this.back=root.querySelector('.terrain-layer');this.ctx=this.canvas.getContext('2d');this.bctx=this.back.getContext('2d',{alpha:false});this.mini=root.querySelector('.world-minimap');this.mctx=this.mini?.getContext('2d');
 this.weather=weatherAt(state);this.atmosphere=state.combat&&!this.weather.exposed?'clear':regionalWeather(state);this.state=state;this.callbacks=callbacks;this.id=state.combat?combatSceneId(state):sceneId(state.location);this.scene=SCENES[this.id];this.grid=buildGrid(this.scene.polygon,this.scene.obstacles);this.actors=makeActors(this.scene,state);this.listeners=[];this.raf=0;this.destroyed=false;this.paused=false;this.visible=true;this.suspended=!!document.hidden;this.ready=false;this.last=0;this.time=0;this.cameraDirty=true;this.hover=null;this.target=null;this.destination=null;this.showNames=readPreferences().names;this.combatTimer=null;this.keys=new Set();this.follow=true;this.reduced=document.body.classList.contains('reduce-motion')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;this.economy=readPreferences().battery;this.pointers=new Map();this.pinch=null;this.social=null;this.nextSocial=8;this.combatFx=null;this.trail=[];this.puffs=[];this.motes=[];
 this.memoryKey=state.combat?'combat:'+this.id:state.location;
 const old=memories.get(this.memoryKey),entry=this.scene.entry;
 this.player={id:'player',name:state.lead==='berkay'?'Berkay':'Uygar',person:state.lead,atlas:equipmentAtlas(state,state.lead),look:state.gear?.[state.lead],x:old?.x??entry[0],y:old?.y??entry[1],direction:old?.direction??2,path:[],speed:120,acceleration:857,phase:0,hero:true,moving:false};
 this.snap(this.player);
 this.camera={x:old?.camera?.x??this.player.x,y:old?.camera?.y??this.player.y-130,zoom:old?.camera?.zoom??1.12};
 this.createParty();
 if(state.combat){this.actors=[];const stage=combatStaging(state.combat.kind);this.player.x=state.combat.position===0?stage.player.x-90:state.combat.position===2?stage.player.x+160:stage.player.x;this.player.y=state.combat.position===1?stage.player.y:stage.player.y+43;this.player.speed=420;this.player.direction=stage.player.direction;this.enemy={id:'enemy',name:state.combat.name,sprite:1,x:stage.enemy.x,y:stage.enemy.y,path:[],speed:135,direction:1,phase:0,enemy:true};this.camera.x=stage.camera.x;this.camera.y=stage.camera.y;this.camera.zoom=stage.camera.zoom;if(this.companion){this.companion.x=stage.companion.x;this.companion.y=stage.companion.y;this.companion.sheltered=true;this.companion.path=[];this.snap(this.companion);this.dog.x=stage.dog.x;this.dog.y=stage.dog.y;this.dog.sheltered=true;this.dog.path=[];this.snap(this.dog);}}
 this.actors.forEach(a=>this.snap(a));separateCrowd(this.actors,this.grid,46);this.player.speed*=this.weather.speed;this.partyActors().forEach(a=>a.speed*=this.weather.speed);
 this.bind();this.resize();this.root.querySelector('[data-world="names"]')?.setAttribute('aria-pressed',String(this.showNames));
 this.headingTimer=setTimeout(()=>{if(!this.destroyed)this.root.querySelector('.world-heading')?.classList.add('is-compact');},3400);
 const leadAtlas=equipmentAtlas(state,state.lead);const brotherAtlas=this.companion?equipmentAtlas(state,this.companion.person):null;const need=[leadAtlas,'npc-walk'];if(brotherAtlas&&!need.includes(brotherAtlas))need.push(brotherAtlas);if(this.dog)need.push('pukie-walk');if(this.actors.some(a=>a.atlas==='npc-workers'))need.push('npc-workers');Promise.all([loadImage(this.scene.asset),loadMetadata(),...need.map(loadImage)]).then(async ([background,meta,...loaded])=>{if(this.destroyed)return;const atlases={};need.forEach((name,i)=>{atlases[name]=loaded[i];});const rigAtlases={};await Promise.all(need.map(async name=>{const rig=meta[name]?.rig;if(rig)rigAtlases[rig.asset]=await loadImage(rig.asset);}));if(this.destroyed)return;annotateFootPads(meta,atlases);Object.assign(this,{background,hero:atlases[leadAtlas],npcs:atlases['npc-walk'],workers:atlases['npc-workers']||atlases['npc-walk'],rigAtlases,atlases,meta,ready:true});this.bakeOccluders();this.bakeMinimapGround();this.weatherTiles=new Map();root.querySelector('.world-loading')?.remove();this.cameraDirty=true;this.draw();this.wake();}).catch(()=>{if(!this.destroyed){const el=root.querySelector('.world-loading');if(el)el.textContent='Artwork could not load. Refresh to retry. Campaign actions below remain available.';}});
 }
 createParty(){
 // The brother is the dog's guardian; Pukie never accepts player movement orders.
 const waiting=this.state.party?.mode==='wait',waitingAt=this.state.party?.waitingAt;
 if(waiting&&(this.state.combat||waitingAt!==this.state.location))return;
 const brotherName=this.state.lead==='berkay'?'Uygar':'Berkay',anchor=waiting?this.actors.find(a=>a.location===waitingAt):null;
 const x=anchor?.x??this.player.x,y=anchor?.y??this.player.y;
 if(!waiting&&!this.trail.length){for(let i=24;i>=0;i--)this.trail.push({x:x,y:y+i*10});}
 const brotherSlot=waiting?{x:x-65,y:y+135}:this.trailPoint(70,this.player,-1);
 const dogSlot=waiting?{x:x-20,y:y+175}:this.trailPoint(48,this.player,1);
 this.companion={id:'brother',name:brotherName,person:brotherName.toLowerCase(),atlas:equipmentAtlas(this.state,brotherName.toLowerCase()),look:this.state.gear?.[brotherName.toLowerCase()],x:brotherSlot.x,y:brotherSlot.y,path:[],speed:128,baseSpeed:128,acceleration:914,direction:2,phase:0,moving:false,followWait:0,party:true,waiting};
 this.snap(this.companion);
 this.dog={id:'pukie',name:'Pukie',atlas:'pukie-walk',x:dogSlot.x,y:dogSlot.y,path:[],speed:142,baseSpeed:142,acceleration:1014,direction:2,phase:0,moving:false,followWait:0,party:true,dog:true,stature:40,waiting};
 this.snap(this.dog);resolveSeparation(this.dog,[this.companion,this.player],this.grid,30);
 }
 partyActors(){return [this.companion,this.dog].filter(Boolean);}
 updateFollower(actor,leader,dt,gap,side){
 if(actor.waiting||actor.sheltered||this.target?.actor===actor)return;
 actor.followWait-=dt;
 const point=this.trailPoint(gap,leader,side);
 const behind=distance(actor,point);
 actor.speed=Math.min(actor.baseSpeed*1.35,Math.max(actor.baseSpeed*.55,(leader.velocity||leader.speed||110)+(behind-18)*1.1));
 if(behind>22&&actor.followWait<=0){
  const blockers=[this.player,...this.partyActors().filter(a=>a!==actor)];
  const blocked=blockActors(this.grid,blockers,actor,actor.dog?22:26);
  actor.path=approachPoint(blocked,actor,point,8)||findPath(blocked,actor,point,70)||approachPoint(this.grid,actor,point,8)||findPath(this.grid,actor,point,70)||[];
  actor.followWait=.32;
 }
 if(behind<16)actor.path=[];
 this.advanceActor(actor,dt);resolveSeparation(actor,[this.player,...this.actors,...this.partyActors().filter(a=>a!==actor)],this.grid,actor.dog?22:28);
 }
 trailPoint(gap,leader,side=0){
  const trail=this.trail||[];
  let acc=0,px=leader.x,py=leader.y,point=null;
  for(let i=trail.length-1;i>=0;i--){
   const p=trail[i],d=Math.hypot(p.x-px,p.y-py);
   if(acc+d>=gap){const u=d?(gap-acc)/d:0;point={x:px+(p.x-px)*u,y:py+(p.y-py)*u};break;}
   acc+=d;px=p.x;py=p.y;
  }
  if(!point)point={x:px,y:py+gap};
  let hx=0,hy=1;
  if(leader.heading&&(leader.heading.x||leader.heading.y)){hx=leader.heading.x;hy=leader.heading.y;}
  else if(trail.length>=2){const a=trail[trail.length-1],b=trail[Math.max(0,trail.length-8)],d=Math.hypot(a.x-b.x,a.y-b.y)||1;hx=(a.x-b.x)/d;hy=(a.y-b.y)/d;}
  const len=Math.hypot(hx,hy)||1;hx/=len;hy/=len;
  return {x:point.x+(-hy)*side*34,y:point.y+(hx)*side*34};
 }
 pushTrail(leader){
  this.trail=this.trail||[];
  const last=this.trail[this.trail.length-1];
  if(!last||Math.hypot(leader.x-last.x,leader.y-last.y)>8){this.trail.push({x:leader.x,y:leader.y});if(this.trail.length>90)this.trail.splice(0,this.trail.length-90);}
 }
 snap(actor){const i=nearestCell(this.grid,actor.x,actor.y);if(i>=0){const p=cellCenter(this.grid,i);actor.x=p.x;actor.y=p.y;}}
 on(el,type,fn,options){el.addEventListener(type,fn,options);this.listeners.push(()=>el.removeEventListener(type,fn,options));}
 bind(){
 this.on(this.canvas,'pointerdown',e=>this.pointerDown(e));
 this.on(this.canvas,'pointermove',e=>this.pointerMove(e));
 this.on(this.canvas,'pointerup',e=>this.pointerUp(e));
 this.on(this.canvas,'pointercancel',()=>{this.drag=null;this.pinch=null;this.pointers.clear();});
 this.on(this.canvas,'contextmenu',e=>e.preventDefault());
 this.on(this.canvas,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY<0?.12:-.12);},{passive:false});
 this.on(this.canvas,'keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();this.keys.add(e.key.toLowerCase());this.target=null;this.setStatus('');this.player.path=[];this.follow=true;this.wake();}if(e.code==='Space'){e.preventDefault();this.togglePause();}if(e.key.toLowerCase()==='e'){e.preventDefault();this.interactNearest();}if(e.key.toLowerCase()==='l'){this.toggleNames();}if(e.key.toLowerCase()==='f'){this.center();}});
 this.on(this.canvas,'keyup',e=>this.keys.delete(e.key.toLowerCase()));
 this.on(this.canvas,'blur',()=>this.keys.clear());
 this.on(document,'visibilitychange',()=>{this.setSuspended(document.hidden);});
 if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.root);}else this.on(window,'resize',()=>this.resize());
 if(typeof IntersectionObserver!=='undefined'){this.intersection=new IntersectionObserver(entries=>{this.setVisible(entries[0]?.isIntersecting??true);},{threshold:.05});this.intersection.observe(this.root);}
 for(const b of this.root.querySelectorAll('[data-world]'))this.on(b,'click',()=>{switch(b.dataset.world){case'zoom-in':this.zoom(.15);break;case'zoom-out':this.zoom(-.15);break;case'center':this.center();break;case'pause':this.togglePause();break;case'names':this.toggleNames();break;case'interact':this.interactNearest();break;case'fullscreen':this.callbacks.expand?.();break;}});
 }
 pointerDown(e){
 if(!this.ready||this.suspended||this.combatFx)return;
 this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(this.pointers.size===2){const [a,b]=[...this.pointers.values()],mid={clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2};this.pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:this.camera.zoom,anchor:this.eventPoint(mid)};this.drag=null;this.follow=false;return;}
 if(this.pointers.size===1)this.drag={x:e.clientX,y:e.clientY,cx:this.camera.x,cy:this.camera.y,moved:false,button:e.button};
 }
 pointerMove(e){
 if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(this.pinch&&this.pointers.size>=2){const [a,b]=[...this.pointers.values()],r=this.canvas.getBoundingClientRect();this.camera.zoom=clamp(this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/this.pinch.distance,.82,2.1);this.scale=this.baseScale*this.camera.zoom;this.camera.x=this.pinch.anchor.x-((a.x+b.x)/2-r.left-this.width/2)/this.scale;this.camera.y=this.pinch.anchor.y-((a.y+b.y)/2-r.top-this.height/2)/this.scale;this.clampCamera();this.cameraDirty=true;this.draw();return;}
 const p=this.eventPoint(e);if(this.drag){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.hypot(dx,dy)>7){this.drag.moved=true;this.follow=false;this.camera.x=this.drag.cx-dx/this.scale;this.camera.y=this.drag.cy-dy/this.scale;this.clampCamera();this.cameraDirty=true;this.draw();}}
 this.hover=this.pickActor(p);this.canvas.style.cursor=this.drag?.moved?'grabbing':this.hover?'pointer':isWalkable(this.grid,p.x,p.y)?'crosshair':'not-allowed';if(this.paused||this.state.combat||this.economy)this.draw();
 }
 pointerUp(e){
 const pinching=!!this.pinch,drag=this.drag;this.pointers.delete(e.pointerId);this.canvas.releasePointerCapture?.(e.pointerId);
 if(pinching){this.pinch=null;const remaining=[...this.pointers.values()][0];this.drag=remaining?{x:remaining.x,y:remaining.y,cx:this.camera.x,cy:this.camera.y,moved:true,button:0}:null;return;}
 this.drag=null;if(!drag||drag.moved||drag.button===2)return;this.click(this.eventPoint(e));
 }
 setSuspended(suspended){this.suspended=suspended;this.keys.clear();this.pointers.clear();this.pinch=null;this.drag=null;if(suspended){this.finishCombat();this.stop();}else this.wake();}
 resize(){if(this.destroyed)return;const r=this.root.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.dprCap=this.dprCap||(this.economy?1.5:3);this.dpr=Math.min(window.devicePixelRatio||1,this.dprCap);for(const c of [this.canvas,this.back]){c.width=Math.round(this.width*this.dpr);c.height=Math.round(this.height*this.dpr);c.style.width=this.width+'px';c.style.height=this.height+'px';}this.baseScale=Math.max(this.width/WORLD_W,this.height/WORLD_H);this.scale=this.baseScale*this.camera.zoom;this.clampCamera();this.cameraDirty=true;if(this.ready)this.draw();}
 clampCamera(){this.scale=this.baseScale*this.camera.zoom;const halfW=this.width/this.scale/2,halfH=this.height/this.scale/2;this.camera.x=halfW>WORLD_W/2?WORLD_W/2:clamp(this.camera.x,halfW,WORLD_W-halfW);this.camera.y=halfH>WORLD_H/2?WORLD_H/2:clamp(this.camera.y,halfH,WORLD_H-halfH);}
 eventPoint(e){const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left-this.width/2)/this.scale+this.camera.x,y:(e.clientY-r.top-this.height/2)/this.scale+this.camera.y};}
 screenPoint(p){return{x:(p.x-this.camera.x)*this.scale+this.width/2,y:(p.y-this.camera.y)*this.scale+this.height/2};}
 zoom(delta){this.camera.zoom=clamp(this.camera.zoom+delta,.82,2.1);this.clampCamera();this.cameraDirty=true;this.draw();}
 center(){this.follow=true;this.camera.x=this.player.x;this.camera.y=this.player.y-100;this.clampCamera();this.cameraDirty=true;this.draw();this.canvas.focus({preventScroll:true});}
 toggleNames(){this.showNames=!this.showNames;savePreference('names',this.showNames);this.root.querySelector('[data-world="names"]')?.setAttribute('aria-pressed',String(this.showNames));this.draw();}
 togglePause(){if(this.state.combat||this.combatFx)return;this.paused=!this.paused;this.root.classList.toggle('world-paused',this.paused);this.root.querySelector('[data-world="pause"]')?.setAttribute('aria-pressed',String(this.paused));if(this.paused){this.stop();this.draw();}else this.wake();}
 pickActor(p){const actors=[...this.actors,...this.partyActors(),...(this.enemy?[this.enemy]:[])];return actors.sort((a,b)=>b.y-a.y).find(a=>{const body=a.dog?58:Math.max(124,(a.stature||102)+40);const half=a.dog?30:Math.max(48,38/this.scale);return Math.abs(a.x-p.x)<half&&p.y<a.y+28&&p.y>a.y-body;})||null;}
 click(p){
 if(this.state.combat){const actor=this.pickActor(p);if(actor===this.enemy)this.callbacks.enemy();else if(actor?.party)this.callbacks.interact(actor);return;}
 if(this.paused){this.callbacks.message('The world is paused. Press Space or the pause button to resume.');return;}
 const actor=this.pickActor(p);if(actor){this.approach(actor);return;}
 this.target=null;this.destination=null;this.setStatus('');
 const path=findPath(this.grid,this.player,p,38);
 if(!path){this.callbacks.message('That ground is not accessible. Choose the open paving.');return;}
 this.player.path=path;this.destination=path.at(-1);this.follow=true;this.wake();
 }
 approach(actor,callback=null){
 if(this.state.combat||this.paused||!this.ready)return false;
 actor.path=[];actor.moving=false;actor.velocity=0;actor.wait=30;
 if(distance(this.player,actor)<95){this.faceEachOther(this.player,actor);if(callback)callback();else this.callbacks.interact(actor);return true;}
 const path=approachPoint(this.grid,this.player,actor,64);
 if(!path){this.callbacks.message('There is no clear route to that character.');return false;}
 this.player.path=path;this.target={actor,callback};this.destination=path.at(-1);this.follow=true;this.setStatus('Walking to '+actor.name+'…');this.callbacks.approaching?.(actor);if(!this.visible)this.completeApproach();else this.wake();return true;
 }
 walkToLocation(location,callback){const actor=this.actors.find(a=>a.location===location);if(!actor)return false;return this.approach(actor,callback);}
 setStatus(text){const el=this.root.querySelector('.world-status');if(el){el.textContent=text;el.hidden=!text;}}
 completeApproach(){if(!this.target)return;const {actor,callback}=this.target;const end=this.player.path.at(-1);if(end){this.player.x=end.x;this.player.y=end.y;}this.player.path=[];this.target=null;this.destination=null;this.setStatus('');this.faceEachOther(this.player,actor);if(distance(this.player,actor)<=115){if(callback)callback();else this.callbacks.interact(actor);}}
 setVisible(visible){this.visible=visible;if(visible)this.wake();else{this.stop();this.finishCombat();if(!this.destroyed)this.completeApproach();}}
 interactNearest(){if(this.state.combat){this.callbacks.enemy();return;}const near=[...this.actors,...this.partyActors()].sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0];if(near)this.approach(near);}
 faceEachOther(a,b){const dx=b.x-a.x,dy=b.y-a.y;a.direction=dy>=0?(dx>=0?0:1):(dx<0?2:3);b.direction=(a.direction+2)%4;}
 stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.last=0;}
 wake(){if(this.destroyed||!this.ready||!this.visible||this.suspended||this.paused||this.raf)return;this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));}
 frame(t){this.raf=0;if(this.destroyed||!this.visible||this.suspended||this.paused)return;const elapsed=this.last?t-this.last:16.7;const cap=this.economy?24:this.reduced?30:60;if(elapsed>=1000/cap-1){if(elapsed>22)this.slowFrames=(this.slowFrames||0)+1;else if(elapsed<17)this.slowFrames=Math.max(0,(this.slowFrames||0)-2);this.lowQuality=!!(this.economy||this.reduced||(this.slowFrames||0)>=2);if((this.slowFrames||0)>=2&&this.dprCap>2&&!this.economy){this.dprCap=Math.max(2,+(this.dprCap-0.5).toFixed(2));this.slowFrames=0;this.resize();}this.last=t;this.update(Math.min(elapsed/1000,.08));if(this.destroyed)return;this.draw();if(this.state.combat&&!this.combatFx)return;if((this.reduced||this.economy)&&!this.player.path.length&&!this.keys.size&&!this.partyActors().some(a=>a.path.length)&&!this.combatFx)return;}this.raf=requestAnimationFrame(n=>this.frame(n));}
 update(dt){
 this.time+=dt;this.updateDust(dt);
 if(this.combatFx){this.combatFx.age+=dt;this.updateCombat();return;}
 if(this.state.combat)return;
 const dx=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0),dy=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0);
 if(dx||dy){const length=Math.hypot(dx,dy),look=Math.max(40,this.player.speed*.3);const nx=this.player.x+dx/length*look,ny=this.player.y+dy/length*look;this.player.path=[];this.destination=null;this.player.holdVelocity=true;if(isWalkable(this.grid,nx,ny)){this.player.path=[{x:nx,y:ny}];}else if(isWalkable(this.grid,nx,this.player.y)){this.player.path=[{x:nx,y:this.player.y}];}else if(isWalkable(this.grid,this.player.x,ny)){this.player.path=[{x:this.player.x,y:ny}];}}
 else {this.player.holdVelocity=false;if(!this.player.path.length){const coast=coastTarget(this.player,this.grid);if(coast)this.player.path=[coast];}}
 this.advanceActor(this.player,dt);this.pushTrail(this.player);
 if(this.target&&!this.player.path.length){const {actor,callback}=this.target;this.target=null;this.destination=null;this.setStatus('');this.faceEachOther(this.player,actor);if(distance(this.player,actor)<=115){if(callback)callback();else this.callbacks.interact(actor);if(this.destroyed)return;}}
 if(!this.reduced&&!this.economy){
 this.updateSocial(dt);
 for(const a of this.actors){if(a===this.target?.actor||this.social&&(a===this.social.a||a===this.social.b))continue;a.wait-=dt;if(a.route&&!a.path.length&&a.wait<=0){const p=a.route[a.routeIndex++%a.route.length];let dest={x:p[0],y:p[1]};for(let tries=0;tries<6;tries++){const occupied=this.actors.some(o=>o!==a&&Math.hypot((o.path?.at(-1)?.x??o.x)-dest.x,(o.path?.at(-1)?.y??o.y)-dest.y)<48);if(!occupied)break;const ang=tries*1.15,r=50+tries*12,nx=p[0]+Math.cos(ang)*r,ny=p[1]+Math.sin(ang)*r;if(isWalkable(this.grid,nx,ny))dest={x:nx,y:ny};}a.path=findPath(this.grid,a,dest,70)||[];a.wait=2.4+((a.routeIndex*5+(a.name||'').length+(a.sprite||0))%8)*.85;}this.advanceActor(a,dt);resolveSeparation(a,[this.player,...this.actors],this.grid,38);}
 if(this.time%1<dt)separateCrowd(this.actors,this.grid,42);
 }
 if(this.companion)this.updateFollower(this.companion,this.player,dt,70,-1);
 if(this.dog)this.updateFollower(this.dog,this.player,dt,48,1);
 if(this.follow&&!this.drag){const targetX=this.player.x,targetY=this.player.y-85,dx=targetX-this.camera.x,dy=targetY-this.camera.y;const deadX=Math.max(48,(this.width/this.scale)*0.20),deadY=Math.max(36,(this.height/this.scale)*0.16);let mx=0,my=0;if(Math.abs(dx)>deadX)mx=dx-Math.sign(dx)*deadX;if(Math.abs(dy)>deadY)my=dy-Math.sign(dy)*deadY;if(mx||my){this.camera.x+=mx*Math.min(1,dt*4);this.camera.y+=my*Math.min(1,dt*4);this.clampCamera();this.cameraDirty=true;}}
 }
 updateSocial(dt){
 const ambient=this.actors.filter(a=>a.route);
 if(!this.social&&this.time>this.nextSocial&&ambient.length>=2){const [a,b]=ambient;if(distance(a,b)<70){a.wait=4;b.wait=5;this.nextSocial=this.time+8;return;}a.path=approachPoint(this.grid,a,b,72)||[];b.path=[];this.social={a,b,age:0,phase:0};}
 if(!this.social)return;
 const s=this.social;s.age+=dt;this.advanceActor(s.a,dt);s.b.moving=false;
 if(!s.a.path.length||s.age>7){this.faceEachOther(s.a,s.b);if(s.phase===0){s.phase=1;s.age=0;s.a.bubble={text:s.a.barks[0],until:this.time+3.2};}else if(s.phase===1&&s.age>3.5){s.phase=2;s.age=0;s.b.bubble={text:s.b.barks[0],until:this.time+3.2};}else if(s.phase===2&&s.age>4){s.a.wait=3;s.b.wait=4;this.social=null;this.nextSocial=this.time+17;}}
 }
 playCombat(id,nextState,done){
 if(!this.ready||this.reduced||!this.visible||this.suspended||this.paused){done();return;}
 this.player.path=[];
 this.combatFx={id,next:nextState,done,age:0,startX:this.player.x,startY:this.player.y,enemyStart:{x:this.enemy.x,y:this.enemy.y},hit:nextState.combat?this.state.combat.hp-nextState.combat.hp:id==='attack'?this.state.combat.hp:0,hurt:Math.max(0,this.state.hp-nextState.hp)};
 this.combatTimer=setTimeout(()=>this.finishCombat(),1250);
 if(id==='cover')this.player.path=findPath(this.grid,this.player,{x:this.state.combat.position===0?930:530,y:790},100)||[];
 if(id==='flee')this.player.path=findPath(this.grid,this.player,{x:620,y:920},100)||[];
 this.wake();
 }
 finishCombat(){const fx=this.combatFx;if(!fx)return;this.combatFx=null;clearTimeout(this.combatTimer);this.combatTimer=null;fx.done();}
 updateCombat(){const f=this.combatFx;this.advanceActor(this.player,1/30);this.player.direction=3;if(f.age>.52&&f.age<.92){const t=(f.age-.52)/.4;this.enemy.x=f.enemyStart.x-Math.sin(t*Math.PI)*48;this.enemy.y=f.enemyStart.y+Math.sin(t*Math.PI)*24;this.enemy.moving=true;this.enemy.phase+=.15;}else this.enemy.moving=false;if(f.age>1.18)this.finishCombat();}
 transform(ctx){ctx.setTransform(this.dpr*this.scale,0,0,this.dpr*this.scale,this.dpr*(this.width/2-this.camera.x*this.scale),this.dpr*(this.height/2-this.camera.y*this.scale));}
 draw(){
 if(!this.ready||this.destroyed)return;
 if(this.cameraDirty){this.bctx.setTransform(1,0,0,1,0,0);this.bctx.imageSmoothingEnabled=true;this.bctx.imageSmoothingQuality=this.lowQuality?'medium':'high';this.bctx.fillStyle='#111910';this.bctx.fillRect(0,0,this.back.width,this.back.height);this.transform(this.bctx);this.bctx.drawImage(this.background,0,0,WORLD_W,WORLD_H);this.cameraDirty=false;}
 const ctx=this.ctx;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.transform(ctx);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 if(this.companion?.waiting)this.drawWaitingPoint();
 if(this.player.path.length){ctx.strokeStyle='rgba(229,202,136,.30)';ctx.lineWidth=1.5/this.scale;ctx.setLineDash([3/this.scale,7/this.scale]);ctx.beginPath();ctx.moveTo(this.player.x,this.player.y);for(const p of this.player.path)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);}
 if(this.destination){const p=this.destination;ctx.strokeStyle='#edd693';ctx.lineWidth=1.2/this.scale;ctx.beginPath();ctx.ellipse(p.x,p.y,18,9,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-24,p.y);ctx.lineTo(p.x-11,p.y);ctx.moveTo(p.x+11,p.y);ctx.lineTo(p.x+24,p.y);ctx.stroke();}
 this.drawDust();
 const drawables=[...this.actors,this.player,...this.partyActors(),...(this.enemy?[this.enemy]:[]),...(this.occluderSprites||[])].sort((a,b)=>a.y-b.y);
 for(const actor of drawables){if(actor.occluder){if(actor.canvas)ctx.drawImage(actor.canvas,actor.ox,actor.oy);else{ctx.save();polygon(ctx,actor.polygon);ctx.clip();ctx.drawImage(this.background,0,0,WORLD_W,WORLD_H);ctx.restore();}}else this.drawActor(actor);}
 this.drawWeather();this.drawMotes();
 for(const a of [this.player,...this.actors,...this.partyActors(),...(this.enemy?[this.enemy]:[])]){if(a.bubble?.until>this.time)this.drawBubble(a,a.bubble.text);}
 this.layoutLabels();
 if(this.combatFx)this.drawCombatFx();
 if(this.mctx)this.drawMinimap();
 }
 drawWeather(){
 const kind=this.atmosphere;if(kind==='clear')return;
 const ctx=this.ctx,w=this.width,h=this.height;
 ctx.save();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
 ctx.fillStyle=kind==='rain'?'rgba(22,42,58,.26)':kind==='fog'?'rgba(198,212,204,.25)':'rgba(177,137,75,.23)';ctx.fillRect(0,0,w,h);
 const staticWx=this.economy||this.reduced||this.lowQuality;
 if(kind==='fog'){const t=staticWx?0:this.time;for(let i=0;i<3;i++){ctx.fillStyle='rgba(213,224,216,.045)';const y=(i*h/3+t*5)%(h+100)-60;ctx.fillRect(0,y,w,95);}ctx.restore();return;}
 const tile=this.weatherTile(kind);if(tile){const t=staticWx?0:this.time,ox=kind==='rain'?(t*62)%tile.width:(t*120)%tile.width,oy=kind==='rain'?(t*280)%tile.height:(t*18)%tile.height;for(let x=-ox;x<w;x+=tile.width)for(let y=-oy;y<h;y+=tile.height)ctx.drawImage(tile,x,y);}
 ctx.restore();
 }
 weatherTile(kind){
 if(this.weatherTiles?.has(kind))return this.weatherTiles.get(kind);
 const size=256,c=document.createElement('canvas');c.width=size;c.height=size;const g=c.getContext('2d');
 if(kind==='rain'){g.strokeStyle='rgba(180,214,225,.40)';g.lineWidth=1;g.beginPath();for(let i=0;i<18;i++){const x=(i*71)%size,y=(i*113)%size;g.moveTo(x,y);g.lineTo(x-5,y+14);}g.stroke();}
 else{g.strokeStyle='rgba(228,196,133,.28)';g.lineWidth=1;g.beginPath();for(let i=0;i<14;i++){const x=(i*83)%size,y=(i*67)%size;g.moveTo(x,y);g.lineTo(x+22,y-3);}g.stroke();}
 this.weatherTiles.set(kind,c);return c;
 }
 bakeOccluders(){
 this.occluderSprites=(this.scene.occluders||[]).map(o=>{
  const xs=o.polygon.map(p=>p[0]),ys=o.polygon.map(p=>p[1]);
  const pad=2,x0=Math.floor(Math.min(...xs))-pad,y0=Math.floor(Math.min(...ys))-pad,x1=Math.ceil(Math.max(...xs))+pad,y1=Math.ceil(Math.max(...ys))+pad;
  const c=document.createElement('canvas');c.width=Math.max(1,x1-x0);c.height=Math.max(1,y1-y0);
  const g=c.getContext('2d');g.translate(-x0,-y0);polygon(g,o.polygon);g.clip();g.drawImage(this.background,0,0,WORLD_W,WORLD_H);
  return {occluder:true,y:o.depth,canvas:c,ox:x0,oy:y0};
 });
 }
 bakeMinimapGround(){
 if(!this.mini)return;const g=document.createElement('canvas');g.width=this.mini.width;g.height=this.mini.height;const c=g.getContext('2d');c.drawImage(this.background,0,0,g.width,g.height);this.minimapGround=g;
 }
 drawWaitingPoint(){
 // A little water station marks their safe waiting spot without an idle animation loop.
 const ctx=this.ctx,a=this.dog,x=a.x+29,y=a.y+10;
 ctx.save();ctx.fillStyle='rgba(8,18,15,.22)';ctx.beginPath();ctx.ellipse(x,y+3,17,7,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#716b52';ctx.beginPath();ctx.ellipse(x,y,14,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7ca9a2';ctx.beginPath();ctx.ellipse(x,y-2,10,3.5,0,0,Math.PI*2);ctx.fill();
 ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillStyle='#e0d6ad';ctx.fillText('WAITING POINT',this.companion.x,this.companion.y+32);ctx.restore();
 }
 advanceActor(actor,dt){
  const prev=actor.phase||0;
  const moved=stepActor(actor,dt);
  this.emitFootDust(actor,prev,actor.phase||0);
  return moved;
 }
 emitFootDust(actor,prev,phase){
  if(this.reduced||this.economy||this.lowQuality||actor.planted||!actor.moving)return;
  const a=((prev%4)+4)%4,b=((phase%4)+4)%4;
  if(!((a<2&&b>=2)||(a>b)))return;
  const n=actor.dog?2:3;
  for(let i=0;i<n;i++)this.puffs.push({x:actor.x+(Math.random()-.5)*8,y:actor.y+(Math.random()-.5)*3,r:2+Math.random()*2.2,life:.26+Math.random()*.16,age:0,a:.2});
  if(this.puffs.length>40)this.puffs.splice(0,this.puffs.length-40);
 }
 updateDust(dt){
  if(this.reduced||this.economy||this.lowQuality){if(this.puffs.length)this.puffs.length=0;return;}
  if(!this.motes.length){for(let i=0;i<10;i++)this.motes.push({x:Math.random()*WORLD_W,y:Math.random()*WORLD_H,s:.55+Math.random()*1.05,vx:(Math.random()-.5)*8,vy:-3.5-Math.random()*5,ph:Math.random()*Math.PI*2});}
  for(let i=this.puffs.length-1;i>=0;i--){const p=this.puffs[i];p.age+=dt;p.y-=dt*6;p.r+=dt*8;if(p.age>=p.life)this.puffs.splice(i,1);}
  for(const m of this.motes){m.x+=m.vx*dt;m.y+=m.vy*dt;m.ph+=dt*1.4;if(m.y<0){m.y=WORLD_H;m.x=Math.random()*WORLD_W;}if(m.x<0)m.x+=WORLD_W;else if(m.x>WORLD_W)m.x-=WORLD_W;}
 }
 drawDust(){
  const ctx=this.ctx;
  for(const p of this.puffs){const t=1-p.age/p.life;ctx.fillStyle='rgba(196,180,140,'+(p.a*t).toFixed(3)+')';ctx.beginPath();ctx.ellipse(p.x,p.y,p.r,p.r*.45,0,0,Math.PI*2);ctx.fill();}
 }
 drawMotes(){
  if(!this.motes.length)return;
  const ctx=this.ctx;
  for(const m of this.motes){const a=.08+.1*(.5+.5*Math.sin(m.ph));ctx.fillStyle='rgba(230,220,180,'+a.toFixed(3)+')';ctx.beginPath();ctx.arc(m.x,m.y,m.s,0,Math.PI*2);ctx.fill();}
 }
 drawGroundShadow(a){
 const ctx=this.ctx,dog=!!a.dog,rx=dog?9:13,ry=dog?3.1:4.2;
 const gait=gaitPose(a,this.reduced);
 const pulse=a.moving&&!gait.planted?1-0.12*Math.abs(Math.sin(gait.cycle*4*Math.PI)):1;
 const heading=a.heading||{x:0,y:1};
 const fx=-heading.y*(dog?3.2:4.6),fy=heading.x*(dog?1.2:1.6);
 ctx.save();
 ctx.fillStyle='rgba(6,8,6,.16)';
 ctx.beginPath();ctx.ellipse(a.x,a.y+0.4,rx*1.22*pulse,ry*1.16*pulse,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='rgba(4,6,4,.28)';
 ctx.beginPath();ctx.ellipse(a.x+fx,a.y+fy,rx*.62*pulse,ry*.55*pulse,0,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.ellipse(a.x-fx,a.y-fy,rx*.62*pulse,ry*.55*pulse,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='rgba(4,6,4,.34)';
 ctx.beginPath();ctx.ellipse(a.x,a.y,rx*.8*pulse,ry*.74*pulse,0,0,Math.PI*2);ctx.fill();
 ctx.restore();
 }
 drawSelectionMark(a){
 const ctx=this.ctx,dog=!!a.dog;
 const color=a.enemy?'#e78e78':a.hero?'#d5e29e':a.party?'#91c5c0':(a.accent||'#edca7f');
 ctx.save();
 ctx.fillStyle=color+'33';
 ctx.beginPath();ctx.ellipse(a.x,a.y,dog?13:17.5,dog?4:5.4,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=color;
 ctx.lineWidth=1.35/this.scale;
 ctx.beginPath();ctx.ellipse(a.x,a.y,dog?13:17.5,dog?4:5.4,0,0,Math.PI*2);ctx.stroke();
 ctx.restore();
 }
 drawActor(a){
 const ctx=this.ctx,pos=this.screenPoint(a);if(pos.x< -100||pos.x>this.width+100||pos.y< -120||pos.y>this.height+140)return;
 this.drawGroundShadow(a);
 if(a===this.hover||a===this.target?.actor||(a.enemy&&this.state.combat))this.drawSelectionMark(a);
 const gait=gaitPose(a,this.reduced),frame=gait.frame,atlas=a.atlas||(a.hero?equipmentAtlas(this.state,this.state.lead):'npc-walk'),directional=a.hero||a.party,row=directional?a.direction:(a.sprite??0),meta=this.meta[atlas]||this.meta[equipmentAtlas(this.state,this.state.lead)],rect=meta.frames[row*4+frame];
 const drawH=a.dog?40:a.hero||a.party?102:a.enemy?107:(a.stature||99),pose=spritePose(rect,drawH);
 const mirror=!directional&&(a.direction===0||a.direction===3);let ox=0,oy=0;
 if(this.combatFx){const f=this.combatFx;if(a.hero&&f.id==='attack'&&f.age<.38)ox=Math.sin(f.age/.38*Math.PI)*9;if(a.enemy&&f.id==='attack'&&f.age>.17&&f.age<.5&&f.hit>0)ox=Math.sin(f.age*40)*4;}
 const b=rect.bounds||{x:0,y:0,w:rect.w,h:rect.h},footShift=(rect.footPad||0)*pose.height/b.h+1.2;
 ctx.save();
 const bob=gait.planted?0:-(gait.lift||0),sway=gait.planted?0:(gait.sway||0);ctx.translate(a.x+ox+sway,a.y+oy+footShift+bob);if(mirror)ctx.scale(-1,1);if(!gait.planted&&gait.lean)ctx.rotate(gait.lean);if(a.filter)ctx.filter=a.filter;
 let rigged=false;
 if(rigged){try{this.drawRig(a,pose,gait,meta,row,frame);}catch{rigged=false;}}
 if(!rigged){const source=pose.source;ctx.drawImage(this.atlases[atlas]||(a.hero?this.hero:atlas==='npc-workers'?this.workers:this.npcs),source.x,source.y,source.w,source.h,-pose.width/2,-pose.height,pose.width,pose.height);}
 if(a.look)this.drawEquipment(a,pose);if(a.filter)ctx.filter='none';ctx.restore();
 }
 drawRig(a,pose,gait,meta,row,frame){
 const ctx=this.ctx,rig=meta.rig,config=rig.rows[row],texture=this.rigAtlases[rig.asset],ref=meta.frames[config.reference],refPose=spritePose(ref,pose.height),bounds=ref.bounds;
 const map=p=>({x:(p.x-bounds.w/2)*pose.height/bounds.h,y:(p.y-bounds.h)*pose.height/bounds.h});
 const feet=footTargets(a,gait.cycle,pose.hip,gait.lift),legs=config.bones.map((bone,i)=>{
 const hip={x:pose.hip.x+(i===0?1:-1)*4,y:pose.hip.y},foot=feet[i],knee=kneeFor(hip,foot,pose.height*.26,pose.height*.27,(a.direction===0||a.direction===3)?-1:1);
 return {i,hip,knee,foot,source:{hip:map(bone.hip),knee:map(bone.knee),foot:map(bone.foot)}};
 }).sort((a,b)=>a.foot.y-b.foot.y);
 for(const leg of legs){for(let segment=0;segment<2;segment++){
 const s=leg.source,from=segment?s.knee:s.hip,to=segment?s.foot:s.knee,A=segment?leg.knee:leg.hip,B=segment?leg.foot:leg.knee,part=config.parts[leg.i*2+segment];
 ctx.save();ctx.transform(...boneAffine(from,to,A,B));ctx.drawImage(texture,part.x,part.y,part.w,part.h,-refPose.width/2,-refPose.height,refPose.width,refPose.height);ctx.restore();
 }}
 const body=config.bodies[0];ctx.drawImage(texture,body.x,body.y,body.w,body.h,-pose.width/2,-pose.height,pose.width,pose.height);
 }
 drawEquipment(a,pose){
 const ctx=this.ctx,g=a.look,front=a.direction<2,side=a.direction===0||a.direction===3?1:-1;
 const crown=pose.crown,face=pose.face,hip=pose.hip;
 const hw=Math.max(11,pose.headWidth);
 if(a.person!=='berkay'&&g.hat&&!hoodRaised(this.state,a.person)){
  const cx=crown.x,cy=crown.y+hw*.18,rx=hw*.58,ry=hw*.34;
  ctx.fillStyle='#6e6250';ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7d6e58';ctx.beginPath();ctx.ellipse(cx,cy+ry*.12,rx*1.02,ry*.82,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#5a4f3f';ctx.beginPath();ctx.ellipse(cx,cy+ry*.42,rx*1.02,ry*.18,0,0,Math.PI*2);ctx.fill();
  if(front){
   const bx=cx+side*rx*.62,by=cy+ry*.55;
   ctx.fillStyle='#5d5242';ctx.beginPath();ctx.ellipse(bx,by,rx*.74,ry*.28,side*-.32,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#8a7b63';ctx.beginPath();ctx.ellipse(bx,by-ry*.08,rx*.68,ry*.16,side*-.32,0,Math.PI*2);ctx.fill();
  }else{
   ctx.strokeStyle='#4a4338';ctx.lineWidth=1.05;ctx.beginPath();ctx.ellipse(cx,cy+ry*.32,rx*.26,ry*.15,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.strokeStyle='#5a4f3f';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(cx,cy-ry);ctx.lineTo(cx,cy+ry*.15);ctx.stroke();
 }
 if(a.person!=='berkay'&&g.glasses&&front){
  const x=face.x+side*.6,y=face.y+.3,lw=Math.max(3.5,hw*.22),lh=Math.max(2.3,hw*.13);
  ctx.fillStyle='#14120f';
  ctx.beginPath();ctx.ellipse(x-lw*.7,y,lw*.48,lh*.7,side*.1,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(x+lw*.7,y,lw*.48,lh*.7,side*-.1,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#2a2722';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(x-lw*.2,y);ctx.lineTo(x+lw*.2,y);ctx.stroke();
  ctx.fillStyle='rgba(220,220,230,.2)';ctx.beginPath();ctx.ellipse(x-lw*.82,y-lh*.2,lw*.16,lh*.12,0,0,Math.PI*2);ctx.fill();
 }
 if(false&&a.person==='berkay'&&front&&!(a.atlas||'').includes('rain')){
  const x=face.x+side*hw*.2,y=face.y+hw*.26;
  ctx.fillStyle='#f0eee6';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+side*2.4,y+.8);ctx.lineTo(x+side*4.4,y+4.4);ctx.lineTo(x+side*1.6,y+2.6);ctx.closePath();ctx.fill();
  ctx.fillStyle='#2a8eb0';ctx.beginPath();ctx.ellipse(x+side*2.2,y+2.2,.7,1,side*-.4,0,Math.PI*2);ctx.fill();
 }
 if(a.person==='uygar'&&hoodRaised(this.state,'uygar')){ctx.strokeStyle='#253342';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(crown.x,face.y,pose.headWidth*.52,12,0,Math.PI*.8,Math.PI*2.1);ctx.stroke();}
 const gun=g.weapon;ctx.save();
 if(a.hero&&this.state.combat){ctx.translate(pose.hand.x,pose.hand.y);ctx.rotate(-.55);}else{
 // Carry weapons against the belt/back rather than drawing them beside an empty hand.
 ctx.translate(hip.x+side*6,hip.y);ctx.rotate(gun==='pistol'?1.15:-.55*side+Math.PI/2);
 }
 ctx.strokeStyle='#59675c';ctx.fillStyle='#26322c';ctx.lineWidth=.7;
 if(gun==='pistol'){ctx.fillRect(-1,-1.5,9,3);ctx.fillRect(0,0,3,5);}
 else{const length=gun==='carbine'?26:22;ctx.fillStyle='#544b37';ctx.fillRect(-5,-2,8,5);ctx.fillStyle='#27332f';ctx.fillRect(2,-1.5,length-2,3);ctx.strokeRect(2,-1.5,length-2,3);ctx.fillRect(6,0,3,5);if(gun==='shotgun')ctx.fillRect(10,1.5,10,1.5);}
 ctx.restore();
 }
 labelText(a){return a.hero?a.name:a.waiting?(a.dog?'Pukie · Waiting':a.name+' · With Pukie'):a.sheltered?a.name+' · Sheltered':a.weatherShelter?a.name+' · Under cover':a.name;}
 drawPin(a,on){const ctx=this.ctx,h=a.dog?42:a.hero||a.party?102:a.enemy?107:(a.stature||99),apex=a.y-h-22;ctx.save();ctx.fillStyle=on?'#f1d285':'#d4bf87';ctx.strokeStyle='rgba(18,22,16,.5)';ctx.lineWidth=1/Math.max(.6,this.scale);ctx.beginPath();ctx.moveTo(a.x,apex);ctx.lineTo(a.x+5,apex+8);ctx.lineTo(a.x,apex+16);ctx.lineTo(a.x-5,apex+8);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(a.x,apex+16);ctx.lineTo(a.x,apex+22);ctx.stroke();ctx.restore();}
 layoutLabels(){
  const ctx=this.ctx,items=[],pins=[],top=52,bottom=58,near=150;
  const large=document.body.classList.contains('large-text');
  const fontSize=large?13:10,tagSize=large?10:8,labelH=large?20:16;
  const pin=(a,on)=>{if(a?.location)pins.push({a,on});};
  const consider=(a,priority)=>{
   if(!a)return;
   const p=this.screenPoint(a);
   if(p.x<-25||p.x>this.width+25||p.y<0||p.y>this.height+80)return;
   const forced=a===this.hover||a===this.target?.actor||a.enemy;
   const nearby=Math.hypot(a.x-this.player.x,a.y-this.player.y)<near;
   const show=forced||(a.hero&&this.showNames)||(a.party&&this.showNames&&nearby)||(nearby&&(this.showNames||a.location)&&!a.hero);
   if(!show){pin(a,a.location===this.state.location);return;}
   items.push({a,p,priority,forced,label:this.labelText(a)});
  };
  consider(this.player,5);if(this.enemy)consider(this.enemy,5);for(const a of this.partyActors())consider(a,4);for(const a of this.actors)consider(a,a.location?3:1);
  items.sort((a,b)=>b.priority-a.priority||a.p.y-b.p.y);
  const ambient=items.filter(i=>!i.forced&&!i.a.hero&&!i.a.enemy&&!i.a.party);
  if(ambient.length>2){const keep=new Set(ambient.map(i=>({i,d:Math.hypot(i.a.x-this.player.x,i.a.y-this.player.y)})).sort((a,b)=>a.d-b.d).slice(0,2).map(x=>x.i));for(const i of ambient){if(!keep.has(i)){i.cull=true;pin(i.a,false);}}}
  ctx.save();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.font='600 '+fontSize+'px Arial';
  const reserved=[{x:0,y:this.height-56,w:this.width,h:56},{x:0,y:0,w:Math.min(240,this.width*.62),h:46}];
  const overlap=(A,B,pad=5)=>A.x<B.x+B.w+pad&&A.x+A.w+pad>B.x&&A.y<B.y+B.h+pad&&A.y+A.h+pad>B.y;
  const boxes=[];
  for(const item of items){
   if(item.cull)continue;
   const w=Math.min(this.width-16,ctx.measureText(item.label).width+14);
   const head=item.p.y-(item.a.dog?36:item.a.stature||102)*this.scale-18;
   const baseX=clamp(item.p.x-w/2,8,this.width-w-8),baseY=clamp(head,top,this.height-bottom);
   boxes.push({item,x:baseX,y:baseY,w,h:labelH,baseX,baseY,head});
  }
  for(let iter=0;iter<16;iter++){
   let moved=false;
   for(let i=0;i<boxes.length;i++){
    for(let j=i+1;j<boxes.length;j++){
     const A=boxes[i],B=boxes[j];
     if(!overlap(A,B,6))continue;
     const pa=A.item.priority,pb=B.item.priority;
     const ta=pa>pb?0.2:pa<pb?0.8:0.5,tb=1-ta;
     let vy=((B.y+B.h/2)>=(A.y+A.h/2)?1:-1)*8,vx=((B.x+B.w/2)>=(A.x+A.w/2)?1:-1)*5;
     const nudge=(box,sx,sy)=>{
      box.x=clamp(box.x+sx,8,this.width-box.w-8);
      box.y=clamp(box.y+sy,top,this.height-bottom);
      const dx=box.x-box.baseX,dy=box.y-box.baseY,d=Math.hypot(dx,dy),cap=52;
      if(d>cap){box.x=clamp(box.baseX+dx/d*cap,8,this.width-box.w-8);box.y=clamp(box.baseY+dy/d*cap,top,this.height-bottom);}
      if(box.y+box.h>box.head+8)box.y=clamp(Math.min(box.y,box.head-2),top,this.height-bottom);
     };
     nudge(A,-vx*ta,-vy*ta);nudge(B,vx*tb,vy*tb);moved=true;
    }
    for(const r of reserved){if(overlap(boxes[i],r,4)){boxes[i].y=clamp(boxes[i].y-(r.y<this.height/2?12:-12),top,this.height-bottom);moved=true;}}
   }
   if(!moved)break;
  }
  this.labelRects=reserved.concat(boxes.map(b=>({x:b.x,y:b.y,w:b.w,h:b.h})));
  for(const box of boxes)this.paintLabel(box.item.a,box.item.label,box,fontSize,tagSize,labelH);
  ctx.restore();
  for(const p of pins)this.drawPin(p.a,p.on);
 }
 paintLabel(a,label,r,fontSize=10,tagSize=8,labelH=16){
  const ctx=this.ctx,{x,y,w}=r;
  ctx.font='600 '+fontSize+'px Arial';
  ctx.fillStyle='rgba(9,19,15,.52)';rounded(ctx,x,y,w,labelH,3);ctx.fill();ctx.strokeStyle=a.enemy?'rgba(238,170,146,.7)':a.hero?'rgba(203,217,163,.7)':(a.accent||'rgba(213,180,124,.65)');ctx.lineWidth=.8;ctx.stroke();ctx.fillStyle='rgba(245,239,220,.92)';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+w/2,y+labelH/2,w-8);ctx.textBaseline='alphabetic';
  if(a.location&&(a===this.hover||a===this.target?.actor)){ctx.font='bold '+tagSize+'px Arial';ctx.fillStyle=a.accent||'#ecce84';ctx.fillText(a.tag||'TALK',x+w/2,y-6);ctx.font='600 '+fontSize+'px Arial';}
  if(a.enemy){const hp=this.combatFx?Math.max(0,this.state.combat.hp-(this.combatFx.age>.3?this.combatFx.hit:0)):this.state.combat.hp;ctx.fillStyle='#341c16';ctx.fillRect(x,y+18,w,4);ctx.fillStyle='#d8856c';ctx.fillRect(x,y+18,w*hp/this.state.combat.maxHp,4);}
 }

 drawBubble(a,text){
 const ctx=this.ctx,p=this.screenPoint(a);
 ctx.save();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
 ctx.font='italic 11px Georgia';
 const maxW=Math.min(200,this.width-24);
 const words=String(text).split(' ');let line='',lines=[];
 for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxW-14&&line){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);lines=lines.slice(0,3);
 const w=Math.min(maxW,Math.max(...lines.map(s=>ctx.measureText(s).width))+14);
 const h=8+lines.length*13;
 let x=clamp(p.x-w/2,8,this.width-w-8),y=clamp(p.y-(a.dog?36:72)*this.scale-h-8,44,this.height-h-64);
 if(y>this.height-64){ctx.restore();return;}
 ctx.fillStyle='rgba(238,224,181,.82)';rounded(ctx,x,y,w,h,4);ctx.fill();
 ctx.beginPath();ctx.moveTo(clamp(p.x,x+6,x+w-6)-5,y+h);ctx.lineTo(clamp(p.x,x+6,x+w-6),y+h+6);ctx.lineTo(clamp(p.x,x+6,x+w-6)+5,y+h);ctx.fill();
 ctx.fillStyle='#29301c';ctx.textAlign='center';ctx.textBaseline='top';
 lines.forEach((s,i)=>ctx.fillText(s,x+w/2,y+4+i*13,w-10));
 ctx.textBaseline='alphabetic';ctx.restore();
}
 drawCombatFx(){
 const ctx=this.ctx,f=this.combatFx,a=this.player,b=this.enemy;
 if(f.id==='attack'&&f.age>.10&&f.age<.26){ctx.strokeStyle='#ffe4a4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x+18,a.y-58);ctx.lineTo(b.x,b.y-50);ctx.stroke();ctx.fillStyle='#fff4ba';ctx.beginPath();ctx.arc(a.x+18,a.y-58,5+Math.sin(f.age*100)*2,0,Math.PI*2);ctx.fill();}
 ctx.font='bold 22px Georgia';ctx.textAlign='center';
 if(f.id==='attack'&&f.age>.27&&f.age<.8){ctx.fillStyle=f.hit>0?'#f4bb86':'#ebe2c9';ctx.fillText(f.hit>0?'−'+f.hit:'MISS',b.x,b.y-140-f.age*20);}
 if(f.age>.82&&f.hurt>0){ctx.fillStyle='#f59984';ctx.fillText('−'+f.hurt,a.x,a.y-124-(f.age-.8)*25);}
 if(f.id==='combatmed'&&f.age<.65){ctx.fillStyle='#c4e69d';ctx.fillText('+16',a.x,a.y-125-f.age*25);}
 if(f.id==='aim'&&f.age<.65){ctx.strokeStyle='#eddb91';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y-55,27,0,Math.PI*2);ctx.stroke();}
 }
 drawMinimap(){if(this.lowQuality&&this._miniSkip){this._miniSkip=false;return;}this._miniSkip=!!this.lowQuality;const c=this.mctx,w=this.mini.width,h=this.mini.height;c.setTransform(1,0,0,1,0,0);if(this.minimapGround){c.globalAlpha=.75;c.drawImage(this.minimapGround,0,0);c.globalAlpha=1;}else{c.clearRect(0,0,w,h);c.globalAlpha=.75;c.drawImage(this.background,0,0,w,h);c.globalAlpha=1;}const sx=w/WORLD_W,sy=h/WORLD_H;for(const a of this.actors){if(!a.location)continue;c.fillStyle='#e3c77e';c.fillRect(a.x*sx-1.5,a.y*sy-1.5,3,3);}c.fillStyle='#e6f4bb';c.beginPath();c.arc(this.player.x*sx,this.player.y*sy,3,0,Math.PI*2);c.fill();c.strokeStyle='#d9d5a677';c.lineWidth=1;c.strokeRect((this.camera.x-this.width/this.scale/2)*sx,(this.camera.y-this.height/this.scale/2)*sy,this.width/this.scale*sx,this.height/this.scale*sy);}
 destroy(){
 if(this.destroyed)return;memories.set(this.memoryKey||this.id,{x:this.player.x,y:this.player.y,direction:this.player.direction,camera:{...this.camera}});this.destroyed=true;clearTimeout(this.combatTimer);clearTimeout(this.headingTimer);this.combatTimer=null;this.combatFx=null;this.stop();this.listeners.forEach(off=>off());this.resizeObserver?.disconnect();this.intersection?.disconnect();this.keys.clear();this.pointers.clear();
 }
}
export function mountWorld(root,state,callbacks){if(!root?.querySelector?.('.actors-layer')?.getContext)return null;return new IsometricWorld(root,state,callbacks);}
