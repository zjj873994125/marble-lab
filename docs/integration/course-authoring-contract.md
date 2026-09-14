# 长关多实例与分支关卡编写协议

2026-09-14。此协议是 `top-difficulty` 与 `three-route` 的正式运行数据接口，CODE已同步实现对应类型、坐标变换与有向路线状态。LEVEL可据此填写正式TS，ART可按相同实例根和静态施工数据制作两份TrackStatic。旧三关单字段继续兼容。

## 坐标与资源

全部数据为米制、PlayCanvas/glTF Y-up。`mechanismGroups`统一以组局部 **-Z为前进、+X为侧向**；`position`是组根世界坐标，`yaw`为绕世界Y的度数，默认0，`phaseSeconds`为整组时钟偏移秒数。局部primitive的position/rotation、锚点、杆中心和碰撞体必须同乘组根变换，不能只转模型。

旧机关不要求LEVEL了解其历史世界朝向：组内config直接使用局部-Z前进装配。CODE先在局部坐标调用原`arcHammerPose`、`liftPosition`、`turntablePose`或原单锤/平台公式，再将结果与旋转乘根yaw。三锤/升降的各子项保留自身phase，最终时间为`gameTime + group.phaseSeconds`；多组同id禁止，组内生成实体名带组id。

```ts
mechanismGroups: [
  { id:'hammer-bank-01', kind:'hammers', position:[0,0,0], yaw:90, phaseSeconds:.4, configs:[/* 三把局部配置 */] },
  { id:'lift-bank-01', kind:'lifts', position:[12,0,-8], yaw:180, configs:[/* 四板局部配置 */] },
  { id:'single-01', kind:'pendulum', position:[0,0,-20], yaw:0, config:{/* 局部配置 */} },
  { id:'cross-01', kind:'turntable', position:[0,0,-30], yaw:0, config:{/* 局部配置 */} },
  { id:'platform-01', kind:'platform', position:[0,0,-42], yaw:0, config:{/* 局部配置 */} },
]
```

五机关继续用现有`mechanisms`数组，每实例已具position/yaw/phaseSeconds；跷跷板不使用时间相位。长窄板、45度吊桥和推杆真实碰撞接口保持。单件GLB由同一Application的model-assets按文件名缓存，所有实例共享container mesh/material，不复制网络请求；每个实例有独立实体和相位，退出先销毁实例再卸资源。

每个动态件所需的固定结构必须在`staticObjects`明确提供并由ART写入静态GLB：锤门架、升降套筒/支脚、十字中心柱、横移导轨及高层库脚不能由动件GLB推断。`refinedVisual:true`仅隐藏基础Render，碰撞仍由该primitive创建。上跨区域的支撑禁区由LEVEL施工JSON指定，ART不得用立柱穿过下层行驶/机关包络。

新关静态资源分别为`top-difficulty-track.glb`与`three-route-track.glb`，根`TrackStatic`，世界原点[0,0,0]、identity、scale1、自包含、无动态机关；关卡`visuals:{track:'...'}`。资源未完成时LEVEL可临时设null白盒，正式目录接入只在同名资源完成后恢复。

## 旧机关局部装配

- pendulum：局部anchor/ball/rod均为组坐标。原公式在局部Z往复，根yaw决定世界侧摆方向；锤头长轴与杆旋转使用同一局部姿态后叠根yaw。
- hammers：每个ArcHammerConfig的anchor、ball、rod均为局部坐标；三把可各自phase/速度/杆长，组phaseSeconds只平移时间，不改相位单位。
- lifts：body为局部位置，沿局部Y升降；组yaw只改变XZ装配，套筒由staticObjects提供。
- turntable：config.position和parts.position均为组局部坐标，parts仍相对config.position；先按原函数绕局部Y，再把中心、五盒及碰撞变到世界。固定轴柱在staticObjects。
- platform：body/stripe、centerX/centerZ及axis均为组局部坐标；先沿局部x/z运动，再把两实体变到世界。stripe与碰撞主体同相位，导轨在staticObjects。

旧单字段`pendulum/platform/turntable/hammers/lifts`视为position[0,0,0]、yaw0、phaseSeconds0的legacy组，运行行为/资源路径保持，旧三关无需迁移。

