# 机关试炼 · 第三关接入协议

2026-09-14。本轮已完成13类图鉴、五机关行为代码与第三关目录注册。LEVEL正式TS与ART共享库/静态场景均已接入；运行时读取TS配置，不把设计JSON当运行数据。按授权未运行本地测试、构建、类型检查或试玩，未提交推送；代码完成不代表物理或可通性通过。实际文件与交付边界见 [第三关交付](level-03-delivery.md)。

## 正式配置

`src/levels/mechanism-trial.ts` 默认导出LevelConfig，id=`mechanism-trial`，当前rulesVersion=`intense-v2`，`standard`、`challenge`和`intense`成绩留在历史桶；目录注册名“机关试炼”、编号03，不新增第四关。不填medals即暂不校准奖牌。保存复用v3关卡/规则桶，前两关及进展/水速不变。当前模型/参数与接入状态见 [intense-v2交付](level-03-refinements.md)，上一轮源码路径结论保留在 [challenge说明](level-03-difficulty.md)。

复用staticObjects/start/checkpoints/checkpointTrigger/finish/fallY/progress。旧pendulum、platform、hammers、lifts、turntable均可省略；静态资源 `visuals:{track:'mechanism-trial-track.glb'}` 或未配套时null。静态GLB为TrackStatic、根identity/世界原点，米制Y-up；仅静态线路/安全岛/推墙袋区及支撑，五机关、水面/圆环均不烘焙进去。当前库的Context未导出，线路必须在staticObjects提供真实承托。

新增 `mechanisms: LibraryMechanismConfig[]`，类型见 `src/game/library-types.ts`。每项：

- `id`：实例唯一英文名；`kind`：共享库五个稳定id之一。
- `position:[x,y,z]`：库根世界坐标，参考岸顶为根Y+3.4。
- `yaw?:number`：根绕世界Y的角度，单位度、默认0，scale固定1。本地通行-Z随yaw旋转。
- `phaseSeconds?:number`：时间驱动机关的秒偏移、默认0，暂停不推进；跷跷板不使用时间相位。
- `visual?:boolean`：默认加载共享GLB目标根，false用于基础外观；不影响真实碰撞。
- `staticColliders?:PrimitiveConfig[]`：相对该库根的可触固定结构，运行时强制静态。需由LEVEL按结构明确给盒/圆柱，不能自动把整段Static包围盒作为碰撞，以免填满开口或造隐形墙。非可触装饰可不提供；真实支架若可能挡球则必须提供或在布局中避开。

主体尺寸、局部枢轴、质心偏移从obstacle-library.json读取，不另填一套尺寸。库节点协议继续见obstacle-library-contract.md；单包一次加载模板，按root/part路径克隆和驱动。

## 五种参数与物理

以下列接口省略字段时的兼容默认值，不是当前intense-v2值。当前正式参数：推墙stages=[.9,.45,.22,.65,.25]；翻板stages=[1.5,.20,.45,.22]/warningSeconds=.45，第三项为打开停留；滚筒angularSpeed=-4.5。跷跷板mass.65/rest25/limit25/spring4/damping3、主体[.7,.30,7]/轴高约4.743217748；吊桥amplitude45/period3，配套宽岸和外移门架。杆段另从manifest的Rod取得collisionRadius/referenceLength/extensionAxis创建持续伸缩的真实圆柱。交付时点见intense-v2说明，运行时和图鉴始终以正式TS与当前manifest为准。

- **weight-seesaw**：mass=4、restAngle=8°、limitAngle=8°、spring=25Nm/rad、damping=55Nms/rad，均可由同名字段覆盖。真实动态盒板加一个世界锚定X轴hinge，角限±limitAngle；仅对板施加`-spring*(angle-rest)-damping*angularVelocity`扭矩。球负载通过实际接触/惯量改变姿态，不按球位置直接设角度、不正弦驱动。重开恢复restAngle和零角速度，普通掉落不重置板。
- **axial-roller**：angularSpeed=-.45rad/s。Z向圆柱半径/总长从库bodySize读取；每帧更新运动学target旋转，让Ammo获得真实角速度与接触，不能只转模型。没有暗加球横推力。
- **piston-wall**：travel=3.7米，stages=[3,1,1.6,.8,1.6]秒，依次收回/预告/推出/伸出保持/收回；总周期为五项之和。推入和回收用两端零速度的smoothstep。Head真实盒碰撞；杆从intense-v2起使用独立真实圆柱，其半径/缸口读manifest、长度和中心按头后缘同步，原生shape轴向缩放而不逐帧重建。预告从同一阶段时钟驱动可见指示，不延长安全期。
- **timed-trapdoor**：openAngle=-90°，stages=[4.5,1,1.5,1.5]秒，依次闭合/下翻/打开/回位；warningSeconds=.9包含于闭合4.5，不重复计时。板心=P+Rz(angle)*offset，真实运动学盒随偏心铰轴转动，开口无静态补板，不关碰撞吞球。
- **sway-cradle-bridge**：amplitude=9°、period=10秒。单刚性桥绕上铰轴Z摆动，板心和桥倾角由同一个angle导出；frameColliders可选，提供相对Pivot坐标的可触吊架简化盒体并同步运动，主板由库尺寸自动创建。无软体、无强绑球或额外“摇晃力”。

所有可选数值都是机关自身参数，玩家力/摩擦/刹车/速度/镜头不改。yaw180对应跷跷板向+Z，yaw90对应吊桥向-X。可按LEVEL候选五根位置直接布置。模型固定Static可触部分要考虑推墙缸壳、翻板驱动器、吊桥上架的完整包络，不能把模型的非承托结构当固定桥。可触代理只表达真实结构，不用于扩展通行空间。

## 生命周期与交接

图鉴用正式配置参数和独立演示时钟，不加载Ammo或计分；其中跷跷板仅按配置限角展示姿态，与游戏负载驱动完全分开。库原始manifest的runtimeSupported/design.implemented是ART制作时的状态记录，不由预览自动写成true；实际能力在代码和本说明的交付状态中记录。

游戏暂停/后台不推进时间驱动和板恢复力，重开复位机关/约束但保留现有规则；约束先于动态体释放，实例和模板先于共享资源池释放。切关及异步取消不允许迟到模型挂到旧app。最终实际可通性、铰链稳定、接触带动与手机体验均未验，不以动画作为物理通过证据。
