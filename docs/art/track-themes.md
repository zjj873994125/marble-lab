# 七套赛道皮肤 · 美术定稿与材质映射

2026-09-14。对应[产品要求](../product/track-themes.md)。本次只交配色/PBR和制作对照图，不修改任何Blender源、GLB、材质分区或模型交付校验值。CODE负责实时切换/持久化/作用域资源管理；本文件不宣称已通过浏览器或运行验收。

## 七主题视觉决定

本轮按用户反馈重新拉开主体色差：**奶油 / 中深钢蓝灰 / 鲜明冰青蓝 / 炭黑**。原工业近白与冰川冷白值已被本稿覆盖；classic与black-gold参数保持，glacier稳定id不变、中文名为「冰蓝极境」。

- **classic / 经典奶油**：精确恢复每个来源材质的原始值。不能把各资源不同的奶油、平台珐琅或旧fallback强制统一成一套近似颜色。
- **industrial / 工业钢铁**：中深钢蓝灰台面 **#526C88**、深石墨底架、浅银合金；以明确降低主体亮度形成工业感，保持有限金属感和中高粗糙度，黄色用于独立锤壳，安全橙边缘保留。
- **glacier / 冰蓝极境**：鲜明中亮冰青蓝台面 **#69CBE0**、蓝灰结构、冰蓝独立锤壳、靛紫水；不透明、不增加折射或“冰面摩擦”。
- **black-gold / 黑金竞技**：炭灰台面、暖金金属、明亮金黄色水。台面从候选#282E35提亮为 **#383F47**，roughness=.58，给受保护的钢球和深刻度留亮度空间。

本轮追加三款，原四款JSON保持原值。主体覆盖奶油、钢蓝灰、冰青蓝、炭黑、紫晶紫、樱粉、暖黄；新增款不做近白淡色。

- **violet / 紫晶幻境**：台面#9569D4，深紫灰结构与深梅紫水，浅冷银金属；保持紫色饱和度。
- **pink / 樱粉乐园**：台面#E68DB8，暗梅灰支架与莓红水，银粉合金；不做高曝光近白粉。
- **yellow / 暖阳赛道**：台面#E8C64A，深蓝灰结构与翡翠绿水，冷银金属；黄色覆盖台面，区别于奶油底色或黑金只染金属。橙色警示、终点环及其几何保持；不将这些标记改黄。

**明确的混用限制：** 当前GLB的`Safety terracotta`同时属于护栏/边缘/夹层/推头和已烘焙的橙色警示线；这些面可能在同一primitive里。仅按材质名无法只染装饰而保留警示。为遵守本轮保护要求、且不改GLB，**该名称在整包中保留原PBR**。因此部分GLB护栏仍为橙色，不能把主题卡画成全黄/全冰蓝/全金护栏并声称3D一致。`accent`在七套主题均保留安全橙，只用于缩略图采样；运行时原orange也不染色，锤壳单独走hammer；不靠原RGB分割混合材质。

## 角色参数

下面HEX为sRGB颜色，metalness/roughness范围0–1。它们是视觉参数，绝不写入球或赛道碰撞摩擦。PlayCanvas PBR按实际材质glossInvert处理：GLB导入glossInvert=true时写roughness，普通primitive/water写1−roughness，材质其它贴图/分区/透明度/法线保持。导入GLB的原始baseColorFactor是linear，Blender预览应先将HEX转linear，不能把HEX分量直接当linear。

classic中的值**只供主题卡/简图采样**；3D classic实际使用每个原材质完整快照，尤其fallback与精细GLB原值不同。

### classic / 经典奶油

