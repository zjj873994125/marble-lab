# 皮肤商城 · 七赛道与九小球交付

2026-09-14，依据 [商城需求](../product/skin-shop.md)。已完成商城、赛道入口迁移、九球材质与资源接入；同一批水色和性能同行布局也已实现。没有运行test/build/typecheck、浏览器、Git写操作或部署，以下是代码交付，不是发布/观感/碰撞验收。

## 入口与装备

导航顺序保持“开始 → 障碍图鉴 → 我的纪录 → 皮肤商城”，新Hash地址`/#/skins`可直接进入。导航在小窗口横向滚动，保留可点击文字，不压成窄字列。商城两个分类为赛道皮肤/小球皮肤，卡片仅图片、名字、已装备标记，点击直接保存，无确认、价格、货币、购买、解锁或广告。

七款赛道从SettingsPanel移到商城，继续复用trackThemes/ThemeThumbnail/trackTheme；设置里不留重复的皮肤选择。设置保留纯净模式、画质、水速、音量、灵敏度、性能信息和减少动态。恢复默认仍恢复全部设置，包括classic赛道、steel球与关闭性能。

商城为静态卡片页面，不创建额外WebGL/Ammo。首页菜单进入商城时卸载背景GameCanvas，离页后按当前装备重新创建菜单预览；没有调用startRun或把装备计作游玩，也不写入一条成绩。游戏中既有暂停/返回主菜单流程保持，材质setSkin/applySettings本身不重开或更换刚体。

普通页面三列，≤900px两列、≤480px一列，自然滚动，无空白第十款。九张球卡使用ART同球/同光制作PNG，CODE压成400×400透明图；赛道卡继续用token驱动SVG。图片是外观参照，不是当前浏览器截图。

## 九款实际球皮肤

- steel / 亮银钢球：精确原默认diffuse=[.82,.83,.84]、metalness1、gloss.93、reflectivity1，保留原studio环境与polish法线。
- titanium / 黑钛：#424C58、metalness1、roughness.14。
- rose-gold / 玫瑰金：#C88F7B、metalness1、roughness.12。
- ice-blue / 冰蓝金属：#74B8D6、metalness.95、roughness.10。
- ringed-steel / 环纹钢球：原钢底，三道深银纬圈，颜色与gloss纹理，不是凸环。
- basketball / 篮球：橙颗粒与黑弧缝，metalness0，实际roughness贴图、reflectivity.35、normalStrength.20。
- soccer / 足球：ART截角二十面体12黑五边/20白六边球面纹，metalness0、reflectivity.40、normalStrength.10。
- tennis / 网球：黄绿表面、浅色曲线与绒面法线，metalness0、reflectivity.18、normalStrength.14。
- eight-ball / 桌球黑 8：亮黑树脂、双面白圆黑8，metalness0、reflectivity.65，无normal贴图。

没有shuttlecock或第十款。所有皮肤只作用于同一个.85米平滑球的材质，不改变原SphereGeometry/实际旋转、质量、惯量、碰撞、摩擦、反弹、施力、刹车、速度或镜头。赛道主题映射继续排除玩家材质；ballSkin与trackTheme各自保存，互不覆盖。

## 材质、UV与恢复

`steel-material.ts`保留原环境/微纹生成函数，增加setSkin。颜色金属立即更新；运动球首次按需加载完整颜色/粗糙度/可选法线后一次性应用，加载中/失败保留上一外观，后续applySettings可重试。代际标识阻止迟到结果覆盖更新的选择，销毁后不再应用。

前五金属共用原player-steel-studio环境与polish，原speed驱动bumpiness渐隐继续，update只更新微纹强度，不覆写所选PBR。四运动球使用各自normal或无normal，不叠金属polish；其表面纹理不因停球消失。切回steel清除diffuse/gloss贴图、恢复glossInvert/channel和原polish，再恢复精确默认数值；环境始终同一份，水的中性反射不污染球环境。

运动球basecolor按sRGB读取、材质乘白；roughness按线性R通道，使用gloss=1和glossInvert=true得到绝对粗糙度，不再乘一遍平均roughness。normal为线性切线图，U repeat/V clamp、flipY与当前球UV对齐，mipmap开启。最终11张纹理由ART程序原创，包含首尾经线相同、极点常色和连续3D微粒噪声；代码原样复制运行贴图，没有换球几何。

环纹采用ART精确v规则：中心.32/.50/.68，全宽.008、每侧羽化.002，三带max遮罩。仅首次选中时生成1024×512颜色比例图与gloss比例图，U方向恒定、两极白底，之后缓存复用。白底乘原材质保持钢底，环色#7F8E99、环gloss约.80，8bit贴图有正常量化；不是高度/normal纹。原球UV随真实旋转带动环纹，不滚动纹理偏移或转环境冒充球转动。

## 保存与资源作用域

Settings.ballSkin接受九id，默认/非法/缺失/已取消的shuttlecock回steel；v3自动保存，恢复默认steel，所有赛道设置、纯净/性能/水速和历史成绩保留。没有新schema或计分版本。

每个球材质作用域按文件缓存纹理请求，不重复生成或为每次装备重建。颜色与数据纹理的解码类型在Asset.data中明确；请求失败/超时释放资产，卸载取消等待，迟到资源继续释放。销毁先断开材质，再卸载自有运动纹理、环纹、原环境及polish，重复destroy无副作用。跨Application不共享GPU纹理对象。

图鉴路径示意球按需创建同一球材质并跟随ballSkin，只有出现示意球才加载所需纹理；异步完成时仅请求一帧预览重绘，不重播。图鉴仍没有球物理，因此示意球的路径和朝向不能当作实际滚动验收。商城卡片不建立每卡WebGL。

## 文件与未验证项

新增：`src/game/ball-skins.ts`、`ball-skin-assets.ts`、`ball-skin-textures.ts`，`src/components/SkinsShop.vue`、`BallSkinThumbnail.vue`及`src/assets/ball-skins/`（9卡+11运行贴图）。接入改动涉及steel-material/runtime、state、main/App、SettingsPanel/style、obstacle-preview/ObstaclePreview。旧GLB、LEVEL配置和ART源文件没有由CODE改动。

保存/非法回退/九球往返、PBR与默认贴图恢复、环纹缓存、迟到结果及纹理取消释放用例已编写，未执行。实际UV/法线方向、数字8可读性、微粒闪烁、金属/树脂观感、手机导航与商城布局、首次加载/取消表现尚未运行验收。

水最终为工业黑海#101316/ref.40、黑金金水#C6A128/ref.32，其他主题保持本轮各色水，见 [水色交付](water-themes.md)。默认关闭的性能读数与就绪/暂停同行，750ms汇总、生产三角面缺失显示“—”，见 [性能交付](performance-overlay.md)。CI cycleTime修复、纯净1200/600和首页左下按钮保持，不实施长关/第四关。
