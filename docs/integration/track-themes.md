# 七套赛道皮肤 · 代码交付

2026-09-14。依据 [产品任务](../product/track-themes.md) 与 [ART最终配色](../art/track-themes.md)，七主题设置、保存、即时材质切换及图鉴接入已实现。新增紫、粉、黄三款，原四款最新token保持；工业和冰蓝继续使用明显不同的主体颜色，旧近白候选未作为最终值。**未运行test/build/typecheck、浏览器、试玩或Git操作，未部署；本说明不是视觉/性能验收报告。**

## 商城入口与最终配色

赛道选择已迁到`/#/skins`皮肤商城的“赛道皮肤”分类，按同一目录生成七张SVG卡片，点击直接装备保存。设置抽屉不再保留重复面板。商城普通三列、≤900px两列、≤480px单列，自然滚动，没有第八张占位主题；九款小球是独立分类，见[商城交付](skin-shop.md)。

- classic / 经典奶油：3D恢复各来源材质原始PBR；卡片以ART经典HEX作示意。
- industrial / 工业钢铁：主体钢蓝灰#526C88，metalness .40、roughness .50；平台#789BB2。
- glacier / 冰蓝极境：主体冰青蓝#69CBE0，metalness .03、roughness .42；平台#3299BE。稳定id不因中文改名变化。
- black-gold / 黑金竞技：炭灰主体#383F47，metalness .10、roughness .58；平台#53616B，合金暖金#BFA76E。
- violet / 紫晶幻境：鲜明紫色主体#9569D4，metalness .05、roughness .44；平台#684AAC，深紫灰结构#34314D，深梅紫水#492B68。
- pink / 樱粉乐园：饱和樱粉主体#E68DB8，metalness .03、roughness .45；平台#B65B91，暗梅灰结构#423545，莓红水#69344F。
- yellow / 暖阳赛道：暖黄主体#E8C64A，metalness .05、roughness .46；平台#AC8E2D，深蓝灰结构#343E4B，翡翠绿水#22584B。

完整九角色token统一在`src/game/track-themes.ts`，已经收敛到ART最新JSON。安全橙示意#D96836保留，独立锤壳可随主题为黄/冰蓝/金色，保持非金属。水色现为经典#123C45、工业黑海#101316、冰蓝靛紫#34325E、黑金金黄#C6A128；后三者gloss分别.66/.70/.62，reflectivity为.40/.30/.32，详见[水色交付](water-themes.md)。

新增三款同样具有完整九角色；水roughness均.35（gloss=.65），reflectivity分别为紫.30、粉.28、黄.30。accent安全橙和handle仍使用统一保护约定，球/CP/警示不随新主题改色。

`state.settings.trackTheme`保存七个稳定id，默认classic，旧字段缺失/非法时回classic，恢复默认也回classic；isTrackTheme直接读取主题目录，新增id无需另写一套存储白名单。保存仍用v3，保留现有设置、游玩进展、全部关卡/规则历史桶与只读v1/v2。纯净模式auto/on/off及1200/600阈值保持。球皮肤另由ballSkin独立装备；商城没有价格、货币或解锁，也不新增关卡。

## 即时切换与覆盖

GameCanvas原settings监听继续调用当前运行时applySettings，主题scope更新已挂载材质，不改runId、sceneLoadId、phase、计时、CP、掉落或机关time。商城页面自身无WebGL/Ammo，进入时卸载菜单背景Canvas，返回首页按当前装备加载菜单预览，不自动开始一局；装备操作本身不调用重开。

`runtime.ts`覆盖三关primitive台面/侧边/结构/池边及动态基础外观；静态轨道/横移通过track-visuals、独立锤通过hammer-visuals、十字/升降通过attachMovingVisual、五机关通过共享库模板入口绑定同一材质装饰回调。装饰回调在实例挂载前执行，读取当前选择，加载期间切肤不会将迟到模型染回旧主题。失败仍显示对应主题基础外观，碰撞代理不随主题增删。

图鉴持久Application使用独立主题scope，复用当前设置getter和材质缓存。打开/切换机关时应用当前皮肤，已打开预览切肤只更新材质并请求一帧绘制，不清场、不重播、不改变演示time。独立图鉴不运行Ammo或保存成绩。

ThemeThumbnail、LevelThumbnail、ObstacleThumbnail都从同一token取非经典角色色；球和语义标记不用全图滤镜。五张ART静态机关PNG继续是经典外观，悬停提示说明经典示意/动态预览使用当前皮肤，未改动ART图或声称静态图已实时换材质。

