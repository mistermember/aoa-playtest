import {LOCATIONS} from './content.js';
// Weather is deterministic from settlement + region, independent of combat RNG and wall-clock time.
export const WEATHER={
 clear:{name:'Clear skies',speed:1,accuracy:0,description:'Dry paving and open sightlines.'},
 rain:{name:'Rain',speed:.86,accuracy:-2,description:'Wet paving slows footsteps. Exposed crossings cost 1 health without a raincoat; Pukie gains 1 stress while following.'},
 fog:{name:'River fog',speed:.92,accuracy:-4,description:'Mist softens sightlines. Outdoor combat accuracy falls by 4 percentage points.'},
 dust:{name:'Dust wind',speed:.8,accuracy:-6,description:'Windblown dust slows footsteps and reduces outdoor combat accuracy by 6 points. Pukie gains 1 stress on exposed crossings.'}
};
const cycle=['clear','rain','fog','dust'];
const offset={'The Fringe':0,'The Interior':1,'The Delta':1,'The Gardens':2,'The Core':0};
const indoors=new Set(['office','clinic','bank','directorate','ward','clearing','archive','antechamber']);
export function regionalWeather(s,location=s.location){
 const region=LOCATIONS[location].region;
 if(region==='The Core')return 'clear';
 return cycle[(Math.floor(s.turn/6)+offset[region])%4];
}
export function weatherAt(s,location=s.location){
 const kind=regionalWeather(s,location),base=WEATHER[kind],exposed=!indoors.has(location);
 return {kind,name:exposed?base.name:`Sheltered · ${base.name.toLowerCase()} outside`,exposed,speed:exposed?base.speed:1,accuracy:exposed?base.accuracy:0,description:exposed?base.description:'Covered interiors protect the group from weather. Outdoor conditions still affect the district.'};
}
export function hoodRaised(s,id){
 if(s?.gear?.[id]?.outfit!=='rain')return false;
 // Waiting companions are always under cover, even if the selected brother is outdoors elsewhere.
 if(id!==s.lead&&s.party?.mode==='wait')return false;
 const w=weatherAt(s);return w.exposed&&w.kind==='rain';
}
export function weatherTravel(s,destination){
 const w=weatherAt(s,destination),crossing=LOCATIONS[s.location].region!==LOCATIONS[destination].region;
 return { ...w,health:crossing&&w.exposed&&w.kind==='rain'&&s.gear?.[s.lead]?.outfit!=='rain'?1:0,stress:crossing&&w.exposed&&['rain','dust'].includes(w.kind)&&s.party.mode==='follow'?1:0};
}
export function weatherNotice(s){
 const w=weatherAt(s);
 if(!w.exposed)return 'The covered entrance keeps the rain and dust off the group.';
 if(w.kind==='rain')return 'Rain rattles on patched awnings. '+(s.gear?.berkay?.outfit==='rain'&&(s.lead==='berkay'||s.party.mode==='follow')?'Berkay zips his thin shell and raises the hood; the mini-brush remains at the corner of his mouth. ':'')+(s.party.mode==='follow'?'Your brother keeps Pukie close to the dry edge of the paving.':'Your brother and Pukie remain sheltered at their waiting point.');
 if(w.kind==='fog')return 'Fog wraps the district. Workers call to one another across the paving; '+(s.party.mode==='follow'?'Pukie stays close to your brother’s boots.':'the sheltered pair wait for your return.');
 if(w.kind==='dust')return 'Dust runs in ribbons between the buildings. Porters cover their crates; '+(s.party.mode==='follow'?'your brother shields Pukie from the gusts.':'your brother keeps Pukie under cover.');
 return 'The weather has cleared. Coats loosen, market stalls reopen and the group can see the road ahead.';
}