```json
{
  "deck": {
    "color": "#DEDBD0",
    "metalness": 0,
    "roughness": 0.34
  },
  "accent": {
    "color": "#D96836",
    "metalness": 0,
    "roughness": 0.32
  },
  "structure": {
    "color": "#344B50",
    "metalness": 0.18,
    "roughness": 0.4
  },
  "alloy": {
    "color": "#9BAAAA",
    "metalness": 0.62,
    "roughness": 0.3
  },
  "platform": {
    "color": "#729EAA",
    "metalness": 0,
    "roughness": 0.34
  },
  "hammer": {
    "color": "#F1B82D",
    "metalness": 0,
    "roughness": 0.32
  },
  "handle": {
    "color": "#252A2D",
    "metalness": 0,
    "roughness": 0.58
  },
  "water": {
    "color": "#123C45",
    "metalness": 0,
    "roughness": 0.32
  },
  "poolEdge": {
    "color": "#617B80",
    "metalness": 0,
    "roughness": 0.65
  }
}
```

### industrial / 工业钢铁

```json
{
  "deck": {
    "color": "#526C88",
    "metalness": 0.4,
    "roughness": 0.5
  },
  "accent": {
    "color": "#D96836",
    "metalness": 0,
    "roughness": 0.32
  },
  "structure": {
    "color": "#303C47",
    "metalness": 0.35,
    "roughness": 0.55
  },
  "alloy": {
    "color": "#C5D1D7",
    "metalness": 0.75,
    "roughness": 0.3
  },
  "platform": {
    "color": "#789BB2",
    "metalness": 0.2,
    "roughness": 0.42
  },
  "hammer": {
    "color": "#F2B635",
    "metalness": 0,
    "roughness": 0.38
  },
  "handle": {
    "color": "#252A2D",
    "metalness": 0,
    "roughness": 0.58
  },
  "water": {
    "color": "#101316",
    "metalness": 0,
    "roughness": 0.34,
    "reflectivity": 0.4
  },
  "poolEdge": {
    "color": "#445866",
    "metalness": 0.2,
    "roughness": 0.55
  }
}
```

### glacier / 冰蓝极境

```json
{
  "deck": {
    "color": "#69CBE0",
    "metalness": 0.03,
    "roughness": 0.42
  },
  "accent": {
    "color": "#D96836",
    "metalness": 0,
    "roughness": 0.32
  },
  "structure": {
    "color": "#304C63",
    "metalness": 0.2,
    "roughness": 0.5
  },
  "alloy": {
    "color": "#B6D2DF",
    "metalness": 0.65,
    "roughness": 0.28
  },
  "platform": {
    "color": "#3299BE",
    "metalness": 0.08,
    "roughness": 0.38
  },
  "hammer": {
    "color": "#4FAECC",
    "metalness": 0,
    "roughness": 0.38
  },
  "handle": {
    "color": "#252A2D",
    "metalness": 0,
    "roughness": 0.58
  },
  "water": {
    "color": "#34325E",
    "metalness": 0,
    "roughness": 0.3,
    "reflectivity": 0.3
  },
  "poolEdge": {
    "color": "#55778B",
    "metalness": 0.1,
    "roughness": 0.5
  }
}
```

### black-gold / 黑金竞技

```json
{
  "deck": {
    "color": "#383F47",
    "metalness": 0.1,
    "roughness": 0.58
  },
  "accent": {
    "color": "#D96836",
    "metalness": 0,
    "roughness": 0.32
  },
  "structure": {
    "color": "#45413B",
    "metalness": 0.25,
    "roughness": 0.52
  },
  "alloy": {
    "color": "#BFA76E",
    "metalness": 0.7,
    "roughness": 0.32
  },
  "platform": {
    "color": "#53616B",
    "metalness": 0.12,
    "roughness": 0.48
  },
  "hammer": {
    "color": "#D4AC53",
    "metalness": 0,
    "roughness": 0.38
  },
  "handle": {
    "color": "#252A2D",
    "metalness": 0,
    "roughness": 0.58
  },
  "water": {
    "color": "#C6A128",
    "metalness": 0,
    "roughness": 0.38,
    "reflectivity": 0.32
  },
  "poolEdge": {
    "color": "#8AA1A1",
    "metalness": 0.2,
    "roughness": 0.55
  }
}
```

### violet / 紫晶幻境

