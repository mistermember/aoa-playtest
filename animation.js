// Pose calculations use travelled distance, never wall-clock animation timers.
export function gaitPose(actor,reduced=false){
 const cycle=(((actor.phase||0)%4)+4)%4/4;
 const frame=!actor.moving?0:Math.floor(cycle*4)%4;
 const lift=actor.moving&&!reduced?(actor.dog?.55:.85)*(1-Math.cos(cycle*4*Math.PI))*.5:0;
 return {frame,cycle,lift,sway:actor.moving&&!reduced?Math.sin(cycle*2*Math.PI)*.008:0};
}
export function spritePose(frame,stature){
 const b=frame.bounds||{x:0,y:0,w:frame.w,h:frame.h},scale=stature/b.h;
 const anchors=frame.anchors||{crown:{x:b.w/2,y:2},face:{x:b.w/2,y:b.h*.12},hip:{x:b.w/2,y:b.h*.54},hand:{x:b.w*.7,y:b.h*.55},headWidth:b.w*.3};
 const point=p=>({x:(p.x-b.w/2)*scale,y:(p.y-b.h)*scale});
 return {source:{x:frame.x+b.x,y:frame.y+b.y,w:b.w,h:b.h},width:b.w*scale,height:stature,crown:point(anchors.crown),face:point(anchors.face),hip:point(anchors.hip),hand:point(anchors.hand),headWidth:anchors.headWidth*scale};
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
