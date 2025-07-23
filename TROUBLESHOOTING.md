# Chrome插件故障排除指南

## 🚨 常见问题：页面检测失败，无法连接到页面

### 问题症状
- 点击插件图标后显示"页面检测失败"
- 错误信息："无法连接到页面"或"Could not establish connection"
- 插件弹窗显示空白或加载失败

### 🔍 诊断步骤

#### 1. 快速诊断
在浏览器控制台（F12）中运行以下代码：
```javascript
// 检查content script是否加载
console.log("Content Script状态:", typeof window.detectPageContent);
console.log("SimpleContentDetector:", typeof window.SimpleContentDetector);

// 测试页面检测
if (typeof window.detectPageContent === 'function') {
    const result = window.detectPageContent();
    console.log("页面检测结果:", result);
}
```

#### 2. 详细诊断
运行项目根目录下的 `debug-extension.js` 脚本：
```bash
# 在浏览器控制台中复制粘贴 debug-extension.js 的内容
```

### 🛠️ 解决方案

#### 方案1：刷新页面和扩展
1. **刷新当前页面** (Ctrl+R 或 F5)
2. **重新加载扩展**：
   - 打开 `chrome://extensions/`
   - 找到"安全需求分析助手"
   - 点击刷新按钮 🔄

#### 方案2：检查扩展权限
1. 打开 `chrome://extensions/`
2. 确保扩展已启用
3. 点击扩展详情，检查权限设置
4. 确保允许访问所有网站

#### 方案3：清除扩展数据
1. 打开 `chrome://extensions/`
2. 点击扩展详情
3. 点击"清除存储数据"
4. 重新加载扩展

#### 方案4：重新安装扩展
1. 在 `chrome://extensions/` 中移除扩展
2. 重新加载项目文件夹
3. 确保manifest.json配置正确

### 🔧 开发者调试

#### 检查Content Script注入
```javascript
// 在目标页面控制台运行
chrome.runtime.sendMessage({action: "diagnostic-ping"}, response => {
    console.log("Content Script响应:", response);
});
```

#### 检查Background Script
1. 打开 `chrome://extensions/`
2. 点击扩展的"检查视图" → "Service Worker"
3. 查看控制台错误信息

#### 检查Popup Script
1. 右键点击扩展图标
2. 选择"检查弹出内容"
3. 查看控制台错误信息

### 📋 常见错误及解决方案

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| Could not establish connection | Content Script未加载 | 刷新页面，重新加载扩展 |
| Extension context invalidated | 扩展被重新加载 | 关闭弹窗重新打开 |
| Cannot access chrome:// URL | 尝试访问Chrome内部页面 | 切换到普通网页 |
| Manifest file is missing | 扩展文件损坏 | 重新安装扩展 |

### 🎯 预防措施

1. **定期更新扩展**：确保使用最新版本
2. **避免在特殊页面使用**：如chrome://、chrome-extension://等
3. **保持Chrome更新**：使用最新版本的Chrome浏览器
4. **监控控制台**：开发时注意控制台错误信息

### 📞 获取帮助

如果以上方案都无法解决问题，请：

1. **收集错误信息**：
   - 浏览器版本
   - 错误截图
   - 控制台错误日志
   - 问题复现步骤

2. **运行完整诊断**：
   ```bash
   node debug-extension.js
   ```

3. **提交问题报告**：包含所有诊断信息

### 🚀 性能优化建议

1. **减少不必要的页面检测**
2. **使用缓存机制**
3. **优化选择器性能**
4. **及时清理事件监听器**

---

## 📝 更新日志

### v2.0 (当前版本)
- ✅ 改进错误处理机制
- ✅ 增强消息传递稳定性
- ✅ 添加详细的调试信息
- ✅ 优化Content Script加载逻辑

### v1.0
- 基础页面检测功能
- 简单的错误处理