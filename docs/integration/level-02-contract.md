# 水上冲关 · 最小接入协议

状态：2026-09-11 恢复开发后的接口约定，已按三锤、十字旋转台及向 -X 坡道修订。以下新增字段尚待类型、实现和测试就绪通知；目前仍只用于 LEVEL/ART 准备，不表示第二关已可选或可玩。第一关文件与参数保持，新关卡文件建立后原位维护，不建版本副本或备份。

## 关卡与成绩

- 稳定 id=`water-rush`，名称“水上冲关”，编号02；配置为 `src/levels/water-rush.ts`。代码目录将注册第一关与第二关，HUD/运行时/成绩使用同一选中项。
- 继续使用 LevelConfig 的 staticObjects、start、checkpoints、checkpointTrigger、finish、fallY、platform、progress。旧 `pendulum` 改为可选，仅服务第一关原运动；第二关使用 `hammers` 数组，不同时填写旧 pendulum。一个横移平台继续使用既有字段/资产。
- 第二关规则拟为 `standard`，成绩键 `water-rush/standard`。历史 classic/open-hammer/flat-hammer 均明确归第一关，保留原键、记录及共享设置；第一关成绩不会成为第二关最佳。真实选择/生命周期/存档实现完成后另发就绪通知。
- progress 每段增加 `axis?: 'x' | 'z'` 与 `origin?: number`，缺省使用 z/originZ 兼容第一关。按当前已过检查点取一段，第二关建议 x/z/z/x；它仍是分段估计，不宣称精确路程。原 originZ 保留以免改写第一关配置。

## 静态图元与坡面

PrimitiveConfig 新增拟定字段 `rotation?: [x,y,z]`，单位度，按 PlayCanvas `setEulerAngles` 解释；未填为零。body=static 的盒体与基础显示一起旋转，真实碰撞不是水平代理。

上坡用旋转盒体表达：size 为局部 X/Y/Z 完整尺寸，position 为盒体中心。当前坡向 -X，局部长轴 X，三段 rotation 分别为 `[0,0,-20]`、`[0,0,-45]`、`[0,0,-20]`；精确 position/size/topStart/topEnd 以最新设计 JSON 为准。局部顶面端点 `[±L/2,h/2,0]` 经旋转再加 position 得到接驳位置，不能只对齐盒中心。旧向 -Z 示例不适用于当前第二关。

保留现有力12、重力16、水平限速7及球体摩擦。坡角大于约 atan(12/16)=36.87° 才可能在理想受力上出现低速难上，但撞坡损耗、滚动惯量与接缝必须实测。建议先准备约40–45°的短坡、足够助跑和坡顶制动岛；这些是候选，不是已经验证可通关的参数。

## 三把固定杆长圆弧锤

新增 `hammers` 数组，每项包含 `ball`、`rod`（PrimitiveConfig）、`visuals`（同款 head/handle 文件名）、`anchor`、`rodLength`、`maxAngle`、`angularSpeed`、`phase`、`rodWidth`。ball 为局部 Z 向平端 cylinder，collisionAxis=2，size=[.9,.9,1.36]；rod 为无碰撞 cylinder。各 name 唯一便于诊断。

运动严格为 `theta=maxAngle*sin(t*angularSpeed+phase)`；头中心 `[anchorX, anchorY-rodLength*cos(theta), anchorZ+rodLength*sin(theta)]`，头/柄 Euler X 均为 `-theta`（转成度）；柄中心为吊点和头中心的中点，长度始终 rodLength。当前 rodLength=3.6、maxAngle=asin(1.65/3.6)，频率1.1/1.5/1.9，相位0/π/π/2；中心X=-24/-18/-12由LEVEL冻结。禁止套用旧 abs(offset)*lift/伸缩杆公式。

暂停冻结时间和姿态，重开 t=0 恢复各自 phase，不能三把统一复位中间；建模中位只是几何参考。真实头部碰撞跟随各自姿态，跨道门架属于静态外观。复用同一份 HammerHead/HammerHandle 资源、多份实体；一米标准柄沿 Y 固定伸长3.6米，其他轴不缩放模型。第一关继续原 pendulum 公式，不因新增模式改变手感或规则。

## 十字旋转台（最多一座）

拟定可选 `turntable`：

```ts
turntable: {
  position: [x,y,z], // 旋转中心，也是 GLB 原点的世界位置
  parts: [ // 中心+四臂，共五个局部盒体，精确尺寸由 LEVEL 提供
    { name: 'Turntable center', type: 'box', position: [0,0,0], size: [armWidth,thickness,armWidth], material: 'cream' },
    // 其余四臂 position 相对旋转中心，彼此不重叠、不填满四角
  ],
  angularSpeed: 0.5, // 弧度/秒，示意值
  phase: 0,         // 弧度
  visual: 'water-rush-turntable.glb'
}
```

`yaw=phase+angularSpeed*t`。代码创建五个同步的运动学盒体，各局部 position 随同一 yaw 转到世界坐标，五个姿态一致；GLB 挂在比例为1的显示根节点，按同一中心和 yaw 旋转。先采用独立同步盒体的最小支持，中心连接处真实滚过和接触抖动必须实测。没有整盒、圆柱、凸包底板或旧 barrier；四角必须能落水。不强绑、传送弹珠，不只转纹理。

**资源仍为一份** `water-rush-turntable.glb` / `TurntableVisual`，原点十字台旋转中心，Y-up、米制。只包含中心与四臂的外观，移除旧圆盘、四角底层和挡杆。成功加载后隐藏五块基础显示，碰撞保持；失败时五块基础显示可用。LEVEL 提供臂宽、跨度、厚度、五块局部盒体、臂端外角扫掠半径、入口/出口接缝与角度窗口；ART 对齐同一组尺寸。当前旧 JSON 中 closed Y cylinder/coMovingBar 不作为实施依据。

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

实现分阶段通知：先交付类型/姿态计算/代理支持及测试，LEVEL 再填写正式 TS；随后代码注册第二关、完成选择/加载/成绩与真实路线验收。原 v1/v2 存储原文保留，新增按关卡+规则组织的存储，不把历史桶改记为第二关。所有浏览器验证使用5177对应的隔离测试origin，不清用户数据。当前准备稿不等于可选或可玩第二关。
