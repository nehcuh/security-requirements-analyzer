// src/debug/diagnostic-ui.js - 诊断界面控制逻辑
class DiagnosticUI {
  constructor() {
    this.diagnosticTool = null;
    this.currentResults = null;
    this.init();
  }

  async init() {
    try {
      // 动态导入诊断工具
      const { default: ExtensionDiagnosticTool } = await import('./diagnostic-tool.js');
      this.diagnosticTool = new ExtensionDiagnosticTool();

      this.setupEventListeners();
      this.setupProgressCallbacks();
      this.checkInitialState();
    } catch (error) {
      console.error('初始化诊断工具失败:', error);
      this.showError('初始化失败', error.message);
    }
  }

  setupEventListeners() {
    // 运行诊断按钮
    document.getElementById('runDiagnostics').addEventListener('click', () => {
      this.runDiagnostics();
    });

    // 标签页切换
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // 导出功能
    document.getElementById('exportReport').addEventListener('click', () => {
      this.exportReport();
    });

    document.getElementById('copyToClipboard').addEventListener('click', () => {
      this.copyToClipboard();
    });

    document.getElementById('openDevTools').addEventListener('click', () => {
      this.openDevTools();
    });

    document.getElementById('reloadExtension').addEventListener('click', () => {
      this.reloadExtension();
    });
  }

  setupProgressCallbacks() {
    if (this.diagnosticTool) {
      this.diagnosticTool.onProgress = (progress) => {
        this.updateProgress(progress);
      };

      this.diagnosticTool.onComplete = (results) => {
        this.displayResults(results);
      };
    }
  }

  async checkInitialState() {
    // 检查是否在Chrome扩展环境中
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      this.showError(
        '环境错误',
        '请在Chrome扩展环境中运行此诊断工具'
      );
      return;
    }

