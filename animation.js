// Pose calculations use travelled distance, never wall-clock animation timers.
export function idleAtlasFor(walkAtlas){
 if(!walkAtlas)return null;
 const map={
  'pukie-walk':'pukie-idle',
  'uygar-walk':'uygar-idle',
  'uygar-rain-walk':'uygar-rain-idle',
  'berkay-walk':'berkay-idle',
  'berkay-hat-walk':'berkay-hat-idle',
  'berkay-hat-glasses-walk':'berkay-hat-glasses-idle',
  'berkay-rain-walk':'berkay-rain-idle',
  'berkay-rain-hat-walk':'berkay-rain-hat-idle',
  // berkay-rain-hat-glasses-walk is byte-identical to berkay-hat-glasses-walk, so it shares that standing sheet.
  'berkay-rain-hat-glasses-walk':'berkay-hat-glasses-idle',
  'berkay-rain-hood-walk':'berkay-rain-hood-idle',
  // v5.0.9b: town NPCs have dedicated two-feet-down standing sheets (one cell per row, all columns share it).
  'npc-walk':'npc-idle',
  'npc-workers':'npc-workers-idle'
 };
 return map[walkAtlas]||null;
}
// v5.0.9b: extra pixel-locked gesture cells appended as row 4 of the brothers' standing sheets.
const GESTURES={
 'uygar-idle':{satchel:16},'uygar-rain-idle':{satchel:16},
 'berkay-idle':{holdup:16,hug:17},'berkay-hat-idle':{holdup:16,hug:17},'berkay-hat-glasses-idle':{holdup:16,hug:17},
 'berkay-rain-idle':{holdup:16,hug:17},'berkay-rain-hat-idle':{holdup:16,hug:17},'berkay-rain-hood-idle':{holdup:16,hug:17}
};
export function gestureFrame(walkAtlas,name){const idle=idleAtlasFor(walkAtlas);return idle&&GESTURES[idle]?GESTURES[idle][name]??null:null;}
export function idleSeed(actor){
 const s=String(actor.id||actor.name||'x')+','+String(actor.person||actor.sprite||'');
 let h=2166136261;
 for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
 return (h>>>0)/4294967296;
}
export function ensureIdle(actor){
 if(!actor.idle){
  const seed=idleSeed(actor);
  actor.idle={col:0,mode:'stand',t:0,next:2+seed*2,glanceDir:null,plantedFor:0,roam:null,seed,clock:seed*3.4,bounce:0,bob:0,nextWag:1.2+seed*1.2,nextSniff:2.8+seed*2.2,sitAfter:6+seed*2.5,nextRoam:10+seed*5,perkT:0};
 }
 return actor.idle;
}
export function resetIdle(actor){
 const idle=ensureIdle(actor);
 idle.col=0;idle.mode='stand';idle.t=0;idle.glanceDir=null;idle.plantedFor=0;idle.bounce=0;idle.bob=0;idle.perkT=0;idle.special=null;idle.specialMirror=false;idle.shift=0;
 idle.next=2+(idle.seed||0)*2;idle.nextWag=1.2+(idle.seed||0)*1.2;idle.nextSniff=2.8+(idle.seed||0)*2.2;idle.nextRoam=10+(idle.seed||0)*5;
 if(idle.roam)idle.roam=null;
}
// Breathing: torso-only rise of at most 1.2%, applied above the hip line in world.js (legs never stretch).
export function breathScale(time,seed){
 return 1+0.006*(1+Math.sin((time+(seed||0)*3.4)*2*Math.PI/3.8));
}
export function stepIdle(actor,dt,opts={}){
 const reduced=!!opts.reduced;
 const idle=ensureIdle(actor);
 const planted=!!(actor.planted??(!actor.moving||(actor.velocity||0)<8));
 idle.clock=(idle.clock||0)+dt;
 idle.bounce=0;idle.bob=0;idle.shimmy=0;
 if(!planted){resetIdle(actor);return idle;}
 // v5.0.9b: world-driven quirks (Berkay's hold-up / hug) own the pose while they run.
 if(idle.mode==='quirk'){idle.plantedFor+=dt;return idle;}
 idle.plantedFor+=dt;
 idle.t+=dt;
 if(reduced){idle.col=idleAtlasFor(actor.atlas)?0:NPC_STAND_COL;idle.mode='stand';idle.glanceDir=null;idle.special=null;idle.shift=0;return idle;}
 if(actor.dog)return stepDogIdle(actor,dt,opts,idle);
 if(actor.hero||actor.party)return stepHumanIdle(actor,dt,idle,!!idleAtlasFor(actor.atlas));
 return stepNpcIdle(actor,dt,idle);
}
function stepHumanIdle(actor,dt,idle,hasSheet){
 const hold=()=>1.8+Math.random()*.8,cadence=()=>2.8+Math.random()*2.4;
 if(!hasSheet){
  idle.col=NPC_STAND_COL;
  if(idle.mode==='stand'){
   idle.glanceDir=null;
   if(idle.t>=idle.next){idle.mode='glance';idle.t=0;const dir=actor.direction||0;idle.glanceDir=Math.random()<.5?(dir+1)%4:(dir+3)%4;idle.next=hold();}
  }else if(idle.t>=idle.next){idle.mode='stand';idle.glanceDir=null;idle.t=0;idle.next=cadence();}
  return idle;
 }
 // v5.0.9b: calm random idle life every ~3-7 s, feet never move: turn left/right (row switch), a torso-only weight shift,
 // or a pixel-locked hand gesture (Uygar's satchel strap). Breathing runs underneath all of them.
 idle.col=0;
 const satchel=gestureFrame(actor.atlas,'satchel');
 if(idle.mode==='stand'){
  idle.glanceDir=null;idle.special=null;idle.shift=0;
  if(idle.t>=idle.next){
   idle.t=0;const roll=Math.random();
   if(satchel!=null&&roll<.3){idle.mode='gesture';idle.next=1.6+Math.random()*.8;idle.special=satchel;idle.specialMirror=false;}
   else if(roll<.62){idle.mode='shift';idle.next=2.2+Math.random()*.8;idle.shiftDir=Math.random()<.5?-1:1;}
   else{idle.mode='glance';idle.next=hold();const dir=actor.direction||0;idle.glanceDir=Math.random()<.5?(dir+1)%4:(dir+3)%4;}
  }
 }else{
  if(idle.mode==='shift'){const p=Math.min(1,idle.t/idle.next);idle.shift=Math.sin(p*Math.PI)*(idle.shiftDir||1);}
  if(idle.t>=idle.next){idle.mode='stand';idle.glanceDir=null;idle.special=null;idle.shift=0;idle.t=0;idle.next=3+Math.random()*4;}
 }
 return idle;
}
// NPC sheets have no standing art; column 1 is the passing pose (feet closest together, both near the ground line).
const NPC_STAND_COL=1;
function stepNpcIdle(actor,dt,idle){
 idle.col=NPC_STAND_COL;
 if(idle.mode==='stand'){
  idle.glanceDir=null;
  if(idle.t>=idle.next){idle.mode='glance';idle.t=0;const dir=actor.direction||0;idle.glanceDir=Math.random()<.5?(dir+1)%4:(dir+3)%4;idle.next=1.8+Math.random()*.8;}
 }else if(idle.t>=idle.next){idle.mode='stand';idle.glanceDir=null;idle.t=0;idle.next=4+Math.random()*5;}
 return idle;
}
function stepDogIdle(actor,dt,opts,idle){
 // v5.0.9b: Pukie never moves as a whole while planted. A wag flips between two tail-only cells (paws pixel-identical),
 // a sniff holds the head-dip cell. No shimmy, no bounce.
 const roam=idle.roam;
 idle.col=0;idle.shimmy=0;
 if(roam&&(roam.stage==='go'||roam.stage==='back'))return idle;
 const wag=t=>{idle.col=1+(Math.floor(t*9)%2);};
 if(roam&&(roam.stage==='sniff'||roam.stage==='wag')){if(roam.stage==='wag')wag(idle.t);else idle.col=3;return idle;}
 if(idle.mode==='wag'){
  wag(idle.t);
  if(idle.t>=1.5){idle.mode='stand';idle.t=0;idle.col=0;idle.nextWag=3+Math.random()*4;}
  return idle;
 }
 if(idle.mode==='sniff'){
  idle.col=3;
  if(idle.t>=idle.next){idle.mode='stand';idle.t=0;idle.col=0;idle.nextSniff=4+Math.random()*3.5;}
  return idle;
 }
 if(idle.mode==='sit'){idle.mode='stand';idle.t=0;}
 idle.nextWag=(idle.nextWag??2.5)-dt;
 idle.nextSniff=(idle.nextSniff??5)-dt;
 if(idle.nextWag<=0){idle.mode='wag';idle.t=0;wag(0);return idle;}
 if(idle.nextSniff<=0){idle.mode='sniff';idle.t=0;idle.col=3;idle.next=1.6+Math.random()*1.2;return idle;}
 return idle;
}
export function gaitPose(actor,reduced=false){
 const cycle=(((actor.phase||0)%4)+4)%4/4;
 const speed=actor.velocity||0;
 const planted=actor.planted??(!actor.moving||speed<8);
 const idle=actor.idle;
 if(planted){
  const hasSheet=!!idleAtlasFor(actor.atlas);
  const frame=hasSheet?(idle?.col??0):(idle?.col??NPC_STAND_COL);
  return {frame,cycle,lift:0,sway:0,lean:0,planted:true,idle:true,bounce:0,bob:0,special:idle?.special??null,mirror:!!idle?.specialMirror,shift:reduced?0:(idle?.shift||0),breath:(reduced||actor.dog)?1:breathScale(idle?.clock||0,idle?.seed||0)};
 }
 // v5.0.9: no body rotation while walking (it tilted the whole sprite incl. feet, so planted feet skated);
 // a small vertical lift at the passing position and a gentle lateral weight shift remain.
 const lift=reduced?0:Math.abs(Math.sin(cycle*2*Math.PI))*(actor.dog?.25:.7);
 const sway=reduced?0:Math.sin(cycle*2*Math.PI)*(actor.dog?.25:.6);
 const lean=0;
 return {frame:Math.floor(cycle*4)%4,cycle,lift,sway,lean,planted:false,bounce:0,bob:0,breath:1};
}
export function spritePose(frame,stature){
 // refH (standing sheets) keeps the pixel-locked upper body at walk scale; the standing height is b.h*scale.
 const b=frame.bounds||{x:0,y:0,w:frame.w,h:frame.h},scale=stature/(frame.refH||b.h);
 const anchors=frame.anchors||{crown:{x:b.w/2,y:2},face:{x:b.w/2,y:b.h*.12},hip:{x:b.w/2,y:b.h*.54},hand:{x:b.w*.7,y:b.h*.55},headWidth:b.w*.3};
 const point=p=>({x:(p.x-b.w/2)*scale,y:(p.y-b.h)*scale});
 return {source:{x:frame.x+b.x,y:frame.y+b.y,w:b.w,h:b.h},width:b.w*scale,height:b.h*scale,scale,crown:point(anchors.crown),face:point(anchors.face),hip:point(anchors.hip),hand:point(anchors.hand),headWidth:anchors.headWidth*scale};
}
export function boneAffine(a,b,A,B){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ex=B.x-A.x,ey=B.y-A.y,next=Math.hypot(ex,ey)||1;
 const ux=dx/len,uy=dy/len,vx=ex/next,vy=ey/next,s=next/len;
 const m11=vx*s*ux+vy*uy,m12=vy*s*ux-vx*uy,m21=vx*s*uy-vy*ux,m22=vy*s*uy+vx*ux;
 return [m11,m12,m21,m22,A.x-m11*a.x-m21*a.y,A.y-m12*a.x-m22*a.y];
}
export function kneeFor(hip,foot,upper,lower,bend=1){
 const dx=foot.x-hip.x,dy=foot.y-hip.y,d=Math.max(.01,Math.min(Math.hypot(dx,dy),upper+lower-.01)),raw=Math.hypot(dx,dy)||1,ux=dx/raw,uy=dy/raw;
 const along=(upper*upper-lower*lower+d*d)/(2*d),side=Math.sqrt(Math.max(0,upper*upper-along*along))*bend;
 return {x:hip.x+ux*along-uy*side,y:hip.y+uy*along+ux*side};
}
export function footTargets(actor,cycle,hip,lift=0){
 const diagonal=[[.85,.42],[-.85,.42],[-.85,-.42],[.85,-.42]][actor.direction||0],len=Math.hypot(...diagonal);
 const forward=actor.heading?[actor.heading.x,actor.heading.y]:diagonal.map(v=>v/len);
 return [0,1].map(i=>{
 const p=(cycle+i*.5)%1,stance=.58,stride=60*stance;
 let along=0,up=0;if(actor.moving){if(p<stance)along=(.5-p/stance)*stride;else{const t=(p-stance)/(1-stance);along=(t-.5)*stride;up=Math.sin(t*Math.PI)*6;}}
 return {x:hip.x+(i===0?6:-6)+forward[0]*along,y:(i===0?1:-2)+forward[1]*along-up+lift};
 });
}
