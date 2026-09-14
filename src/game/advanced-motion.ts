import type { AdvancedMechanismConfig, JetNozzleConfig } from './advanced-types'

const smooth=(value:number)=>value*value*(3-2*value)
function cycleTime(time:number,stages:readonly number[]) {
  const cycle=stages.reduce((sum,value)=>sum+value,0)
  if(!Number.isFinite(time)||!stages.length||stages.some(value=>!Number.isFinite(value)||value<=0)||cycle<=0)throw new Error('高级机关阶段时长必须为正数')
  const phase=time%cycle
  return phase<0?(phase+cycle)%cycle:phase
}

export function radialWeight(radius:number,coreRadius:number,outerRadius:number) {
  if(![radius,coreRadius,outerRadius].every(Number.isFinite)||coreRadius<0||outerRadius<=coreRadius)throw new Error('机关作用半径无效')
  if(radius<=coreRadius)return 1
  if(radius>=outerRadius)return 0
  return 1-smooth((radius-coreRadius)/(outerRadius-coreRadius))
}

export function springImpulse(currentOutwardSpeed:number,mass:number,storedEnergyJ:number,speedCeiling:number,weight:number) {
  if(![currentOutwardSpeed,mass,storedEnergyJ,speedCeiling,weight].every(Number.isFinite)||mass<=0||storedEnergyJ<0||speedCeiling<=0)return 0
  const outward=Math.max(0,currentOutwardSpeed),energy=Math.min(storedEnergyJ*Math.max(0,Math.min(1,weight)),Math.max(0,mass*(speedCeiling*speedCeiling-outward*outward)/2))
  return Math.max(0,mass*(Math.sqrt(outward*outward+2*energy/mass)-outward))
}

export function jetIntensity(time:number,nozzle:JetNozzleConfig) {
  const stages=nozzle.stages??[1.6,.7,.45,.25]
  let phase=cycleTime(time,stages)
  if(phase<stages[0])return {intensity:0,warning:false}
  if((phase-=stages[0])<stages[1])return {intensity:0,warning:true}
  if((phase-=stages[1])<stages[2])return {intensity:1,warning:false}
  phase-=stages[2]
  return {intensity:1-smooth(phase/stages[3]),warning:false}
}

export function conveyorSpeed(time:number,config:Extract<AdvancedMechanismConfig,{kind:'reversing-conveyor'}>) {
  const stages=[config.holdEachDirectionSeconds,config.reverseDecelSeconds,config.zeroHoldSeconds,config.reverseAccelSeconds,config.holdEachDirectionSeconds,config.reverseDecelSeconds,config.zeroHoldSeconds,config.reverseAccelSeconds]
  let phase=cycleTime(time,stages),index=0
  while(phase>=stages[index]!){phase-=stages[index]!;index++}
  const t=phase/stages[index]!,speed=config.targetTreadSpeed
  if(index===0)return speed
  if(index===1)return speed*(1-smooth(t))
  if(index===2||index===6)return 0
  if(index===3)return -speed*smooth(t)
  if(index===4)return -speed
  if(index===5)return -speed*(1-smooth(t))
  return speed*smooth(t)
}

export function orbitalPose(time:number,config:Extract<AdvancedMechanismConfig,{kind:'orbital-catcher'}>) {
  const travel=config.period/4,stages=[travel,config.brakingSeconds,config.settleHoldSeconds,config.dockHoldSeconds,travel,config.brakingSeconds,config.settleHoldSeconds,config.dockHoldSeconds]
  let phase=cycleTime(time,stages),index=0
  while(phase>=stages[index]!){phase-=stages[index]!;index++}
  let progress:number
  if(index===0)progress=.9*phase/stages[index]!
  else if(index===1)progress=.9+.1*smooth(phase/stages[index]!)
  else if(index<=3)progress=1
  else if(index===4)progress=1-.9*phase/stages[index]!
  else if(index===5)progress=.1*(1-smooth(phase/stages[index]!))
  else progress=0
  const angle=config.dockAngleDegrees*Math.PI/180*progress
  return {offset:[config.orbitAmplitude[0]*Math.sin(angle),config.orbitAmplitude[1]*Math.sin(angle),config.orbitAmplitude[2]*(1-Math.cos(angle))] as [number,number,number],progress,docked:index>=2&&index<=3}
}

export function cascadeState(time:number,triggerTime:number|undefined,index:number,config:Extract<AdvancedMechanismConfig,{kind:'cascade-bridge'}>) {
  if(triggerTime===undefined)return {warning:false,released:false}
  const release=triggerTime+config.firstReleaseDelay+config.releaseInterval*index
  return {warning:time>=release-config.visibleWarningBeforeEachRelease&&time<release,released:time>=release}
}
