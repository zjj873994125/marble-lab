# 九款小球皮肤 · 材质与环纹交付

2026-09-14，对应[皮肤商城需求](../product/skin-shop.md)。只制作同球体材质设计及轻量图片，不改源文件、GLB、球几何或物理。CODE负责实际材质切换/持久化/页面，图为制作参照，不是浏览器验收。

## 共用基线

已读取当前 `src/game/steel-material.ts`：材质名 `Polished bearing steel`，useMetalness=true，metalness=1，diffuse=new Color(.82,.83,.84)，gloss=.93，reflectivity=1；球专用128×128六面灰阶studio cubemap、256×128球UV微纹normalMap，滚动时bumpiness=.18×smooth(.02,.35,speed)，停止时渐隐微纹。默认steel必须逐项恢复这些实际值，不能用下面近似HEX反向替换默认数值，也不能被每帧update重置所选颜色或环纹。

九款皮肤共用原直径 **.85米** 的平滑球（半径.425），原UV与实际旋转，根/碰撞/惯量/质量/摩擦/输入/相机不改。前五款保留原studio环境和速度驱动微纹；四款运动球使用各自非金属纹理/粗糙度，切回steel准确恢复原微纹；不旋转环境冒充球滚动，不用纯黑球/塑料球替代金属。赛道主题映射继续排除玩家材质，ballSkin与trackTheme独立。

## 最终参数

color为sRGB HEX；默认steel以explicitDiffuse数组为精确来源。以下gloss均为普通金属StandardMaterial值（roughness=1−gloss），metalness、reflectivity范围0–1。没有emissive、透明、额外清漆或凸条。字段按CODE最终类型对齐，本稿给出无歧义数值。

```json
[
  {"id":"steel","name":"亮银钢球","color":"#D1D4D6","explicitDiffuse":[0.82,0.83,0.84],"metalness":1,"gloss":0.93,"roughness":0.07,"reflectivity":1,"pattern":"none"},
  {"id":"titanium","name":"黑钛","color":"#424C58","metalness":1,"gloss":0.86,"roughness":0.14,"reflectivity":1,"pattern":"none"},
  {"id":"rose-gold","name":"玫瑰金","color":"#C88F7B","metalness":1,"gloss":0.88,"roughness":0.12,"reflectivity":1,"pattern":"none"},
  {"id":"ice-blue","name":"冰蓝金属","color":"#74B8D6","metalness":0.95,"gloss":0.90,"roughness":0.10,"reflectivity":1,"pattern":"none"},
  {"id":"ringed-steel","name":"环纹钢球","color":"#D1D4D6","explicitDiffuse":[0.82,0.83,0.84],"metalness":1,"gloss":0.93,"roughness":0.07,"reflectivity":1,"pattern":"latitude-rings","ringColor":"#7F8E99","ringGloss":0.80,"ringRoughness":0.20,"ringCentersV":[0.32,0.50,0.68],"ringWidthV":0.008,"ringFeatherV":0.002}
]
```

- 亮银：当前原效果，清楚的灰阶环境/亮条与暗部交替，不额外调亮默认光照。
- 黑钛：偏冷深灰金属，底色有可见亮度，反射强度仍1；用略高粗糙度保持较宽高光，不做#000纯黑。
- 玫瑰金：温暖铜粉底色配中低粗糙度，高光保持金属质感；不做粉色塑料。
- 冰蓝：明确蓝色金属，metalness .95，不使用透明冰、玻璃折射或减摩擦。
- 环纹：原银钢底上三道克制的深银纬圈，颜色/粗糙度均为材质效果；侧边没有凸环、切槽或额外碰撞。

## 无缝环纹规格

使用当前球UV的纬向v，三中心v=.32/.50/.68。每圈实色全宽.008，向两侧各再羽化.002；对某中心c，d=abs(v−c)，遮罩为1−smoothstep(.004,.006,d)，三圈取max。u不参与遮罩，所以U=0与U=1完全一致；仅三个中心各自±.006范围内有环，不接近两极。极点不添加汇聚线或接缝。

实现可用一张 **1024×512** 的程序生成单通道遮罩（或同等采样密度的现有材质通道），本地生成、线性遮罩色彩空间、mipmap及正常过滤、U repeat/V clamp。全宽约4个纹素，可避免只落1像素的闪烁。遮罩同时混合底色与环色、roughness .07→.20，metalness始终1。它不是高度图，不叠到normalMap或产生凸起；原polish normalMap仍单独使用。若CODE选择直接生成diffuse/gloss纹理，也必须满足同一遮罩、无缝和颜色空间规则，进入steel时移除环纹并恢复原贴图。

环纹绑定球UV，随球真实旋转自然变化；不随视线、世界水纹或独立时间滚动。停止时细环保留，只让原微观polish的bumpiness按既有逻辑渐隐。暂停、换皮肤、恢复默认不能重建/重置刚体或旋转。

## 四款运动球 · 实际可用纹理

最新总数为9：前五款保持，再加basketball篮球、soccer足球、tennis网球、eight-ball桌球黑 8。没有羽毛球皮肤或第十张卡。这四款保持原平滑球和直径.85米，以非金属材质表达橡胶/球革、绒面或树脂，不能沿用metalness1把所有运动球做成金属涂色。

