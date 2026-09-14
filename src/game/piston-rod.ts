import * as pc from 'playcanvas'

type AmmoVector = { setValue:(x:number,y:number,z:number)=>void }
type AmmoModule = { btVector3:new(x:number,y:number,z:number)=>AmmoVector; destroy:(value:AmmoVector)=>void }

// 一个持久圆柱shape沿局部Z伸缩；实体旋转将它对齐库的+X轴。
export function createPistonRodMotion(app:pc.Application,entity:pc.Entity,referenceLength:number) {
  const rigid=entity.rigidbody!
  const shape=entity.collision!.shape as { setLocalScaling:(scale:AmmoVector)=>void }
  const native=rigid.body as { getWorldTransform:()=>unknown; setInterpolationWorldTransform?:(transform:unknown)=>void }
  const world=app.systems.rigidbody!.physicsWorld!.nativeWorld as { updateSingleAabb:(body:unknown)=>void }
  const cached:{module?:AmmoModule}={}
  // createGame已等待Ammo；取缓存实例，不创建第二个物理模块。
  pc.WasmModule.getInstance('Ammo',instance=>{cached.module=instance as AmmoModule})
  const module=cached.module
  if(!module||typeof shape.setLocalScaling!=='function'||typeof world.updateSingleAabb!=='function')throw new Error('当前物理后端不支持推杆形状伸缩')
  const scale=new module.btVector3(1,1,1)
  let lastLength=referenceLength,disposed=false
  return {
    sync(length:number,position:pc.Vec3,rotation:pc.Quat,reset=false) {
      if(disposed)return
      const ratio=length/referenceLength
      if(length!==lastLength) {
        scale.setValue(1,1,ratio)
        shape.setLocalScaling(scale)
        lastLength=length
      }
      entity.setLocalScale(1,1,ratio)
      if(reset){rigid.teleport(position,rotation);native.setInterpolationWorldTransform?.(native.getWorldTransform())}
      else {entity.setPosition(position);entity.setRotation(rotation)}
      // 形状缩短也刷新宽相包围盒，不能保留整段伸出时的碰撞范围。
      world.updateSingleAabb(native)
    },
    destroy(){if(disposed)return;disposed=true;module.destroy(scale)},
  }
}
