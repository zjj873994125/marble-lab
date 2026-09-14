# 第三关challenge · 参数接入与动力源码结论

2026-09-14。按 [调难任务](../product/level-03-difficulty.md) 完成CODE范围的源码追踪和参数接入。**没有运行测试、构建、类型检查、浏览器或Ammo模拟；下文是源码事实和参数推导，不是实际难度、接触动力或通关验收。** 没有Git写入或部署。

本文保留challenge阶段的参数与交付快照，后续intense已另行授权修改两机关和接岸，当前参数与资源状态见 [intense交付](level-03-intense.md)。不要使用本文旧参数覆盖正式配置。

## 本轮实际变化

发现并修复一处明确参数脱节：新五机关图鉴此前由`previewLibraryConfig`只返回kind/原点，其余读省略字段的默认值，正式关卡加速后图鉴仍演示旧节奏。

- `src/game/library-data.ts`：图鉴现在读取正式`src/levels/mechanism-trial.ts`中对应kind的实例，保留阶段/速度/振幅/相位等参数，只归零展示位置和朝向。找不到正式机关时明确报错，不静默回退默认值。
- `src/game/library-visuals.ts`：跷跷板示意角幅度使用正式limitAngle；演示仍为预置往复，不模拟球负载、spring或damping。
- `tests/library-motion.test.mjs`：同步正式配置导入，并留下图鉴参数与正式实例一致的回归用例；**未执行**。原默认时序/几何用例仍检查接口默认值，不冒充当前challenge参数。
- README、AGENTS、协作说明、第三关协议与图鉴说明同步challenge和历史成绩边界。

本轮未发现下述三种机关有明确的“只转模型”“刚体姿态被锁死/每帧覆盖”实现缺陷，因此没有改`runtime.ts`或`library-mechanisms.ts`，没有额外施力到球。也没有修改LEVEL参数、ART或前两关。

## 运动学目标进入Ammo的路径

依据项目实际安装的PlayCanvas 2.22.1源码，路径如下：

1. `src/game/runtime.ts`在playing阶段推进机关time，再调用`libraryMechanisms.update(time)`。这一监听位于Application的update事件，晚于当前帧system物理更新，所以写入的目标用于下一次物理step。
2. `src/game/library-mechanisms.ts`的`sync`对非跷跷板主体调用Entity.setPosition和setRotation；普通帧不调用teleport，不直接覆盖nativeBody世界变换或插值历史。开局/重开才使用teleport并同步插值位姿。
3. 引擎`framework/components/rigid-body/system.js`的step先遍历_kinematic，调用各组件_updateKinematic，再调用world.step。
4. `framework/components/rigid-body/component.js`的_updateKinematic取collision.getShapePosition/getShapeRotation，将完整位置和四元数交给_body.setKinematicTarget。collision形状旋转默认直接读取实体rotation。
5. `framework/physics/ammo/ammo-physics-body.js`的setKinematicTarget同时填写btTransform的origin与rotation，只写nativeBody.getMotionState().setWorldTransform；没有“位移为零就忽略旋转”的条件，也没有在这里将nativeBody直接teleport到目标而抹掉前后姿态差。
6. `framework/physics/ammo/ammo-physics-world.js`的step进入本地Ammo的nativeWorld.stepSimulation(dt,maxSubSteps,fixedTimeStep)。createBody/addBody为kinematic设置对应碰撞标志并禁止休眠。

因此源码没有把纯旋转从物理路径过滤掉，旋转目标确实传入Ammo。按Bullet运动学目标机制应由前后位姿差导出接触所用速度；但本地依赖提供的是WASM与JS绑定，没有本轮可直接阅读的Bullet C++步进实现，也没有实测native角速度/接触冲量，**不能把“目标传入”写成“滚筒已实测带动球”**。

另外，RigidBodyComponent.angularVelocity的getter仅对dynamic从后端更新，kinematic会返回组件缓存；未来采样滚筒速度应读取`rigidbody.body.getAngularVelocity()`等native证据，不用该组件getter的零值误判。

## 三项重点结论

