# 🚀 Chrome扩展快速修复指南

## 🔍 问题诊断

你遇到的两个主要问题：
1. **UI没有显示检测到的附件** - 界面显示问题
2. **LLM API调用失败 (404错误)** - 配置问题

## 🔧 一键修复方案

### 方法1: 使用完整修复脚本 ⭐ **推荐**

1. **打开扩展popup**
2. **打开开发者工具** (F12)
3. **切换到Console标签页**
4. **复制并运行** `fix-extension-complete.js` 的全部内容

这个脚本会：
- ✅ 自动注入Content Script
- ✅ 修复UI显示问题
- ✅ 配置默认LLM设置
- ✅ 绑定所有按钮事件
- ✅ 测试所有功能

### 方法2: 分步修复

如果需要分步调试，可以依次运行：

1. **UI显示调试**: `debug-ui-display.js`
2. **LLM配置**: `quick-llm-config.js`
3. **功能测试**: `test-extension-fix.js`

## ⚙️ LLM配置解决方案

### 默认配置 (推荐)
```json
{
  "provider": "custom",
  "endpoint": "http://localhost:1234/v1/chat/completions",
  "apiKey": "",
  "model": "local-model"
}
```

### 使用步骤:
1. **下载并启动 [LM Studio](https://lmstudio.ai/)**
2. **加载任意聊天模型**
3. **启动本地服务器** (默认端口1234)
4. **运行修复脚本** - 会自动配置

### 其他选项:
- **Ollama**: 端口11434
- **OpenAI**: 需要API密钥
- **自定义服务**: 修改endpoint和model

## 🎯 预期结果

修复后，扩展应该能够：

### UI显示
- ✅ 显示检测到的附件列表
- ✅ 显示页面文本预览
- ✅ 显示配置状态指示器
- ✅ 所有按钮正常工作

### 功能测试
- ✅ 点击"重新检测"刷新内容
- ✅ 选择附件或输入文本
- ✅ 点击"开始分析"进行AI分析
- ✅ 在新窗口显示分析结果

## 🐛 如果仍有问题

### 常见问题解决:

1. **Content Script注入失败**
   ```javascript
   // 在页面控制台运行
   chrome.scripting.executeScript({
     target: { tabId: tab.id },
     files: ['src/content/content-simple.js']
   });
   ```

2. **LLM连接失败**
   - 确保LM Studio正在运行
   - 检查端口是否为1234
   - 尝试访问 http://localhost:1234/v1/models

3. **UI不显示**
   - 刷新扩展页面
   - 重新加载扩展
   - 检查控制台错误信息

4. **权限问题**
   - 检查manifest.json权限
   - 重新安装扩展

## 📞 调试命令

在扩展popup控制台可用的调试命令：

```javascript
// 完整修复
// 复制 fix-extension-complete.js 内容并运行

// 快速LLM配置
setLLMConfig('lmstudio')  // 配置LM Studio
setLLMConfig('ollama')    // 配置Ollama

// 测试功能
// 复制 test-extension-fix.js 内容并运行
```

## 🎉 成功标志

修复成功后，你应该看到：
- 📎 附件列表显示在扩展popup中
- 📄 页面文本预览可见
- ✅ 配置状态显示"AI服务已配置"
- 🚀 点击"开始分析"能正常工作

---

**立即行动**: 复制 `fix-extension-complete.js` 到扩展popup控制台运行！