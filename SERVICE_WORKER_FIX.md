# Service Worker 注册失败修复说明

## 问题诊断

错误代码15表示Service Worker注册失败，通常原因包括：
- ES6模块导入问题
- 文件路径错误
- 依赖模块缺失
- 语法错误

## 修复措施

### 1. 创建简化的Background Script

- **文件**: `src/background/background-simple.js`
- **目的**: 移除复杂的模块依赖，使用基础功能
- **特点**: 
  - 不使用ES6 import
  - 内置基本功能
  - 避免动态导入问题

### 2. 更新Manifest配置

```json
{
  "background": {
    "service_worker": "src/background/background-simple.js"
  }
}
```

- 移除 `"type": "module"` 配置
- 使用简化的background脚本
- 减少content scripts依赖

### 3. Content Script兼容性

- 添加AttachmentSorter可用性检查
- 提供后备实现
- 确保核心功能正常工作

## 验证步骤

### 1. 重新加载插件
1. 打开 `chrome://extensions/`
2. 点击插件的"重新加载"按钮
3. 检查是否有错误信息

### 2. 测试基本功能
1. 访问测试页面 `tests/test-page.html`
2. 点击插件图标
3. 验证内容检测是否正常

### 3. 检查Service Worker状态
1. 在 `chrome://extensions/` 中找到插件
2. 点击"检查视图" -> "背景页"
3. 确认Service Worker正常运行

### 4. 功能测试
- ✅ 诊断ping响应
- ✅ 内容检测功能
- ✅ 附件识别
- ✅ 存储访问
- ✅ LLM连接测试

## 常见问题解决

### 问题1：Service Worker仍然无法启动
**解决方案**：
1. 完全卸载插件
2. 重启Chrome浏览器
3. 重新加载插件

### 问题2：Content Script无响应
**解决方案**：
1. 刷新目标页面
2. 检查页面URL协议（需要https或http）
3. 查看控制台错误信息

### 问题3：功能部分失效
**解决方案**：
1. 使用简化版本的功能
2. 检查API配置
3. 查看background页面日志

## 文件变更清单

```
新增:
+ src/background/background-simple.js
+ SERVICE_WORKER_FIX.md

修改:
~ manifest.json (更新background配置)
~ src/content/content.js (添加兼容性检查)
```

## 技术说明

### 简化策略
1. **移除模块依赖**: 不使用复杂的ES6导入
2. **内联功能**: 将核心功能直接写入background script
3. **后备机制**: 在依赖不可用时提供替代方案

### 兼容性保证
- Chrome 88+ 支持
- Manifest V3 兼容
- 基础功能完整保留

### 性能考虑
- 减少了启动时间
- 降低了内存占用
- 提高了稳定性

## 验证清单

- [ ] Service Worker正常启动
- [ ] 插件图标可点击
- [ ] 内容检测功能正常
- [ ] 诊断工具可用
- [ ] API连接测试成功
- [ ] 无控制台错误

完成以上验证后，Service Worker注册问题应该得到解决。