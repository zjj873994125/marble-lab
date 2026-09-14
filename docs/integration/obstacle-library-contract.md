# 五机关共享模型库协议

2026-09-14。本文保留资产制作时的节点、单位、原点与候选行为协议。**后续授权接入已完成代码开发**：库内按名取用、13类图鉴和第三关五种刚体行为已落盘，未运行测试、构建或试玩，详见 [第三关交付](level-03-delivery.md)。下文“未来/尚未实现”描述资产制作阶段，不作为当前代码能力开关；原始manifest的runtimeSupported/design.implemented制作记录保持不改。尺寸依据 [新机关设计](../levels/new-obstacles.md)，不作为可玩性或动力通过证明。

## 唯一文件与坐标基准

- 源文件 `art/obstacle-library.blend`；运行包 `public/models/obstacle-library.glb`；资源清单 `public/models/obstacle-library.json`。三者均首次建立后原位维护，不创建版本或备份。
- 一份GLB、一个默认glTF scene，内含下列五个顶级独立根。根均为Empty/节点，TRS必须是position `[0,0,0]`、rotation identity、scale `[1,1,1]`。每个根包含完整独立装配子树，不将五件焊成一个mesh。
- **Y=0为共同装配基准，固定岸顶面参考Y=3.4；不是把岸顶面设为0。** 根XZ原点为该机关危险区/桥段中央。根原点不保证等于最低支撑点；实际包围盒由ART记录。未来要接到目标岸高H时，实例根Y放在 `H-3.4`，全部子件相对坐标仍保持。
- 米制，Y-up，默认沿-Z通行；Blender坐标映射为 `(x,-z,y)`。下面位置和角度全部指**导出后的glTF局部坐标**，旋转角用度，正方向遵循右手系/PlayCanvas Euler。动件铰轴另外用单位向量表达。
- 五根在导出scene可重合；供编辑观看的陈列偏移只放在不导出的集合实例/陈列父级上。导出选择规范根子树，不能把展示区偏移或旋转烘焙进根。不要通过五份重复网格制作陈列与运行双套资产。
- 根与可寻址动组的scale保持1；网格应用建模比例，子节点保留下述必要局部平移。动组中位/闭合姿态导出rotation为0，候选初始运动角由未来代码设置，不能重复烘焙一次。
- 无皮肤骨骼、morph、跨根父子引用、动画剪辑、碰撞体、脚本、灯光/相机或陈列地面。采用刚性节点分件。共享少量PBR材质，纹理如有使用需嵌入GLB；零件名不能因合批/压缩丢失。

## 稳定层级与装配位置

下列英文名大小写固定，每个关键节点在整个库中唯一；额外螺栓/细节使用所属根前缀。`Static`直接归根，局部position/rotation为0。各Visual节点是允许包含多个mesh的装配组；不要用Blender自动`.001`后缀替代指定名。

### weight-seesaw / WeightSeesaw

```text
WeightSeesaw
├─ WeightSeesaw_Static
│  ├─ WeightSeesaw_Base
│  └─ WeightSeesaw_AxleFrame
└─ WeightSeesaw_Pivot
   └─ WeightSeesaw_DeckVisual
```

`Pivot`相对根为 `[0,h,0]`，轴 `[1,0,0]`。板中心就是枢轴，DeckVisual相对Pivot中心 `[0,0,0]`。intense-v2定向修改为主体 `[.7,.30,7]`，`h = 3.4 + 3.5*sin(25°) - .15*cos(25°)`（约4.743217748，以公式与导出浮点值为准）；根/part路径保持，轴架收窄、止挡按±25°配套。仍以水平板导出，正式初始角+25°/限角±25°由关卡配置控制，不烘焙进GLB。初版的2.2米宽/h≈3.5994/+8°已是历史尺寸，不再用于当前主体创建。

底座、固定轴架/止挡为Static；板、随板转动的轴套/装饰归Pivot。真实球重响应、动态板质量与板轴弹簧阻尼已在代码实现但未经运行验收，不能用图鉴预置动画证明负载效果；本轮配置与资源接入见 [intense-v2交付](level-03-refinements.md)。

### axial-roller / AxialRoller

```text
AxialRoller
├─ AxialRoller_Static
│  ├─ AxialRoller_BearingNear
│  └─ AxialRoller_BearingFar
└─ AxialRoller_Rotor
   └─ AxialRoller_DrumVisual
```

Rotor相对根 `[0,2.4,0]`，轴 `[0,0,1]`；DrumVisual以Rotor中心为局部0，主体尺寸 `[2,2,5]`、半径1，筒长沿Z。冠部Y3.4。候选角速度−.45rad/s使筒顶朝+X运动，不以视角“顺/逆时针”替代轴定义。条纹随Drum转且不凸出成齿；固定轴承留在Static，转轴若随筒转归Rotor。未来必须验证原生圆柱接触角速度，模型转动不等于物理已实现。

