# intense-v2 · 杆身碰撞与长窄板/45°吊桥

2026-09-14，依据 [四项任务](../product/level-03-refinements.md)。**四项代码、正式配置、新共享库/静态接岸与图鉴图片已完成配套接入**，正式TS已恢复track引用。没有运行test/build/typecheck、浏览器或Ammo模拟，不Git写入、不部署。代码实现与设计推导不代表运行验收。

## 推杆缺失碰撞的修复

原实现只有Head主刚体，Piston rod由libraryFallback提供纯Render，GLB的RodShaft也只缩放外观，因此露出杆段没有任何真实代理。本轮新增一个独立运动学圆柱，尺寸与显示取自同一份数据。

- 最小清单协议：`public/models/obstacle-library.json`的`PistonWall_Rod` part提供`collisionRadius=.08m`、`referenceLength=.3m`、`extensionAxis=[1,0,0]`和固定缸口position。ART已写入，不使用design备注推断半径，杆不填主bodySize/bodyCenterOffset。
- `src/game/library-data.ts`的pistonRodPose统一计算缸口→推头后缘：长度约`.3+3.7u`，中心X约`-2.35+1.85u`，u来自原推墙阶段。半径始终.08，收回露杆.3米、全伸4米。GLB杆伸缩、基础圆柱和真实碰撞共用这份结果，不维护第二套时序。
- `src/game/library-mechanisms.ts`创建一个kinematic圆柱，沿局部Z建形后转Y90°对齐库+X，再叠根yaw/position。推出、伸出停留和回收均保持真实碰撞，开局/重开回到当前初相位对应长度；暂停不推进，外观加载失败保留基础杆和真实碰撞。
- `src/game/piston-rod.ts`保持同一个刚体和原生shape，使用Ammo.setLocalScaling沿圆柱Z更新真实长度，同时更新中心目标与宽相AABB，缩短也刷新。没有逐帧修改collision.height（PlayCanvas该setter会重建形状/刚体），没有创建整段静态长墙，没有仅靠Render缩放假装碰撞。
- 一个原生btVector3循环复用，销毁随机关作用域执行且幂等；失败、取消、切关和卸载按现有统一清理路径释放杆体/shape/向量。完全收回仍保留模型真实存在的.3米短杆，不保留4米伸出范围。

相关文件：`library-types.ts`、`library-data.ts`、`library-visuals.ts`、`library-mechanisms.ts`、新增`piston-rod.ts`。主体/杆摩擦沿用现有机关设置，没有修改小球参数或额外推球力。源代码和本地Ammo绑定提供setLocalScaling/updateSingleAabb接口，本轮未运行native接触验证；动态变长圆柱表达当前占据空间，不宣称已验证材料点摩擦速度或连续扫掠。

`tests/library-motion.test.mjs`增加全周期端点/回收长度用例，`tests/piston-rod.test.mjs`增加持久shape/单向量、真实缩放/AABB及卸载调用用例。均未执行；后者是接口回归，不是Ammo物理模拟，不可当作球已不会穿杆的运行证据。上一轮快速运动在低帧的离散扫掠风险仍保留，不因补齐杆碰撞就声称零漏碰。

## 参数与几何

- 新规则`intense-v2`，显示名“极限挑战Ⅱ”；同一mechanism-trial/03，standard/challenge/intense历史桶保留。存储继续使用既有通用分桶，设置与进展不清空；state用例补充新规则的历史保留/往返/刷新与标签，未执行。
- 翻板四阶段为`[1.5,.20,.45,.22]`秒，总周期2.37秒。只将第三项“打开停留”1.5缩到.45；闭合停留、下翻、回位及包含于闭合期的.45预告不改。推墙`[.9,.45,.22,.65,.25]`、滚筒-4.5rad/s保持。
- 跷跷板主体从`[1,.30,5]`改为`[.7,.30,7]`米，rest/limit保持25°，板心=Pivot、X轴。新轴高`3.4+3.5sin25°-.15cos25°=4.743217748036951m`；岸localZ±3.39，低位端顶Z投影约3.235470m，名义缝约.154530m。轴架/脚/止挡与两端接岸由LEVEL/ART配套，运行时主体与单hinge读取新manifest。
- 板质量由1.2改为.65，spring4/damping3保持。若长7米仍用1.2质量，Ixx=m*(7²+.3²)/12≈4.909kg·m²，是上一版2.509的1.96倍；新mass.65得Ixx≈2.659，保持转动响应量级。空载固有角频率≈1.2265rad/s、阻尼比≈.460。球质量1、重力16，3.5m板端准静态负载矩约50.75Nm，双极限最大弹簧恢复矩仍约3.49Nm。真实球载荷会增加有效惯量，以上不是响应或通关仿真。
- 吊桥幅度明确45°、period3秒，根、上轴、主板与U架保持。塔由±3.8外移到±4.35、门梁宽8.94，接岸总宽6.8；为避南塔，LEVEL仅调整CP1到跷跷板连接段至Z=-4，三个CP位置与其余整体路线保持。完整扫掠/接岸可通过性未实测。

图鉴继续读取正式TS参数与manifest；新跷跷/吊桥PNG已从ART原路径更新为600×471透明卡图，其他三类库图片保持。跷跷板图鉴仅示意±25°，不启动Ammo或模拟负载，推杆预览仍无物理，与正式游戏分开。

## 资源与交接

ART已交新共享库，以下SHA为其交付标识，本轮代码未另跑哈希验算：

- `public/models/obstacle-library.glb`：`8281551e662b13d240a1f5ffa64bcfb43d3687cc37ddd0ae605e28f8575f4b68`，619,092字节/31,860面/6材质/18网格。
- `art/obstacle-library.blend`：`43c336afd41f47bceaa1046d68e73fd335afe932d48e069b9b6a0eac8a40fd91`。
- ART最终manifest：`666c571b08e2d972756fbc46c6124432ab34a88b007893b6dd73fdf3e7fbf2a7`。最终回传确认库GLB、静态GLB及两项新PNG未再变化，不需要再次转换卡图。
- `public/models/mechanism-trial-track.glb`：`5d56e7739479d8ba62b89e0c926421ff368ed53976ad3938c92b68946e4f8a5f`，794,956字节/42,792面/5材质，TrackStatic世界原点/Y-up。
- `art/mechanism-trial.blend`：`02c615c12777f8c9ab3cd629db1b4a6888d3df9eb151df15854799bf3d94a3b0`。
- LEVEL冻结制作JSON：`3e3e7b8681b2ee066c42d76bd2454a4fee03010bb34904d1e0909e8e7256c44a`。
- LEVEL最终正式TS：`4e2f616d2c3ad2497c8a8e4eb227ad2ca931de92b093a6a9182a2fa4a16d2c3d`；最终含接入状态的JSON：`ef42244e2ca0569873a6e72b4b9efebc201fb136e1ac90860ff7715309d6fded`。

五根/part路径保持。CODE不写LEVEL/ART文件，不重跑模型生成器；已读正式配置确认新大角/轴高/代理与对应资产配套，仍为第三关，21台面、5栏、33支撑和三个安全CP保留。完成通知已回传LEVEL/ART与统筹，旧公共说明改为当前intense-v2，先前阶段报告保留为历史快照。

未验证项包括类型构建、实际杆碰撞及回收后的接触解除、快动作低帧扫掠、长窄板负载响应、45°全运动包络、上下桥窗口、手机表现和整关通关；没有验收通过结论。所留回归用例未运行，不记录虚构成绩或浏览器证据。
