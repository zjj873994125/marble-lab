# 主题水色与中性反射 · 代码交付

2026-09-14。水色修订及动态图鉴同源水面已实现，采用ART最新黑海/金水方案。没有运行test/build/typecheck、浏览器、Git或部署；未观察真实屏幕强弱，不能把源码分析称为实际视觉验收。

## 原因与最终值

原代码已经将真实水材质以owned方式注册到主题scope并refresh，因此没有发现“只改卡片、游戏水完全未接入”的代码缺口。旧token大多为深蓝/深青；原水专用cubemap的基础RGB为[42,66,72]且天空也是偏蓝分量，存在固定蓝青倾向。这解释了设计区分有限和可能的反射偏色，但未经本轮运行测量，不能断言反射在用户屏幕上占比多大。

最终water color / roughness / reflectivity：

- classic：原#123C45 / .32 / .45，原gloss .68及原反射对象保持。
- industrial：近黑黑海#101316 / .34 / .40。
- glacier：靛紫#34325E / .30 / .30。
- black-gold：明亮金黄#C6A128 / .38 / .32。
- violet：深梅紫#492B68 / .35 / .30。
- pink：莓红#69344F / .35 / .28。
- yellow：翡翠绿#22584B / .35 / .30。

仅修改六个非classic的water颜色与reflectivity，七主题其余八角色及classic完整token保持；中间琥珀棕/浅玉绿已由用户最新黑海/金水要求替代。水仍useMetalness=false、specular原值，不成为金属板或哑光色块。

## 水专用反射与连续动画

createWaterMaterial保留原法线和原64×64×6反射贴图。第一次选非classic时按原反射明暗结构生成一张灰度中性cubemap，消除固定蓝青色相；后续六款共享这张本作用域贴图，不每次换色生成纹理。切回classic直接恢复原cubemap对象，不通过重新调色近似它，也不修改钢球独立studio环境或全局灯光。

theme scope继续原位更新同一个水material的diffuse/gloss/reflectivity；setTheme只选反射对象，不写water_offsets、不resetClock、不替换normalMap。既有512法线、双层采样、水速、减少动态、低画质静止和暂停/后台冻结全部保持。设置换色与切关使用当前选择，不重开局、不改物理/计时/CP。

新中性cubemap懒建一次并随水作用域销毁，classic纹理和法线各由原水工厂持有。贴图setSource失败会释放已创建纹理，反射创建失败会释放已生成法线，水destroy幂等。新反射增加约128KiB纹理预算（含mipmap量级），不为每个颜色建一份。

## 图鉴与生成图

图鉴原先只有陈列底座，没有真实水材质。当前在底座上添加无碰撞薄水层，复用createWaterMaterial、相同主题token和反射选择；随图鉴播放/暂停、显示/隐藏以及水速/画质/减少动态设置更新。这个独立预览仍无Ammo，不改变游戏池体或标记；关闭弹窗保留会话水资源但停止动画，离页释放。

ThemeThumbnail与LevelThumbnail已有水色读取，直接随新token更新；没有用CSS滤镜给球/轨道整体染色。静态ART机关卡仍是经典示意，动态大预览显示当前主题。ART同名总览只作设计参考。

## 文件与未验证项

代码涉及track-themes.ts、water-material.ts、runtime.ts、obstacle-preview.ts和ObstaclePreview.vue。水材质/反射恢复与连续相位用例已留在tests/water-theme.test.mjs，主题PBR断言同步更新；均未执行。实际黑海波光、金水色相、各色反射、暂停/低高画质、预览关闭资源及设备表现尚未验证。CI的cycleTime修复未改动。
