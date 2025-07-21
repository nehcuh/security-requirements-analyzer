// popup.js - 插件弹窗逻辑
class SecurityAnalysisPopup {
  constructor() {
    this.attachments = [];
    this.pageText = '';
    this.selectedSource = null;
    this.init();
  }

  async init() {
    this.showLoading();

    // 首先检查配置状态
    const configStatus = await this.checkConfiguration();

    if (!configStatus.isConfigured) {
      this.showConfigAlert();
      return;
    }

    await this.detectPageContent();
    this.bindEvents();
    this.showContent();
    this.showConfigStatus(configStatus);
  }

  showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
  }

  showContent() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  }

  async detectPageContent() {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 向content script发送消息获取页面内容
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'detectContent'
      });

      if (response) {
        this.attachments = response.attachments || [];
        this.pageText = response.pageText || '';
        this.updateUI();
      }
    } catch (error) {
      console.error('检测页面内容失败:', error);
      this.showError('无法检测页面内容，请确保页面已完全加载');
    }
  }

  updateUI() {
    // 更新附件列表
    if (this.attachments.length > 0) {
      this.showAttachments();
    }

    // 更新页面文本预览
    if (this.pageText.trim()) {
      this.showPageText();
    }
  }

  showAttachments() {
    const section = document.getElementById('attachments-section');
    const list = document.getElementById('attachment-list');

    section.style.display = 'block';
    list.innerHTML = '';

    this.attachments.forEach((attachment, index) => {
      const item = document.createElement('div');
      item.className = 'attachment-item';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'attachment';
      radio.value = index;
      radio.id = `attachment-${index}`;

      const label = document.createElement('label');
      label.htmlFor = `attachment-${index}`;
      label.textContent = `${attachment.name} (${attachment.type})`;

      item.appendChild(radio);
      item.appendChild(label);
      list.appendChild(item);

      // 默认选择第一个PDF或DOCX文件
      if (index === 0 || this.isPRDFile(attachment)) {
        radio.checked = true;
        this.selectedSource = { type: 'attachment', data: attachment };
      }
    });
  }

  showPageText() {
    const section = document.getElementById('text-section');
    const preview = document.getElementById('text-preview');

    section.style.display = 'block';
    preview.textContent = this.pageText.substring(0, 500) +
      (this.pageText.length > 500 ? '...' : '');
  }

  isPRDFile(attachment) {
    const name = attachment.name.toLowerCase();
    const prdKeywords = ['prd', '需求', 'requirement', '产品'];
    return prdKeywords.some(keyword => name.includes(keyword)) ||
      ['pdf', 'docx', 'doc'].includes(attachment.type.toLowerCase());
  }

  bindEvents() {
    // 配置相关按钮
    this.bindConfigEvents();

    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.init();
    });

    // 分析按钮
    document.getElementById('analyze-btn').addEventListener('click', () => {
      this.startAnalysis();
    });

    // 附件选择变化
    document.addEventListener('change', (e) => {
      if (e.target.name === 'attachment') {
        const index = parseInt(e.target.value);
        this.selectedSource = {
          type: 'attachment',
          data: this.attachments[index]
        };
      }
    });
  }

  async startAnalysis() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const originalText = analyzeBtn.textContent;

    try {
      analyzeBtn.textContent = '🔄 分析中...';
      analyzeBtn.disabled = true;

      // 获取分析内容
      const content = await this.getAnalysisContent();
      const customPrompt = document.getElementById('custom-prompt').value.trim();

      // 发送到后台进行分析
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeContent',
        data: {
          content,
          prompt: customPrompt,
          source: this.selectedSource
        }
      });

      if (result.success) {
        // 显示结果或跳转到威胁建模平台
        this.showAnalysisResult(result.data);
      } else {
        this.showError(result.error || '分析失败');
      }

    } catch (error) {
      console.error('分析过程出错:', error);
      this.showError('分析过程中出现错误');
    } finally {
      analyzeBtn.textContent = originalText;
      analyzeBtn.disabled = false;
    }
  }

  async getAnalysisContent() {
    // 优先级：手动输入 > 选中附件 > 页面文本
    const manualInput = document.getElementById('manual-input').value.trim();

    if (manualInput) {
      return { type: 'manual', content: manualInput };
    }

    if (this.selectedSource && this.selectedSource.type === 'attachment') {
      // 这里需要解析附件内容
      return {
        type: 'attachment',
        content: await this.parseAttachment(this.selectedSource.data)
      };
    }

    if (this.pageText.trim()) {
      return { type: 'pageText', content: this.pageText };
    }

  }

  async parseAttachment(attachment) {
    // 发送到background script进行文件解析
    const result = await chrome.runtime.sendMessage({
      action: 'parseFile',
      data: attachment
    });

    if (result.success) {
      return result.content;
    } else {
      throw new Error(result.error || '文件解析失败');
    }
  }

  showAnalysisResult(result) {
    // 创建结果显示窗口
    const resultWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');

    const resultHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>安全需求分析结果</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; padding: 15px; border: 1px solid #dee2e6; border-radius: 5px; }
          .section h3 { margin-top: 0; color: #495057; }
          .threat { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 3px; }
          .threat.high { background: #f8d7da; }
          .threat.medium { background: #fff3cd; }
          .threat.low { background: #d1ecf1; }
          .test-scenario { background: #d4edda; padding: 10px; margin: 5px 0; border-radius: 3px; }
          pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
          .export-btn { background: #007cba; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛡️ 安全需求分析结果</h1>
          <p><strong>分析时间:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
          <button class="export-btn" onclick="exportToJson()">导出JSON</button>
          <button class="export-btn" onclick="window.print()">打印报告</button>
        </div>
        
        ${this.formatAnalysisResult(result)}
        
        <script>
          function exportToJson() {
            const data = ${JSON.stringify(result, null, 2)};
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'security-analysis-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
          }
        </script>
      </body>
      </html>
    `;

    resultWindow.document.write(resultHtml);
    resultWindow.document.close();
  }

  formatAnalysisResult(result) {
    let html = '';

    try {
      const analysis = typeof result.analysis === 'string' ?
        JSON.parse(result.analysis) : result.analysis;

      if (analysis.summary) {
        html += `
          <div class="section">
            <h3>📋 需求概述</h3>
            <p>${analysis.summary}</p>
          </div>
        `;
      }

      if (analysis.assets && analysis.assets.length > 0) {
        html += `
          <div class="section">
            <h3>🎯 关键资产</h3>
            <ul>
              ${analysis.assets.map(asset => `<li>${asset}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      if (analysis.threats && analysis.threats.length > 0) {
        html += `
          <div class="section">
            <h3>⚠️ 识别的威胁</h3>
            ${analysis.threats.map(threat => `
              <div class="threat ${threat.level || 'medium'}">
                <strong>${threat.type || '未分类威胁'}:</strong> ${threat.description}
                <br><small>风险等级: ${threat.level || '中等'}</small>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (analysis.testScenarios && analysis.testScenarios.length > 0) {
        html += `
          <div class="section">
            <h3>🧪 安全测试场景</h3>
            ${analysis.testScenarios.map(scenario => `
              <div class="test-scenario">
                <strong>${scenario.category || '安全测试'}:</strong> ${scenario.description}
                ${scenario.steps ? `<br><small>测试步骤: ${scenario.steps.join(', ')}</small>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      }

      if (analysis.recommendations && analysis.recommendations.length > 0) {
        html += `
          <div class="section">
            <h3>💡 安全建议</h3>
            <ul>
              ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    } catch (error) {
      html += `
        <div class="section">
          <h3>📄 原始分析结果</h3>
          <pre>${result.analysis}</pre>
        </div>
      `;
    }

    return html;
  }

  async checkConfiguration() {
    try {
      const result = await chrome.storage.sync.get(['llmConfig']);
      const llmConfig = result.llmConfig || {};

      const isConfigured = !!(
        llmConfig.endpoint &&
        llmConfig.apiKey &&
        llmConfig.model
      );

      return {
        isConfigured,
        config: llmConfig,
        missingFields: this.getMissingConfigFields(llmConfig)
      };
    } catch (error) {
      console.error('检查配置失败:', error);
      return { isConfigured: false, config: {}, missingFields: ['all'] };
    }
  }

  getMissingConfigFields(config) {
    const required = ['endpoint', 'apiKey', 'model'];
    return required.filter(field => !config[field]);
  }

  showConfigAlert() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('config-alert').style.display = 'block';

    this.bindConfigEvents();
  }

  bindConfigEvents() {
    // 配置按钮事件
    document.getElementById('open-config')?.addEventListener('click', () => {
      this.openConfigPage();
    });

    document.getElementById('setup-config')?.addEventListener('click', () => {
      this.openConfigPage();
    });

    document.getElementById('show-help')?.addEventListener('click', () => {
      this.showHelpDialog();
    });

    document.getElementById('dismiss-alert')?.addEventListener('click', () => {
      this.dismissConfigAlert();
    });
  }

  openConfigPage() {
    chrome.runtime.openOptionsPage();
  }

  showHelpDialog() {
    const helpWindow = window.open('', '_blank', 'width=600,height=500,scrollbars=yes');

    const helpHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>使用帮助</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .step { background: #e9ecef; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .step h4 { margin: 0 0 10px 0; color: #495057; }
          code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; }
          .provider-example { background: #d4edda; padding: 10px; margin: 5px 0; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛡️ 安全需求分析助手 - 使用帮助</h1>
        </div>
        
        <div class="section">
          <h2>🚀 快速开始</h2>
          
          <div class="step">
            <h4>步骤1: 配置AI服务</h4>
            <p>点击插件图标右上角的 ⚙️ 按钮，或点击"立即配置"按钮打开配置页面。</p>
          </div>
          
          <div class="step">
            <h4>步骤2: 选择LLM提供商</h4>
            <p>支持以下AI服务提供商：</p>
            
            <div class="provider-example">
              <strong>OpenAI GPT-4</strong><br>
              端点: <code>https://api.openai.com/v1/chat/completions</code><br>
              模型: <code>gpt-4-vision-preview</code><br>
              密钥: <code>sk-your-openai-api-key</code>
            </div>
            
            <div class="provider-example">
              <strong>Azure OpenAI</strong><br>
              端点: <code>https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-12-01-preview</code><br>
              模型: <code>gpt-4-vision-preview</code><br>
              密钥: <code>your-azure-api-key</code>
            </div>
          </div>
          
          <div class="step">
            <h4>步骤3: 测试配置</h4>
            <p>在配置页面点击"🧪 测试配置"按钮，确认API连接正常。</p>
          </div>
          
          <div class="step">
            <h4>步骤4: 开始分析</h4>
            <p>在产品需求页面点击插件图标，选择需求内容，点击"🚀 开始分析"。</p>
          </div>
        </div>
        
        <div class="section">
          <h2>💡 使用技巧</h2>
          <ul>
            <li>插件会自动检测页面中的PDF/DOCX附件</li>
            <li>如果没有附件，会提取页面文本内容</li>
            <li>可以手动输入或粘贴需求内容</li>
            <li>支持自定义分析提示词</li>
            <li>分析结果可以导出为JSON格式</li>
          </ul>
        </div>
        
        <div class="section">
          <h2>🔧 故障排除</h2>
          <ul>
            <li><strong>API调用失败</strong>: 检查API密钥和网络连接</li>
            <li><strong>页面检测失败</strong>: 确保页面完全加载后再使用</li>
            <li><strong>分析结果异常</strong>: 尝试调整提示词或检查模型支持</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <button onclick="window.close()" style="background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">关闭帮助</button>
        </div>
      </body>
      </html>
    `;

    helpWindow.document.write(helpHtml);
    helpWindow.document.close();
  }

  async dismissConfigAlert() {
    // 隐藏配置提醒，继续使用（但功能受限）
    document.getElementById('config-alert').style.display = 'none';

    // 显示受限模式提示
    await this.detectPageContent();
    this.bindEvents();
    this.showContent();

    // 添加受限模式提示
    this.showLimitedModeWarning();
  }

  showLimitedModeWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'config-status not-configured';
    warningDiv.innerHTML = `
      ⚠️ 受限模式：未配置AI服务，无法进行智能分析
      <button id="limited-mode-config-btn" 
              style="float: right; background: #ffc107; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
        立即配置
      </button>
    `;

    const content = document.getElementById('content');
    content.insertBefore(warningDiv, content.firstChild);

    // 绑定配置按钮事件
    document.getElementById('limited-mode-config-btn').addEventListener('click', () => {
      this.openConfigPage();
    });
  }

  showConfigStatus(configStatus) {
    const indicator = document.getElementById('config-status-indicator');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const statusBtn = document.getElementById('status-config-btn');

    if (!indicator) return;

    indicator.style.display = 'flex';

    if (configStatus.isConfigured) {
      indicator.className = 'config-status configured';
      statusIcon.textContent = '✅';
      statusText.textContent = `AI服务已配置 (${configStatus.config.provider || 'Custom'})`;
    } else {
      indicator.className = 'config-status not-configured';
      statusIcon.textContent = '⚠️';
      statusText.textContent = '需要配置AI服务';
    }

    // 绑定配置按钮事件
    statusBtn.addEventListener('click', () => {
      this.openConfigPage();
    });
  }

  showError(message) {
    // 创建更友好的错误显示
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border: 1px solid #f5c6cb;
      border-radius: 5px;
      max-width: 300px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    errorDiv.innerHTML = `
      <strong>错误:</strong> ${message}
      <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
    `;

    document.body.appendChild(errorDiv);

    // 5秒后自动移除
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }
}

// 初始化弹窗
document.addEventListener('DOMContentLoaded', () => {
  new SecurityAnalysisPopup();
});