四款的baseColor图已含最终颜色，材质color乘白#FFFFFF；roughness图为**绝对粗糙度**，不要再乘表中的fallback roughness二次压暗。PlayCanvas若使用glossMap则开启相应粗糙度反向语义或转换为1−roughness，单通道读取r。下表roughness数字仅用于贴图未加载时的外观回退。原metal polish不与运动球微表面叠加；切回steel重新使用原normal/渐隐。reflectivity只作球皮肤材质参数，不改球环境贴图或水环境。

```json
[
  {
    "id": "basketball",
    "name": "篮球",
    "color": "#FFFFFF",
    "metalness": 0,
    "roughness": 0.74,
    "reflectivity": 0.35,
    "maps": {
      "color": "basketball-basecolor.png",
      "roughness": "basketball-roughness.png",
      "normal": "basketball-normal.png"
    },
    "normalStrength": 0.2
  },
  {
    "id": "soccer",
    "name": "足球",
    "color": "#FFFFFF",
    "metalness": 0,
    "roughness": 0.56,
    "reflectivity": 0.4,
    "maps": {
      "color": "soccer-basecolor.png",
      "roughness": "soccer-roughness.png",
      "normal": "soccer-normal.png"
    },
    "normalStrength": 0.1
  },
  {
    "id": "tennis",
    "name": "网球",
    "color": "#FFFFFF",
    "metalness": 0,
    "roughness": 0.91,
    "reflectivity": 0.18,
    "maps": {
      "color": "tennis-basecolor.png",
      "roughness": "tennis-roughness.png",
      "normal": "tennis-normal.png"
    },
    "normalStrength": 0.14
  },
  {
    "id": "eight-ball",
    "name": "桌球黑 8",
    "color": "#FFFFFF",
    "metalness": 0,
    "roughness": 0.12,
    "reflectivity": 0.65,
    "maps": {
      "color": "eight-ball-basecolor.png",
      "roughness": "eight-ball-roughness.png"
    },
    "normalStrength": 0
  }
]
```

所有maps相对 `docs/art/ball-skins/`，CODE复制到自身src/assets后由各Application按需加载/缓存。11张纹理：4张basecolor + 4张roughness + 3张normal；黑8不需要normal。每张1024×512等距球UV，basecolor为RGB/sRGB，roughness灰度L/linear，normal为RGB切线空间/linear。推荐mipmap、U repeat/V clamp、常规线性过滤；球UI小图与运行时都用球真实UV，不用CSS滤镜替代。

本地纹理采样约定：图像顶行θ=0为北极，底行θ=π为南极，列φ从0到2π；单位球坐标p=[sinθ cosφ, cosθ, sinθ sinφ]。首尾列完全相同、两极常色/平法线，避免U接缝与极点噪点。若引擎图像上传Y翻转规则不同，只在统一纹理装载约定中转换一次，不能让color/roughness/normal各翻一次造成错位；后续CODE依据现有SphereGeometry UV实际装载。

- **篮球**：橙色球革底、深黑大圆/弧瓣接缝，球面连续高频粒纹以basecolor、roughness及轻normal共同表现。无球队标志或外来商标，缝与颗粒不改球轮廓。
- **足球**：从正二十面体截角构造12个五边形和20个六边形，再径向投影为球面分区；五边黑、六边米白、细灰接缝。实际纹理为32块球面多边形，不是棋盘格或随机斑点。
- **网球**：黄绿色绒面与奶油白连续S形弧线。高粗糙度和轻微方向连续细纹表达绒感，避免镜面黄色球；不生成毛发几何。
- **桌球黑 8**：非纯零值黑树脂底#171A1F，低粗糙度亮面。单位球±Z两侧分别作白圆黑8，背面切平面横向坐标反向，朝各自外侧观察时数字正读；圆标是球面贴图，随真实旋转，绝不屏幕朝向广告牌。无凸出圆牌或外伸几何。

本轮程序原创生成纹理，没有下载球队logo、商业IP球面或任何外部贴图。八份basecolor/roughness加三normal共用本目录，不输出新的.glb/.blend。运动球与五金属球最终卡片各一张透明640×640 PNG，按相同球体、相同摄像机、相同studio明暗生成。

## 轻量图与预览

[九款统一球体/光照对照](ball-skins-preview.png)。各卡片PNG置于 `docs/art/ball-skins/`，名称为steel.png、titanium.png、rose-gold.png、ice-blue.png、ringed-steel.png、basketball.png、soccer.png、tennis.png、eight-ball.png；CODE可复制压缩到src/assets，不为每张卡常驻WebGL/Ammo。若运行预览需要旋转，最多一个按需画布并释放自有资源。

制作使用同一个.85米平滑球、同一固定朝向、同一中性studio明暗环境。环境分布复用当前steel-material.ts的方向函数生成于临时内存，不下载图片；不同渲染器的金属BRDF、曝光、UV与gloss实现可能导致像素差异，不把制作图声称为游戏实测效果。环纹图是同一规则的制作表现。

本轮只交docs/art图文，不改任何模型/源/用户GUI，不新增纹理下载或模型备份，不test/build/typecheck/浏览器试玩/Git/部署。实际商店装备、v3保存、默认恢复、共享材质生命周期与球体可读性由CODE实现并如实标注未验证。

最终交付共9张透明640×640球卡PNG和11张1024×512程序纹理PNG，合计20张，另有一张九宫格总览。制作环境在原灰阶studio方向函数基础上加同一中性柔光，九款相同；仅用来比较材质，默认steel游戏参数仍精确保留源代码基线。CODE收到实际图与纹理后可定向复制，不需要重建球网格。
