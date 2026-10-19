# 徐喆，20 周岁生日快乐 · CS2 开箱版

独立静态生日网页，流程为：

1. 查看武器箱和物品池。
2. 武器卡片横向滚动约 6.5 秒，逐步减速，在中央指针内锁定金色生日奖励，再单独展示奖励。
3. 领取重新定制的 CS2 黑金巧克力蛋糕，带武器箱、枪械巧克力、金色战术地图纹路和数字 20 蜡烛；许愿后熄灭网页单独绘制的火焰。
4. 阅读队友祝福；署名进入可视区域后先写 From，再按原视频笔顺写出张亦玮，可单独重播。

frontend-design 负责画面设计，gsap-core、gsap-timeline、gsap-performance 用于转场、滚动减速、奖励揭晓和手写时序。GSAP 已保存在本站目录，不需要外部 CDN。

手写名字沿用用户原照片提取的墨迹轮廓与按签字视频校正的 12 笔遮罩；From 为手写 SVG。没有替换成字体，也没有上传用户原照片或原视频。

武器与武器箱图片来自 Steam 官方物品展示：

- [AK-47 | Slate](https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Slate%20%28Field-Tested%29)
- [M4A1-S | Decimator](https://steamcommunity.com/market/listings/730/M4A1-S%20%7C%20Decimator%20%28Field-Tested%29)
- [AWP | Atheris](https://steamcommunity.com/market/listings/730/AWP%20%7C%20Atheris%20%28Field-Tested%29)
- [Recoil Case](https://steamcommunity.com/market/listings/730/Recoil%20Case)

游戏素材版权归 Valve 及相应权利人。本网页为非官方个人生日创作；金色生日徽章为原创图形，物品展示不对应游戏内发放。

背景音乐按用户指定使用马思唯《Coco Elva Tia》，音轨来自[马思唯官方 MV](https://www.youtube.com/watch?v=-QWATTV7c08)，时长约 3 分 28 秒，从点击开箱时开始循环播放。背景音乐和开箱音效有独立开关。开箱与读信时自动压低背景音量；暂停偏好会保留，切页继续播放，切到后台暂停。浏览器限制音频时可以点击音乐开关重试，不影响网页操作。

蛋糕透明 PNG 由内置 imagegen 工具生成，具体提示词和素材路径见工作区 work/cake-v3-generation.md。图中不含火焰，网页使用独立火焰和烟雾层，许愿后不会残留图片里的火焰。

音乐和游戏素材版权归原权利人，本页面为个人生日祝福。

所有图片、脚本和 SVG 均在本站，运行时不访问 Steam 或其它外部服务。无构建依赖，无登录，无支付，无真实物品交易。支持键盘、320 像素窄屏和减少动态效果设置；减少动态效果或 GSAP 不可用时直接展示奖励和完整署名。

上传本目录中 index.html、style.css、app.js、content.js、gsap.min.js、icon.svg、assets/ 至新的静态站项目即可。当前仅完成本地版本，新线上部署尚未执行。
