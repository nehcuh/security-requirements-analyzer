# Chrome插件调试指南

## 🛠️ 在Kiro中调试Chrome插件

### 方法1: 使用内置调试工具

我们已经为插件添加了内置的调试工具，可以在浏览器中直接使用：

#### 启用调试模式
1. 加载插件到Chrome
2. 打开任意网页
3. 按 `Ctrl+Shift+D` 打开调试面板
4. 在控制台运行调试命令

#### 调试命令
```javascript
// 检查插件状态
debugExtension()

// 运行所有测试
DebugScripts.runAllTests()

// 测试内容检测
DebugScripts.testContentScript()

// 测试后台服务
DebugScripts.testBackground()

// 检查权限
DebugScripts.checkPermissions()
```

### 方法2: 使用Chrome DevTools

#### 调试Content Scripts
1. 打开目标网页
2. 按F12打开DevTools
3. 在Console中查看插件日志
4. 在Sources标签中找到插件脚本进行断点调试

#### 调试Background Script
1. 访问 `chrome://extensions/`
2. 找到你的插件，点击"检查视图"中的"背景页"
3. 在打开的DevTools中调试background.js

#### 调试Popup
1. 右键点击插件图标
2. 选择"检查弹出内容"
3. 在DevTools中调试popup相关代码

### 方法3: 使用VS Code调试配置

我们已经配置了VS Code的调试设置，你可以：

#### 启动调试Chrome
1. 在VS Code中按 `Ctrl+Shift+P`
2. 选择 "Tasks: Run Task"
3. 选择 "Start Chrome with Remote Debugging"

#### 附加调试器
1. 在VS Code中按 `F5`
2. 选择 "Attach to Chrome Extension"
3. 现在可以在VS Code中设置断点调试

## 🔍 常用调试场景

### 调试内容检测问题

```javascript
// 在目标页面的控制台中运行
const detector = new ContentDetector();
console.log('Attachments:', detector.detectAttachments());
console.log('Page text:', detector.detectPageText().substring(0, 200));
console.log('Page type:', detector.detectPageType());
```

### 调试LLM API调用

```javascript
// 在background script的DevTools中运行
chrome.runtime.sendMessage({
  action: 'testLLMConnection',
  data: {
    endpoint: 'your-api-endpoint',
    apiKey: 'your-api-key',
    model: 'your-model'
  }
}, console.log);
```

### 调试存储问题

```javascript
// 查看当前存储的配置
chrome.storage.sync.get(null, console.log);

// 清除所有存储
chrome.storage.sync.clear();

// 设置测试配置
chrome.storage.sync.set({
  testConfig: { test: true }
});
```

### 调试消息传递

```javascript
// 在content script中发送消息
chrome.runtime.sendMessage({
  action: 'test',
  data: 'hello'
}, response => {
  console.log('Response:', response);
});

// 在background script中监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  sendResponse({ received: true });
});
```

## 🐛 常见问题排查

### 插件无法加载
1. 检查manifest.json语法
2. 确认所有引用的文件存在
3. 查看chrome://extensions/页面的错误信息

### Content Script不工作
1. 检查页面URL是否匹配matches规则
2. 确认脚本注入时机（document_end）
3. 查看页面控制台的错误信息

### Background Script问题
1. 检查Service Worker是否正常运行
2. 查看chrome://extensions/中的错误
3. 确认权限配置正确

### API调用失败
1. 检查网络连接
2. 验证API密钥和端点
3. 查看CORS设置
4. 检查API配额限制

## 📊 性能调试

### 监控内存使用
```javascript
// 在DevTools中运行
console.log('Memory usage:', performance.memory);

// 监控DOM节点数量
console.log('DOM nodes:', document.querySelectorAll('*').length);
```

### 监控网络请求
1. 在DevTools的Network标签中查看API调用
2. 检查请求头和响应
3. 监控请求时间和大小

### 性能分析
1. 使用DevTools的Performance标签
2. 录制插件操作过程
3. 分析性能瓶颈

## 🔧 调试工具推荐

### Chrome扩展
- **Extension Reloader** - 自动重载插件
- **Chrome Apps & Extensions Developer Tool** - 扩展开发工具

### VS Code插件
- **Chrome Debugger** - Chrome调试支持
- **JavaScript Debugger** - JS调试增强

### 在线工具
- **JSON Formatter** - 格式化API响应
- **Regex Tester** - 测试正则表达式
- **Base64 Encoder/Decoder** - 编码解码工具

## 📝 调试最佳实践

### 1. 使用结构化日志
```javascript
console.group('🔍 Content Detection');
console.log('URL:', window.location.href);
console.log('Attachments found:', attachments.length);
console.groupEnd();
```

### 2. 添加错误边界
```javascript
try {
  // 可能出错的代码
} catch (error) {
  console.error('Operation failed:', error);
  // 发送错误报告
}
```

### 3. 使用条件调试
```javascript
const DEBUG = true;
if (DEBUG) {
  console.log('Debug info:', data);
}
```

### 4. 保存调试状态
```javascript
// 保存调试信息到本地存储
localStorage.setItem('debug-state', JSON.stringify({
  timestamp: Date.now(),
  data: debugData
}));
```

## 🚀 自动化调试

### 创建测试脚本
```bash
# 在package.json中添加脚本
{
  "scripts": {
    "debug": "chrome --remote-debugging-port=9222 --load-extension=.",
    "test": "node test-runner.js"
  }
}
```

### 持续集成
- 设置GitHub Actions进行自动测试
- 使用Puppeteer进行端到端测试
- 配置代码质量检查

---

通过这些调试方法和工具，你可以高效地在Kiro环境中开发和调试Chrome插件。记住，调试是一个迭代过程，要善用各种工具组合来定位和解决问题。