**滚筒**：主体是collisionAxis=2的真实Z向圆柱kinematic，`libraryPose`将angularSpeed乘时间写入Z角，位置可保持不变；实体旋转仍进入上述完整target路径。没有只改RotorVisual、设angularFactor为0或每帧清角速度的代码。正式-1.8rad/s、半径1m，对应筒冠切向速度量级1.8m/s、方向局部+X；这是理论值，不是实测球速度。

**吊桥**：真实主板center由Pivot+Rz(angle)*bodyCenterOffset求得，body姿态与模型使用同一angle；可触吊架frameColliders也按同一Pivot、angle和根yaw更新运动学实体。固定架保持static，不替代桥面承托。不是只摆外观或只横移碰撞。仍需实际确认接触带动、上岸窗口和全行程间隙。

**跷跷板**：板为dynamic、mass来自正式配置；普通sync读取nativeBody四元数，在局部X轴提取角度，只将该角同步到外观。主体setPosition/setRotation分支明确排除weight-seesaw。单hinge在水平姿态建立零角，固定世界，limits为±8°，maxMotorForce=0关闭电机。恢复扭矩为`-spring*(angle-rest)-damping*omega`，只施加到板，读取世界轴方向上的真实角速度。只有开局/重开teleport回restAngle，普通掉落不复位。没有位置映射假负载、正弦覆盖、固定约束或额外角自由度锁死；原强阻尼会抑制响应，LEVEL本轮已降低。

## 正式配置与成绩

已读到LEVEL实际落盘的`src/levels/mechanism-trial.ts`，本轮只读取，最终参数为：

LEVEL回传正式TS SHA-256为`7e58791f17cdd700baf3910196373506fd24111cc9e0e1ec04627287edc8009f`，设计JSON为`960749cbe053890e4221a005fe6024bdc2df0e26757e4e225301a79597d36a28`；本轮没有另跑哈希验算。路线、CP、根TRS、主体尺寸、碰撞代理与GLB引用保持，不需ART重导。

- rulesVersion：challenge；id仍mechanism-trial，目录仍03“机关试炼”，没有第四关、没有奖牌阈值。
- 推墙：travel3.7m，stages=[.9,.45,.45,.65,.65]s，周期3.1s。
- 翻板：stages=[1.5,.35,1.5,.6]s，周期3.95s；warningSeconds=.45包含在闭合1.5s内，openAngle保持-90°。
- 滚筒：angularSpeed=-1.8rad/s。
- 跷跷板：spring10Nm/rad、damping15Nms/rad；mass4、restAngle8°、limitAngle8°保持。
- 吊桥：amplitude10°、period3.6s。LEVEL按岸口半宽1.8m保守控制幅度，主要提高频率，空间推导见其关卡说明，不当作动态间隙实测。

推墙smoothstep推出峰速为1.5×3.7/.45≈12.33m/s，按1/120固定步长对应约.103m/子步的量级。运动学目标按渲染帧送入，并非本轮新增逐子步轨迹插值，因此该估算不能证明快速推出时绝不会漏碰撞；没有擅自改变球CCD、摩擦或步长，需之后真实接触验证。

源码数据链为`mechanism-trial.ts → levels.ts → activeLevel.config → GameCanvas/createGame → mechanisms`；目录直接引用正式对象，没有复制一份旧参数。图鉴修复后也是直接读取该TS。

`src/state.ts`的rulesVersion来自activeLevel.config，bucketsFor只把当前version放入runs，将其他version保留于archivedByVersion；retainCurrentRuns保存时合并历史桶与当前桶。因而同id切到challenge后，standard作为“初始难度”历史组保留，不进入challenge最佳；第一/二关桶、v1/v2原文、设置和游玩进展逻辑均不需改动。本轮没有操作浏览器存储，也没有运行刷新/写入实测，以上为源码结论。

## 交接边界

已回传LEVEL参数接入与物理源码结论。后续若获准验证，需要采集原生运动学线/角速度、真实接触响应、负载板角度变化、各接缝与检查点通关证据；当前不宣称challenge已平衡或用户反馈已解决。图鉴外观动画也不能替代这些证据。