    // 显示基本信息
    this.displayBasicInfo();
  }

  async runDiagnostics() {
    const button = document.getElementById('runDiagnostics');
    const buttonText = document.getElementById('runButtonText');

    try {
      // 禁用按钮并显示加载状态
      button.disabled = true;
      buttonText.innerHTML = '<span class="loading"></span>运行中...';

      // 显示进度条
      this.showProgress();

      // 清除之前的错误信息
      this.clearErrors();

      // 运行诊断
      const results = await this.diagnosticTool.runDiagnostics();
      this.currentResults = results;

      // 显示结果
      this.displayResults(results);

    } catch (error) {
      console.error('诊断运行失败:', error);
      this.showError('诊断失败', error.message);
    } finally {
      // 恢复按钮状态
      button.disabled = false;
      buttonText.textContent = '重新诊断';
      this.hideProgress();
    }
  }

  updateProgress(progress) {
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progressContainer.style.display = 'block';
    progressFill.style.width = `${progress.percentage}%`;
    progressText.textContent = `${progress.message} (${progress.current}/${progress.total})`;
  }

  showProgress() {
    const progressContainer = document.getElementById('progressContainer');
    progressContainer.style.display = 'block';
  }

  hideProgress() {
    const progressContainer = document.getElementById('progressContainer');
    progressContainer.style.display = 'none';
  }

  displayResults(results) {
    // 显示结果容器
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.style.display = 'block';

    // 更新概览
    this.updateOverview(results);

    // 更新检查列表
    this.updateChecksList(results);

    // 更新建议
    this.updateRecommendations(results);
  }

  updateOverview(results) {
    const statusOverview = document.getElementById('statusOverview');
    const summaryInfo = document.getElementById('summaryInfo');

    // 清空现有内容
    statusOverview.innerHTML = '';
    summaryInfo.innerHTML = '';

    // 生成状态卡片
    const summary = results.summary;

    const cards = [
      {
        number: summary.passed,
        label: '通过检查',
        status: 'pass'
      },
      {
        number: summary.failed,
        label: '失败检查',
        status: 'fail'
      },
      {
        number: summary.warnings,
        label: '警告项目',
        status: 'warning'
      },
      {
        number: summary.total,
        label: '总检查项',
        status: 'default'
      }
    ];

    cards.forEach(card => {
      const cardElement = document.createElement('div');
      cardElement.className = `status-card ${card.status}`;
      cardElement.innerHTML = `
        <div class="number">${card.number}</div>
        <div class="label">${card.label}</div>
      `;
      statusOverview.appendChild(cardElement);
    });

    // 生成总体状态信息
    const overallStatus = this.getOverallStatusText(results.overall);
    const timestamp = new Date(results.timestamp).toLocaleString('zh-CN');

    summaryInfo.innerHTML = `
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;">
        <h3 style="margin-bottom: 15px; color: #333;">诊断概要</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div>
            <strong>整体状态:</strong><br>
            <span class="status-badge ${results.overall}">${overallStatus}</span>
          </div>
          <div>
            <strong>诊断时间:</strong><br>
            ${timestamp}
          </div>
          <div>
            <strong>浏览器版本:</strong><br>
            ${this.getBrowserInfo()}
          </div>
          <div>
            <strong>插件状态:</strong><br>
            ${this.getExtensionStatus()}
          </div>
        </div>
      </div>
    `;
  }

  updateChecksList(results) {
    const checksList = document.getElementById('checksList');
    checksList.innerHTML = '';

    Object.entries(results.checks).forEach(([checkName, checkResult]) => {
      const checkItem = document.createElement('div');
      checkItem.className = 'check-item';

      const statusIcon = this.getStatusIcon(checkResult.status);
      const timestamp = new Date(checkResult.timestamp).toLocaleTimeString('zh-CN');

      checkItem.innerHTML = `
        <div class="check-status ${checkResult.status}">${statusIcon}</div>
        <div class="check-info">
          <div class="check-name">${this.getCheckDisplayName(checkName)}</div>
          <div class="check-message">${checkResult.message}</div>
          <div class="check-timestamp" style="font-size: 12px; color: #999; margin-top: 5px;">
            ${timestamp}
          </div>
          <div class="check-details" id="details-${checkName}">
            <pre>${JSON.stringify(checkResult.details, null, 2)}</pre>
          </div>
        </div>
        <button class="check-toggle" onclick="toggleDetails('${checkName}')">
          详情
        </button>
      `;

      checksList.appendChild(checkItem);
    });
  }

  updateRecommendations(results) {
    const recommendationsList = document.getElementById('recommendationsList');
    recommendationsList.innerHTML = '';

    if (!results.recommendations || results.recommendations.length === 0) {
      recommendationsList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>🎉 太棒了！</h3>
          <p>当前没有需要处理的问题，系统运行正常。</p>
        </div>
      `;
      return;
    }

    results.recommendations.forEach(rec => {
      const recElement = document.createElement('div');
      recElement.className = `recommendation ${rec.priority}`;

      recElement.innerHTML = `
        <div class="recommendation-title">
          <span class="recommendation-priority ${rec.priority}">${this.getPriorityText(rec.priority)}</span>
          ${rec.title}
        </div>
        <div class="recommendation-description">
          ${rec.description}
        </div>
        <div class="recommendation-action">
          <strong>建议操作:</strong> ${this.getActionText(rec.action)}
        </div>
      `;

      recommendationsList.appendChild(recElement);
    });
  }

  switchTab(tabName) {
    // 更新标签状态
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  async exportReport() {
    if (!this.currentResults) {
      this.showError('导出失败', '没有可导出的诊断结果');
      return;
    }

    try {
      const report = {
        ...this.currentResults,
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        chromeVersion: this.getChromeVersion(),
        extensionVersion: this.getExtensionVersion()
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extension-diagnostic-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showSuccess('报告已导出到下载文件夹');
    } catch (error) {
      this.showError('导出失败', error.message);
    }
  }

  async copyToClipboard() {
    if (!this.currentResults) {
      this.showError('复制失败', '没有可复制的诊断结果');
      return;
    }

    try {
      const summary = this.generateTextSummary(this.currentResults);
      await navigator.clipboard.writeText(summary);
      this.showSuccess('诊断摘要已复制到剪贴板');
    } catch (error) {
      this.showError('复制失败', error.message);
    }
  }

  async openDevTools() {
    try {
      // 尝试打开扩展的开发者工具
      if (chrome && chrome.tabs) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          chrome.tabs.update(tabs[0].id, { url: 'chrome://extensions/' });
        }
      }
      this.showSuccess('正在打开扩展管理页面');
    } catch (error) {
      this.showError('操作失败', '无法自动打开开发者工具，请手动访问 chrome://extensions/');
    }
  }

  async reloadExtension() {
    try {
      if (chrome && chrome.runtime) {
        chrome.runtime.reload();
        this.showSuccess('正在重新加载插件...');

        // 延迟关闭窗口
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } catch (error) {
      this.showError('重载失败', '无法自动重新加载插件，请在扩展管理页面手动操作');
    }
  }

  displayBasicInfo() {
    // 在页面上显示基本的环境信息
    const basicInfo = document.createElement('div');
    basicInfo.style.cssText = `
      background: #e3f2fd;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #2196f3;
    `;

    basicInfo.innerHTML = `
      <h4 style="margin-bottom: 10px; color: #1976d2;">环境信息</h4>
      <div style="font-size: 14px; color: #666;">
        <div><strong>用户代理:</strong> ${navigator.userAgent}</div>
        <div><strong>当前页面:</strong> ${window.location.href}</div>
        <div><strong>Chrome扩展:</strong> ${chrome && chrome.runtime ? '✅ 可用' : '❌ 不可用'}</div>
      </div>
    `;

    document.querySelector('.diagnostic-panel').appendChild(basicInfo);
  }

  showError(title, message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `
      <div class="error-message">
        <strong>${title}:</strong> ${message}
      </div>
    `;
  }

  showSuccess(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `
      <div class="success-message">
        ${message}
      </div>
    `;

    // 3秒后自动清除
    setTimeout(() => {
      errorContainer.innerHTML = '';
    }, 3000);
  }

  clearErrors() {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = '';
  }

  getStatusIcon(status) {
    const icons = {
      pass: '✓',
      fail: '✗',
      warning: '⚠',
      error: '⚠'
    };
    return icons[status] || '?';
  }

  getCheckDisplayName(checkName) {
    const names = {
      'extension-context': '插件上下文检查',
      'permissions': '权限配置检查',
      'content-script': 'Content Script状态',
      'background-service': 'Background Service状态',
      'storage-access': '存储访问检查',
      'message-passing': '消息传递检查',
      'page-compatibility': '页面兼容性检查',
      'api-configuration': 'API配置检查'
    };
    return names[checkName] || checkName;
  }

  getOverallStatusText(status) {
    const texts = {
      pass: '✅ 正常',
      warning: '⚠️ 有警告',
      fail: '❌ 有问题'
    };
    return texts[status] || '❓ 未知';
  }

  getPriorityText(priority) {
    const texts = {
      high: '高',
      medium: '中',
      low: '低'
    };
    return texts[priority] || priority;
  }

  getActionText(action) {
    const actions = {
      'reload-extension': '在 chrome://extensions/ 页面重新加载插件',
      'check-permissions': '检查 manifest.json 中的权限配置',
      'refresh-page': '刷新当前页面',
      'restart-browser': '重启浏览器',
      'configure-api': '访问插件设置页面配置API',
      'check-background': '检查 Background Service Worker 状态'
    };
    return actions[action] || action;
  }

  getBrowserInfo() {
    const userAgent = navigator.userAgent;
    const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/);
    return chromeMatch ? `Chrome ${chromeMatch[1]}` : '未知浏览器';
  }

  getChromeVersion() {
    const userAgent = navigator.userAgent;
    const chromeMatch = userAgent.match(/Chrome\/([0-9.]+)/);
    return chromeMatch ? chromeMatch[1] : 'unknown';
  }

  getExtensionVersion() {
    if (chrome && chrome.runtime && chrome.runtime.getManifest) {
      try {
        return chrome.runtime.getManifest().version;
      } catch (error) {
        return 'unknown';
      }
    }
    return 'unknown';
  }

  getExtensionStatus() {
    if (chrome && chrome.runtime) {
      return chrome.runtime.id ? `✅ 已加载 (${chrome.runtime.id})` : '✅ 可用';
    }
    return '❌ 不可用';
  }

  generateTextSummary(results) {
    const summary = results.summary;
    const timestamp = new Date(results.timestamp).toLocaleString('zh-CN');

    let text = `Chrome插件诊断报告\n`;
    text += `===================\n\n`;
    text += `诊断时间: ${timestamp}\n`;
    text += `整体状态: ${this.getOverallStatusText(results.overall)}\n\n`;

    text += `检查统计:\n`;
    text += `- 总检查项: ${summary.total}\n`;
    text += `- 通过: ${summary.passed}\n`;
    text += `- 失败: ${summary.failed}\n`;
    text += `- 警告: ${summary.warnings}\n`;
    text += `- 错误: ${summary.errors}\n\n`;

    if (results.recommendations && results.recommendations.length > 0) {
      text += `修复建议:\n`;
      results.recommendations.forEach((rec, index) => {
        text += `${index + 1}. [${this.getPriorityText(rec.priority)}] ${rec.title}\n`;
        text += `   ${rec.description}\n\n`;
      });
    }

    text += `\n详细信息请查看完整的诊断报告。`;

    return text;
  }
}

// 全局函数，用于切换详情显示
window.toggleDetails = function(checkName) {
  const details = document.getElementById(`details-${checkName}`);
  if (details) {
    details.style.display = details.style.display === 'none' ? 'block' : 'none';
  }
};

// 初始化诊断界面
document.addEventListener('DOMContentLoaded', () => {
  new DiagnosticUI();
});

// 添加样式到页面
const style = document.createElement('style');
style.textContent = `
  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
  }

  .status-badge.pass {
    background: #d4edda;
    color: #155724;
  }

  .status-badge.warning {
    background: #fff3cd;
    color: #856404;
  }

  .status-badge.fail {
    background: #f8d7da;
    color: #721c24;
  }
`;
document.head.appendChild(style);