### piston-wall / PistonWall

```text
PistonWall
├─ PistonWall_Static
│  ├─ PistonWall_CylinderBody
│  └─ PistonWall_Guide
├─ PistonWall_Head
│  └─ PistonWall_HeadVisual
└─ PistonWall_Rod
   └─ PistonWall_RodShaft
```

以完全收回导出。Head相对根 `[-2.025,3.95,0]`，HeadVisual以头部刚体中心为0，主体 `[.35,1.1,1.6]`；轴向 `[1,0,0]`。最大头中心 `[1.675,3.95,0]`，行程3.7；前面是局部X=+.175，杆连后面X=−.175，不能把推墙原点设到前缘。

Rod与Head为根下的兄弟节点，避免随头平移又被二次平移。Rod原点是固定缸口，采用 `[-2.5,3.95,0]`；杆网格沿局部+X从0延至收回时的头后面，参考长度 `−2.2−outletX`（当前.3m）。导出scale=1。未来仅对RodShaft沿X按 `当前缸口到头后面距离 / referenceLength` 伸缩，Root、Head和静态缸体不缩放；套环/推头固定件不能焊入这段需要伸缩的杆网格。缸壳X范围[-6.7,-2.5]，杆半径.08、缸内/外半径.10/.16。全伸露杆4m，未来RodShaft沿X比例为(.3+3.7u)/.3，不能把3.7行程当全伸长度。最终采用实际.3米参考杆、缸口原点、导出scale=1；不采用1米中心杆和默认scale=.3的替代方案。

intense-v2新增真实杆身碰撞：parts中`PistonWall_Rod`明确提供`collisionRadius:.08`（米），沿用`extensionAxis:[1,0,0]`、`referenceLength:.3`及固定缸口position。Shaft不重复半径字段；Rod不填bodySize/bodyCenterOffset，主bodyPart仍为推头。CODE按同一端点计算外观与真实圆柱，局部范围始终是缸口→头后缘，长.3+3.7u、全伸4米。一个持续存在的kinematic圆柱通过原生shape轴向缩放同步长度并更新宽相包围盒，不仅缩放Render，也不逐帧重建刚体。收回只剩真实.3米露杆；没有静态整段长柱。见 [本轮接入](level-03-refinements.md)。

通道地面、前后等待袋属于关卡线路，不烘焙进机关库。可在源文件各自可拆Context集合做制作参照和展示，但Context不导入GLB、不属于运行根；不改变五根子树协议。design中的初版候选8秒周期属于历史记录；当前阶段以正式TS为准。

### timed-trapdoor / TimedTrapdoor

```text
TimedTrapdoor
├─ TimedTrapdoor_Static
│  ├─ TimedTrapdoor_AxleFrame
│  └─ TimedTrapdoor_Drive
└─ TimedTrapdoor_Pivot
   └─ TimedTrapdoor_DeckVisual
```

以闭合水平姿态导出。Pivot相对根 `[-1.1,3.4,0]`，轴 `[0,0,1]`；DeckVisual中心相对Pivot `[1.1,-.12,0]`，主体 `[2.2,.24,3]`。所有板层/同动件都在Pivot下，绕Z从0到−90°向下翻；不要保留补满开口的静态底板。固定岸不进库。

候选周期8.5秒：闭合4.5（含最后.9预告）、下翻1、打开1.5、回位1.5。该周期只进design，不导出自动播放轨道。运行时未来要同时计算偏心板质心的平移与旋转。

### sway-cradle-bridge / SwayCradleBridge

```text
SwayCradleBridge
├─ SwayCradleBridge_Static
│  ├─ SwayCradleBridge_GantryNear
│  ├─ SwayCradleBridge_GantryFar
│  └─ SwayCradleBridge_UpperAxle
└─ SwayCradleBridge_Pivot
   ├─ SwayCradleBridge_HangerVisual
   └─ SwayCradleBridge_DeckVisual
```

Pivot相对根 `[0,6.08,0]`，轴 `[0,0,1]`，导出中位0°。DeckVisual中心相对Pivot `[0,-2.8,0]`，主体 `[2.4,.24,5]`，中位顶Y3.4。刚性U架与板同属Pivot，彼此相对位置固定。HangerVisual在Pivot坐标下建模，可寻址组原点为0。

候选±9°/10秒；转角φ时板心为 `[2.8*sinφ,6.08−2.8*cosφ,0]`，板同时绕Z转φ。不是水平横移、软绳或多节桥。门架/上轴在Static，侧吊臂需在可行走包络外；可触及的支架以后必须另配真实代理。末端固定岛由关卡负责，不进库。

## 清单字段与交付

ART填写 `public/models/obstacle-library.json`，文件名固定。以下为格式示例，实际必须包含五项，包围盒/统计/哈希由导出结果填入，不能复制示例假值：

