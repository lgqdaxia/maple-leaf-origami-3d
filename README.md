# 纸间 · 枫叶折纸练习

交互式 3D 折纸原型，依据 [Brian Chan 的枫叶折纸步骤图](https://web.mit.edu/chosetec/www/origami/diagrams/mapleleaf/)制作。拖动纸张可以旋转视角，滚轮可以缩放；播放器和步骤卡片可以控制进度。

## 完成情况

目前实现原图 **第 1～8 步**。第 8 步包含对另一侧的压折、花瓣折和折回。
从**第 9 步**开始，原图中“盖过一层”的隐藏层次尚无法可靠判断，因此第 9～34 步没有编入播放序列。三维动画是根据折叠前后的几何状态计算出的演示，并非真实纸张的完整物理仿真；复杂动作的运动轨迹可能与手工折叠不同。

## 本地运行

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev
```

用终端显示的本地地址打开页面。生产构建使用 `npm run build`，输出目录为 `dist/`；`npm test` 检查已实现的纸面连接和主要几何状态。安装了 Chrome 或 Edge 时，`npm run test:browser` 检查播放和尺寸切换；也可以通过 `BROWSER_EXECUTABLE` 指定浏览器路径。

## 致谢

- 枫叶原设计及图纸：Brian Chan，见[原作品页面](https://web.mit.edu/chosetec/www/origami/maple/)。
- 纸面几何、折叠求解和 3D 渲染基于 [Origamio 的 `c28937855e8d` 版本](https://github.com/hannesgao/Origamio/tree/c28937855e8d)，其 MIT 许可见 [ORIGAMIO-LICENSE](ORIGAMIO-LICENSE)。本项目调整了 3D 视图不可用时的提示文字。
