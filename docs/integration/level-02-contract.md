# 水上冲关 · 最小接入协议

状态：首份数据与资产协议，供 LEVEL/ART 并行准备；行为实现排在当前 UI/钢珠/平端收尾之后，未发“运行时就绪”前只写设计数据，不启用第二关。第一关文件与参数不改。新关卡正式文件建立后原位维护，不建版本副本或备份。

## 关卡与成绩

- 稳定 id=`water-rush`，名称“水上冲关”，编号02；配置为 `src/levels/water-rush.ts`。代码目录将注册第一关与第二关，HUD/运行时/成绩使用同一选中项。
- 继续使用现有 LevelConfig 的 staticObjects、start、checkpoints、checkpointTrigger、finish、fallY、pendulum、platform、progress。一把平端锤和一个横移平台继续用既有字段/资产，不复制第一关文件。
- 第二关规则拟为 `standard`，成绩键 `water-rush/standard`。历史 classic/open-hammer/flat-hammer 均明确归第一关，保留原键、记录及共享设置；第一关成绩不会成为第二关最佳。真实选择/生命周期/存档实现完成后另发就绪通知。
- 当前沿 Z 的 progress 可按路线分段配置；若路线有长横向区段，可在后续实现中给分段加 axis=x/z，第一关默认 z 保持。它仍是分段估计，不宣称精确路程。

## 静态图元与坡面

PrimitiveConfig 新增拟定字段 `rotation?: [x,y,z]`，单位度，按 PlayCanvas `setEulerAngles` 解释；未填为零。body=static 的盒体与基础显示一起旋转，真实碰撞不是水平代理。

上坡用旋转盒体表达：size 为坡自身局部的完整宽/厚/长度，position 为盒体中心，rotation=[正坡角,0,0] 表示向 -Z 上坡。设计需按旋转后的顶面算足/顶接缝，不能只对齐盒中心。例：局部顶面端点 `[0,h/2,±L/2]` 经旋转再加 position，得到真实接驳位置。

保留现有力12、重力16、水平限速7及球体摩擦。坡角大于约 atan(12/16)=36.87° 才可能在理想受力上出现低速难上，但撞坡损耗、滚动惯量与接缝必须实测。建议先准备约40–45°的短坡、足够助跑和坡顶制动岛；这些是候选，不是已经验证可通关的参数。

## 大转盘（最多一座）

拟定可选 `turntable`：

```ts
turntable: {
  body: { name: 'Turntable', type: 'cylinder', position: [x,y,z], size: [diameter,thickness,diameter], material: 'cream' },
  angularSpeed: 0.5, // 弧度/秒，示意值
  phase: 0,         // 弧度
  barrier: { name: 'Turntable barrier', type: 'box', position: [localX,localY,localZ], size: [w,h,d], material: 'orange' },
  visual: 'water-rush-turntable.glb'
}
```

body 由代码设为 Y 轴圆柱运动学代理；yaw=phase+angularSpeed*t。barrier 可省略，最多一根，position 是相对盘心局部偏移，尺寸为实际米制，可附局部 rotation。代码用独立运动学盒体同步其世界位置/姿态，不把弹珠绑定到盘，也不只转纹理。转盘真实摩擦/挡杆接触作用必须验收。

**资源为一份** `water-rush-turntable.glb`，根节点 `TurntableVisual`，原点盘体中心，Y-up；包括盘外观和冻结配置中那一根挡杆。转盘 GLB 整体按 yaw 旋转；独立挡杆碰撞由代码同步，加载成功隐藏对应基础图元。不能在没有 barrier 配置时烘焙看似有碰撞的挡杆。盘面必须闭合，不能把装饰缺口盖在整圆代理上。

## 四块交替升降板

拟定可选 `lifts` 数组，每项如下：

```ts
{ body: { name: 'Lift 1', type: 'box', position: [x,baseY,z], size: [w,h,d], material: 'blue' },
  amplitude: 0.5, angularSpeed: 1, phase: 0, visual: 'water-rush-lift.glb' }
```

body 由代码设为运动学盒体。Y=baseY+amplitude*sin(angularSpeed*t+phase)，X/Z固定；phase 为弧度，奇偶可用0/π。基准Y是盒中心，不是表面。每块独立相位，重开统一 t=0，暂停不推进。靠原接触承托，不传送、不粘球。

四板优先同尺寸，共用一个 `water-rush-lift.glb` / `LiftVisual`，局部原点盒中心、米制Y-up，运行时建立四个独立实例；材质/基础几何可共用，资源只加载/释放一次。高度范围、相邻接缝及两组等高窗口由LEVEL列出并实测，不以球直径推定必定能过。

## 静态资源与唯一来源

- `water-rush-track.glb` 根节点沿用 **TrackStatic**，原点世界 `[0,0,0]`，尺寸和坡角烘焙到相同世界位置；不另起 WaterRushTrack 运行时查找约定。
- 静态 GLB 包含固定岛、坡面、支架与真正静态的栏/标识；不烘焙转盘、升降板、横移台、锤头/柄、水池、检查点圆环或配置警示线。
- 第一关当前平端锤/柄及 platform-refined.glb 直接引用。水池使用现有 water/poolEdge/dark 配置图元；需覆盖第二关和动态扫掠，不能改第一关池体。
- 动态模型保持真实米制尺寸，代码抵消基础图元父比例；动件原点均为对应刚体中心。几何发生尺寸修改时同步代理与同一资源，不用缩放显示掩盖错配。
- 各资源失败时使用该机关的基础显示与真实碰撞继续游戏；具体加载/卸载和多实例测试随运行时能力交付。

以上参数结构已给设计/美术准备使用；类型、行为、两关切换与成绩实现就绪后，CODE再发明确启用消息。当前准备稿不等于可选或可玩第二关。