```json
{
  "deck": {
    "color": "#9569D4",
    "metalness": 0.05,
    "roughness": 0.44
  },
  "accent": {
    "color": "#D96836",
    "metalness": 0,
    "roughness": 0.32
  },
  "structure": {
    "color": "#34314D",
    "metalness": 0.2,
    "roughness": 0.55
  },
  "alloy": {
    "color": "#BFC0D7",
    "metalness": 0.65,
    "roughness": 0.32
  },
  "platform": {
    "color": "#684AAC",
    "metalness": 0.08,
    "roughness": 0.44
  },
  "hammer": {
    "color": "#C49AED",
    "metalness": 0,
    "roughness": 0.4
  },
  "handle": {
    "color": "#252A2D",
    "metalness": 0,
    "roughness": 0.58
  },
  "water": {
    "color": "#492B68",
    "metalness": 0,
    "roughness": 0.35,
    "reflectivity": 0.3
  },
  "poolEdge": {
    "color": "#4E5278",
    "metalness": 0.15,
    "roughness": 0.55
  }
}
```

### pink / 樱粉乐园

```json
{
  "deck": {
    "color": "#E68DB8",
    "metalness": 0.03,
    "roughness": 0.45
  },
  "accent": {
    "color": "#D96836",
    "metalness": 0,
    "roughness": 0.32
  },
  "structure": {
    "color": "#423545",
    "metalness": 0.2,
    "roughness": 0.55
  },
  "alloy": {
    "color": "#CEB8C5",
    "metalness": 0.65,
    "roughness": 0.32
  },
  "platform": {
    "color": "#B65B91",
    "metalness": 0.08,
    "roughness": 0.44
  },
  "hammer": {
    "color": "#F3B2D3",
    "metalness": 0,
    "roughness": 0.4
  },
  "handle": {
    "color": "#252A2D",
    "metalness": 0,
    "roughness": 0.58
  },
  "water": {
    "color": "#69344F",
    "metalness": 0,
    "roughness": 0.35,
    "reflectivity": 0.28
  },
  "poolEdge": {
    "color": "#586B73",
    "metalness": 0.15,
    "roughness": 0.55
  }
}
```

### yellow / 暖阳赛道

```json
{
  "deck": {
    "color": "#E8C64A",
    "metalness": 0.05,
    "roughness": 0.46
  },
  "accent": {
    "color": "#D96836",
    "metalness": 0,
    "roughness": 0.32
  },
  "structure": {
    "color": "#343E4B",
    "metalness": 0.2,
    "roughness": 0.55
  },
  "alloy": {
    "color": "#B5C1CD",
    "metalness": 0.65,
    "roughness": 0.32
  },
  "platform": {
    "color": "#AC8E2D",
    "metalness": 0.08,
    "roughness": 0.44
  },
  "hammer": {
    "color": "#F3DB77",
    "metalness": 0,
    "roughness": 0.4
  },
  "handle": {
    "color": "#252A2D",
    "metalness": 0,
    "roughness": 0.58
  },
  "water": {
    "color": "#22584B",
    "metalness": 0,
    "roughness": 0.35,
    "reflectivity": 0.3
  },
  "poolEdge": {
    "color": "#4E6577",
    "metalness": 0.15,
    "roughness": 0.55
  }
}
```

水色最新修订：按用户纠正，industrial改近黑黑海、black-gold改明亮金黄色水；其余五款水及七款所有非water角色保持上一轮值。下列清单为当前最终值。

- industrial：近黑黑海 **#101316**，roughness .34 / gloss .66 / reflectivity **.40**。
- glacier：靛紫 **#34325E**，roughness .30 / gloss .70 / reflectivity **.30**。
- black-gold：明亮金黄 **#C6A128**，roughness .38 / gloss .62 / reflectivity **.32**。
- violet：深梅紫 **#492B68**，roughness .35 / gloss .65 / reflectivity **.30**。
- pink：莓红 **#69344F**，roughness .35 / gloss .65 / reflectivity **.28**。
- yellow：翡翠绿 **#22584B**，roughness .35 / gloss .65 / reflectivity **.30**。
- classic：保留原 **#123C45 / gloss .68 / reflectivity .45**，运行时仍精确恢复原材质基线。