## 保护与classic恢复

材质角色匹配采用trim后剥离尾部一个或多个`.三位数字`，再精确全名匹配。当前映射Ivory polymer→deck、Graphite chassis→structure、Brushed alloy→alloy、Platform enamel→platform、Toy amber shell→hammer；未知材质保持原样，不依据RGB猜用途。

Safety terracotta在部分GLB内混合了护栏/夹层/推头和烘焙警示线，无法在不改GLB时分离，因而**整材质保留原PBR**。Printed markings、Rubber pads、Toy charcoal handle同样保持。部分栏杆/边缘仍是原橙色，这是明确的保护边界，不把主题卡画成全黄/蓝/金边。

primitive原orange不就地染色，独立锤头通过明确hammer角色使用单独克隆。Approach marking、平台stripe、锤握柄、独立warning灯、钢球与起点/CP/终点环显式留在原材质路径。已激活CP继续保留原橙色身份；主题切换不重置标记状态、预告相位或HUD品牌色。图鉴示意球与平台条纹也保留。

每个Application按“来源材质对象＋角色”缓存克隆，不能只按名字缓存，因为同名材质可能有不同原始值。首次克隆保留原材质全部PBR/纹理/alpha/emissive/标记/自定义配置；切换仅改变diffuse、metalness、useMetalness、gloss、reflectivity这几项。classic恢复这些字段的精确对象基线，其余字段从未改动，不经统一HEX近似还原。

glTF材质glossInvert=true时gloss字段实际存roughness，直接写主题roughness；普通primitive使用1−roughness。保留glossInvert及纹理解释，不翻转粗糙贴图。颜色使用PlayCanvas的sRGB材质接口；经典值直接copy当前加载基线，不从ART文档HEX反算。

水材质为本Application独占对象，直接登记其基线，不克隆带动画uniform的第二份水材质。仅更新diffuse/gloss/reflectivity，useMetalness=false、specular、normalMap、shader chunks、water_offsets、水波速度/画质/减少动态流程保持。非classic懒建并复用中性水反射，classic恢复原cubeMap对象。切主题不会resetClock或清相位，画质变更仍按原意重接水时钟。

## 资源所有权

- 同一个来源/角色只创建一个主题克隆，反复切换复用，按需加载的图鉴材质保留到图鉴页面退出；不同Application不共享主题克隆。
- 原始GLB材质与纹理由现有资源池持有；克隆引用共享纹理，不修改资源原材质，也不调用共享纹理destroy。独占水材质及其纹理由createWaterMaterial持有并销毁。
- 正常卸载先移除模型实例/共享库模板，再释放主题克隆，再卸载模型资源。初始化失败/取消会关闭主题scope，迟到装饰请求抛AbortError，由对应加载器清理实例；共享模板装饰失败立即销毁未挂载模板。
- primitive原材质仍归runtime/preview原materials数组，主题scope只释放自己创建的克隆；水由原水生命周期释放，不双重destroy。

## 文件与未验证边界

主要新文件：`src/game/track-themes.ts`、`src/game/theme-materials.ts`、`src/components/ThemeThumbnail.vue`。

接入文件：`src/state.ts`、`SettingsPanel.vue`、`LevelThumbnail.vue`、`ObstacleThumbnail.vue`、`ObstaclePreview.vue`、`Obstacles.vue`，以及`runtime.ts`、`track-visuals.ts`、`hammer-visuals.ts`、`model-assets.ts`、`obstacle-library.ts`、`library-mechanisms.ts`、`obstacle-scene.ts`、`obstacle-preview.ts`。GLB、Blender源和LEVEL配置没有由CODE改动；首页按钮布局和纯净HUD保持。

`tests/state.test.mjs`已补主题非法值/保存/恢复默认及历史保留用例，`tests/track-themes.test.mjs`留下逐对象classic恢复、克隆复用、保护名、迟到选择、独立作用域、共享纹理与水uniform的回归用例；全部未执行。类型构建、设置卡布局、真实三关覆盖观感、金属球/标记可读性、切肤性能、模型失败与取消的浏览器表现均未验。

七款扩展复用统一主题链路；后续已迁商城并定向修订水色，原抽屉卡片不再保留。保存、克隆复用/classic恢复与水uniform回归用例已覆盖新增三款，仍未执行。

ART的[同机位配色设计图](../art/track-themes-preview.png)仅为美术设计稿，不能代替PlayCanvas实际渲染或通关证据。用户要求的七套即时主题已完成代码交付，实际验收另行进行。
