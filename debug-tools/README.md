# 🔧 调试工具集

这个目录包含了Chrome扩展开发过程中使用的各种调试和测试工具。

## 📁 文件说明

### 🔍 诊断工具
- `debug-extension-comprehensive.js` - 全面的扩展诊断工具
- `debug-page-console.js` - 页面控制台诊断工具 ⭐ **推荐**
- `debug-popup-simple.js` - 简化的popup诊断工具
- `debug-ui-display.js` - UI显示问题诊断工具

### 🧪 测试工具
- `test-direct-execution.js` - 直接执行检测逻辑测试
- `test-extension-fix.js` - 验证修复效果的测试
- `test-popup-basic.js` - 基础popup功能测试
- `test-content-script.js` - Content Script功能测试
- `test-page.html` - 测试页面（包含模拟附件）

### 🔧 修复工具
- `fix-extension-complete.js` - 完整的扩展修复脚本
- `fix-popup-only.js` - 专用于popup环境的修复脚本 ⭐ **推荐**
- `manual-inject-content-script.js` - 手动注入Content Script工具
- `quick-llm-config.js` - 快速LLM配置工具

### 📚 文档
- `EXTENSION_FIX_SUMMARY.md` - 扩展修复总结
- `QUICK_FIX_GUIDE.md` - 快速修复指南

## 🚀 使用方法

### 如果扩展无法正常工作：

1. **在扩展popup控制台运行**：
   ```javascript
   // 复制 fix-popup-only.js 的内容并运行
   ```

2. **在目标页面控制台运行**：
   ```javascript
   // 复制 debug-page-console.js 的内容并运行
   ```

### 如果需要详细诊断：

1. **运行综合诊断**：
   ```javascript
   // 复制 debug-extension-comprehensive.js 的内容并运行
   ```

2. **测试特定功能**：
   ```javascript
   // 复制对应的 test-*.js 文件内容并运行
   ```

## 💡 常见问题解决

- **Content Script未加载** → 使用 `manual-inject-content-script.js`
- **LLM配置问题** → 使用 `quick-llm-config.js`
- **UI显示问题** → 使用 `debug-ui-display.js`
- **页面检测失败** → 使用 `test-direct-execution.js`

## ⚠️ 注意事项

- 这些工具仅用于开发和调试
- 生产环境中不需要这些文件
- 运行前请确保在正确的环境中（popup/页面控制台）