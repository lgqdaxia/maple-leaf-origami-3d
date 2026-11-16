# 纸间 · 枫叶折纸练习

交互式 3D 折纸原型，依据 [Brian Chan 的枫叶折纸步骤图](https://web.mit.edu/chosetec/www/origami/diagrams/mapleleaf/)制作。拖动纸张可以旋转视角，滚轮可以缩放；播放器和步骤卡片可以控制进度。

## 完成情况

现在可以逐步播放 **第 1～34 步**，并直接查看可旋转的最终枫叶。打开网页默认显示成品，点击“从头播放”可以从方纸开始观看。

第 1～8 步使用折痕和纸面几何状态，动画在前后状态之间连续过渡；复杂动作的轨迹是近似演示，并非纸张物理仿真。第 9～34 步按照原图的外形和动作重建为 3D 关键帧，包含五个叶瓣的展开、内藏折示意、叶柄收细和最后整形。这部分的隐藏纸层、运动轨迹和局部折线是近似重建，纸张完整拓扑、碰撞和实纸折法尚未验证，适合观察步骤与外形。

## 最终枫叶

- [GLB 模型](deliverables/maple-leaf.glb)：包含薄纸面、折痕和弯曲叶柄，使用示意比例。
- [透明背景成品图](deliverables/maple-leaf.png)。

网页上的“下载枫叶 GLB”会直接从同一份成品几何生成模型。

## 本地运行

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev
```

用终端显示的本地地址打开页面。生产构建使用 `npm run build`，输出目录为 `dist/`；`npm test` 检查前八步纸面连接、后续关键帧插值和成品主要特征。安装了 Chrome 或 Edge 时，`npm run test:browser` 检查后续步骤播放、GLB 下载、暂停和尺寸切换；也可以通过 `BROWSER_EXECUTABLE` 指定浏览器路径。网址加 `?step=0` 从方纸开始，加 `?step=任意步骤编号` 可以直接查看对应状态。

## 致谢

- 枫叶原设计及图纸：Brian Chan，见[原作品页面](https://web.mit.edu/chosetec/www/origami/maple/)。
- 纸面几何、折叠求解和 3D 渲染基于 [Origamio 的 `c28937855e8d` 版本](https://github.com/hannesgao/Origamio/tree/c28937855e8d)，其 MIT 许可见 [ORIGAMIO-LICENSE](ORIGAMIO-LICENSE)。本项目加入枫叶步骤、连续播放和模型导出，并调整了纸层与折痕的深度处理。