水为独立流程：`Pool fine ripples`保留useMetalness=false、specular=[.025,.025,.025]、normalMap、water_offsets/water_detail和既有水速/画质/暂停时钟。金属度全为0，粗糙度沿用上一轮；仅适度降低非classic反射强度，让固定蓝色环境不压过主题底色。CODE若需处理中性/随主题的水面反射色，仅限水专用反射路径，classic原环境与球钢材cubeMap保持，纹理作用域与释放归属不变。

保留既有连续动态细波/高光，不采用不动哑光色板，不靠更改灯光/全局色调掩盖问题。新水色应与各台面保持明显色相或亮度分离：钢蓝灰对近黑黑海、冰青蓝对靛紫、炭黑对明亮金黄、亮紫/亮粉对深梅紫/莓红、暖黄对翡翠绿。球、CP与安全橙仍按保护清单不染色。制作图使用临时程序细波法线表达波光方向，不能等同WebGL水材质/环境反射的运行验收。

## 实际材质名映射

对名称先trim，再只剥离一个或连续多个末尾`.数字三位`后缀，如`Ivory polymer.001`→`Ivory polymer`；然后精确匹配全名。不能使用includes("steel")或颜色近似检测。未知名原样保留。原始材质快照按**材质对象/资源作用域**缓存，不按归一名称共用一份基线。

- `Ivory polymer` → deck。
- `Graphite chassis` → structure。
- `Brushed alloy` → alloy。与球材质无关，不能把所有金属都归这里。
- `Platform enamel` → platform。横移/升降主体保留相对普通台面不同的涂层颜色。
- `Toy amber shell` → hammer。独立玩具锤壳可随主题改变，不增加金属性。
- `Toy charcoal handle` → handle，但保持原色/metalness0/roughness.58；不用把握柄染成合金。
- `Safety terracotta` → **protected / 原值**，原因见混用限制。
- `Printed markings` → **protected / 原值**，包括转台方向线、平台文字和刻度。
- `Rubber pads` → **protected / 原值**。
- `Polished bearing steel` → **protected player**，运行时实际球材质；保持metalness1/gloss.93、原diffuse、环境反射、normal/微纹更新、reflectivity1。
- `Pool fine ripples` → **water专用**；不经过普通GLB材质克隆染色逻辑。

fallback键只能辅助，不代替实体语义：cream→deck，dark→structure，edge→alloy，blue→platform（仅普通平台），poolEdge→poolEdge；orange→protected，七主题都保留各自基线，包括普通边缘、warning、方向提示、CP与起终圈。由于当前orange同时供圈/提示共用，不能直接原地修改公共orange材质导致保护对象被染。pool basin/floorMat采用对应structure/poolEdge或独立低饱和池体色，未知地面不自动处理。

## 当前资产覆盖清单

以下来自直接解析磁盘GLB，当前13份（含历史）均无材质数字后缀；源码里的后缀不能据此忽略。

