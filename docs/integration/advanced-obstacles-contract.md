# 高级八机关运行与资源协议

2026-09-14。本协议用于 `advanced-trial` “高阶机关试验场”。CODE 维护类型、状态机、物理与加载；LEVEL 只填写 `advancedMechanisms` 实例、静态接驳、CP/gate/路线；ART 维护单一共享库和测试场静态模型。

## 统一坐标与代理

全部实例使用米制、PlayCanvas/glTF +Y 向上，局部 `-Z` 为前进、`+X` 为右侧。`position/yaw/phaseSeconds` 作用于整组。碰撞代理的 position/rotation/size 是组局部完整尺寸，与旧关一样由 CODE 乘根变换创建。

LEVEL 配置是玩法与碰撞的唯一事实源。manifest 的 `referenceSize/pivot/axis` 用于模型对齐和交付校验，不自动生成隐形碰撞。作用区、预测线、喷流、核心圈和轨迹节点均为 `indicator`，不可作为硬体。

## 共享库

- GLB：`public/models/advanced-obstacle-library.glb`
- manifest：`public/models/advanced-obstacle-library.json`
- Blender：`art/advanced-obstacle-library.blend`
- GLB 顶层必须恰好有 8 个 identity 根，没有灯光、摄像机、刚体或脚本。所有纹理自包含。
- 整包每个 PlayCanvas Application 只加载一次；实例只克隆目标根。卸载先销毁实例/约束，再释放 container。

manifest 固定格式：

```json
{
  "schemaVersion": 1,
  "asset": "advanced-obstacle-library.glb",
  "units": "m",
  "upAxis": "+Y",
  "entries": [{
    "id": "spring-trampoline",
    "rootNode": "SpringTrampoline",
    "rootBounds": { "min": [0,0,0], "max": [0,0,0] },
    "parts": [{
      "nodePath": "SpringTrampoline_Deck",
      "role": "body",
      "motion": "kinematic",
      "pivot": [0,0,0],
      "axis": [0,1,0],
      "referenceSize": [2.4,.3,2.4]
    }]
  }]
}
```

`rootBounds`/`referenceSize` 必须填真实值，不复制示例零值。`nodePath` 相对该机关根，同根下名称唯一。

## 8 根与分件路径

1. `spring-trampoline` / `SpringTrampoline`：`SpringTrampoline_Deck` body/kinematic，`SpringTrampoline_Frame` frame/fixed，`SpringTrampoline_Core` zone/indicator。Deck 原点是台面刚体中心，局部 +Y 是弹射法向。
2. `gravity-coaster` / `GravityCoaster`：`GravityCoaster_Track` body/fixed，`GravityCoaster_Rails` guard/fixed，`GravityCoaster_Supports` frame/fixed。为开放落差与倾斜 90° 弯首版，不建完整环；游戏碰撞由 LEVEL 的细分代理提供。
3. `pulse-jet` / `PulseJet`：`PulseJet_Housing` frame/fixed，`PulseJet_Valve` valve/kinematic，`PulseJet_Flow` zone/indicator。Flow 不碰撞，局部 +X 为默认喷口轴；真实力的 position/axis/range 读 LEVEL nozzle 配置。
4. `orbital-catcher` / `OrbitalCatcher`：`OrbitalCatcher_Carriage/OrbitalCatcher_Bowl` body/kinematic，`OrbitalCatcher_Carriage` carriage/kinematic，`OrbitalCatcher_Rail` frame/fixed，`OrbitalCatcher_Dock` dock/fixed。运行时只驱动 Carriage，Bowl 随父节点；Bowl 凹面不合并成凸包围盒。
5. `reversing-conveyor` / `ReversingConveyor`：`ReversingConveyor_Belt` body/fixed，`ReversingConveyor_Frame` frame/fixed，`ReversingConveyor_DrumA` 与 `ReversingConveyor_DrumB` drum/kinematic，`ReversingConveyor_Direction` indicator/indicator。带面作用只在球与 deck 真实接触时生效。
6. `vortex-funnel` / `VortexFunnel`：`VortexFunnel_Surface` body/fixed，`VortexFunnel_Rails` guard/fixed，`VortexFunnel_CatchDeck` catch/fixed，`VortexFunnel_Supports` frame/fixed。中央孔必须真实开放，不得以整圆凸包或透明板托球。
7. `gimbal-platform` / `GimbalPlatform`：`GimbalPlatform_Base` frame/fixed，`GimbalPlatform_OuterFrame` outer/dynamic，`GimbalPlatform_OuterFrame/GimbalPlatform_InnerDeck` body/dynamic，两轴套分别嵌套在对应父节点下。OuterFrame 绕局部 +X，InnerDeck 绕外框局部 +Z；manifest 分别填两个 pivot/axis，运行时只驱动外框和内板父节点。
8. `cascade-bridge` / `CascadeBridge`：`CascadeBridge_Frame` frame/fixed，`CascadeBridge_Tile01` 至 `CascadeBridge_Tile06` body/dynamic，`CascadeBridge_Lock01` 至 `CascadeBridge_Lock06` lock/indicator。Tile 原点各自在刚体中心，解锁后受原重力下落；Lock 只反馈预告/解锁。

## 配置与行为

`LevelConfig.advancedMechanisms` 是 8 类判别联合，定义于 `src/game/advanced-types.ts`。

- 蹦床：仅球从上方下落且与 deck 新接触时触发一次。径向在 core 内为 1，core 至 outer 平滑降为 0；只追加不超过 `storedEnergyJ` 且不使向上速度超过 ceiling 的冲量。离面高度与最小时间同时满足才重装。
- 过山车/漏斗：纯静态真实接触，无样条吸附、透明承托或局部改重力。
- 喷流：球心进入 nozzle 局部有限体积才 `applyForce`；idle/warning 为 0，pulse 为 1，decay 平滑归零。多喷口力矢量相加，LEVEL 负责不超过 40N 设计峰值。
- 接球斗：Bowl 与 Carriage 为真实运动学碰撞；轨道运动→减速→settle→dock 保持→反程，不追球、不传送。
- 输送带：deck 是真实固定碰撞，球与带面接触时按带面目标速度差施有限摩擦力。正向保持→减速→零速→反向加速→反向保持对称回程，周期 7.4s。
- 双轴平台：固定座→OuterFrame 真实限位铰链→InnerDeck 真实限位铰链；两轴分别有限回位/阻尼力矩，只有球接触负载改变姿态。
- 坍塌桥：任一 tile 真实上表面承重达 dwell 后只锁存一次；从该块起按 delay/interval 将运动学块切为动态刚体。链已启动不回滚，掉落安全重生或重开时整组重装。

## 试验场与验收

`advanced-trial` 首版 `rulesVersion:'standard'`，目录编号“试验”，无奖牌阈值。8 项每项必须有可辨入口/恢复区，CP 不放在动件、漏斗孔或空中。关卡静态 GLB 只含固定岸、接驳、支撑和水面，不重复烘入八机关库根。

CODE 验收覆盖：8 类/id/实例唯一、资源一次加载/取消/卸载，蹦床去重、喷流边界力、带面接触、斗的dock、双铰链负载、坍塌触发/重装、暂停冻结、快速碰撞和完整路线。图鉴扩为 21 类，预览与游戏使用同一根/分件姿态，不启动 Ammo 或写成绩。