## 有向路线与条件检查点

新关使用`course`，不再以旧线性`checkpoints + progress`决定合法完成；旧字段仍保留供旧关兼容。

```ts
course: {
  checkpoints: [
    { id:'CP-SELECT', ring:{position:[0,3.46,6],radius:.8}, respawn:[0,3.95,6], triggerRadius:1.2 },
    { id:'CP-A-ENTRY', ring:{position:[-6,3.46,0],radius:.8}, respawn:[-6,3.95,0], triggerRadius:1.2 },
  ],
  routes: [
    { id:'A', checkpointIds:['CP-SELECT','CP-A-ENTRY','CP-A-MID','CP-MERGED'], points:[/* 有序世界中心线 */] },
    { id:'B', checkpointIds:['CP-SELECT','CP-B-ENTRY','CP-B-MID','CP-MERGED'], points:[/* 有序世界中心线 */] },
    { id:'C', checkpointIds:['CP-SELECT','CP-C-ENTRY','CP-C-MID','CP-MERGED'], points:[/* 有序世界中心线 */] },
  ],
}
```

CourseCheckpoint的ring.position/ring.radius仅用于圆环显示，respawn用于触发中心和重生；可分别覆盖triggerRadius/heightTolerance，省略取1.2。id全局唯一，圆环半径与触发半径不能复用同一字段。每条route的checkpointIds为本路线严格有序列表；同层公共CP用相同id，分支CP用不同id。points是该次合法路线从起点至终点的有序世界中心线，至少两点，用于最近线段投影显示进度；不得把全图总长度或另一支路计入分母。

组末、防跨路和汇合前验证使用无圆环、不可重生的`course.gates`，每项`{id,position,forward?,radius,heightTolerance?}`。有forward时，球心必须从门平面背面跨到正面，且到门轴的横向距离小于radius；反向穿越不算。无forward时仅用于狭小球形门。gate不会增加HUD检查点数，也不改变最后重生点。

需要gate的路线必须显式写`steps:[{kind:'checkpoint'|'gate',id}]`完整顺序，同时checkpointIds仍只列其中checkpoint项且顺序一致。运行时逐项接受，不能先触发MERGED再补支路末gate。top应把各组末/边界有向标记放入main steps；three-route每条A/B/C在MID之后继续列本路组末gate，再列MERGED。若没有steps则兼容为只含checkpointIds，用于简单关卡。

开局候选为全部routes。玩家只能触发各候选路线共同的“下一CP”或某条分支独有的下一CP；触发独有CP后候选收窄并锁定selectedRoute，误入其他路CP不会覆盖。每次掉落回已通过的最后合法CP，保留当前候选/所选路线；重开清空历史与选择。汇合CP必须列在每条route末尾，终点只要求最终选定路线的checkpointIds全部通过，不要求另两路。top-difficulty只提供id=`main`的一条route，同样经过四个边界CP。

显示进度取当前候选/已选route中心线的最近线段投影；分支锁定前取仍合法路线中的最大值，锁定后只按该路线。终点记route id到成绩Run.route；旧Run无route仍可读。HUD检查点总数在未选路时取候选最大值，选路后取该route实际数。

## 登记与交付

`top-difficulty`标题“顶级难度关卡”、目录number=`挑战`；`three-route`标题“三路分流”、number=`04`。两关首版rulesVersion=`standard`、无奖牌阈值，与旧三关及所有历史成绩按id/version隔离。当前总目录最终五项。

LEVEL交正式`src/levels/top-difficulty.ts`、`three-route.ts`，必须包含静态代理、起终点、course完整路线和全部动态实例；设计JSON继续是施工依据，不能由运行时直接加载。ART逐关交同名blend/GLB及哈希/预览。CODE负责目录注册、测试、资源接入、全路线物理试玩与存档证据。

接口实现就绪不表示两关已可玩。最终验收必须覆盖：多实例独立yaw/phase、显示/碰撞/锚杆一致、资源一次请求、top完整单线四CP/终点、three-route A/B/C分别选择/保留/汇合/结算，以及掉落/重开/暂停、桌面和小屏关键输入。不得用隐形托板、传送或额外推球通过验收。
