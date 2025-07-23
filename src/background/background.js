// background.js - 后台服务脚本
// 使用动态导入来避免模块加载问题

class SecurityAnalysisService {
  constructor() {
    this.llmConfig = {
      provider: "custom",
      endpoint: "http://localhost:1234/v1/chat/completions",
      apiKey: "",
      model: "deepseek/deepseek-r1-0528-qwen3-8b",
    };

    this.threatModelingPlatform = {
      baseUrl: "", // 威胁建模平台地址
      apiKey: "", // 平台API密钥
    };

    // 延迟初始化这些组件
    this.documentParser = null;
    this.stacService = null;
    this.inputValidator = null;

    // Initialize result cache for performance optimization
    this.stacResultCache = new Map();
    this.cacheMaxSize = 100;
    this.cacheExpiryTime = 30 * 60 * 1000; // 30 minutes

    // Performance optimization: Initialize cleanup for background service
    this.cleanupInterval = setInterval(
      () => {
        this._performBackgroundCleanup();
      },
      15 * 60 * 1000,
    ); // Every 15 minutes

    this.init();
  }

  init() {
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持异步响应通道开放
    });

    // 加载配置
    this.loadConfig();
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

  /**
   * 延迟初始化组件以避免模块加载问题
   */
  async initializeComponents() {
    if (!this.documentParser) {
      try {
        // 动态导入DocumentParser
        const DocumentParserModule = await import("./document-parser.js");
        this.documentParser = new DocumentParserModule.default();
      } catch (error) {
        console.warn("Failed to load DocumentParser:", error);
        this.documentParser = null;
      }
    }

    if (!this.stacService) {
      try {
        // 动态导入STACService
        const STACServiceModule = await import("./stac-service.js");
        this.stacService = new STACServiceModule.default();
      } catch (error) {
        console.warn("Failed to load STACService:", error);
        this.stacService = null;
      }
    }

    if (!this.inputValidator) {
      try {
        // 动态导入InputValidator
        const InputValidatorModule = await import(
          "../shared/input-validator.js"
        );
        this.inputValidator = new InputValidatorModule.default();
      } catch (error) {
        console.warn("Failed to load InputValidator:", error);
        // 创建一个简单的验证器作为后备
        this.inputValidator = {
          validateObject: (data, options) => ({
            isValid: true,
            sanitized: data,
            errors: [],
            warnings: ["Using fallback validator"],
          }),
          validateText: (text, options) => ({
            isValid: true,
            sanitized: text,
            errors: [],
            warnings: [],
          }),
          validateAttachment: (attachment) => ({
            isValid: true,
            sanitized: attachment,
            errors: [],
            warnings: [],
          }),
          validateArray: (array, options) => ({
            isValid: true,
            sanitized: array,
            errors: [],
            warnings: [],
          }),
        };
      }
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      // Handle diagnostic ping without validation for debugging
      if (request.action === "diagnostic-ping") {
        sendResponse({
          success: true,
          message: "Background service is active",
          timestamp: new Date().toISOString(),
          receivedTimestamp: request.timestamp,
        });
        return;
      }

      // 确保组件已初始化
      await this.initializeComponents();

      // Security: Validate incoming message structure
      const messageValidation = this._validateIncomingMessage(request);
      if (!messageValidation.isValid) {
        console.error("Invalid message received:", messageValidation.errors);
        sendResponse({
          success: false,
          error: `Invalid message: ${messageValidation.errors.join(", ")}`,
          errorType: "validation",
        });
        return;
      }

      // Use sanitized request data
      const sanitizedRequest = messageValidation.sanitized;

      switch (sanitizedRequest.action) {
        case "analyzeContent":
          const analysisResult = await this.analyzeContent(
            sanitizedRequest.data,
          );
          sendResponse({ success: true, data: analysisResult });
          break;

        case "parseFile":
          const fileContent = await this.parseFile(sanitizedRequest.data);
          sendResponse({ success: true, content: fileContent });
          break;

        case "parseAndAnalyzeDocument":
          // New integrated document parsing and analysis workflow
          const documentAnalysisResult = await this.parseAndAnalyzeDocument(
            sanitizedRequest.data.attachment,
            sanitizedRequest.data.options || {},
          );
          sendResponse({ success: true, data: documentAnalysisResult });
          break;

        case "performSTACMatching":
          // Standalone STAC matching for content
          const stacMatchingResult = await this.performSTACMatching(
            sanitizedRequest.data.content,
            sanitizedRequest.data.options || {},
          );
          sendResponse({ success: true, data: stacMatchingResult });
          break;

        case "generateAIFallback":
          // Generate AI fallback for STAC gaps
          const aiFallbackResult = await this.generateAIFallback(
            sanitizedRequest.data.gaps,
            sanitizedRequest.data.content,
            sanitizedRequest.data.options || {},
          );
          sendResponse({ success: true, data: aiFallbackResult });
          break;

        case "updateConfig":
          await this.updateConfig(sanitizedRequest.data);
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

  async analyzeContent(data) {
    const { content, prompt, source } = data;

    // 构建分析请求
    const analysisPrompt = this.buildAnalysisPrompt(content, prompt);

    // 调用LLM进行分析
    const llmResult = await this.callLLM(analysisPrompt, content);

    // 解析安全场景
    const securityScenarios = this.parseSecurityScenarios(llmResult);

    // 可选：发送到威胁建模平台
    if (this.threatModelingPlatform.baseUrl) {
      await this.sendToThreatModelingPlatform(securityScenarios);
    }

    return {
      originalContent: content,
      analysis: llmResult,
      securityScenarios,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Parse and analyze document with integrated workflow
   * Requirement 1.1, 1.3: Document parsing with progress tracking and timeout handling
   * @param {Object} attachment - Attachment object with url, type, name, etc.
   * @param {Object} options - Optional parsing and analysis options
   * @returns {Promise<Object>} - Complete analysis result with parsed content
   */
  async parseAndAnalyzeDocument(attachment, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || 60000; // 60 second default timeout for full analysis

    // Initialize progress tracking
    const progressCallback = options.onProgress || (() => {});

    try {
      // 确保组件已初始化
      await this.initializeComponents();
      progressCallback({
        stage: "parsing",
        progress: 0,
        message: "Starting document parsing...",
      });

      // Step 1: Parse the document using DocumentParser
      const parseOptions = {
        fallbackContent: options.webpageContent,
        enableWebpageFallback: options.enableWebpageFallback !== false,
        timeout: Math.min(timeout * 0.4, 20000), // Allocate 40% of timeout to parsing
      };

      const parsedContent = this.documentParser
        ? await this.documentParser.parseDocument(attachment, parseOptions)
        : {
            success: false,
            error: "Document parser not available",
            text: attachment.name || "Unknown document",
          };

      if (!parsedContent.success && !parsedContent.text) {
        throw new Error(
          parsedContent.error || "Document parsing failed completely",
        );
      }

      progressCallback({
        stage: "parsing",
        progress: 25,
        message: `Document parsed successfully. Extracted ${parsedContent.metadata.wordCount} words.`,
      });

      // Step 2: Prepare content for analysis
      const analysisContent = this.prepareContentForAnalysis(parsedContent);

      progressCallback({
        stage: "stac_matching",
        progress: 30,
        message: "Starting STAC knowledge base matching...",
      });

      // Step 3: Perform STAC matching
      const stacResults = await this.performSTACMatching(analysisContent, {
        timeout: Math.min(timeout * 0.3, 15000), // Allocate 30% of timeout to STAC matching
      });

      progressCallback({
        stage: "stac_matching",
        progress: 50,
        message: `STAC matching completed. Found ${stacResults.matchedScenarios.length} scenario matches.`,
      });

      // Step 4: Check if AI fallback is needed for gaps
      let aiResults = null;
      if (
        stacResults.gaps &&
        stacResults.gaps.length > 0 &&
        stacResults.coverage.percentage < 70
      ) {
        progressCallback({
          stage: "ai_fallback",
          progress: 60,
          message: "Generating AI fallback for unmatched scenarios...",
        });

        try {
          aiResults = await this.generateAIFallback(
            stacResults.gaps,
            analysisContent,
            {
              timeout: Math.min(timeout * 0.2, 10000), // Allocate 20% of timeout to AI fallback
            },
          );

          progressCallback({
            stage: "ai_fallback",
            progress: 70,
            message: `AI fallback completed. Generated ${aiResults.scenarios.length} additional scenarios.`,
          });
        } catch (error) {
          console.warn("AI fallback failed:", error);
          progressCallback({
            stage: "ai_fallback",
            progress: 70,
            message: "AI fallback failed, continuing with STAC results only.",
          });
        }
      }

      // Step 5: Perform traditional LLM analysis (for comparison)
      progressCallback({
        stage: "llm_analysis",
        progress: 75,
        message: "Starting LLM analysis...",
      });

      const analysisPrompt = this.buildAnalysisPrompt(
        analysisContent,
        options.customPrompt,
      );
      const llmResult = await this.callLLM(analysisPrompt, analysisContent);
      const securityScenarios = this.parseSecurityScenarios(llmResult);

      progressCallback({
        stage: "llm_analysis",
        progress: 85,
        message: "LLM analysis completed.",
      });

      // Step 6: Combine all results with AI fallback integration
      const combinedAnalysis = aiResults
        ? this.combineSTACAndAIResults(stacResults, aiResults)
        : { stac: stacResults, ai: null };

      const combinedResult = {
        source: {
          type: "document",
          attachment: {
            url: attachment?.url || "",
            name: attachment?.name || "Unknown Document",
            type: attachment?.type || "Unknown",
          },
          parsedContent: {
            success: parsedContent.success,
            wordCount: parsedContent.metadata.wordCount,
            pages: parsedContent.metadata.pages,
            processingTime: parsedContent.processingTime,
            fallbackUsed: parsedContent.fallbackUsed,
          },
        },
        content: {
          original: parsedContent.text,
          structured: {
            sections: parsedContent.structure.sections,
            tables: parsedContent.structure.tables,
            images: parsedContent.structure.images,
          },
          metadata: parsedContent.metadata,
        },
        analysis: {
          combined: combinedAnalysis,
          stac: stacResults,
          ai: aiResults,
          llm: {
            result: llmResult,
            scenarios: securityScenarios,
          },
        },
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // Add warnings if fallback was used
      if (parsedContent.fallbackUsed) {
        combinedResult.warnings = [
          `Document parsing used fallback mechanism: ${parsedContent.fallbackUsed}`,
        ];
      }

      if (parsedContent.warning) {
        combinedResult.warnings = combinedResult.warnings || [];
        combinedResult.warnings.push(parsedContent.warning);
      }

      // Add STAC-specific warnings
      if (stacResults.coverage.percentage < 50) {
        combinedResult.warnings = combinedResult.warnings || [];
        combinedResult.warnings.push(
          `Low STAC coverage (${stacResults.coverage.percentage}%). Consider AI fallback for unmatched scenarios.`,
        );
      }

      progressCallback({
        stage: "complete",
        progress: 100,
        message: "Analysis completed successfully.",
      });

      // Optional: Send to threat modeling platform
      if (this.threatModelingPlatform.baseUrl) {
        try {
          await this.sendToThreatModelingPlatform(securityScenarios);
        } catch (error) {
          console.warn("Failed to send to threat modeling platform:", error);
        }
      }

      return combinedResult;
    } catch (error) {
      console.error("Document parsing and analysis failed:", error);

      progressCallback({
        stage: "error",
        progress: 0,
        message: `Analysis failed: ${error.message}`,
      });

      // Return error result with any partial data
      return {
        source: {
          type: "document",
          attachment: {
            url: attachment?.url || "",
            name: attachment?.name || "Unknown Document",
            type: attachment?.type || "Unknown",
          },
        },
        content: null,
        analysis: null,
        error: error.message,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Prepare parsed content for security analysis
   * @param {Object} parsedContent - Parsed document content
   * @returns {string} - Formatted content for analysis
   */
  prepareContentForAnalysis(parsedContent) {
    let analysisContent = parsedContent.text;

    // Add structured information if available
    if (parsedContent.structure.sections.length > 0) {
      analysisContent += "\n\n=== Document Structure ===\n";
      parsedContent.structure.sections.forEach((section, index) => {
        if (section.title && section.title !== `Page ${index + 1}`) {
          analysisContent += `\n${section.title}\n`;
        }
      });
    }

    // Add table information if available
    if (parsedContent.structure.tables.length > 0) {
      analysisContent += "\n\n=== Tables Found ===\n";
      analysisContent += `Document contains ${parsedContent.structure.tables.length} table(s) with structured data.\n`;
    }

    // Add metadata context
    if (parsedContent.metadata.title) {
      analysisContent = `Document Title: ${parsedContent.metadata.title}\n\n${analysisContent}`;
    }

    return analysisContent;
  }

  /**
   * Perform STAC matching integration with caching and performance optimization
   * Requirements 3.1, 3.2, 3.3: STAC scenario matching, coverage calculation, result caching
   * @param {string} content - Content to match against STAC knowledge base
   * @param {Object} options - Optional matching options
   * @returns {Promise<Object>} - STAC matching results with coverage analysis
   */
  async performSTACMatching(content, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || 15000; // 15 second default timeout

    try {
      // Generate cache key based on content hash
      const cacheKey = this.generateContentHash(content);

      // Check cache first for performance optimization
      const cachedResult = this.getFromSTACCache(cacheKey);
      if (cachedResult) {
        // Result retrieved from cache
        return cachedResult;
      }

      // Ensure STAC service is initialized
      await this.stacService.loadKnowledgeBase();

      // Perform scenario matching with timeout
      const matchingPromise = this.stacService.matchScenarios(content);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("STAC matching timeout")), timeout),
      );

      const matchedScenarios = await Promise.race([
        matchingPromise,
        timeoutPromise,
      ]);

      // Calculate coverage statistics
      const coverage = this.calculateSTACCoverage(matchedScenarios, content);

      // Retrieve security requirements and test cases for matched scenarios
      const securityRequirements =
        await this.stacService.getSecurityRequirements(
          matchedScenarios.map((match) => match.scenario),
        );

      const testCases = await this.stacService.getTestCases(
        matchedScenarios.map((match) => match.scenario),
      );

      // Identify gaps for potential AI fallback
      const gaps = this.identifySTACGaps(matchedScenarios, content);

      // Construct comprehensive STAC result
      const stacResult = {
        matchedScenarios: matchedScenarios.map((match) => ({
          ...match,
          source: "STAC",
        })),
        coverage: coverage,
        securityRequirements: securityRequirements.map((req) => ({
          ...req,
          source: "STAC",
        })),
        testCases: testCases.map((testCase) => ({
          ...testCase,
          source: "STAC",
        })),
        gaps: gaps,
        processingTime: Date.now() - startTime,
        cacheKey: cacheKey,
      };

      // Cache the result for future use
      this.addToSTACCache(cacheKey, stacResult);

      return stacResult;
    } catch (error) {
      console.error("STAC matching failed:", error);

      // Return empty result structure on failure
      return {
        matchedScenarios: [],
        coverage: {
          total: 0,
          matched: 0,
          percentage: 0,
        },
        securityRequirements: [],
        testCases: [],
        gaps: [
          {
            area: "STAC Matching",
            reason: `STAC matching failed: ${error.message}`,
            suggestion: "Use AI fallback for security analysis",
          },
        ],
        processingTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Calculate STAC coverage statistics
   * @param {Array} matchedScenarios - Array of matched STAC scenarios
   * @param {string} content - Original content being analyzed
   * @returns {Object} - Coverage statistics
   */
  calculateSTACCoverage(matchedScenarios, content) {
    // Simple coverage calculation based on matched scenarios
    // In a real implementation, this could be more sophisticated
    const totalPossibleScenarios = Math.max(
      10,
      Math.floor(content.length / 500),
    ); // Estimate based on content length
    const matchedCount = matchedScenarios.length;

    return {
      total: totalPossibleScenarios,
      matched: matchedCount,
      percentage: Math.round((matchedCount / totalPossibleScenarios) * 100),
      confidence:
        matchedScenarios.length > 0
          ? matchedScenarios.reduce((sum, match) => sum + match.confidence, 0) /
            matchedScenarios.length
          : 0,
    };
  }

  /**
   * Identify gaps in STAC coverage for AI fallback
   * @param {Array} matchedScenarios - Array of matched STAC scenarios
   * @param {string} content - Original content being analyzed
   * @returns {Array} - Array of identified gaps
   */
  identifySTACGaps(matchedScenarios, content) {
    const gaps = [];

    // Identify common security areas that might not be covered
    const commonSecurityAreas = [
      "authentication",
      "authorization",
      "input validation",
      "data encryption",
      "session management",
      "error handling",
      "logging",
      "access control",
    ];

    const contentLower = content.toLowerCase();
    const matchedAreas = matchedScenarios.map((match) =>
      match.scenario.toLowerCase(),
    );

    commonSecurityAreas.forEach((area) => {
      const areaInContent =
        contentLower.includes(area) ||
        contentLower.includes(area.replace(" ", ""));
      const areaMatched = matchedAreas.some((matched) =>
        matched.includes(area),
      );

      if (areaInContent && !areaMatched) {
        gaps.push({
          area: area,
          reason: `Content mentions ${area} but no STAC scenarios matched`,
          suggestion: `Consider AI analysis for ${area} security requirements`,
        });
      }
    });

    // If very few scenarios matched, suggest comprehensive AI analysis
    if (matchedScenarios.length < 3) {
      gaps.push({
        area: "General Security Analysis",
        reason: "Limited STAC scenario matches found",
        suggestion: "Recommend comprehensive AI-based security analysis",
      });
    }

    return gaps;
  }

  /**
   * Generate a simple hash for content caching
   * @param {string} content - Content to hash
   * @returns {string} - Simple hash string
   */
  generateContentHash(content) {
    // Simple hash function for caching (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get result from STAC cache
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} - Cached result or null
   */
  getFromSTACCache(cacheKey) {
    const cached = this.stacResultCache.get(cacheKey);
    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.cacheExpiryTime) {
      this.stacResultCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Add result to STAC cache with size management
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Result to cache
   */
  addToSTACCache(cacheKey, result) {
    // Manage cache size
    if (this.stacResultCache.size >= this.cacheMaxSize) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.stacResultCache.keys().next().value;
      this.stacResultCache.delete(firstKey);
    }

    this.stacResultCache.set(cacheKey, {
      result: result,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate AI fallback for STAC gaps
   * Requirements 4.1, 4.2, 4.3: AI fallback for unmatched scenarios with confidence indicators
   * @param {Array} gaps - Array of identified gaps from STAC matching
   * @param {string} content - Original content being analyzed
   * @param {Object} options - Optional fallback options
   * @returns {Promise<Object>} - AI fallback results with confidence indicators
   */
  async generateAIFallback(gaps, content, options = {}) {
    const startTime = Date.now();

    try {
      if (!gaps || gaps.length === 0) {
        return {
          scenarios: [],
          requirements: [],
          testCases: [],
          confidence: 0,
          processingTime: Date.now() - startTime,
          source: "AI_FALLBACK",
        };
      }

      // Create specialized prompts for unmatched security scenarios
      const fallbackResults = [];

      for (const gap of gaps) {
        const specializedPrompt = this.buildSpecializedPrompt(gap, content);

        try {
          const aiResult = await this.callLLM(specializedPrompt, content);
          const parsedResult = this.parseAIFallbackResult(aiResult, gap);

          // Add confidence indicators for AI-generated content
          parsedResult.confidence = this.calculateAIConfidence(
            parsedResult,
            gap,
            content,
          );
          parsedResult.source = "AI_FALLBACK";
          parsedResult.gap = gap;

          fallbackResults.push(parsedResult);
        } catch (error) {
          console.warn(`AI fallback failed for gap ${gap.area}:`, error);
          // Continue with other gaps even if one fails
        }
      }

      // Combine and structure the AI fallback results
      const combinedFallback = this.combineAIFallbackResults(fallbackResults);
      combinedFallback.processingTime = Date.now() - startTime;

      return combinedFallback;
    } catch (error) {
      console.error("AI fallback generation failed:", error);
      return {
        scenarios: [],
        requirements: [],
        testCases: [],
        confidence: 0,
        error: error.message,
        processingTime: Date.now() - startTime,
        source: "AI_FALLBACK",
      };
    }
  }

  /**
   * Build specialized prompts for unmatched security scenarios
   * @param {Object} gap - Gap information from STAC analysis
   * @param {string} content - Original content
   * @returns {string} - Specialized prompt for the gap
   */
  buildSpecializedPrompt(gap, content) {
    const basePrompt = `作为安全专家，请针对以下特定安全领域进行深入分析：

安全领域: ${gap.area}
分析原因: ${gap.reason}
建议方向: ${gap.suggestion}

请专门针对"${gap.area}"领域，分析以下产品需求文档中的安全风险和威胁场景。

分析要求：
1. 重点关注${gap.area}相关的安全风险
2. 识别该领域的具体威胁场景
3. 提出针对性的安全需求
4. 设计相应的安全测试用例
5. 评估风险等级和优先级

请以JSON格式返回分析结果，包含以下字段：
- area: "${gap.area}"
- threats: 威胁列表（每个威胁包含名称、描述、风险等级、影响范围）
- requirements: 安全需求列表（每个需求包含名称、详细描述、优先级）
- testCases: 测试用例列表（每个用例包含名称、测试步骤、预期结果）
- recommendations: 针对性安全建议
- confidence: 分析置信度（0-1之间的数值）

产品需求内容：`;

    return basePrompt + "\n\n" + content;
  }

  /**
   * Parse AI fallback result from LLM response
   * @param {string} aiResult - Raw AI response
   * @param {Object} gap - Gap information
   * @returns {Object} - Parsed AI fallback result
   */
  parseAIFallbackResult(aiResult, gap) {
    try {
      const parsed = JSON.parse(aiResult);

      // Validate and normalize the structure
      return {
        area: parsed.area || gap.area,
        threats: Array.isArray(parsed.threats)
          ? parsed.threats.map((threat) => ({
              name: threat.name || "",
              description: threat.description || threat.desc || "",
              riskLevel: threat.riskLevel || threat.risk || "medium",
              impact: threat.impact || threat.影响范围 || "",
              source: "AI_FALLBACK",
            }))
          : [],
        requirements: Array.isArray(parsed.requirements)
          ? parsed.requirements.map((req) => ({
              name: req.name || "",
              details: req.details || req.description || req.详细描述 || "",
              priority: req.priority || req.优先级 || "medium",
              source: "AI_FALLBACK",
            }))
          : [],
        testCases: Array.isArray(parsed.testCases)
          ? parsed.testCases.map((test) => ({
              name: test.name || "",
              steps: test.steps || test.测试步骤 || test.details || "",
              expected: test.expected || test.预期结果 || "",
              category: gap.area,
              source: "AI_FALLBACK",
            }))
          : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : [],
        rawConfidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.warn(
        "Failed to parse AI fallback result as JSON, using text parsing:",
        error,
      );

      // Fallback to text parsing
      return this.parseAIFallbackText(aiResult, gap);
    }
  }

  /**
   * Parse AI fallback result from text when JSON parsing fails
   * @param {string} text - Raw text response
   * @param {Object} gap - Gap information
   * @returns {Object} - Parsed result
   */
  parseAIFallbackText(text, gap) {
    const result = {
      area: gap.area,
      threats: [],
      requirements: [],
      testCases: [],
      recommendations: [],
      rawConfidence: 0.3, // Lower confidence for text parsing
    };

    const lines = text.split("\n");
    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect sections
      if (trimmed.includes("威胁") || trimmed.includes("threat")) {
        currentSection = "threats";
      } else if (trimmed.includes("需求") || trimmed.includes("requirement")) {
        currentSection = "requirements";
      } else if (trimmed.includes("测试") || trimmed.includes("test")) {
        currentSection = "testCases";
      } else if (
        trimmed.includes("建议") ||
        trimmed.includes("recommendation")
      ) {
        currentSection = "recommendations";
      }

      // Extract content based on current section
      if (
        currentSection &&
        (trimmed.startsWith("-") ||
          trimmed.startsWith("•") ||
          /^\d+\./.test(trimmed))
      ) {
        const content = trimmed.replace(/^[-•\d.]\s*/, "");

        switch (currentSection) {
          case "threats":
            result.threats.push({
              name: content.substring(0, 50) + "...",
              description: content,
              riskLevel: this.assessThreatLevel(content),
              impact: gap.area,
              source: "AI_FALLBACK",
            });
            break;
          case "requirements":
            result.requirements.push({
              name: content.substring(0, 50) + "...",
              details: content,
              priority: "medium",
              source: "AI_FALLBACK",
            });
            break;
          case "testCases":
            result.testCases.push({
              name: content.substring(0, 50) + "...",
              steps: content,
              expected: "验证安全控制措施有效性",
              category: gap.area,
              source: "AI_FALLBACK",
            });
            break;
          case "recommendations":
            result.recommendations.push(content);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Calculate confidence indicators for AI-generated content
   * @param {Object} result - Parsed AI result
   * @param {Object} gap - Gap information
   * @param {string} content - Original content
   * @returns {number} - Confidence score (0-1)
   */
  calculateAIConfidence(result, gap, content) {
    let confidence = result.rawConfidence || 0.5;

    // Adjust confidence based on result completeness
    const completenessScore =
      (result.threats.length > 0 ? 0.25 : 0) +
      (result.requirements.length > 0 ? 0.25 : 0) +
      (result.testCases.length > 0 ? 0.25 : 0) +
      (result.recommendations.length > 0 ? 0.25 : 0);

    // Adjust confidence based on content relevance
    const contentLower = content.toLowerCase();
    const areaLower = gap.area.toLowerCase();
    const relevanceScore =
      contentLower.includes(areaLower) ||
      contentLower.includes(areaLower.replace(" ", ""))
        ? 0.2
        : 0;

    // Combine scores
    confidence = Math.min(confidence + completenessScore + relevanceScore, 1.0);

    // AI fallback typically has lower confidence than STAC matches
    return Math.max(confidence * 0.8, 0.1);
  }

  /**
   * Combine multiple AI fallback results into a structured response
   * @param {Array} fallbackResults - Array of AI fallback results
   * @returns {Object} - Combined AI fallback response
   */
  combineAIFallbackResults(fallbackResults) {
    const combined = {
      scenarios: [],
      requirements: [],
      testCases: [],
      threats: [],
      recommendations: [],
      confidence: 0,
      source: "AI_FALLBACK",
      coverage: {
        areas: [],
        totalGaps: fallbackResults.length,
        addressedGaps: fallbackResults.filter(
          (r) => r.threats.length > 0 || r.requirements.length > 0,
        ).length,
      },
    };

    let totalConfidence = 0;
    let validResults = 0;

    for (const result of fallbackResults) {
      if (result.confidence > 0) {
        totalConfidence += result.confidence;
        validResults++;
      }

      // Add area coverage
      combined.coverage.areas.push({
        area: result.area,
        confidence: result.confidence,
        threatsCount: result.threats.length,
        requirementsCount: result.requirements.length,
        testCasesCount: result.testCases.length,
      });

      // Combine threats
      combined.threats.push(
        ...result.threats.map((threat) => ({
          ...threat,
          area: result.area,
          confidence: result.confidence,
        })),
      );

      // Combine requirements
      combined.requirements.push(
        ...result.requirements.map((req) => ({
          ...req,
          area: result.area,
          confidence: result.confidence,
        })),
      );

      // Combine test cases
      combined.testCases.push(
        ...result.testCases.map((test) => ({
          ...test,
          area: result.area,
          confidence: result.confidence,
        })),
      );

      // Combine recommendations
      combined.recommendations.push(
        ...result.recommendations.map((rec) => ({
          area: result.area,
          recommendation: rec,
          confidence: result.confidence,
        })),
      );

      // Create scenario entries for each area
      if (result.threats.length > 0 || result.requirements.length > 0) {
        combined.scenarios.push({
          scenario: `AI Generated - ${result.area}`,
          confidence: result.confidence,
          source: "AI_FALLBACK",
          area: result.area,
          threatsCount: result.threats.length,
          requirementsCount: result.requirements.length,
          testCasesCount: result.testCases.length,
        });
      }
    }

    // Calculate overall confidence
    combined.confidence = validResults > 0 ? totalConfidence / validResults : 0;
    combined.coverage.percentage = Math.round(
      (combined.coverage.addressedGaps / combined.coverage.totalGaps) * 100,
    );

    return combined;
  }

  /**
   * Generate AI fallback for STAC gaps
   * Requirements 4.1, 4.2, 4.3: AI fallback for unmatched scenarios with confidence indicators
   * @param {Array} gaps - Array of identified gaps from STAC matching
   * @param {string} content - Original content being analyzed
   * @param {Object} options - Optional fallback options
   * @returns {Promise<Object>} - AI fallback results with confidence indicators
   */
  async generateAIFallback(gaps, content, options = {}) {
    const startTime = Date.now();

    try {
      if (!gaps || gaps.length === 0) {
        return {
          scenarios: [],
          requirements: [],
          testCases: [],
          confidence: 0,
          processingTime: Date.now() - startTime,
          source: "AI_FALLBACK",
        };
      }

      // Create specialized prompts for unmatched security scenarios
      const fallbackResults = [];

      for (const gap of gaps) {
        const specializedPrompt = this.buildSpecializedPrompt(gap, content);

        try {
          const aiResult = await this.callLLM(specializedPrompt, content);
          const parsedResult = this.parseAIFallbackResult(aiResult, gap);

          // Add confidence indicators for AI-generated content
          parsedResult.confidence = this.calculateAIConfidence(
            parsedResult,
            gap,
            content,
          );
          parsedResult.source = "AI_FALLBACK";
          parsedResult.gap = gap;

          fallbackResults.push(parsedResult);
        } catch (error) {
          console.warn(`AI fallback failed for gap ${gap.area}:`, error);
          // Continue with other gaps even if one fails
        }
      }

      // Combine and structure the AI fallback results
      const combinedFallback = this.combineAIFallbackResults(fallbackResults);
      combinedFallback.processingTime = Date.now() - startTime;

      return combinedFallback;
    } catch (error) {
      console.error("AI fallback generation failed:", error);
      return {
        scenarios: [],
        requirements: [],
        testCases: [],
        confidence: 0,
        error: error.message,
        processingTime: Date.now() - startTime,
        source: "AI_FALLBACK",
      };
    }
  }

  /**
   * Build specialized prompts for unmatched security scenarios
   * @param {Object} gap - Gap information from STAC analysis
   * @param {string} content - Original content
   * @returns {string} - Specialized prompt for the gap
   */
  buildSpecializedPrompt(gap, content) {
    const basePrompt = `作为安全专家，请针对以下特定安全领域进行深入分析：

安全领域: ${gap.area}
分析原因: ${gap.reason}
建议方向: ${gap.suggestion}

请专门针对"${gap.area}"领域，分析以下产品需求文档中的安全风险和威胁场景。

分析要求：
1. 重点关注${gap.area}相关的安全风险
2. 识别该领域的具体威胁场景
3. 提出针对性的安全需求
4. 设计相应的安全测试用例
5. 评估风险等级和优先级

请以JSON格式返回分析结果，包含以下字段：
- area: "${gap.area}"
- threats: 威胁列表（每个威胁包含名称、描述、风险等级、影响范围）
- requirements: 安全需求列表（每个需求包含名称、详细描述、优先级）
- testCases: 测试用例列表（每个用例包含名称、测试步骤、预期结果）
- recommendations: 针对性安全建议
- confidence: 分析置信度（0-1之间的数值）

产品需求内容：`;

    return basePrompt + "\n\n" + content;
  }

  /**
   * Parse AI fallback result from LLM response
   * @param {string} aiResult - Raw AI response
   * @param {Object} gap - Gap information
   * @returns {Object} - Parsed AI fallback result
   */
  parseAIFallbackResult(aiResult, gap) {
    try {
      const parsed = JSON.parse(aiResult);

      // Validate and normalize the structure
      return {
        area: parsed.area || gap.area,
        threats: Array.isArray(parsed.threats)
          ? parsed.threats.map((threat) => ({
              name: threat.name || "",
              description: threat.description || threat.desc || "",
              riskLevel: threat.riskLevel || threat.risk || "medium",
              impact: threat.impact || threat.影响范围 || "",
              source: "AI_FALLBACK",
            }))
          : [],
        requirements: Array.isArray(parsed.requirements)
          ? parsed.requirements.map((req) => ({
              name: req.name || "",
              details: req.details || req.description || req.详细描述 || "",
              priority: req.priority || req.优先级 || "medium",
              source: "AI_FALLBACK",
            }))
          : [],
        testCases: Array.isArray(parsed.testCases)
          ? parsed.testCases.map((test) => ({
              name: test.name || "",
              steps: test.steps || test.测试步骤 || test.details || "",
              expected: test.expected || test.预期结果 || "",
              category: gap.area,
              source: "AI_FALLBACK",
            }))
          : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : [],
        rawConfidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.warn(
        "Failed to parse AI fallback result as JSON, using text parsing:",
        error,
      );

      // Fallback to text parsing
      return this.parseAIFallbackText(aiResult, gap);
    }
  }

  /**
   * Parse AI fallback result from text when JSON parsing fails
   * @param {string} text - Raw text response
   * @param {Object} gap - Gap information
   * @returns {Object} - Parsed result
   */
  parseAIFallbackText(text, gap) {
    const result = {
      area: gap.area,
      threats: [],
      requirements: [],
      testCases: [],
      recommendations: [],
      rawConfidence: 0.3, // Lower confidence for text parsing
    };

    const lines = text.split("\n");
    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect sections
      if (trimmed.includes("威胁") || trimmed.includes("threat")) {
        currentSection = "threats";
      } else if (trimmed.includes("需求") || trimmed.includes("requirement")) {
        currentSection = "requirements";
      } else if (trimmed.includes("测试") || trimmed.includes("test")) {
        currentSection = "testCases";
      } else if (
        trimmed.includes("建议") ||
        trimmed.includes("recommendation")
      ) {
        currentSection = "recommendations";
      }

      // Extract content based on current section
      if (
        currentSection &&
        (trimmed.startsWith("-") ||
          trimmed.startsWith("•") ||
          /^\d+\./.test(trimmed))
      ) {
        const content = trimmed.replace(/^[-•\d.]\s*/, "");

        switch (currentSection) {
          case "threats":
            result.threats.push({
              name: content.substring(0, 50) + "...",
              description: content,
              riskLevel: this.assessThreatLevel(content),
              impact: gap.area,
              source: "AI_FALLBACK",
            });
            break;
          case "requirements":
            result.requirements.push({
              name: content.substring(0, 50) + "...",
              details: content,
              priority: "medium",
              source: "AI_FALLBACK",
            });
            break;
          case "testCases":
            result.testCases.push({
              name: content.substring(0, 50) + "...",
              steps: content,
              expected: "验证安全控制措施有效性",
              category: gap.area,
              source: "AI_FALLBACK",
            });
            break;
          case "recommendations":
            result.recommendations.push(content);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Calculate confidence indicators for AI-generated content
   * @param {Object} result - Parsed AI result
   * @param {Object} gap - Gap information
   * @param {string} content - Original content
   * @returns {number} - Confidence score (0-1)
   */
  calculateAIConfidence(result, gap, content) {
    let confidence = result.rawConfidence || 0.5;

    // Adjust confidence based on result completeness
    const completenessScore =
      (result.threats.length > 0 ? 0.25 : 0) +
      (result.requirements.length > 0 ? 0.25 : 0) +
      (result.testCases.length > 0 ? 0.25 : 0) +
      (result.recommendations.length > 0 ? 0.25 : 0);

    // Adjust confidence based on content relevance
    const contentLower = content.toLowerCase();
    const areaLower = gap.area.toLowerCase();
    const relevanceScore =
      contentLower.includes(areaLower) ||
      contentLower.includes(areaLower.replace(" ", ""))
        ? 0.2
        : 0;

    // Combine scores
    confidence = Math.min(confidence + completenessScore + relevanceScore, 1.0);

    // AI fallback typically has lower confidence than STAC matches
    return Math.max(confidence * 0.8, 0.1);
  }

  /**
   * Combine multiple AI fallback results into a structured response
   * @param {Array} fallbackResults - Array of AI fallback results
   * @returns {Object} - Combined AI fallback response
   */
  combineAIFallbackResults(fallbackResults) {
    const combined = {
      scenarios: [],
      requirements: [],
      testCases: [],
      threats: [],
      recommendations: [],
      confidence: 0,
      source: "AI_FALLBACK",
      coverage: {
        areas: [],
        totalGaps: fallbackResults.length,
        addressedGaps: fallbackResults.filter(
          (r) => r.threats.length > 0 || r.requirements.length > 0,
        ).length,
      },
    };

    let totalConfidence = 0;
    let validResults = 0;

    for (const result of fallbackResults) {
      if (result.confidence > 0) {
        totalConfidence += result.confidence;
        validResults++;
      }

      // Add area coverage
      combined.coverage.areas.push({
        area: result.area,
        confidence: result.confidence,
        threatsCount: result.threats.length,
        requirementsCount: result.requirements.length,
        testCasesCount: result.testCases.length,
      });

      // Combine threats
      combined.threats.push(
        ...result.threats.map((threat) => ({
          ...threat,
          area: result.area,
          confidence: result.confidence,
        })),
      );

      // Combine requirements
      combined.requirements.push(
        ...result.requirements.map((req) => ({
          ...req,
          area: result.area,
          confidence: result.confidence,
        })),
      );

      // Combine test cases
      combined.testCases.push(
        ...result.testCases.map((test) => ({
          ...test,
          area: result.area,
          confidence: result.confidence,
        })),
      );

      // Combine recommendations
      combined.recommendations.push(
        ...result.recommendations.map((rec) => ({
          area: result.area,
          recommendation: rec,
          confidence: result.confidence,
        })),
      );

      // Create scenario entries for each area
      if (result.threats.length > 0 || result.requirements.length > 0) {
        combined.scenarios.push({
          scenario: `AI Generated - ${result.area}`,
          confidence: result.confidence,
          source: "AI_FALLBACK",
          area: result.area,
          threatsCount: result.threats.length,
          requirementsCount: result.requirements.length,
          testCasesCount: result.testCases.length,
        });
      }
    }

    // Calculate overall confidence
    combined.confidence = validResults > 0 ? totalConfidence / validResults : 0;
    combined.coverage.percentage = Math.round(
      (combined.coverage.addressedGaps / combined.coverage.totalGaps) * 100,
    );

    return combined;
  }

  /**
   * Implement result combination logic for STAC and AI outputs
   * Requirements 4.1, 4.2, 4.3: Combine STAC and AI results with confidence weighting
   * @param {Object} stacResults - Results from STAC matching
   * @param {Object} aiResults - Results from AI fallback
   * @param {Object} options - Combination options
   * @returns {Object} - Combined analysis results
   */
  combineSTACAndAIResults(stacResults, aiResults, options = {}) {
    const combined = {
      summary: {
        stacCoverage: stacResults.coverage || { percentage: 0, matched: 0 },
        aiCoverage: aiResults.coverage || { percentage: 0, addressedGaps: 0 },
        totalScenarios:
          (stacResults.matchedScenarios || []).length +
          (aiResults.scenarios || []).length,
        totalRequirements:
          (stacResults.securityRequirements || []).length +
          (aiResults.requirements || []).length,
        totalTestCases:
          (stacResults.testCases || []).length +
          (aiResults.testCases || []).length,
        combinedConfidence: 0,
      },
      scenarios: [],
      requirements: [],
      testCases: [],
      threats: [],
      recommendations: [],
      sources: {
        stac: stacResults,
        ai: aiResults,
      },
      timestamp: new Date().toISOString(),
    };

    // Combine scenarios with source tracking
    if (stacResults.matchedScenarios) {
      combined.scenarios.push(
        ...stacResults.matchedScenarios.map((scenario) => ({
          ...scenario,
          source: "STAC",
          priority: scenario.confidence * 1.2, // STAC results get higher priority
        })),
      );
    }

    if (aiResults.scenarios) {
      combined.scenarios.push(
        ...aiResults.scenarios.map((scenario) => ({
          ...scenario,
          source: "AI_FALLBACK",
          priority: scenario.confidence * 0.8, // AI results get lower priority
        })),
      );
    }

    // Combine requirements with deduplication
    const requirementMap = new Map();

    // Add STAC requirements first (higher priority)
    if (stacResults.securityRequirements) {
      for (const req of stacResults.securityRequirements) {
        const key = `${req.name}_${req.details}`.toLowerCase();
        requirementMap.set(key, {
          ...req,
          source: "STAC",
          priority: req.confidence || 0.8,
        });
      }
    }

    // Add AI requirements (avoid duplicates, lower priority)
    if (aiResults.requirements) {
      for (const req of aiResults.requirements) {
        const key = `${req.name}_${req.details}`.toLowerCase();
        if (!requirementMap.has(key)) {
          requirementMap.set(key, {
            ...req,
            source: "AI_FALLBACK",
            priority: (req.confidence || 0.5) * 0.8,
          });
        }
      }
    }

    combined.requirements = Array.from(requirementMap.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    // Combine test cases with deduplication
    const testCaseMap = new Map();

    // Add STAC test cases first
    if (stacResults.testCases) {
      for (const test of stacResults.testCases) {
        const key = `${test.name}_${test.details}`.toLowerCase();
        testCaseMap.set(key, {
          ...test,
          source: "STAC",
          priority: test.confidence || 0.8,
        });
      }
    }

    // Add AI test cases
    if (aiResults.testCases) {
      for (const test of aiResults.testCases) {
        const key = `${test.name}_${test.steps}`.toLowerCase();
        if (!testCaseMap.has(key)) {
          testCaseMap.set(key, {
            ...test,
            source: "AI_FALLBACK",
            priority: (test.confidence || 0.5) * 0.8,
          });
        }
      }
    }

    combined.testCases = Array.from(testCaseMap.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    // Combine threats
    if (stacResults.threats) {
      combined.threats.push(
        ...stacResults.threats.map((threat) => ({
          ...threat,
          source: "STAC",
        })),
      );
    }

    if (aiResults.threats) {
      combined.threats.push(
        ...aiResults.threats.map((threat) => ({
          ...threat,
          source: "AI_FALLBACK",
        })),
      );
    }

    // Calculate combined confidence
    const stacWeight = 0.7;
    const aiWeight = 0.3;
    const stacConfidence = stacResults.coverage?.confidence || 0;
    const aiConfidence = aiResults.confidence || 0;

    combined.summary.combinedConfidence =
      stacConfidence * stacWeight + aiConfidence * aiWeight;

    return combined;
  }

  /**
   * Implement result combination logic for STAC and AI outputs
   * Requirements 4.1, 4.2, 4.3: Combine STAC and AI results with confidence weighting
   * @param {Object} stacResults - Results from STAC matching
   * @param {Object} aiResults - Results from AI fallback
   * @param {Object} options - Combination options
   * @returns {Object} - Combined analysis results
   */
  combineSTACAndAIResults(stacResults, aiResults, options = {}) {
    const combined = {
      summary: {
        stacCoverage: stacResults.coverage || { percentage: 0, matched: 0 },
        aiCoverage: aiResults.coverage || { percentage: 0, addressedGaps: 0 },
        totalScenarios:
          (stacResults.matchedScenarios || []).length +
          (aiResults.scenarios || []).length,
        totalRequirements:
          (stacResults.securityRequirements || []).length +
          (aiResults.requirements || []).length,
        totalTestCases:
          (stacResults.testCases || []).length +
          (aiResults.testCases || []).length,
        combinedConfidence: 0,
      },
      scenarios: [],
      requirements: [],
      testCases: [],
      threats: [],
      recommendations: [],
      sources: {
        stac: stacResults,
        ai: aiResults,
      },
      timestamp: new Date().toISOString(),
    };

    // Combine scenarios with source tracking
    if (stacResults.matchedScenarios) {
      combined.scenarios.push(
        ...stacResults.matchedScenarios.map((scenario) => ({
          ...scenario,
          source: "STAC",
          priority: scenario.confidence * 1.2, // STAC results get higher priority
        })),
      );
    }

    if (aiResults.scenarios) {
      combined.scenarios.push(
        ...aiResults.scenarios.map((scenario) => ({
          ...scenario,
          source: "AI_FALLBACK",
          priority: scenario.confidence * 0.8, // AI results get lower priority
        })),
      );
    }

    // Combine requirements with deduplication
    const requirementMap = new Map();

    // Add STAC requirements first (higher priority)
    if (stacResults.securityRequirements) {
      for (const req of stacResults.securityRequirements) {
        const key = `${req.name}_${req.details}`.toLowerCase();
        requirementMap.set(key, {
          ...req,
          source: "STAC",
          priority: req.confidence || 0.8,
        });
      }
    }

    // Add AI requirements (avoid duplicates, lower priority)
    if (aiResults.requirements) {
      for (const req of aiResults.requirements) {
        const key = `${req.name}_${req.details}`.toLowerCase();
        if (!requirementMap.has(key)) {
          requirementMap.set(key, {
            ...req,
            source: "AI_FALLBACK",
            priority: (req.confidence || 0.5) * 0.8,
          });
        }
      }
    }

    combined.requirements = Array.from(requirementMap.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    // Combine test cases with deduplication
    const testCaseMap = new Map();

    // Add STAC test cases first
    if (stacResults.testCases) {
      for (const test of stacResults.testCases) {
        const key = `${test.name}_${test.details}`.toLowerCase();
        testCaseMap.set(key, {
          ...test,
          source: "STAC",
          priority: test.confidence || 0.8,
        });
      }
    }

    // Add AI test cases
    if (aiResults.testCases) {
      for (const test of aiResults.testCases) {
        const key = `${test.name}_${test.steps}`.toLowerCase();
        if (!testCaseMap.has(key)) {
          testCaseMap.set(key, {
            ...test,
            source: "AI_FALLBACK",
            priority: (test.confidence || 0.5) * 0.8,
          });
        }
      }
    }

    combined.testCases = Array.from(testCaseMap.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    // Combine threats
    if (stacResults.threats) {
      combined.threats.push(
        ...stacResults.threats.map((threat) => ({
          ...threat,
          source: "STAC",
        })),
      );
    }

    if (aiResults.threats) {
      combined.threats.push(
        ...aiResults.threats.map((threat) => ({
          ...threat,
          source: "AI_FALLBACK",
        })),
      );
    }

    // Calculate combined confidence
    const stacWeight = 0.7;
    const aiWeight = 0.3;
    const stacConfidence = stacResults.coverage?.confidence || 0;
    const aiConfidence = aiResults.confidence || 0;

    combined.summary.combinedConfidence =
      stacConfidence * stacWeight + aiConfidence * aiWeight;

    return combined;
  }

  buildAnalysisPrompt(content, customPrompt) {
    const defaultPrompt = `
作为安全专家，请分析以下产品需求文档，识别潜在的安全风险和威胁场景：

分析要求：
1. 识别数据流和关键资产
2. 分析身份认证和授权需求
3. 评估输入验证和数据处理风险
4. 识别业务逻辑安全风险
5. 提出具体的安全测试场景

请以JSON格式返回分析结果，包含以下字段：
- summary: 需求概述
- assets: 关键资产列表
- threats: 威胁列表（每个威胁包含类型、描述、风险等级）
- testScenarios: 安全测试场景列表
- recommendations: 安全建议

产品需求内容：
`;

    return (customPrompt || defaultPrompt) + "\n\n" + JSON.stringify(content);
  }

  async callLLM(prompt, content) {
    if (this.llmConfig.provider !== "custom" && !this.llmConfig.apiKey) {
      throw new Error("请先配置LLM API密钥");
    }

    const headers = {
      "Content-Type": "application/json",
    };

    // 只有在API密钥存在时才添加Authorization头
    if (this.llmConfig.apiKey) {
      headers.Authorization = `Bearer ${this.llmConfig.apiKey}`;
    }

    // 这里是示例实现，需要根据实际使用的LLM服务调整
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
  }

  parseSecurityScenarios(llmResult) {
    try {
      // 尝试解析JSON格式的结果
      const parsed = JSON.parse(llmResult);
      return parsed;
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
    // 简单的威胁提取逻辑
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
          level: this.assessThreatLevel(line),
        });
      }
    });

    return threats;
  }

  extractTestScenarios(text) {
    // 简单的测试场景提取逻辑
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

  assessThreatLevel(text) {
    const highKeywords = ["严重", "高危", "critical", "high"];
    const mediumKeywords = ["中等", "medium"];

    const lowerText = text.toLowerCase();

    if (highKeywords.some((keyword) => lowerText.includes(keyword))) {
      return "high";
    } else if (mediumKeywords.some((keyword) => lowerText.includes(keyword))) {
      return "medium";
    }

    return "low";
  }

  async parseFile(attachment) {
    try {
      // Use the new DocumentParser for consistent parsing
      const parsedContent = await this.documentParser.parseDocument(attachment);

      if (!parsedContent.success) {
        throw new Error(parsedContent.error || "Document parsing failed");
      }

      // Return the text content for backward compatibility
      return parsedContent.text;
    } catch (error) {
      throw new Error(`文件解析失败: ${error.message}`);
    }
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

  async updateConfig(config) {
    await chrome.storage.sync.set(config);
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

  /**
   * Validate incoming message structure and sanitize data
   * Requirements 9.2: Input validation for all user inputs
   * @private
   * @param {Object} request - Incoming message request
   * @returns {Object} - Validation result
   */
  _validateIncomingMessage(request) {
    const result = {
      isValid: false,
      sanitized: null,
      errors: [],
      warnings: [],
    };

    try {
      // Basic structure validation
      if (!request || typeof request !== "object") {
        result.errors.push("Message must be an object");
        return result;
      }

      // Validate action field
      const actionValidation = this.inputValidator.validateText(
        request.action,
        {
          required: true,
          maxLength: 100,
          pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
        },
      );

      if (!actionValidation.isValid) {
        result.errors.push(
          `Invalid action: ${actionValidation.errors.join(", ")}`,
        );
        return result;
      }

      // Validate allowed actions
      const allowedActions = [
        "analyzeContent",
        "parseFile",
        "parseAndAnalyzeDocument",
        "performSTACMatching",
        "generateAIFallback",
        "updateConfig",
        "testLLMConnection",
        "getSTACCoverage",
      ];

      if (!allowedActions.includes(actionValidation.sanitized)) {
        result.errors.push(`Unsupported action: ${actionValidation.sanitized}`);
        return result;
      }

      const sanitized = {
        action: actionValidation.sanitized,
      };

      // Validate data field based on action
      if (request.data !== undefined) {
        const dataValidation = this._validateMessageData(
          request.data,
          actionValidation.sanitized,
        );

        if (!dataValidation.isValid) {
          result.errors.push(
            `Invalid data: ${dataValidation.errors.join(", ")}`,
          );
          return result;
        }

        sanitized.data = dataValidation.sanitized;
        result.warnings.push(...dataValidation.warnings);
      }

      result.sanitized = sanitized;
      result.isValid = true;

      return result;
    } catch (error) {
      result.errors.push(`Message validation error: ${error.message}`);
      return result;
    }
  }

  /**
   * Validate message data based on action type
   * @private
   * @param {any} data - Message data to validate
   * @param {string} action - Action type
   * @returns {Object} - Validation result
   */
  _validateMessageData(data, action) {
    switch (action) {
      case "analyzeContent":
        return this._validateAnalyzeContentData(data);

      case "parseFile":
        return this._validateParseFileData(data);

      case "parseAndAnalyzeDocument":
        return this._validateDocumentAnalysisData(data);

      case "performSTACMatching":
        return this._validateSTACMatchingData(data);

      default:
        // 如果inputValidator不可用，返回基本验证
        if (this.inputValidator) {
          return this.inputValidator.validateObject(data, { maxDepth: 5 });
        } else {
          return {
            isValid: true,
            sanitized: data,
            errors: [],
            warnings: ["Input validation not available"],
          };
        }
    }
  }

  /**
   * Validate analyze content data
   * @private
   * @param {Object} data - Data to validate
   * @returns {Object} - Validation result
   */
  _validateAnalyzeContentData(data) {
    if (!data || typeof data !== "object") {
      return {
        isValid: false,
        errors: ["Analyze content data must be an object"],
        warnings: [],
      };
    }

    const result = {
      isValid: false,
      sanitized: {},
      errors: [],
      warnings: [],
    };

    // Validate content field
    if (data.content !== undefined) {
      const contentValidation = this.inputValidator.validateText(data.content, {
        required: true,
        maxLength: 500000, // 500KB limit
      });

      if (!contentValidation.isValid) {
        result.errors.push(...contentValidation.errors);
        return result;
      }

      result.sanitized.content = contentValidation.sanitized;
      result.warnings.push(...contentValidation.warnings);
    } else {
      result.errors.push("Content is required for analysis");
      return result;
    }

    // Validate optional attachments array
    if (data.attachments !== undefined) {
      const attachmentsValidation = this.inputValidator.validateArray(
        data.attachments,
        {
          maxLength: 50,
          itemValidator: (item) => this.inputValidator.validateAttachment(item),
        },
      );

      if (!attachmentsValidation.isValid) {
        result.errors.push(...attachmentsValidation.errors);
        return result;
      }

      result.sanitized.attachments = attachmentsValidation.sanitized;
      result.warnings.push(...attachmentsValidation.warnings);
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate document analysis data
   * @private
   * @param {Object} data - Data to validate
   * @returns {Object} - Validation result
   */
  _validateDocumentAnalysisData(data) {
    if (!data || typeof data !== "object") {
      return {
        isValid: false,
        errors: ["Document analysis data must be an object"],
        warnings: [],
      };
    }

    const result = {
      isValid: false,
      sanitized: {},
      errors: [],
      warnings: [],
    };

    // Validate attachment field
    if (data.attachment !== undefined) {
      const attachmentValidation = this.inputValidator.validateAttachment(
        data.attachment,
      );

      if (!attachmentValidation.isValid) {
        result.errors.push(...attachmentValidation.errors);
        return result;
      }

      result.sanitized.attachment = attachmentValidation.sanitized;
      result.warnings.push(...attachmentValidation.warnings);
    } else {
      result.errors.push("Attachment is required for document analysis");
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate STAC matching data
   * @private
   * @param {Object} data - Data to validate
   * @returns {Object} - Validation result
   */
  _validateSTACMatchingData(data) {
    if (!data || typeof data !== "object") {
      return {
        isValid: false,
        errors: ["STAC matching data must be an object"],
        warnings: [],
      };
    }

    const result = {
      isValid: false,
      sanitized: {},
      errors: [],
      warnings: [],
    };

    // Validate content field
    if (data.content !== undefined) {
      const contentValidation = this.inputValidator.validateText(data.content, {
        required: true,
        maxLength: 1000000, // 1MB limit for STAC matching
      });

      if (!contentValidation.isValid) {
        result.errors.push(...contentValidation.errors);
        return result;
      }

      result.sanitized.content = contentValidation.sanitized;
      result.warnings.push(...contentValidation.warnings);
    } else {
      result.errors.push("Content is required for STAC matching");
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate parse file data
   * @private
   * @param {any} data - Data to validate
   * @returns {Object} - Validation result
   */
  _validateParseFileData(data) {
    // For parseFile, data should be an attachment object
    return this.inputValidator.validateAttachment(data);
  }
}

// 初始化服务
new SecurityAnalysisService();
