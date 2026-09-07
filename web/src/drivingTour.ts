import type { DriveResolver, DriveState } from './drivingPhysics';

export type CarTourRoute={id:string;name:string;description:string;points:readonly (readonly [number,number])[]};
export type CarTourStatus='playing'|'paused'|'blocked'|'complete';

/** Distance-based road route. Geometry uses local metres, speed is metres/second. */
export class DrivingTour {
  readonly cumulative:number[]=[0];
  readonly length:number;
  distance=0;
  status:CarTourStatus='playing';
  readonly route:CarTourRoute;
  constructor(route:CarTourRoute){
    this.route=route;
    if(route.points.length<2)throw new Error('A driving tour needs at least two road points');
    for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(!Number.isFinite(length)||length<=0)throw new Error('Invalid driving tour segment');
      this.cumulative.push(this.cumulative[i-1]+length);
    }
    this.length=this.cumulative.at(-1)!;
  }
  point(distance:number){
    const d=Math.max(0,Math.min(this.length,distance));
    let low=0,high=this.cumulative.length-1;
    while(low+1<high){const mid=(low+high)>>1;if(this.cumulative[mid]<=d)low=mid;else high=mid;}
    const a=this.route.points[low],b=this.route.points[low+1];
    const t=(d-this.cumulative[low])/(this.cumulative[low+1]-this.cumulative[low]);
    return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t};
  }
  pose(distance:number){
    const p=this.point(distance),a=this.point(Math.max(0,distance-2)),b=this.point(Math.min(this.length,distance+4));
    return {...p,yaw:Math.atan2(-(b.x-a.x),-(b.z-a.z))};
  }
  pause(state:DriveState){if(this.status==='complete')return;this.status='paused';state.speed=0;}
  resume(){if(this.status!=='complete')this.status='playing';}
  update(state:DriveState,dt:number,rate:number,resolve:DriveResolver){
    if(this.status!=='playing'){state.speed=0;return;}
    let remaining=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.1));
    const target=8*Math.max(.5,Math.min(2,Number.isFinite(rate)?rate:1));
    while(remaining>1e-8){
      const h=Math.min(remaining,1/60);remaining-=h;
      // Ease off for bends and the destination, with gradual acceleration.
      const ahead=this.pose(this.distance+12),here=this.pose(this.distance);
      const turn=Math.abs(Math.atan2(Math.sin(ahead.yaw-here.yaw),Math.cos(ahead.yaw-here.yaw)));
      const desired=Math.min(target/(1+turn*2.5),Math.sqrt(5*Math.max(0,this.length-this.distance)));
      const speed=state.speed+Math.max(-5*h,Math.min(2.5*h,desired-state.speed));
      const nextDistance=Math.min(this.length,this.distance+Math.max(.05,speed)*h);
      const pose=this.pose(nextDistance),next={...state,...pose,speed,distance:state.distance+nextDistance-this.distance};
      const result=resolve(state,next);
      if(result.blocked){state.speed=0;this.status='blocked';return;}
      Object.assign(state,next,{x:result.x,y:result.y,z:result.z,steer:0});
      this.distance=nextDistance;
      if(this.distance>=this.length-.01){this.status='complete';state.speed=0;return;}
    }
  }
}