```json
{
  "schemaVersion": 1,
  "asset": "obstacle-library.glb",
  "units": "m",
  "upAxis": "+Y",
  "forwardAxis": "-Z",
  "referenceDeckY": 3.4,
  "glbSha256": "填写本次完整GLB哈希",
  "runtimeSupported": false,
  "entries": [
    {
      "id": "timed-trapdoor",
      "rootNode": "TimedTrapdoor",
      "restPose": "closed-horizontal",
      "rootBounds": { "min": [0,0,0], "max": [0,0,0] },
      "parts": [
        { "nodePath": "TimedTrapdoor_Static", "role": "static", "position": [0,0,0], "rotationDegrees": [0,0,0], "scale": [1,1,1] },
        { "nodePath": "TimedTrapdoor_Pivot", "role": "pivot", "position": [-1.1,3.4,0], "rotationDegrees": [0,0,0], "scale": [1,1,1], "axis": [0,0,1], "bodyCenterOffset": [1.1,-0.12,0], "bodySize": [2.2,0.24,3] }
      ],
      "design": { "implemented": false, "openAngleDegrees": -90, "cycleSeconds": 8.5 },
      "statistics": { "triangles": 0, "materials": 0 }
    }
  ]
}
```

`parts`至少列全上述关键命名节点；nodePath是相对该root的严格父子路径，例如 `TimedTrapdoor_Pivot/TimedTrapdoor_DeckVisual`，不含root本身。position/rotation/scale均相对直接父节点；axis是在未转动父坐标系中，bodyCenterOffset相对该运动节点。普通可渲染组role=`visual`，Head/Rod等平移动件role=`moving`。记录各可渲染子树的局部bounds与面数/材质统计；rootBounds为中位/闭合装配态的根坐标包围盒，不冒充整个运动扫掠范围。杆另外记录 `referenceLength` 与 `extensionAxis`，固定缸口可据Rod的position读取。

design只记本轮候选轴角/行程/周期与尺寸依据，不放脚本、表达式执行器或凭据，不当LevelConfig字段。整体及每项的triangles/materials/GLB bytes、源文件SHA、同动件轴心和必要装配预览写 `docs/art/obstacle-library-delivery.md`，图片放 `docs/art/obstacle-library/`。共享mesh/material统计注明去重口径，不能相加后宣称是整包去重数。

## PlayCanvas取用方案（已按此实现，未运行验收）

依据本机PlayCanvas 2.22.1源码：`GlbContainerResource.instantiateRenderEntity(options)`会遍历整包scene与节点，options是RenderComponent选项，**没有rootName选择参数**。`Entity.clone()`会克隆目标子树及Render组件，Render克隆会复用mesh/material资源。本协议因此采用以下可行接入方式，不依赖私有GLB数据结构：

1. 同一个Application/使用域内由现有createModelAssets按文件名缓存完整container请求，下载并解析**整份GLB**。
2. 后续库加载器一次调用instantiateRenderEntity，模板保持脱离app.root，绝不让五项同时加入场景。按清单确定唯一根；遍历直接child路径定位动静件，拒绝缺失、重名或层级不符，不静默拿第一个相似名字。
3. 从目标根 `clone()`，仅把这一棵克隆子树挂到实例父节点，施加该关卡的摆放变换。根/子组静态局部变换及指定枢轴必须保留；不要用重设每个子节点到0破坏装配。
4. 这是“整包模板一次构建、每实例仅克隆目标子树”的方案，**不是首次只解析/实例化某个根**，也不是网络部分下载。即使只用一个机关，整包GPU/解析资源可能仍已持有；合包不保证首次下载更小。
5. 多个实例共享同一资产的mesh/material，销毁单实例仅销毁该实体子树；不能卸载共享container或destroy共享材质。某实例若需要独立染色，未来需克隆相应材质并自行释放，不能修改模板共享材质影响其他实例。
6. 使用域退出时依次销毁全部实例、未挂载模板，再由资源池unload/remove完整container一次。处理取消/失败后的迟到资源，资源池不能在仍有实例/模板使用时释放；不跨Application共享GPU资源。

只有刚性本地子树才能安全按此克隆，所以本轮禁止跨根骨骼/动画/skin/灯光依赖。模型只供Render，真实碰撞由未来机关代码使用清单尺寸/枢轴与获准关卡参数创建，不从GLB外形自动生成或将全包合并代理。

## 资产协议阶段边界与接入状态

资产协议阶段仅交本文；后续按第三关任务实现了库选择/克隆/释放、图鉴分件动画、单铰链跷跷板和四种运动学机关，并注册正式第三关配置。运行时接口及物理边界以 [第三关协议](level-03-contract.md) 为准。没有test/build/浏览器或动力验证，没有Git写操作及新备份；代码就绪不能当作第三关已通关或接触动力已验收。
