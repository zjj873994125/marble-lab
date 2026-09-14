import advancedTrial from '../levels/advanced-trial'
import { cascadeState, conveyorSpeed, jetIntensity, orbitalPose } from './advanced-motion'
import type { AdvancedKind, AdvancedMechanismConfig } from './advanced-types'
import type { AdvancedLibraryInstance } from './advanced-library'

export function previewAdvancedConfig(kind:AdvancedKind):AdvancedMechanismConfig {
  const config=advancedTrial.advancedMechanisms?.find(item=>item.kind===kind)
  if(!config)throw new Error(`试验场缺少高级机关：${kind}`)
  return {...config,id:`preview-${kind}`,position:[0,0,0],yaw:0,phaseSeconds:0}
}

export function updateAdvancedPreview(instance:AdvancedLibraryInstance,config:AdvancedMechanismConfig,time:number) {
  if(config.kind==='spring-trampoline'){
    const compression=Math.max(0,Math.sin(time*2.4))*Math.exp(-(time%2.6)*1.3)*.1
    instance.part('SpringTrampoline_Deck').setLocalPosition(config.deck.position[0],config.deck.position[1]-compression,config.deck.position[2])
  }else if(config.kind==='pulse-jet'){
    const active=config.nozzles.some(nozzle=>jetIntensity(time,nozzle).intensity>0),warning=config.nozzles.some(nozzle=>jetIntensity(time,nozzle).warning)
    instance.part('PulseJet_Flow').enabled=active;instance.part('PulseJet_Valve').setLocalEulerAngles(0,0,warning?18:active?32:0)
  }else if(config.kind==='orbital-catcher'){
    instance.part('OrbitalCatcher_Carriage').setLocalPosition(...orbitalPose(time,config).offset)
  }else if(config.kind==='reversing-conveyor'){
    const speed=conveyorSpeed(time,config),angle=time*speed/.35*180/Math.PI
    instance.part('ReversingConveyor_DrumA').setLocalEulerAngles(angle,0,0);instance.part('ReversingConveyor_DrumB').setLocalEulerAngles(angle,0,0);instance.part('ReversingConveyor_Direction').setLocalEulerAngles(0,speed<0?180:0,0)
  }else if(config.kind==='gimbal-platform'){
    const outer=config.restAnglesDegrees[0]+Math.sin(time*.8)*config.limitsDegrees[0]*.45,inner=Math.sin(time*1.1)*config.limitsDegrees[1]*.7
    instance.part('GimbalPlatform_OuterFrame').setLocalEulerAngles(outer,0,0);instance.part('GimbalPlatform_OuterFrame/GimbalPlatform_InnerDeck').setLocalEulerAngles(0,0,inner)
  }else if(config.kind==='cascade-bridge'){
    for(let index=0;index<config.tiles.length;index++){
      const state=cascadeState(time,1,index,config),elapsed=Math.max(0,time-(1+config.firstReleaseDelay+config.releaseInterval*index)),tile=instance.part(`CascadeBridge_Tile${String(index+1).padStart(2,'0')}`),lock=instance.part(`CascadeBridge_Lock${String(index+1).padStart(2,'0')}`)
      tile.setLocalPosition(config.tiles[index]!.position[0],config.tiles[index]!.position[1]-(state.released?Math.min(5,8*elapsed*elapsed):0),config.tiles[index]!.position[2]);lock.enabled=!state.released
    }
  }
}