- `public/models/hammer-handle-round-03.glb`：`Brushed alloy`, `Graphite chassis`。
- `public/models/hammer-handle-toy-round-03.glb`：`Toy charcoal handle`。
- `public/models/hammer-head-round-03.glb`：`Safety terracotta`, `Brushed alloy`, `Graphite chassis`。
- `public/models/hammer-head-toy-round-03.glb`：`Toy amber shell`, `Toy charcoal handle`。
- `public/models/mechanism-trial-track.glb`：`Ivory polymer`, `Safety terracotta`, `Graphite chassis`, `Rubber pads`, `Brushed alloy`。
- `public/models/obstacle-library.glb`：`Safety terracotta`, `Graphite chassis`, `Ivory polymer`, `Brushed alloy`, `Printed markings`, `Rubber pads`。
- `public/models/platform-refined.glb`：`Platform enamel`, `Graphite chassis`, `Safety terracotta`, `Printed markings`, `Brushed alloy`, `Ivory polymer`。
- `public/models/track-refined.glb`：`Ivory polymer`, `Graphite chassis`, `Safety terracotta`, `Rubber pads`, `Brushed alloy`, `Platform enamel`, `Printed markings`。
- `public/models/track-round-02.glb`：`Safety terracotta`, `Brushed alloy`, `Graphite chassis`, `Printed markings`, `Ivory polymer`, `Rubber pads`。
- `public/models/track-round-03.glb`：`Safety terracotta`, `Brushed alloy`, `Graphite chassis`, `Printed markings`, `Ivory polymer`, `Rubber pads`。
- `public/models/water-rush-lift.glb`：`Platform enamel`, `Graphite chassis`, `Safety terracotta`, `Brushed alloy`。
- `public/models/water-rush-track.glb`：`Ivory polymer`, `Graphite chassis`, `Safety terracotta`, `Rubber pads`, `Brushed alloy`。
- `public/models/water-rush-turntable.glb`：`Ivory polymer`, `Graphite chassis`, `Safety terracotta`, `Printed markings`。

本轮读取6份源文件的真实名称：

- `art/track-round-03.blend`：`Brushed alloy`, `Graphite chassis`, `Ivory polymer`, `Platform enamel`, `Printed markings`, `Rubber pads`, `Safety terracotta`。
- `art/hammer-toy-round-03.blend`：`Toy amber shell`, `Toy charcoal handle`。
- `art/water-rush.blend`：`Brushed alloy`, `Brushed alloy.001`, `Graphite chassis`, `Graphite chassis.001`, `Ivory polymer`, `Ivory polymer.001`, `Platform enamel`, `Platform enamel.001`, `Printed markings`, `Printed markings.001`, `Rubber pads`, `Safety terracotta`, `Safety terracotta.001`, `Toy amber shell`, `Toy charcoal handle`。
- `art/mechanism-trial.blend`：`Brushed alloy`, `Graphite chassis`, `Ivory polymer`, `Printed markings`, `Rubber pads`, `Safety terracotta`。
- `art/obstacle-library.blend`：`Brushed alloy`, `Graphite chassis`, `Ivory polymer`, `Printed markings`, `Rubber pads`, `Safety terracotta`。
- `art/track-refined.blend`：`Brushed alloy`, `Graphite chassis`, `Ivory polymer`, `Platform enamel`, `Printed markings`, `Rubber pads`, `Safety terracotta`。

mechanism-trial源同时有本地与链接库的同名材质，名字相同不代表同一数据块；必须分别保存原值。water-rush源实际包含`.001`变体。旧胶囊锤/历史轨道不主动加载或迁移，仅提供映射兼容。

## classic精确基线参考

下列linear RGBA与PBR来自本轮实际GLB；HEX只用于人读。恢复时应使用当前加载对象原始快照，不能把此表当所有材质的强制覆盖值。

- `Brushed alloy`：#9BAAAA；linear RGBA=[0.3277781, 0.40197778, 0.40197778, 1]；metalness=0.62，roughness=0.3。
- `Graphite chassis`：#344B50；linear RGBA=[0.03433981, 0.07036009, 0.08021982, 1]；metalness=0.18，roughness=0.4。
- `Ivory polymer`：#DEDBD0；linear RGBA=[0.73046076, 0.70837575, 0.63075715, 1]；metalness=0，roughness=0.34。
- `Platform enamel`：#729EAA；linear RGBA=[0.1682694, 0.34191442, 0.40197778, 1]；metalness=0，roughness=0.34。
- `Printed markings`：#617477；linear RGBA=[0.11953843, 0.17464741, 0.18447499, 1]；metalness=0，roughness=0.65。
- `Rubber pads`：#293334；linear RGBA=[0.02217389, 0.03310477, 0.03433981, 1]；metalness=0，roughness=0.75。
- `Safety terracotta`：#D96836；linear RGBA=[0.69387174, 0.13843161, 0.03688945, 1]；metalness=0，roughness=0.32。
- `Toy amber shell`：#F1B82D；linear RGBA=[0.8796224, 0.47932017, 0.02624122, 1]；metalness=0，roughness=0.32。
- `Toy charcoal handle`：#252A2D；linear RGBA=[0.01850022, 0.02315337, 0.02624122, 1]；metalness=0，roughness=0.58。

