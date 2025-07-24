// config.js - 配置页面脚本
class ConfigManager {
  constructor() {
    this.defaultConfig = {
      llmConfig: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4-vision-preview'
      },
      threatModelingConfig: {
        baseUrl: '',
        apiKey: ''
      },
      analysisConfig: {
        defaultPrompt:
          '根据产品需求内容，识别潜在的安全风险点，明确对应的安全测试场景，并生成相应的安全测试用例。重点关注：数据安全、身份认证、权限控制、输入验证、业务逻辑安全等方面。'
      },
      detectionConfig: {
        customSelectors: []
      }
    };

    this.init();
  }

  async init() {
    await this.loadConfig();
    this.checkFirstTimeSetup();
    this.bindEvents();
    this.updateProviderEndpoint();
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        'llmConfig',
        'threatModelingConfig',
        'analysisConfig',
        'detectionConfig'
      ]);

      // 合并默认配置和保存的配置
      const config = {
        llmConfig: { ...this.defaultConfig.llmConfig, ...result.llmConfig },
        threatModelingConfig: {
          ...this.defaultConfig.threatModelingConfig,
          ...result.threatModelingConfig
        },
        analysisConfig: {
          ...this.defaultConfig.analysisConfig,
          ...result.analysisConfig
        },
        detectionConfig: {
          ...this.defaultConfig.detectionConfig,
          ...result.detectionConfig
        }
      };

      this.populateForm(config);
    } catch (error) {
      console.error('加载配置失败:', error);
      this.showStatus('加载配置失败', 'error');
    }
  }

  populateForm(config) {
    // LLM配置
    document.getElementById('llm-provider').value = config.llmConfig.provider || 'openai';
    document.getElementById('llm-endpoint').value = config.llmConfig.endpoint || '';
    document.getElementById('llm-api-key').value = config.llmConfig.apiKey || '';
    document.getElementById('llm-model').value = config.llmConfig.model || '';

    // 威胁建模平台配置
    document.getElementById('threat-platform-url').value =
      config.threatModelingConfig.baseUrl || '';
    document.getElementById('threat-platform-key').value =
      config.threatModelingConfig.apiKey || '';

    // 分析配置
    document.getElementById('default-prompt').value =
      config.analysisConfig.defaultPrompt || '';

    // 检测配置
    const customSelectors = config.detectionConfig.customSelectors || [];
    document.getElementById('custom-selectors').value = customSelectors.join('\n');
  }

  bindEvents() {
    // 保存配置
    document.getElementById('save-config').addEventListener('click', () => {
      this.saveConfig();
    });

    // 测试配置
    document.getElementById('test-config').addEventListener('click', () => {
      this.testConfig();
    });

    // 重置配置
    document.getElementById('reset-config').addEventListener('click', () => {
      this.resetConfig();
    });

    // LLM提供商变化时更新端点
    document.getElementById('llm-provider').addEventListener('change', () => {
      this.updateProviderEndpoint();
    });

    // 快速设置向导事件
    this.bindQuickSetupEvents();
  }

  async checkFirstTimeSetup() {
    try {
      const result = await chrome.storage.sync.get(['llmConfig', 'hasCompletedSetup']);
      const llmConfig = result.llmConfig || {};
      const hasCompletedSetup = result.hasCompletedSetup || false;

      // 如果没有配置API密钥且没有完成过设置，显示快速设置向导
      if (!llmConfig.apiKey && !hasCompletedSetup) {
        this.showQuickSetupWizard();
      }
    } catch (error) {
      console.error('检查首次设置失败:', error);
    }
  }

  showQuickSetupWizard() {
    const wizard = document.getElementById('quick-setup-wizard');
    if (wizard) {
      wizard.style.display = 'block';

      // 滚动到向导位置
      wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  bindQuickSetupEvents() {
    // 快速设置选项点击
    document.querySelectorAll('.setup-option').forEach(option => {
      option.addEventListener('click', () => {
        const radio = option.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
        }
      });
    });

    // 应用快速设置
    const applyBtn = document.getElementById('apply-quick-setup');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.applyQuickSetup();
      });
    }

    // 跳过向导
    const skipBtn = document.getElementById('skip-wizard');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        this.skipQuickSetup();
      });
    }
  }

  async applyQuickSetup() {
    const selectedProvider = document.querySelector(
      'input[name="quick-provider"]:checked'
    );

    if (!selectedProvider) {
      this.showStatus('请选择一个AI服务提供商', 'error');
      return;
    }

    const provider = selectedProvider.value;

    // 设置提供商
    document.getElementById('llm-provider').value = provider;
    this.updateProviderEndpoint();

    // 隐藏向导
    document.getElementById('quick-setup-wizard').style.display = 'none';

    // 聚焦到API密钥输入框
    const apiKeyInput = document.getElementById('llm-api-key');
    apiKeyInput.focus();
    apiKeyInput.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 显示提示信息
    this.showStatus(`已选择 ${this.getProviderName(provider)}，请填写API密钥`, 'success');

    // 标记已完成快速设置
    await chrome.storage.sync.set({ hasCompletedSetup: true });
  }

  async skipQuickSetup() {
    // 隐藏向导
    document.getElementById('quick-setup-wizard').style.display = 'none';

    // 标记已完成设置（跳过）
    await chrome.storage.sync.set({ hasCompletedSetup: true });

    this.showStatus('已跳过快速设置向导', 'success');
  }

  getProviderName(provider) {
    const names = {
      openai: 'OpenAI GPT-4',
      azure: 'Azure OpenAI',
      anthropic: 'Anthropic Claude',
      custom: '自定义服务'
    };
    return names[provider] || provider;
  }

  updateProviderEndpoint() {
    const provider = document.getElementById('llm-provider').value;
    const endpointInput = document.getElementById('llm-endpoint');
    const modelInput = document.getElementById('llm-model');

    const providerDefaults = {
      openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4-vision-preview'
      },
      azure: {
        endpoint:
          'https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-12-01-preview',
        model: 'gpt-4-vision-preview'
      },
      anthropic: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-opus-20240229'
      },
      custom: {
        endpoint: '',
        model: ''
      }
    };

    const defaults = providerDefaults[provider];
    if (defaults && !endpointInput.value) {
      endpointInput.value = defaults.endpoint;
    }
    if (defaults && !modelInput.value) {
      modelInput.value = defaults.model;
    }
  }

  async saveConfig() {
    try {
      const config = this.getFormConfig();

      // 验证配置
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        this.showStatus(validation.message, 'error');
        return;
      }

      // 保存到Chrome存储
      await chrome.storage.sync.set(config);

      // 通知后台脚本更新配置
      await chrome.runtime.sendMessage({
        action: 'updateConfig',
        data: config
      });

      this.showStatus('配置保存成功！可以开始使用安全分析功能了', 'success');
      // this.showNextStepsGuide(); // 禁用弹窗指南
    } catch (error) {
      console.error('保存配置失败:', error);
      this.showStatus('保存配置失败: ' + error.message, 'error');
    }
  }

  getFormConfig() {
    // 解析自定义选择器
    const customSelectorsText = document.getElementById('custom-selectors').value.trim();
    const customSelectors = customSelectorsText
      ? customSelectorsText
          .split('\n')
          .map(s => s.trim())
          .filter(s => s)
      : [];

    return {
      llmConfig: {
        provider: document.getElementById('llm-provider').value,
        endpoint: document.getElementById('llm-endpoint').value.trim(),
        apiKey: document.getElementById('llm-api-key').value.trim(),
        model: document.getElementById('llm-model').value.trim()
      },
      threatModelingConfig: {
        baseUrl: document.getElementById('threat-platform-url').value.trim(),
        apiKey: document.getElementById('threat-platform-key').value.trim()
      },
      analysisConfig: {
        defaultPrompt: document.getElementById('default-prompt').value.trim()
      },
      detectionConfig: {
        customSelectors
      }
    };
  }

  validateConfig(config) {
    // LLM配置验证
    if (!config.llmConfig.endpoint) {
      return { valid: false, message: '请填写LLM API端点' };
    }

    if (!config.llmConfig.apiKey) {
      return { valid: false, message: '请填写LLM API密钥' };
    }

    if (!config.llmConfig.model) {
      return { valid: false, message: '请填写LLM模型名称' };
    }

    // URL格式验证
    try {
      new URL(config.llmConfig.endpoint);
      if (config.threatModelingConfig.baseUrl) {
        new URL(config.threatModelingConfig.baseUrl);
      }
    } catch (error) {
      return { valid: false, message: 'URL格式不正确' };
    }

    return { valid: true };
  }

  async testConfig() {
    try {
      const config = this.getFormConfig();

      this.showStatus('正在测试配置...', 'success');

      // 测试LLM连接
      const testResult = await chrome.runtime.sendMessage({
        action: 'testLLMConnection',
        data: config.llmConfig
      });

      if (testResult.success) {
        this.showStatus('配置测试成功！LLM连接正常', 'success');
      } else {
        this.showStatus('配置测试失败: ' + testResult.error, 'error');
      }
    } catch (error) {
      console.error('测试配置失败:', error);
      this.showStatus('测试配置失败: ' + error.message, 'error');
    }
  }

  async resetConfig() {
    if (confirm('确定要重置所有配置吗？这将清除所有已保存的设置。')) {
      try {
        await chrome.storage.sync.clear();
        this.populateForm(this.defaultConfig);
        this.showStatus('配置已重置为默认值', 'success');
      } catch (error) {
        console.error('重置配置失败:', error);
        this.showStatus('重置配置失败: ' + error.message, 'error');
      }
    }
  }

  showNextStepsGuide() {
    // 使用控制台输出代替弹窗，避免浏览器弹窗拦截
    console.log('🎉 配置完成！AI服务已成功配置');
    console.log('📋 使用步骤：');
    console.log('  1. 在需求管理平台打开产品需求页面');
    console.log('  2. 点击插件图标启动安全需求分析');
    console.log('  3. 选择内容源并开始分析');
    console.log('  4. 查看生成的安全威胁和测试建议');

    // 可选：显示控制台消息提示
    this.showStatus('配置完成！请查看控制台了解使用步骤', 'success');
  }

  showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    // 3秒后自动隐藏
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

// 初始化配置管理器
document.addEventListener('DOMContentLoaded', () => {
  new ConfigManager();
});
