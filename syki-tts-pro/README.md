# SYKI-TTS Pro 语音试听

无需构建的静态站点。将 `index.html` 和 `assets/` 放在同一目录，可直接打开，也可部署在 GitHub Pages 的子目录。

- 参考音色为 SYKI。
- 页面包含八条自然对话、五条情感示例和四条副语言示例；此前保留的原有副语言示例保持不变。
- 音频为单声道 128 kbps MP3，按需加载，位于 `assets/audio-mp3-20261116/`，文件名包含内容摘要；试听文本和 SS 由 `assets/data.js`、`assets/extras.js` 提供。
- 自然对话的 SS 使用页面上的 MP3 参考音色和输出重新计算；它是音色相似度参考，不是自然度或情感质量评分。