## 球、检查点、终点与警示保护

1. 球体及图鉴示意球：按实际Entity/专用材质标记排除；不改球钢材反射、颜色、微纹、尺寸、质量、碰撞、摩擦或控制。
2. `Checkpoint n`未激活蓝色、已激活橙色，`Start ring`/`Finish ring`、进度/终点标记：独立材质身份保护；主题切换不得重置是否已激活、大小、位置或检测条件。
3. 机关独立warning灯：保留原橙色/emissive及预告时钟，保护名称/注册语义；不通过改变阶段灯色假装主题换肤。
4. 运行时窄梁警示条、推墙危险带边界、方向指示、平台stripe和辅助预告：不能仅因material=orange/blue就染色。严格警示实体保持基线。混烘焙的Safety整材质保留。
5. `Printed markings`、橡胶/握柄保持基线；保护alpha、纹理、法线、emissive及贴花分区。不用CSS全图滤镜替代材质映射。
6. UI/HUD/品牌色与设置卡以外页面样式不属于赛道材质；主题不改变计时/CP/相位/存档桶/纯净模式阈值/水速。

黑金终点与普通暖金合金通过受保护橙色环、形状和位置区分。冰青蓝台面与检查点蓝色依靠保留的环状几何、蓝灰支撑和深靛紫水底增强阅读；实际钢球/标记在各设备曝光中的可读性尚未做浏览器验收，不能仅凭HEX称对比已达标。

## 制作图与交接边界

[七主题统一机位制作对照](track-themes-preview.png)使用同一组现有第三关/共享库几何与光照，只在临时Blender进程内换材质；混用安全橙、刻度/橡胶遵守保护策略。机位、几何、标记和光照保持一致，不提供七份模型，也不修改任何.blend/GLB。图为美术设计对照，不是实时浏览器截图；反射、色调映射和动态水纹以CODE实际运行效果为准。

CODE已直接收到全部名称映射及palette，无需等图才开发。classic恢复、迟到资源、共享模板、图鉴主题和纯净模式等逻辑由CODE负责；图片类图鉴缩略图若仍采用经典配色，界面不得假称它们已跟随当前主题。

本次没有test/build/typecheck/浏览器/试玩/Git/部署。只输出本文件和track-themes-preview.png；尺寸、坐标、原点、材质槽数和三角面数均未变，所有模型沿用当前交付。本轮读取证据用于配色，不新增模型版本、外部纹理或备份。

交付时再次读取13份GLB与6份源文件的SHA-256，均与本轮材质清点时一致。这只是文件未被改写的记录，不是运行测试。对照图中的球与CP环为统一可读性参照，钢球使用原金属/粗糙度量级，未复刻游戏专用环境贴图；七图均保持同一球/环设置。

七款收口：本轮只追加violet/pink/yellow三个完整九角色JSON与水参数，原classic/industrial/glacier/black-gold JSON保持不变。CODE已回传三款实际配置接入、设置列表/存储接受值同步。总览采用四款在上、三款居中在下，七个等尺寸同机位画面，没有第八张占位卡。模型文件、几何、材质槽和碰撞均未改；未运行浏览器或测试验收。

当前水色定稿覆盖文中上一轮“深蓝/深青水”方向；本轮实际改动仅上述六个water颜色/反射值与同名预览，未调整模型或其他角色。

商城本轮水色只改industrial与black-gold，已采用#101316黑海/.40反射及#C6A128金黄/.32反射。提高中性波光保留水质感，不改变钢球反射；其余water与全部非water JSON保持。五款球皮肤另见[ball-skins.md](ball-skins.md)，赛道主题仍不能覆盖玩家材质。
