# 高级八机关共享库 · 美术交付

2026-09-14。第二阶段高级机关库已完成，一个 Blender 源文件、一个 GLB、一个 manifest，保留八个 identity 顶级根和合同规定的固定/运动/动态/指示分件。旧 `obstacle-library` 未覆盖。

## 资源与坐标

- `art/advanced-obstacle-library.blend`：唯一当前源，SHA-256 `cca45bb2583104a25afef1f99db7b9d1c229b50c9cf1d63bffe269155e8f537e`。
- `public/models/advanced-obstacle-library.glb`：SHA-256 `99b0803ec4196cbe2d88170b23b9ce628637205b201a5e7739f8ccf49e40c428`，**1,514,564 字节、84,968 三角面、8 材质、617 个可编辑/语义网格**。
- `public/models/advanced-obstacle-library.json`：真实根包围盒、分件路径、role、motion、pivot、axis、referenceSize、碰撞语义和候选参数。`runtimeSupported:true` 仅表示 CODE 已按八根与分件层级成功加载，`runtimeSupportScope=asset-loading-and-semantic-parts`；不表示八项物理或整关验收完成。

统一米制、glTF +Y 向上、局部 -Z 前进、+X 右侧。八个顶级根位置 `[0,0,0]`、identity 旋转、scale `[1,1,1]`。Blender Z-up，游戏 `(x,y,z)` 对应 Blender `(x,-z,y)`。模型仅提供 Render 分件；碰撞和作用区由 LEVEL/CODE 明确创建，不从根包围盒自动推断。

## 八根尺寸与统计

- `SpringTrampoline`：约 **3.400 x 3.503 x 3.400 米**，38,768 面、6 材质。`Deck` 独立运动，固定框/四弹簧和储能连杆可见；Core/Needle 为指示件。
- `GravityCoaster`：约 **8.308 x 5.380 x 10.271 米**，7,060 面、5 材质。开放落差、30 度竖向过渡、R4/90 度倾斜弯、20 度出坡；两条 .25 米实体低轨，无完整环。
- `PulseJet`：约 **3.347 x 4.645 x 2.090 米**，3,092 面、5 材质。喷嘴壳、护架和阀门提供机械来源；`PulseJet_Flow` 为半透明非碰撞指示体。
- `OrbitalCatcher`：约 **4.790 x 3.513 x 2.695 米**，10,984 面、6 材质。真实凹斗、同动小车、椭圆导轨和固定 dock；最终 dock 在 local Z=.4。
- `ReversingConveyor`：约 **2.260 x 3.421 x 6.700 米**，6,460 面、5 材质。32 块带面板条、两端滚筒、固定护罩/机架、方向指示分件。
- `VortexFunnel`：约 **8.180 x 4.750 x 8.180 米**，11,256 面、7 材质。外径8米、中心孔径1.3米，孔真实开放；下方接台和八组外圈支撑独立。
- `GimbalPlatform`：约 **5.020 x 3.821 x 5.020 米**，3,028 面、5 材质。固定座、X 外框/轴、Z 内板/轴分别成组，支持双铰链。
- `CascadeBridge`：约 **2.290 x 3.420 x 9.550 米**，4,320 面、5 材质。六块独立动态板与六个独立锁销指示，无全跨静态底板。

材质沿用现有语义：Ivory polymer、Graphite chassis、Safety terracotta、Brushed alloy、Rubber pads、Printed markings、Platform enamel；Airflow indicator 仅用于非碰撞喷流。七款主题可按现有角色映射换色，安全橙/标记/橡胶继续保护。

## 预览与边界

八张单项制作图位于 `docs/art/advanced-obstacle-library/`，文件名为八个稳定 id。预览来自当前实际模型、同一灯光，非浏览器截图。蹦床核心圈/板层和喷气阀/作用区的父级变换已定向修正后重导。

几何装配来源 `docs/levels/advanced-trial-construction.json` SHA-256 `90c580d7db8a50eb642380df9d8a104b3a5529241aedfb5f80da9528993d02d1`；资源协议 `docs/integration/advanced-obstacles-contract.md`。CODE 已完成八根自包含加载并开始逐项物理验证；当前不把加载成功写成物理通过。

没有创建八份 GLB、动画脚本、刚体、外部纹理或完整环；未修改旧五机关库和旧关。ART 不操作 Git；本次提交/推送由 CODE 按两阶段授权统一执行。
