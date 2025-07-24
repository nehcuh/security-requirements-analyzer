// background-simple.js - 增强的后台服务脚本
// 集成STAC知识库和文档解析器

class SecurityAnalysisService {
  constructor() {
    this.llmConfig = {
      provider: "custom",
      endpoint: "http://localhost:1234/v1/chat/completions",
      apiKey: "",
      model: "deepseek/deepseek-r1-0528-qwen3-8b",
    };

    this.threatModelingPlatform = {
      baseUrl: "",
      apiKey: "",
    };

    // 初始化STAC服务和文档解析器
    this.stacService = null;
    this.documentParser = null;
    this.inputValidator = null;

    // 初始化缓存
    this.analysisCache = new Map();
    this.cacheMaxSize = 50;
    this.cacheExpiryTime = 30 * 60 * 1000; // 30分钟

    // 工具函数（动态导入）
    this.utils = null;

    this.init();
  }

  async init() {
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持异步响应通道开放
    });

    // 监听标签页更新，确保Content Script正确注入
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.ensureContentScriptInjected(tabId, tab.url);
      }
    });

    // 监听扩展启动
    chrome.runtime.onStartup.addListener(() => {
      this.injectContentScriptToAllTabs();
    });

    // 监听扩展安装
    chrome.runtime.onInstalled.addListener(() => {
      this.injectContentScriptToAllTabs();
    });

    // 加载配置
    this.loadConfig();

    // 初始化高级服务
    await this.initializeAdvancedServices();
  }

  // 动态初始化高级服务
  async initializeAdvancedServices() {
    try {
      // 初始化工具函数
      await this.initUtils();
      
      // 延迟加载STAC服务
      await this.initSTACService();
      
      // 延迟加载文档解析器
      await this.initDocumentParser();
      
      // 初始化输入验证器
      await this.initInputValidator();
      
      console.log('Advanced services initialized successfully');
    } catch (error) {
      console.warn('Advanced services initialization failed, falling back to basic mode:', error);
    }
  }

  async initUtils() {
    try {
      this.utils = await import('../shared/utils.js');
    } catch (error) {
      console.warn('Utils initialization failed:', error);
      // 创建基础工具函数回退
      this.utils = {
        assessThreatLevel: (text) => {
          const highKeywords = ["严重", "高危", "critical", "high"];
          const mediumKeywords = ["中等", "medium"];
          const lowerText = text.toLowerCase();
          if (highKeywords.some(keyword => lowerText.includes(keyword))) return "high";
          else if (mediumKeywords.some(keyword => lowerText.includes(keyword))) return "medium";
          return "low";
        },
        formatTimestamp: (timestamp) => new Date(timestamp).toLocaleString(),
        truncateText: (text, maxLength = 100) => {
          if (!text || text.length <= maxLength) return text;
          return text.substring(0, maxLength) + '...';
        }
      };
    }
  }

  async initSTACService() {
    try {
      // 动态导入STAC服务
      const { STACService } = await import('./stac-service.js');
      this.stacService = new STACService();
      await this.stacService.loadKnowledgeBase();
    } catch (error) {
      console.warn('STAC service initialization failed:', error);
      this.stacService = null;
    }
  }

  async initDocumentParser() {
    try {
      // 使用简化的文档解析器
      const { DocumentParser } = await import('./simple-document-parser.js');
      this.documentParser = new DocumentParser();
      await this.documentParser.init();
      console.log('Simple document parser initialized successfully');
    } catch (error) {
      console.warn('Simple document parser initialization failed:', error);
      this.documentParser = null;
    }
  }

  async initInputValidator() {
    try {
      // 动态导入输入验证器
      const { InputValidator } = await import('../shared/input-validator.js');
      this.inputValidator = new InputValidator();
    } catch (error) {
      console.warn('Input validator initialization failed:', error);
      this.inputValidator = null;
    }
  }

  async ensureContentScriptInjected(tabId, url) {
    try {
      // 如果没有提供URL，获取标签页信息
      if (!url) {
        const tab = await chrome.tabs.get(tabId);
        url = tab.url;
      }
      
      // 跳过chrome://和extension://页面
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return;
      }

      console.log("🔍 检查content script是否已注入，URL:", url);

      // 测试Content Script是否已经注入
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'diagnostic-ping' });
        console.log("✅ Content Script已存在");
        // 如果没有抛出异常，说明Content Script已经存在
        return;
      } catch (error) {
        // Content Script不存在，需要注入
        console.log('❌ Content Script不存在，正在注入...', url);
      }

      // 注入Content Script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content/content-simple.js']
      });

      console.log('✅ Content Script注入成功:', url);
    } catch (error) {
      console.error('❌ Content Script注入失败:', error);
    }
  }

  async injectContentScriptToAllTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          await this.ensureContentScriptInjected(tab.id, tab.url);
        }
      }
    } catch (error) {
      console.error('Failed to inject content script to all tabs:', error);
    }
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        "llmConfig",
        "threatModelingConfig",
      ]);

      // 确保包含默认配置
      const defaultConfig = {
        provider: "custom",
        endpoint: "http://localhost:1234/v1/chat/completions",
        apiKey: "",
        model: "deepseek/deepseek-r1-0528-qwen3-8b",
      };

      if (result.llmConfig) {
        this.llmConfig = { ...defaultConfig, ...result.llmConfig };
      } else {
        this.llmConfig = defaultConfig;
      }
      if (result.threatModelingConfig) {
        this.threatModelingPlatform = {
          ...this.threatModelingPlatform,
          ...result.threatModelingConfig,
        };
      }
    } catch (error) {
      console.error("加载配置失败:", error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      // Handle diagnostic ping without validation for debugging
      if (request.action === "diagnostic-ping") {
        sendResponse({
          success: true,
          message: "Background service is active",
          timestamp: this.utils?.formatTimestamp ? this.utils.formatTimestamp(Date.now()) : new Date().toISOString(),
          receivedTimestamp: request.timestamp,
        });
        return;
      }

      switch (request.action) {
        case "detectContent":
          // 转发到content script进行页面内容检测
          const contentResult = await this.forwardToContentScript(request);
          sendResponse(contentResult);
          break;

        case "analyzeContent":
          const analysisResult = await this.analyzeContent(request.data);
          sendResponse({ success: true, data: analysisResult });
          break;

        case "parseFile":
          const fileContent = await this.parseFile(request.data);
          sendResponse({ success: true, content: fileContent });
          break;

        case "updateConfig":
          await this.updateConfig(request.data);
          sendResponse({ success: true });
          break;

        case "testLLMConnection":
          const testResult = await this.testLLMConnection(request.data);
          sendResponse(testResult);
          break;

        default:
          sendResponse({ success: false, error: "未知操作" });
      }
    } catch (error) {
      console.error("处理消息失败:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async forwardToContentScript(request) {
    try {
      let tabId = request.tabId;
      
      // 如果没有提供tabId，获取当前活动标签页
      if (!tabId) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          throw new Error("无法获取当前标签页");
        }
        tabId = tab.id;
      }

      console.log("🔄 Background转发消息到content script，tabId:", tabId);

      // 确保content script已注入
      await this.ensureContentScriptInjected(tabId, null);

      // 转发消息到content script
      const response = await chrome.tabs.sendMessage(tabId, {
        action: request.action,
        data: request.data
      });

      console.log("✅ Content script响应:", response);
      return { success: true, ...response };
    } catch (error) {
      console.error("❌ 转发到content script失败:", error);
      return { 
        success: false, 
        error: error.message,
        attachments: [],
        pageText: ""
      };
    }
  }

  async analyzeContent(data) {
    const { content, prompt, source } = data;

    // 输入验证
    if (this.inputValidator) {
      try {
        this.inputValidator.validateInput(content);
      } catch (error) {
        throw new Error(`输入验证失败: ${error.message}`);
      }
    }

    // 检查缓存
    const cacheKey = this.generateCacheKey(content, prompt);
    const cachedResult = this.getCachedAnalysis(cacheKey);
    if (cachedResult) {
      console.log('返回缓存的分析结果');
      return cachedResult;
    }

    let analysisResult;

    // 优先使用STAC知识库分析
    if (this.stacService && this.stacService.isLoaded) {
      try {
        console.log('使用STAC知识库进行分析');
        analysisResult = await this.analyzeWithSTAC(content, prompt);
      } catch (error) {
        console.warn('STAC分析失败，使用AI回退:', error);
        analysisResult = await this.analyzeWithLLM(content, prompt);
      }
    } else {
      // 回退到LLM分析
      console.log('使用LLM进行分析');
      analysisResult = await this.analyzeWithLLM(content, prompt);
    }

    // 缓存结果
    this.cacheAnalysis(cacheKey, analysisResult);

    // 可选：发送到威胁建模平台
    if (this.threatModelingPlatform.baseUrl && analysisResult.securityScenarios) {
      try {
        await this.sendToThreatModelingPlatform(analysisResult.securityScenarios);
      } catch (error) {
        console.warn('发送到威胁建模平台失败:', error);
      }
    }

    return analysisResult;
  }

  // 使用STAC知识库进行分析
  async analyzeWithSTAC(content, prompt) {
    try {
      console.log('🔍 开始STAC知识库分析...');
      
      // 使用STAC服务匹配安全场景
      const stacMatches = await this.stacService.matchScenarios(content);
      console.log('📊 STAC匹配结果:', stacMatches);
      
      if (stacMatches && stacMatches.length > 0) {
        console.log(`✅ STAC匹配成功，找到 ${stacMatches.length} 个安全场景`);
        
        // 获取详细的威胁信息和安全需求
        const threatInfo = this.stacService.extractThreatInformation(stacMatches);
        const securityRequirements = this.stacService.getSecurityRequirements(stacMatches);
        const testCases = this.stacService.getTestCases(stacMatches);
        
        console.log('📋 威胁信息:', threatInfo);
        console.log('🔒 安全需求:', securityRequirements);
        console.log('🧪 测试用例:', testCases);
        
        // 构建基于STAC的分析结果
        const securityScenarios = stacMatches.map(match => {
          const scenarioData = this.stacService.getScenarioData(match.scenario);
          
          return {
            category: match.scenario,
            description: `${match.scenario} (置信度: ${Math.round(match.confidence * 100)}%)`,
            steps: testCases
              .filter(test => test.scenario === match.scenario)
              .slice(0, 3)
              .map(test => test.details),
            expectedResult: '系统应正确处理安全威胁',
            riskLevel: this.determineRiskLevel(match.confidence),
            confidence: match.confidence,
            keywordMatches: match.keywordMatches,
            matchedKeywords: match.matchedKeywords,
            matchedThreats: match.matchedThreats || []
          };
        });

        const threats = threatInfo.threats.map(threat => ({
          type: threat.category,
          description: threat.name,
          details: threat.details,
          level: threat.riskLevel,
          impact: threat.scenario,
          securityRequirement: threat.securityRequirement ? threat.securityRequirement.name : null,
          testCase: threat.testCase ? threat.testCase.name : null
        }));

        const stacRecommendations = this.generateSTACRecommendations(stacMatches, securityRequirements, testCases);

        const result = {
          originalContent: content,
          analysis: this.formatSTACAnalysis(stacMatches, threatInfo, securityRequirements, testCases),
          securityScenarios,
          threats,
          securityRequirements: securityRequirements.map(req => ({
            name: req.name,
            details: req.details,
            priority: req.priority,
            category: req.category
          })),
          testCases: testCases.map(test => ({
            name: test.name,
            details: test.details,
            category: test.category,
            priority: test.priority
          })),
          assets: this.extractAssets(content),
          recommendations: stacRecommendations,
          analysisMethod: 'STAC',
          stacMatches: stacMatches,
          stacStatistics: {
            totalScenarios: stacMatches.length,
            averageConfidence: stacMatches.reduce((sum, m) => sum + m.confidence, 0) / stacMatches.length,
            totalThreats: threatInfo.threats.length,
            totalRequirements: securityRequirements.length,
            totalTestCases: testCases.length
          },
          timestamp: new Date().toISOString(),
        };
        
        console.log('✅ STAC分析完成:', result);
        return result;
        
      } else {
        console.warn('⚠️ STAC未找到匹配的安全场景，将回退到LLM分析');
        // 如果STAC没有匹配结果，回退到LLM
        throw new Error('STAC未找到匹配的安全场景');
      }
    } catch (error) {
      console.error('❌ STAC分析失败:', error);
      throw new Error(`STAC分析失败: ${error.message}`);
    }
  }

  // 使用LLM进行分析（原有逻辑）
  async analyzeWithLLM(content, prompt) {
    // 构建分析请求
    const analysisPrompt = this.buildAnalysisPrompt(content, prompt);

    // 调用LLM进行分析
    const llmResult = await this.callLLM(analysisPrompt, content);

    // 解析安全场景
    const securityScenarios = this.parseSecurityScenarios(llmResult);

    return {
      originalContent: content,
      analysis: llmResult,
      securityScenarios,
      threats: this.extractThreats(llmResult),
      assets: this.extractAssets(content),
      recommendations: this.extractRecommendations(llmResult),
      analysisMethod: 'LLM',
      timestamp: new Date().toISOString(),
    };
  }

  // 缓存相关方法
  generateCacheKey(content, prompt) {
    const hash = this.simpleHash(content + (prompt || ''));
    return `analysis_${hash}`;
  }

  getCachedAnalysis(cacheKey) {
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryTime) {
      return cached.result;
    }
    return null;
  }

  cacheAnalysis(cacheKey, result) {
    // 清理过期缓存
    if (this.analysisCache.size >= this.cacheMaxSize) {
      const oldestKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(oldestKey);
    }

    this.analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  buildAnalysisPrompt(content, customPrompt) {
    const defaultPrompt = `
请对以下产品需求内容进行安全分析，识别潜在的安全威胁和风险点，并生成相应的测试场景。

分析要求：
1. 识别关键资产和数据流
2. 分析身份认证和授权需求
3. 评估输入验证和数据处理风险
4. 识别业务逻辑安全风险
5. 提供具体的安全测试场景

请以JSON格式返回结果，包含以下字段：
- summary: 需求概述
- assets: 关键资产列表
- threats: 威胁列表（包含类型、描述、风险等级）
- testScenarios: 测试场景列表
- recommendations: 安全建议

产品需求内容：`;

    return (customPrompt || defaultPrompt) + "\n\n" + JSON.stringify(content);
  }

  async callLLM(prompt, content) {
    if (this.llmConfig.provider !== "custom" && !this.llmConfig.apiKey) {
      throw new Error("请先配置LLM API密钥");
    }

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      // 只有在API密钥存在时才添加Authorization头
      if (this.llmConfig.apiKey) {
        headers.Authorization = `Bearer ${this.llmConfig.apiKey}`;
      }

      const response = await fetch(this.llmConfig.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.llmConfig.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API调用失败: ${response.status}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;
    } catch (error) {
      console.error("LLM调用失败:", error);
      throw error;
    }
  }

  parseSecurityScenarios(llmResult) {
    try {
      return JSON.parse(llmResult);
    } catch (error) {
      // 如果不是JSON格式，进行文本解析
      return {
        summary: "需求分析",
        analysis: llmResult,
        threats: this.extractThreats(llmResult),
        testScenarios: this.extractTestScenarios(llmResult),
      };
    }
  }

  extractThreats(text) {
    const threats = [];
    const lines = text.split("\n");

    lines.forEach((line) => {
      if (
        line.includes("威胁") ||
        line.includes("风险") ||
        line.includes("threat")
      ) {
        threats.push({
          description: line.trim(),
          level: this.utils?.assessThreatLevel ? this.utils.assessThreatLevel(line) : 'medium',
        });
      }
    });

    return threats;
  }

  extractTestScenarios(text) {
    const scenarios = [];
    const lines = text.split("\n");

    lines.forEach((line) => {
      if (
        line.includes("测试") ||
        line.includes("验证") ||
        line.includes("test")
      ) {
        scenarios.push({
          description: line.trim(),
          type: "security_test",
        });
      }
    });

    return scenarios;
  }

  async parseFile(attachment) {
    try {
      // 处理本地文件（ArrayBuffer格式）
      if (attachment.arrayBuffer && attachment.arrayBuffer.length > 0) {
        console.log('解析本地文件:', attachment.name);
        
        const arrayBuffer = new Uint8Array(attachment.arrayBuffer).buffer;
        
        if (this.documentParser) {
          try {
            let parsedContent;
            
            if (attachment.type === 'application/pdf') {
              parsedContent = await this.documentParser.parsePDF(arrayBuffer);
            } else if (
              attachment.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              attachment.type === 'application/msword'
            ) {
              parsedContent = await this.documentParser.parseDOCX(arrayBuffer);
            } else {
              throw new Error(`不支持的文件类型: ${attachment.type}`);
            }
            
            if (parsedContent && parsedContent.success && parsedContent.text) {
              return parsedContent.text;
            } else {
              throw new Error(parsedContent.error || '文档解析返回空内容');
            }
          } catch (error) {
            console.warn('高级文档解析失败，尝试基础解析:', error);
            // 回退到基础文本提取
            try {
              const textContent = await this.basicTextExtraction(arrayBuffer, attachment.type);
              return textContent || `文件已读取: ${attachment.name} (${attachment.type})`;
            } catch (basicError) {
              throw new Error(`文档解析失败: ${error.message}`);
            }
          }
        } else {
          // 文档解析器未初始化，使用基础方法
          try {
            const textContent = await this.basicTextExtraction(arrayBuffer, attachment.type);
            return textContent || `文件已读取: ${attachment.name} (${attachment.type})`;
          } catch (basicError) {
            return `文件信息: ${attachment.name} (${attachment.type}, ${this.formatFileSize(attachment.size)})`;
          }
        }
      }

      // 处理URL文件（保持原有逻辑）
      if (this.documentParser && attachment.url) {
        console.log('使用文档解析器解析文件:', attachment.name);
        
        const parsedContent = await this.documentParser.parseDocumentFromURL(attachment.url);
        return parsedContent.text || parsedContent.content || '解析成功但内容为空';
      }

      // 回退到基础解析
      console.log('使用基础解析器解析文件:', attachment.name);
      
      if (attachment.url) {
        const response = await fetch(attachment.url);
        if (response.ok) {
          const text = await response.text();
          return text.length > 0 ? text : `文件已下载: ${attachment.name}`;
        } else {
          throw new Error(`无法访问文件URL: ${response.status}`);
        }
      }

      return `文件信息: ${attachment.name} (${attachment.type || '未知类型'})`;
    } catch (error) {
      console.warn('文件解析失败，返回基础信息:', error);
      return `文件解析失败: ${attachment.name} - ${error.message}`;
    }
  }

  // 基础文本提取方法（用于回退）
  async basicTextExtraction(arrayBuffer, fileType) {
    if (fileType === 'application/pdf') {
      // 尝试基础PDF文本提取
      try {
        // 这里可以添加简单的PDF文本提取逻辑
        return '基础PDF文本提取功能暂未实现，请使用完整版解析器';
      } catch (error) {
        throw new Error('PDF基础提取失败');
      }
    }
    
    // 对于其他文件类型，返回基础信息
    throw new Error('基础文本提取不支持此文件类型');
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (!bytes) return '未知大小';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async sendToThreatModelingPlatform(scenarios) {
    if (!this.threatModelingPlatform.baseUrl) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.threatModelingPlatform.baseUrl}/api/scenarios`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.threatModelingPlatform.apiKey}`,
          },
          body: JSON.stringify(scenarios),
        },
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("发送到威胁建模平台失败:", error);
    }

    return null;
  }

  async updateConfig(data) {
    await chrome.storage.sync.set(data);
    await this.loadConfig();
  }

  async testLLMConnection(llmConfig) {
    try {
      const testPrompt = "请回复'连接测试成功'来确认API连接正常。";

      const response = await fetch(llmConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: "user",
              content: testPrompt,
            },
          ],
          max_tokens: 50,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API调用失败 (${response.status}): ${errorText}`,
        };
      }

      const result = await response.json();

      if (result.choices && result.choices[0] && result.choices[0].message) {
        return {
          success: true,
          message: "连接测试成功",
          response: result.choices[0].message.content,
        };
      } else {
        return {
          success: false,
          error: "响应格式不正确: " + JSON.stringify(result),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `连接测试失败: ${error.message}`,
      };
    }
  }

  // 提取资产信息
  extractAssets(content) {
    const assets = [];
    const keywords = ['数据库', '用户信息', '密码', 'API', '接口', '文件', '服务器', '系统'];
    
    keywords.forEach(keyword => {
      if (content.includes(keyword)) {
        assets.push(keyword);
      }
    });
    
    return assets.length > 0 ? assets : ['未识别特定资产'];
  }

  // 确定风险等级
  determineRiskLevel(confidence) {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  }

  // 格式化STAC分析结果
  formatSTACAnalysis(stacMatches, threatInfo, securityRequirements, testCases) {
    const totalScenarios = stacMatches.length;
    const avgConfidence = Math.round((stacMatches.reduce((sum, m) => sum + m.confidence, 0) / totalScenarios) * 100);
    
    let analysis = `🔍 **STAC知识库分析结果**\n\n`;
    analysis += `📊 **匹配统计:**\n`;
    analysis += `- 匹配场景: ${totalScenarios} 个\n`;
    analysis += `- 平均置信度: ${avgConfidence}%\n`;
    analysis += `- 识别威胁: ${threatInfo.threats.length} 个\n`;
    analysis += `- 安全需求: ${securityRequirements.length} 个\n`;
    analysis += `- 测试用例: ${testCases.length} 个\n\n`;
    
    analysis += `🎯 **匹配的安全场景:**\n`;
    stacMatches.forEach((match, index) => {
      analysis += `${index + 1}. **${match.scenario}** (置信度: ${Math.round(match.confidence * 100)}%)\n`;
      analysis += `   - 关键词匹配: ${match.keywordMatches} 个\n`;
      analysis += `   - 匹配关键词: ${match.matchedKeywords.slice(0, 3).join(', ')}\n`;
      if (match.matchedThreats && match.matchedThreats.length > 0) {
        analysis += `   - 相关威胁: ${match.matchedThreats.length} 个\n`;
      }
      analysis += `\n`;
    });
    
    if (threatInfo.threats.length > 0) {
      analysis += `⚠️ **主要安全威胁:**\n`;
      threatInfo.threats.slice(0, 5).forEach((threat, index) => {
        analysis += `${index + 1}. **${threat.name}** (${threat.riskLevel})\n`;
        if (threat.details) {
          analysis += `   ${threat.details.substring(0, 100)}...\n`;
        }
        analysis += `\n`;
      });
    }
    
    return analysis;
  }

  // 生成STAC推荐
  generateSTACRecommendations(stacMatches, securityRequirements, testCases) {
    const recommendations = [];
    
    // 高优先级安全需求推荐
    const highPriorityReqs = securityRequirements.filter(req => req.priority > 0.6);
    if (highPriorityReqs.length > 0) {
      recommendations.push(`🔒 优先实施 ${highPriorityReqs.length} 个高优先级安全需求`);
      highPriorityReqs.slice(0, 3).forEach(req => {
        recommendations.push(`   - ${req.name}: ${req.details.substring(0, 80)}...`);
      });
    }
    
    // 关键测试用例推荐
    const criticalTests = testCases.filter(test => test.priority > 0.5);
    if (criticalTests.length > 0) {
      recommendations.push(`🧪 执行 ${criticalTests.length} 个关键安全测试用例`);
      criticalTests.slice(0, 3).forEach(test => {
        recommendations.push(`   - ${test.name}: ${test.details.substring(0, 80)}...`);
      });
    }
    
    // 场景覆盖推荐
    if (stacMatches.length < 3) {
      recommendations.push(`📈 建议扩大安全分析覆盖范围，当前仅匹配到 ${stacMatches.length} 个场景`);
    }
    
    // 置信度推荐
    const lowConfidenceMatches = stacMatches.filter(m => m.confidence < 0.3);
    if (lowConfidenceMatches.length > 0) {
      recommendations.push(`⚡ ${lowConfidenceMatches.length} 个场景置信度较低，建议补充更详细的安全相关信息`);
    }
    
    return recommendations;
  }

  // 原有的生成推荐方法（用于LLM分析）
  generateRecommendations(stacMatches) {
    const recommendations = [];
    
    stacMatches.forEach(match => {
      if (match.recommendations) {
        recommendations.push(...match.recommendations);
      } else {
        recommendations.push(`针对${match.category}威胁，建议进行相应的安全加固`);
      }
    });
    
    return recommendations.length > 0 ? recommendations : ['建议进行全面的安全评估'];
  }

  // 提取推荐信息
  extractRecommendations(text) {
    const recommendations = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.includes('建议') || line.includes('推荐') || line.includes('recommendation')) {
        recommendations.push(line.trim());
      }
    });
    
    return recommendations.length > 0 ? recommendations : ['建议进行安全评估'];
  }
}

// 创建服务实例
const securityAnalysisService = new SecurityAnalysisService();
