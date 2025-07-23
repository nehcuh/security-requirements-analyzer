/**
 * STAC (Security Testing and Analysis Cases) Knowledge Base Service
 * Provides scenario matching and security requirements retrieval
 */
class STACService {
  constructor() {
    this.knowledgeBase = null;
    this.scenarioIndex = new Map();
    this.isLoaded = false;
    
    // Performance optimization: Add caching for STAC matches
    this.matchCache = new Map();
    this.cacheMaxSize = 100;
    this.cacheExpiryTime = 30 * 60 * 1000; // 30 minutes
    
    // Memory management
    this.cleanupInterval = setInterval(() => {
      this._performCacheCleanup();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Load and validate the STAC knowledge base from assets with comprehensive error handling and security
   * Requirements 3.3, 4.1, 9.2: Knowledge base loading with graceful degradation and secure handling
   * @param {Object} options - Loading options
   * @returns {Promise<void>}
   */
  async loadKnowledgeBase(options = {}) {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this._logSTACError(`Loading STAC knowledge base (attempt ${attempt}/${maxRetries})...`, {
          attempt,
          maxRetries,
          startTime
        });
        
        // Security: Load the knowledge base file with timeout and validation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(chrome.runtime.getURL('assets/STAC知识库.json'), {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Security: Validate response size
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const size = parseInt(contentLength, 10);
          const maxSize = 10 * 1024 * 1024; // 10MB limit for knowledge base
          if (size > maxSize) {
            throw new Error(`Knowledge base too large: ${Math.round(size / 1024 / 1024)}MB (maximum 10MB)`);
          }
        }
        
        const rawData = await response.text();
        
        // Security: Validate and sanitize JSON data before parsing
        const sanitizedData = this._sanitizeKnowledgeBaseData(rawData);
        const data = JSON.parse(sanitizedData);
        
        if (!data || typeof data !== 'object') {
          throw new Error('Knowledge base file is empty or invalid JSON');
        }
        
        // Security: Validate knowledge base structure with detailed error reporting
        const validationResult = this.validateKnowledgeBase(data, { strict: true });
        if (!validationResult.isValid) {
          throw new Error(`Knowledge base validation failed: ${validationResult.errors.join(', ')}`);
        }
        
        // Security: Apply additional security checks
        const securityResult = this._performKnowledgeBaseSecurityChecks(data);
        if (!securityResult.isSafe) {
          throw new Error(`Knowledge base security validation failed: ${securityResult.threats.join(', ')}`);
        }
        
        this.knowledgeBase = data;
        
        // Create indexing system for efficient scenario matching
        try {
          this.createScenarioIndex();
        } catch (indexError) {
          this._logSTACError('Failed to create scenario index, using fallback', { error: indexError.message });
          this.scenarioIndex = new Map(); // Empty index as fallback
        }
        
        this.isLoaded = true;
        const loadTime = Date.now() - startTime;
        
        this._logSTACError(`STAC knowledge base loaded successfully`, {
          scenarioCount: Object.keys(data).length,
          indexSize: this.scenarioIndex.size,
          loadTime,
          attempt,
          securityWarnings: securityResult.warnings.length
        });
        
        return; // Success, exit retry loop
        
      } catch (error) {
        lastError = error;
        
        this._logSTACError(`Knowledge base loading attempt ${attempt} failed`, {
          error: error.message,
          errorType: error.name,
          attempt,
          maxRetries
        });
        
        // Don't retry on certain types of errors
        if (error.name === 'SyntaxError' || error.message.includes('validation failed')) {
          break;
        }
        
        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    
    // All attempts failed, set up fallback mode
    this._setupFallbackMode(lastError);
    
    throw new Error(`Failed to load STAC knowledge base after ${maxRetries} attempts: ${lastError.message}`);
  }
  
  /**
   * Setup fallback mode when knowledge base loading fails
   * Requirements 4.1: Graceful degradation when STAC matching fails
   * @private
   * @param {Error} error - The loading error
   */
  _setupFallbackMode(error) {
    this._logSTACError('Setting up STAC fallback mode', { error: error.message });
    
    // Create minimal fallback knowledge base
    this.knowledgeBase = {
      'Generic Security Analysis': {
        threats: [{
          name: 'General Security Assessment',
          details: 'Fallback security analysis when STAC knowledge base is unavailable',
          security_requirement: {
            name: 'Basic Security Review',
            details: 'Perform manual security assessment due to STAC service unavailability'
          },
          security_design: {
            name: 'Manual Security Design',
            details: 'Design security controls manually without STAC guidance'
          },
          test_case: {
            name: 'Manual Security Testing',
            details: 'Conduct security testing without STAC test cases'
          }
        }]
      }
    };
    
    this.scenarioIndex = new Map();
    this.scenarioIndex.set('security', new Set(['Generic Security Analysis']));
    this.scenarioIndex.set('analysis', new Set(['Generic Security Analysis']));
    this.scenarioIndex.set('assessment', new Set(['Generic Security Analysis']));
    
    this.isLoaded = true;
    this.isFallbackMode = true;
  }

  /**
   * Validate the structure and integrity of the knowledge base with detailed error reporting
   * @param {Object} data - The knowledge base data
   * @returns {Object} - Validation result with detailed errors
   */
  validateKnowledgeBase(data) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalScenarios: 0,
        totalThreats: 0,
        validScenarios: 0,
        validThreats: 0
      }
    };
    
    try {
      // Check if data is an object
      if (!data || typeof data !== 'object') {
        result.errors.push('Knowledge base must be an object');
        result.isValid = false;
        return result;
      }

      // Check if it has scenarios
      const scenarios = Object.keys(data);
      result.statistics.totalScenarios = scenarios.length;
      
      if (scenarios.length === 0) {
        result.errors.push('Knowledge base must contain at least one scenario');
        result.isValid = false;
        return result;
      }

      // Validate structure of each scenario
      for (const scenario of scenarios) {
        const scenarioData = data[scenario];
        let scenarioValid = true;
        
        // Each scenario must have threats array
        if (!scenarioData.threats || !Array.isArray(scenarioData.threats)) {
          result.errors.push(`Scenario "${scenario}" must have a threats array`);
          result.isValid = false;
          scenarioValid = false;
          continue;
        }

        result.statistics.totalThreats += scenarioData.threats.length;

        // Validate each threat structure
        for (let i = 0; i < scenarioData.threats.length; i++) {
          const threat = scenarioData.threats[i];
          const threatValidation = this.validateThreatStructure(threat, scenario, i);
          
          if (!threatValidation.isValid) {
            result.errors.push(...threatValidation.errors);
            result.isValid = false;
            scenarioValid = false;
          } else {
            result.statistics.validThreats++;
          }
          
          result.warnings.push(...threatValidation.warnings);
        }
        
        if (scenarioValid) {
          result.statistics.validScenarios++;
        }
      }
      
      // Add warnings for potential issues
      if (result.statistics.validScenarios < result.statistics.totalScenarios * 0.8) {
        result.warnings.push(`Only ${result.statistics.validScenarios}/${result.statistics.totalScenarios} scenarios are valid`);
      }
      
      if (result.statistics.validThreats < result.statistics.totalThreats * 0.9) {
        result.warnings.push(`Only ${result.statistics.validThreats}/${result.statistics.totalThreats} threats are valid`);
      }

      return result;
    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      result.isValid = false;
      return result;
    }
  }

  /**
   * Validate the structure of a threat object
   * @param {Object} threat - The threat object to validate
   * @param {string} scenario - The scenario name for error reporting
   * @returns {boolean} - True if valid, false otherwise
   */
  validateThreatStructure(threat, scenario) {
    const requiredFields = ['name', 'security_requirement', 'security_design', 'test_case'];
    
    for (const field of requiredFields) {
      if (!threat[field]) {
        console.error(`Threat in scenario "${scenario}" missing required field: ${field}`);
        return false;
      }
      
      // Validate nested structure
      if (typeof threat[field] === 'object' && threat[field] !== null) {
        if (!threat[field].name || !threat[field].details) {
          console.error(`Threat field "${field}" in scenario "${scenario}" must have name and details`);
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Create an indexing system for efficient scenario matching
   */
  createScenarioIndex() {
    // Creating scenario index
    
    this.scenarioIndex.clear();
    
    for (const [scenario, scenarioData] of Object.entries(this.knowledgeBase)) {
      // Index by scenario name
      const scenarioKeywords = this.extractKeywords(scenario);
      
      // Index by threat names and details
      for (const threat of scenarioData.threats) {
        const threatKeywords = this.extractKeywords(threat.name);
        const detailKeywords = threat.details ? this.extractKeywords(threat.details) : [];
        
        // Combine all keywords for this scenario
        const allKeywords = [...scenarioKeywords, ...threatKeywords, ...detailKeywords];
        
        // Add to index
        for (const keyword of allKeywords) {
          if (!this.scenarioIndex.has(keyword)) {
            this.scenarioIndex.set(keyword, new Set());
          }
          this.scenarioIndex.get(keyword).add(scenario);
        }
      }
    }
    
    // Index created successfully
  }

  /**
   * Extract keywords from text for indexing
   * @param {string} text - Text to extract keywords from
   * @returns {string[]} - Array of keywords
   */
  extractKeywords(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    // Convert to lowercase and split by common delimiters
    const keywords = text.toLowerCase()
      .split(/[\s\-_\(\)\[\]{}.,;:!?'"]+/)
      .filter(word => word.length > 2) // Filter out very short words
      .filter(word => !this.isStopWord(word)); // Filter out common stop words
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Check if a word is a stop word (common words to ignore)
   * @param {string} word - Word to check
   * @returns {boolean} - True if it's a stop word
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'a', 'an'
    ]);
    
    return stopWords.has(word);
  }

  /**
   * Check if the knowledge base is loaded
   * @returns {boolean} - True if loaded, false otherwise
   */
  isKnowledgeBaseLoaded() {
    return this.isLoaded && this.knowledgeBase !== null;
  }

  /**
   * Get all available scenarios
   * @returns {string[]} - Array of scenario names
   */
  getAvailableScenarios() {
    if (!this.isKnowledgeBaseLoaded()) {
      return [];
    }
    
    return Object.keys(this.knowledgeBase);
  }

  /**
   * Get scenario data by name
   * @param {string} scenarioName - Name of the scenario
   * @returns {Object|null} - Scenario data or null if not found
   */
  getScenarioData(scenarioName) {
    if (!this.isKnowledgeBaseLoaded()) {
      return null;
    }
    
    return this.knowledgeBase[scenarioName] || null;
  }

  /**
   * Match scenarios based on content analysis with fuzzy matching
   * @param {string} content - Content to analyze and match against scenarios
   * @returns {Promise<Array>} - Array of matched scenarios with confidence scores
   */
  /**
   * Match scenarios based on content analysis with comprehensive error handling and graceful degradation
   * Requirements 3.3, 4.1: STAC service error handling with graceful degradation
   * @param {string} content - Content to analyze and match against scenarios
   * @param {Object} options - Optional matching options
   * @returns {Promise<Array>} - Array of matched scenarios with confidence scores
   */
  async matchScenarios(content, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || 15000; // 15 second default timeout
    const errorContext = {
      contentLength: content?.length || 0,
      timestamp: new Date().toISOString(),
      fallbacksAttempted: []
    };

    try {
      // Performance optimization: Check cache first
      const cacheKey = this._generateMatchCacheKey(content);
      const cachedResult = this._getFromMatchCache(cacheKey);
      if (cachedResult && !options.bypassCache) {
        // Result retrieved from cache
        return cachedResult;
      }

      // Validate inputs with detailed error messages
      if (!this.isKnowledgeBaseLoaded()) {
        if (this.fallbackMode) {
          this._logSTACError('Using fallback mode for scenario matching', errorContext);
          return this._performFallbackMatching(content, errorContext);
        }
        throw new Error('Knowledge base not loaded and no fallback mode available');
      }

      if (!content || typeof content !== 'string') {
        this._logSTACError('Invalid content provided for matching', { 
          ...errorContext, 
          contentType: typeof content,
          contentProvided: !!content 
        });
        return [];
      }

      if (content.trim().length === 0) {
        this._logSTACError('Empty content provided for matching', errorContext);
        return [];
      }

      this._logSTACError('Starting scenario matching', {
        ...errorContext,
        contentLength: content.length,
        knowledgeBaseSize: Object.keys(this.knowledgeBase).length,
        indexSize: this.scenarioIndex.size
      });
      
      // Set up timeout for the entire matching process
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const matchingResult = await this._performScenarioMatching(content, errorContext, controller.signal);
        clearTimeout(timeoutId);
        
        const processingTime = Date.now() - startTime;
        this._logSTACError('Scenario matching completed successfully', {
          ...errorContext,
          processingTime,
          matchCount: matchingResult.length,
          topConfidence: matchingResult.length > 0 ? matchingResult[0].confidence : 0
        });
        
        // Performance optimization: Cache the result
        this._addToMatchCache(cacheKey, matchingResult);
        
        return matchingResult;
        
      } catch (matchingError) {
        clearTimeout(timeoutId);
        
        if (matchingError.name === 'AbortError') {
          throw new Error(`Scenario matching timed out after ${timeout}ms`);
        }
        
        throw matchingError;
      }
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this._logSTACError('Scenario matching failed, attempting graceful degradation', {
        ...errorContext,
        error: error.message,
        errorType: error.name,
        processingTime
      });
      
      // Attempt graceful degradation
      return await this._handleMatchingError(error, content, errorContext, processingTime);
    }
  }
  
  /**
   * Perform the core scenario matching logic with error handling
   * @private
   * @param {string} content - Content to match
   * @param {Object} errorContext - Error context for logging
   * @param {AbortSignal} signal - Abort signal for timeout handling
   * @returns {Promise<Array>} - Matched scenarios
   */
  async _performScenarioMatching(content, errorContext, signal) {
    try {
      // Extract keywords from content with error handling
      let contentKeywords = [];
      try {
        contentKeywords = this.extractKeywords(content);
        if (contentKeywords.length === 0) {
          this._logSTACError('No keywords extracted from content', errorContext);
          // Continue with empty keywords - semantic analysis might still work
        }
      } catch (keywordError) {
        this._logSTACError('Keyword extraction failed', { 
          ...errorContext, 
          error: keywordError.message 
        });
        // Continue with empty keywords
      }
      
      // Perform semantic analysis with error handling
      let contentSemantics = {};
      try {
        contentSemantics = this.performSemanticAnalysis(content);
      } catch (semanticError) {
        this._logSTACError('Semantic analysis failed', { 
          ...errorContext, 
          error: semanticError.message 
        });
        // Use empty semantic analysis as fallback
        contentSemantics = {
          securityTerms: [],
          technicalTerms: [],
          businessTerms: [],
          riskIndicators: [],
          complianceTerms: []
        };
      }
      
      // Check for abort signal
      if (signal.aborted) {
        throw new Error('Matching process was aborted');
      }
      
      // Find potential scenario matches with error handling
      const scenarioMatches = new Map();
      let keywordMatchingErrors = 0;
      
      // Keyword-based matching with individual error handling
      for (const keyword of contentKeywords) {
        try {
          if (this.scenarioIndex.has(keyword)) {
            for (const scenario of this.scenarioIndex.get(keyword)) {
              if (!scenarioMatches.has(scenario)) {
                scenarioMatches.set(scenario, {
                  scenario,
                  keywordMatches: 0,
                  matchedKeywords: [],
                  semanticScore: 0,
                  matchedThreats: [],
                  totalScore: 0,
                  errors: []
                });
              }
              
              const match = scenarioMatches.get(scenario);
              match.keywordMatches++;
              match.matchedKeywords.push(keyword);
            }
          }
        } catch (keywordMatchError) {
          keywordMatchingErrors++;
          this._logSTACError(`Keyword matching error for "${keyword}"`, {
            ...errorContext,
            keyword,
            error: keywordMatchError.message
          });
          
          // Continue with other keywords
          if (keywordMatchingErrors > 10) {
            this._logSTACError('Too many keyword matching errors, stopping keyword matching', errorContext);
            break;
          }
        }
        
        // Check for abort signal periodically
        if (signal.aborted) {
          throw new Error('Matching process was aborted');
        }
      }
      
      // Calculate scores for each match with error handling
      let scoringErrors = 0;
      for (const [scenario, match] of scenarioMatches) {
        try {
          const scenarioData = this.knowledgeBase[scenario];
          
          if (!scenarioData) {
            match.errors.push('Scenario data not found');
            continue;
          }
          
          // Calculate semantic similarity with error handling
          try {
            match.semanticScore = this.calculateSemanticSimilarity(
              contentSemantics, 
              scenario, 
              scenarioData
            );
          } catch (semanticError) {
            match.errors.push(`Semantic similarity calculation failed: ${semanticError.message}`);
            match.semanticScore = 0;
          }
          
          // Find matching threats with error handling
          try {
            match.matchedThreats = this.findMatchingThreats(
              contentKeywords, 
              contentSemantics, 
              scenarioData.threats || []
            );
          } catch (threatError) {
            match.errors.push(`Threat matching failed: ${threatError.message}`);
            match.matchedThreats = [];
          }
          
          // Calculate total confidence score with error handling
          try {
            match.totalScore = this.calculateConfidenceScore(match, contentKeywords.length);
          } catch (scoreError) {
            match.errors.push(`Confidence score calculation failed: ${scoreError.message}`);
            match.totalScore = 0;
          }
          
        } catch (matchError) {
          scoringErrors++;
          this._logSTACError(`Scoring error for scenario "${scenario}"`, {
            ...errorContext,
            scenario,
            error: matchError.message
          });
          
          // Remove problematic match
          scenarioMatches.delete(scenario);
          
          if (scoringErrors > 5) {
            this._logSTACError('Too many scoring errors, stopping score calculation', errorContext);
            break;
          }
        }
        
        // Check for abort signal periodically
        if (signal.aborted) {
          throw new Error('Matching process was aborted');
        }
      }
      
      // Convert to array and sort by confidence with error handling
      let results = [];
      try {
        results = Array.from(scenarioMatches.values())
          .filter(match => match.totalScore > 0.1 && match.errors.length === 0) // Filter out problematic matches
          .sort((a, b) => b.totalScore - a.totalScore);
      } catch (sortError) {
        this._logSTACError('Result sorting failed, using unsorted results', {
          ...errorContext,
          error: sortError.message
        });
        
        // Fallback to unsorted results
        results = Array.from(scenarioMatches.values())
          .filter(match => match.totalScore > 0.1);
      }
      
      // Apply ranking and filtering with error handling
      let rankedResults = results;
      try {
        rankedResults = this.rankAndFilterResults(results, content);
      } catch (rankingError) {
        this._logSTACError('Result ranking failed, using unranked results', {
          ...errorContext,
          error: rankingError.message
        });
        
        // Use basic filtering as fallback
        rankedResults = results.slice(0, 10); // Limit to top 10
      }
      
      return rankedResults;
      
    } catch (error) {
      this._logSTACError('Core scenario matching failed', {
        ...errorContext,
        error: error.message,
        errorType: error.name
      });
      throw error;
    }
  }

  /**
   * Perform semantic analysis on content to extract meaningful concepts
   * @param {string} content - Content to analyze
   * @returns {Object} - Semantic analysis results
   */
  performSemanticAnalysis(content) {
    const analysis = {
      securityTerms: [],
      technicalTerms: [],
      businessTerms: [],
      riskIndicators: [],
      complianceTerms: []
    };
    
    const lowerContent = content.toLowerCase();
    
    // Security-related terms
    const securityTerms = [
      'authentication', 'authorization', 'encryption', 'security', 'vulnerability',
      'attack', 'threat', 'risk', 'access control', 'permission', 'privilege',
      'token', 'session', 'password', 'credential', 'certificate', 'ssl', 'tls',
      'https', 'firewall', 'intrusion', 'malware', 'virus', 'phishing',
      'injection', 'xss', 'csrf', 'sql injection', 'buffer overflow'
    ];
    
    // Technical terms
    const technicalTerms = [
      'api', 'database', 'server', 'client', 'web', 'mobile', 'application',
      'system', 'network', 'protocol', 'interface', 'service', 'endpoint',
      'json', 'xml', 'http', 'rest', 'soap', 'oauth', 'jwt', 'saml',
      'ldap', 'active directory', 'cloud', 'aws', 'azure', 'docker'
    ];
    
    // Business terms
    const businessTerms = [
      'user', 'customer', 'account', 'profile', 'data', 'information',
      'document', 'file', 'upload', 'download', 'payment', 'transaction',
      'order', 'product', 'service', 'business', 'process', 'workflow'
    ];
    
    // Risk indicators
    const riskIndicators = [
      'sensitive', 'confidential', 'private', 'personal', 'financial',
      'medical', 'critical', 'important', 'restricted', 'classified',
      'pii', 'phi', 'gdpr', 'compliance', 'regulation', 'audit'
    ];
    
    // Find matches in content
    analysis.securityTerms = securityTerms.filter(term => lowerContent.includes(term));
    analysis.technicalTerms = technicalTerms.filter(term => lowerContent.includes(term));
    analysis.businessTerms = businessTerms.filter(term => lowerContent.includes(term));
    analysis.riskIndicators = riskIndicators.filter(term => lowerContent.includes(term));
    
    return analysis;
  }

  /**
   * Calculate semantic similarity between content and scenario
   * @param {Object} contentSemantics - Semantic analysis of content
   * @param {string} scenario - Scenario name
   * @param {Object} scenarioData - Scenario data
   * @returns {number} - Semantic similarity score (0-1)
   */
  calculateSemanticSimilarity(contentSemantics, scenario, scenarioData) {
    let totalScore = 0;
    let maxScore = 0;
    
    // Check scenario name similarity
    const scenarioSemantics = this.performSemanticAnalysis(scenario);
    maxScore += 4;
    
    totalScore += this.compareSemanticArrays(contentSemantics.securityTerms, scenarioSemantics.securityTerms);
    totalScore += this.compareSemanticArrays(contentSemantics.technicalTerms, scenarioSemantics.technicalTerms);
    totalScore += this.compareSemanticArrays(contentSemantics.businessTerms, scenarioSemantics.businessTerms);
    totalScore += this.compareSemanticArrays(contentSemantics.riskIndicators, scenarioSemantics.riskIndicators);
    
    // Check threat descriptions
    for (const threat of scenarioData.threats) {
      const threatText = `${threat.name} ${threat.details || ''}`;
      const threatSemantics = this.performSemanticAnalysis(threatText);
      maxScore += 4;
      
      totalScore += this.compareSemanticArrays(contentSemantics.securityTerms, threatSemantics.securityTerms);
      totalScore += this.compareSemanticArrays(contentSemantics.technicalTerms, threatSemantics.technicalTerms);
      totalScore += this.compareSemanticArrays(contentSemantics.businessTerms, threatSemantics.businessTerms);
      totalScore += this.compareSemanticArrays(contentSemantics.riskIndicators, threatSemantics.riskIndicators);
    }
    
    return maxScore > 0 ? totalScore / maxScore : 0;
  }

  /**
   * Compare two semantic arrays and return similarity score
   * @param {Array} arr1 - First array
   * @param {Array} arr2 - Second array
   * @returns {number} - Similarity score
   */
  compareSemanticArrays(arr1, arr2) {
    if (arr1.length === 0 && arr2.length === 0) return 0;
    if (arr1.length === 0 || arr2.length === 0) return 0;
    
    const intersection = arr1.filter(item => arr2.includes(item));
    const union = [...new Set([...arr1, ...arr2])];
    
    return intersection.length / union.length;
  }

  /**
   * Find threats that match the content
   * @param {Array} contentKeywords - Keywords from content
   * @param {Object} contentSemantics - Semantic analysis of content
   * @param {Array} threats - Array of threats to check
   * @returns {Array} - Array of matching threats with scores
   */
  findMatchingThreats(contentKeywords, contentSemantics, threats) {
    const matchingThreats = [];
    
    for (const threat of threats) {
      const threatKeywords = this.extractKeywords(`${threat.name} ${threat.details || ''}`);
      const keywordMatches = contentKeywords.filter(kw => threatKeywords.includes(kw)).length;
      
      if (keywordMatches > 0) {
        const threatSemantics = this.performSemanticAnalysis(`${threat.name} ${threat.details || ''}`);
        const semanticScore = this.calculateSemanticSimilarity(
          contentSemantics, 
          threat.name, 
          { threats: [threat] }
        );
        
        matchingThreats.push({
          threat,
          keywordMatches,
          semanticScore,
          totalScore: (keywordMatches * 0.6) + (semanticScore * 0.4)
        });
      }
    }
    
    return matchingThreats.sort((a, b) => b.totalScore - a.totalScore);
  }
  
  /**
   * Performance optimization: Generate cache key for matching
   * @private
   * @param {string} content - Content to generate key for
   * @returns {string} - Cache key
   */
  _generateMatchCacheKey(content) {
    // Simple hash function for cache key
    let hash = 0;
    const truncatedContent = content.substring(0, 1000); // Use first 1000 chars for key
    for (let i = 0; i < truncatedContent.length; i++) {
      const char = truncatedContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Performance optimization: Get result from match cache
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {Array|null} - Cached result or null
   */
  _getFromMatchCache(cacheKey) {
    const cached = this.matchCache.get(cacheKey);
    if (!cached) return null;
    
    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.cacheExpiryTime) {
      this.matchCache.delete(cacheKey);
      return null;
    }
    
    // Update access time for LRU
    cached.lastAccessed = Date.now();
    return cached.result;
  }
  
  /**
   * Performance optimization: Add result to match cache
   * @private
   * @param {string} cacheKey - Cache key
   * @param {Array} result - Result to cache
   */
  _addToMatchCache(cacheKey, result) {
    // Memory management: Check cache size
    if (this.matchCache.size >= this.cacheMaxSize) {
      // Remove oldest entries (LRU)
      let oldestKey = null;
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.matchCache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.matchCache.delete(oldestKey);
      }
    }
    
    this.matchCache.set(cacheKey, {
      result: result,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });
  }
  
  /**
   * Memory management: Perform cache cleanup
   * @private
   */
  _performCacheCleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean expired cache entries
    for (const [key, entry] of this.matchCache) {
      if (now - entry.timestamp > this.cacheExpiryTime) {
        this.matchCache.delete(key);
        cleanedCount++;
      }
    }
    
    // Cache cleanup completed
  }
  
  /**
   * Sanitize knowledge base data before parsing
   * Requirements 9.2: Secure handling of STAC knowledge base
   * @private
   * @param {string} rawData - Raw JSON data
   * @returns {string} - Sanitized JSON data
   */
  _sanitizeKnowledgeBaseData(rawData) {
    if (!rawData || typeof rawData !== 'string') {
      throw new Error('Invalid knowledge base data: must be string');
    }
    
    // Security: Limit data size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (rawData.length > maxSize) {
      throw new Error(`Knowledge base data too large: ${Math.round(rawData.length / 1024 / 1024)}MB (maximum 10MB)`);
    }
    
    // Security: Remove potentially dangerous patterns
    let sanitizedData = rawData;
    
    // Remove JavaScript code patterns
    const dangerousPatterns = [
      /javascript:/gi,
      /data:text\/html/gi,
      /<script[\s\S]*?<\/script>/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /document\./gi,
      /window\./gi,
      /location\./gi,
      /XMLHttpRequest/gi,
      /fetch\s*\(/gi,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitizedData)) {
        // Log potential security issue but don't reject - could be false positive
        console.warn('STAC Security Warning: Potentially dangerous pattern detected and removed:', pattern);
        sanitizedData = sanitizedData.replace(pattern, '[REMOVED]');
      }
    }
    
    // Security: Validate JSON structure before parsing
    try {
      // Basic JSON validation without parsing
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < sanitizedData.length; i++) {
        const char = sanitizedData[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
        }
        
        // Security: Detect potential JSON bomb
        if (braceCount > 1000) {
          throw new Error('JSON structure too deeply nested - potential security risk');
        }
      }
      
      if (braceCount !== 0) {
        throw new Error('Invalid JSON structure: unbalanced braces');
      }
      
    } catch (validationError) {
      throw new Error(`JSON validation failed: ${validationError.message}`);
    }
    
    return sanitizedData;
  }
  
  /**
   * Perform additional security checks on knowledge base data
   * Requirements 9.2: Security measures for knowledge base
   * @private
   * @param {Object} data - Knowledge base data
   * @returns {Object} - Security check result
   */
  _performKnowledgeBaseSecurityChecks(data) {
    const result = {
      isSafe: true,
      threats: [],
      warnings: [],
      checksPerformed: []
    };
    
    try {
      // 1. Validate data structure limits
      result.checksPerformed.push('structure_limits_check');
      
      const maxScenarios = 10000; // Reasonable limit
      const scenarioCount = Object.keys(data).length;
      
      if (scenarioCount > maxScenarios) {
        result.isSafe = false;
        result.threats.push(`Too many scenarios: ${scenarioCount} (maximum ${maxScenarios})`);
        return result;
      }
      
      // 2. Check for suspicious content patterns
      result.checksPerformed.push('content_pattern_check');
      
      const jsonString = JSON.stringify(data);
      const suspiciousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /constructor/,
        /__proto__/,
        /prototype\s*\[/,
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(jsonString)) {
          result.warnings.push(`Potentially suspicious pattern detected: ${pattern}`);
        }
      }
      
      // 3. Validate scenario content
      result.checksPerformed.push('scenario_content_check');
      
      let scenarioCheckCount = 0;
      const maxChecks = 100; // Limit validation checks for performance
      
      for (const [scenarioId, scenario] of Object.entries(data)) {
        if (scenarioCheckCount >= maxChecks) break;
        
        // Validate scenario ID
        if (typeof scenarioId !== 'string' || scenarioId.length > 200) {
          result.warnings.push(`Invalid scenario ID format: ${scenarioId}`);
          continue;
        }
        
        // Validate scenario structure
        if (!scenario || typeof scenario !== 'object') {
          result.warnings.push(`Invalid scenario data for ${scenarioId}`);
          continue;
        }
        
        // Check for suspicious URLs
        const scenarioText = JSON.stringify(scenario);
        const urlPattern = /https?:\/\/[^\s"'<>]+/g;
        const urls = scenarioText.match(urlPattern) || [];
        
        for (const url of urls.slice(0, 10)) { // Check first 10 URLs only
          if (this._isSuspiciousUrl(url)) {
            result.warnings.push(`Potentially suspicious URL in scenario ${scenarioId}: ${url}`);
          }
        }
        
        scenarioCheckCount++;
      }
      
      // 4. Memory usage validation
      result.checksPerformed.push('memory_usage_check');
      
      const estimatedMemoryUsage = jsonString.length * 2; // Rough estimate
      const maxMemoryUsage = 50 * 1024 * 1024; // 50MB
      
      if (estimatedMemoryUsage > maxMemoryUsage) {
        result.warnings.push(`High memory usage estimated: ${Math.round(estimatedMemoryUsage / 1024 / 1024)}MB`);
      }
      
      // 5. Data integrity check
      result.checksPerformed.push('data_integrity_check');
      
      // Check for null bytes or other potential issues
      if (jsonString.includes('\0')) {
        result.isSafe = false;
        result.threats.push('Null bytes detected in knowledge base data');
      }
      
    } catch (error) {
      result.warnings.push(`Security check incomplete: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Check if URL appears suspicious (reused from document parser)
   * @private
   * @param {string} url - URL to check
   * @returns {boolean} - True if URL appears suspicious
   */
  _isSuspiciousUrl(url) {
    const suspiciousDomains = [
      'bit.ly', 'tinyurl.com', 't.co', // URL shorteners
      'tempfile.org', 'temp-share.com', // Temporary file hosts
      'pastebin.com', 'paste.ee', // Paste sites
    ];
    
    const suspiciousPatterns = [
      /\d+\.\d+\.\d+\.\d+/, // IP addresses
      /[0-9a-f]{32,}/, // Long hex strings
      /\.tk$|\.ml$|\.ga$|\.cf$/, // Suspicious TLDs
      /localhost/,
      /127\.0\.0\.1/,
      /0\.0\.0\.0/,
    ];
    
    try {
      const urlObj = new URL(url);
      
      // Check domain
      for (const domain of suspiciousDomains) {
        if (urlObj.hostname.includes(domain)) {
          return true;
        }
      }
      
      // Check patterns
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(url)) {
          return true;
        }
      }
      
      return false;
    } catch {
      return true; // Invalid URL is suspicious
    }
  }
  
  /**
   * Cleanup resources when service is no longer needed
   */
  cleanup() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Clear caches
    this.matchCache.clear();
    this.scenarioIndex.clear();
    
    // STACService cleanup completed
  }

  /**
   * Calculate overall confidence score for a scenario match
   * @param {Object} match - Match object
   * @param {number} totalContentKeywords - Total keywords in content
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidenceScore(match, totalContentKeywords) {
    // Keyword match score (0-0.5)
    const keywordScore = Math.min(match.keywordMatches / totalContentKeywords, 0.5);
    
    // Semantic score (0-0.3)
    const semanticScore = match.semanticScore * 0.3;
    
    // Threat match score (0-0.2)
    const threatScore = Math.min(match.matchedThreats.length * 0.05, 0.2);
    
    return keywordScore + semanticScore + threatScore;
  }

  /**
   * Rank and filter results based on various criteria
   * @param {Array} results - Array of match results
   * @param {string} content - Original content for additional analysis
   * @returns {Array} - Ranked and filtered results
   */
  rankAndFilterResults(results, content) {
    // Apply additional filtering based on content length and complexity
    const contentLength = content.length;
    const minConfidence = contentLength > 1000 ? 0.15 : 0.2;
    
    return results
      .filter(result => result.totalScore >= minConfidence)
      .slice(0, 10) // Limit to top 10 matches
      .map(result => ({
        scenario: result.scenario,
        confidence: Math.round(result.totalScore * 100) / 100,
        keywordMatches: result.keywordMatches,
        matchedKeywords: result.matchedKeywords.slice(0, 5), // Limit keywords shown
        matchedThreats: result.matchedThreats.slice(0, 3), // Limit threats shown
        semanticScore: Math.round(result.semanticScore * 100) / 100
      }));
  }

  /**
   * Get security requirements from matched scenarios with comprehensive error handling
   * Requirements 3.3: Error handling for knowledge base loading failures
   * @param {Array} matchedScenarios - Array of matched scenario results
   * @returns {Array} - Array of security requirements with metadata
   */
  getSecurityRequirements(matchedScenarios) {
    try {
      if (!this.isKnowledgeBaseLoaded()) {
        if (this.fallbackMode) {
          this._logSTACError('Using fallback mode for security requirements', {});
          return this._getFallbackSecurityRequirements(matchedScenarios);
        }
        throw new Error('Knowledge base not loaded and no fallback mode available');
      }

      if (!Array.isArray(matchedScenarios)) {
        this._logSTACError('Invalid matchedScenarios provided to getSecurityRequirements', {
          type: typeof matchedScenarios,
          isArray: Array.isArray(matchedScenarios)
        });
        return [];
      }

      const requirements = [];
      const seenRequirements = new Set();
      let processingErrors = 0;

      for (const match of matchedScenarios) {
        try {
          const scenarioData = this.getScenarioData(match.scenario);
          if (!scenarioData) {
            this._logSTACError(`Scenario data not found: ${match.scenario}`, {});
            continue;
          }

          if (!Array.isArray(scenarioData.threats)) {
            this._logSTACError(`Invalid threats data for scenario: ${match.scenario}`, {});
            continue;
          }

          for (const threat of scenarioData.threats) {
            try {
              if (threat.security_requirement && 
                  threat.security_requirement.name && 
                  threat.security_requirement.details) {
                
                const reqKey = `${threat.security_requirement.name}_${threat.security_requirement.details}`;
                
                if (!seenRequirements.has(reqKey)) {
                  seenRequirements.add(reqKey);
                  
                  let priority = 0.5; // Default priority
                  let category = 'General Security'; // Default category
                  
                  try {
                    priority = this.calculateRequirementPriority(threat, match);
                  } catch (priorityError) {
                    this._logSTACError('Failed to calculate requirement priority', {
                      error: priorityError.message,
                      threat: threat.name
                    });
                  }
                  
                  try {
                    category = this.categorizeRequirement(threat.security_requirement);
                  } catch (categoryError) {
                    this._logSTACError('Failed to categorize requirement', {
                      error: categoryError.message,
                      requirement: threat.security_requirement.name
                    });
                  }
                  
                  requirements.push({
                    name: threat.security_requirement.name,
                    details: threat.security_requirement.details,
                    scenario: match.scenario,
                    threatName: threat.name,
                    confidence: match.confidence || 0,
                    priority: priority,
                    category: category,
                    source: match.source || 'STAC'
                  });
                }
              }
            } catch (threatError) {
              processingErrors++;
              this._logSTACError('Error processing threat for requirements', {
                error: threatError.message,
                scenario: match.scenario,
                threat: threat.name
              });
              
              if (processingErrors > 10) {
                this._logSTACError('Too many threat processing errors, stopping', {});
                break;
              }
            }
          }
        } catch (scenarioError) {
          this._logSTACError('Error processing scenario for requirements', {
            error: scenarioError.message,
            scenario: match.scenario
          });
        }
      }

      // Sort by priority with error handling
      try {
        return requirements.sort((a, b) => b.priority - a.priority);
      } catch (sortError) {
        this._logSTACError('Failed to sort requirements, returning unsorted', {
          error: sortError.message
        });
        return requirements;
      }
      
    } catch (error) {
      this._logSTACError('getSecurityRequirements failed completely', {
        error: error.message,
        errorType: error.name
      });
      
      // Return fallback requirements if possible
      if (this.fallbackMode) {
        return this._getFallbackSecurityRequirements(matchedScenarios);
      }
      
      return [];
    }
  }

  /**
   * Get test cases from matched scenarios with comprehensive error handling
   * Requirements 3.3: Error handling for knowledge base loading failures
   * @param {Array} matchedScenarios - Array of matched scenario results
   * @returns {Array} - Array of test cases with metadata
   */
  getTestCases(matchedScenarios) {
    try {
      if (!this.isKnowledgeBaseLoaded()) {
        if (this.fallbackMode) {
          this._logSTACError('Using fallback mode for test cases', {});
          return this._getFallbackTestCases(matchedScenarios);
        }
        throw new Error('Knowledge base not loaded and no fallback mode available');
      }

      if (!Array.isArray(matchedScenarios)) {
        this._logSTACError('Invalid matchedScenarios provided to getTestCases', {
          type: typeof matchedScenarios,
          isArray: Array.isArray(matchedScenarios)
        });
        return [];
      }

      const testCases = [];
      const seenTestCases = new Set();
      let processingErrors = 0;

      for (const match of matchedScenarios) {
        try {
          const scenarioData = this.getScenarioData(match.scenario);
          if (!scenarioData) {
            this._logSTACError(`Scenario data not found: ${match.scenario}`, {});
            continue;
          }

          if (!Array.isArray(scenarioData.threats)) {
            this._logSTACError(`Invalid threats data for scenario: ${match.scenario}`, {});
            continue;
          }

          for (const threat of scenarioData.threats) {
            try {
              if (threat.test_case && 
                  threat.test_case.name && 
                  threat.test_case.details) {
                
                const testKey = `${threat.test_case.name}_${threat.test_case.details}`;
                
                if (!seenTestCases.has(testKey)) {
                  seenTestCases.add(testKey);
                  
                  let priority = 0.5; // Default priority
                  let category = 'Functional Testing'; // Default category
                  
                  try {
                    priority = this.calculateTestCasePriority(threat, match);
                  } catch (priorityError) {
                    this._logSTACError('Failed to calculate test case priority', {
                      error: priorityError.message,
                      threat: threat.name
                    });
                  }
                  
                  try {
                    category = this.categorizeTestCase(threat.test_case);
                  } catch (categoryError) {
                    this._logSTACError('Failed to categorize test case', {
                      error: categoryError.message,
                      testCase: threat.test_case.name
                    });
                  }
                  
                  testCases.push({
                    name: threat.test_case.name,
                    details: threat.test_case.details,
                    scenario: match.scenario,
                    threatName: threat.name,
                    confidence: match.confidence || 0,
                    priority: priority,
                    category: category,
                    relatedRequirement: threat.security_requirement ? threat.security_requirement.name : null,
                    source: match.source || 'STAC'
                  });
                }
              }
            } catch (threatError) {
              processingErrors++;
              this._logSTACError('Error processing threat for test cases', {
                error: threatError.message,
                scenario: match.scenario,
                threat: threat.name
              });
              
              if (processingErrors > 10) {
                this._logSTACError('Too many threat processing errors, stopping', {});
                break;
              }
            }
          }
        } catch (scenarioError) {
          this._logSTACError('Error processing scenario for test cases', {
            error: scenarioError.message,
            scenario: match.scenario
          });
        }
      }

      // Sort by priority with error handling
      try {
        return testCases.sort((a, b) => b.priority - a.priority);
      } catch (sortError) {
        this._logSTACError('Failed to sort test cases, returning unsorted', {
          error: sortError.message
        });
        return testCases;
      }
      
    } catch (error) {
      this._logSTACError('getTestCases failed completely', {
        error: error.message,
        errorType: error.name
      });
      
      // Return fallback test cases if possible
      if (this.fallbackMode) {
        return this._getFallbackTestCases(matchedScenarios);
      }
      
      return [];
    }
  }

  /**
   * Extract threat information from matched scenarios
   * @param {Array} matchedScenarios - Array of matched scenario results
   * @returns {Object} - Structured threat information
   */
  extractThreatInformation(matchedScenarios) {
    if (!this.isKnowledgeBaseLoaded()) {
      throw new Error('Knowledge base not loaded');
    }

    if (!Array.isArray(matchedScenarios)) {
      return { threats: [], summary: {} };
    }

    const threats = [];
    const threatCategories = new Map();
    const riskLevels = new Map();

    for (const match of matchedScenarios) {
      const scenarioData = this.getScenarioData(match.scenario);
      if (!scenarioData) continue;

      for (const threat of scenarioData.threats) {
        const threatInfo = {
          name: threat.name,
          details: threat.details || '',
          scenario: match.scenario,
          confidence: match.confidence,
          riskLevel: this.assessRiskLevel(threat, match),
          category: this.categorizeThreat(threat),
          securityRequirement: threat.security_requirement,
          securityDesign: threat.security_design,
          testCase: threat.test_case,
          industryStandard: threat.industry_standard
        };

        threats.push(threatInfo);

        // Update category counts
        const category = threatInfo.category;
        threatCategories.set(category, (threatCategories.get(category) || 0) + 1);

        // Update risk level counts
        const riskLevel = threatInfo.riskLevel;
        riskLevels.set(riskLevel, (riskLevels.get(riskLevel) || 0) + 1);
      }
    }

    return {
      threats: threats.sort((a, b) => b.confidence - a.confidence),
      summary: {
        totalThreats: threats.length,
        categories: Object.fromEntries(threatCategories),
        riskLevels: Object.fromEntries(riskLevels),
        scenarios: matchedScenarios.length
      }
    };
  }

  /**
   * Create structured output for analysis results
   * @param {Array} matchedScenarios - Array of matched scenario results
   * @returns {Object} - Comprehensive analysis results
   */
  formatAnalysisResults(matchedScenarios) {
    if (!Array.isArray(matchedScenarios)) {
      return this.getEmptyAnalysisResults();
    }

    const securityRequirements = this.getSecurityRequirements(matchedScenarios);
    const testCases = this.getTestCases(matchedScenarios);
    const threatInfo = this.extractThreatInformation(matchedScenarios);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalScenarios: matchedScenarios.length,
        totalRequirements: securityRequirements.length,
        totalTestCases: testCases.length,
        totalThreats: threatInfo.threats.length,
        averageConfidence: this.calculateAverageConfidence(matchedScenarios)
      },
      scenarios: matchedScenarios.map(scenario => ({
        name: scenario.scenario,
        confidence: scenario.confidence,
        keywordMatches: scenario.keywordMatches,
        matchedKeywords: scenario.matchedKeywords,
        threatCount: scenario.matchedThreats.length
      })),
      securityRequirements: securityRequirements,
      testCases: testCases,
      threats: threatInfo.threats,
      recommendations: this.generateRecommendations(matchedScenarios, securityRequirements, testCases)
    };
  }

  /**
   * Calculate priority for a security requirement
   * @param {Object} threat - Threat object
   * @param {Object} match - Match result
   * @returns {number} - Priority score (0-1)
   */
  calculateRequirementPriority(threat, match) {
    let priority = match.confidence * 0.6; // Base on match confidence
    
    // Increase priority for critical security terms
    const criticalTerms = ['authentication', 'authorization', 'encryption', 'access control'];
    const reqText = (threat.security_requirement.details || '').toLowerCase();
    
    for (const term of criticalTerms) {
      if (reqText.includes(term)) {
        priority += 0.1;
      }
    }
    
    return Math.min(priority, 1.0);
  }

  /**
   * Calculate priority for a test case
   * @param {Object} threat - Threat object
   * @param {Object} match - Match result
   * @returns {number} - Priority score (0-1)
   */
  calculateTestCasePriority(threat, match) {
    let priority = match.confidence * 0.5; // Base on match confidence
    
    // Increase priority for automated test cases
    const testDetails = (threat.test_case.details || '').toLowerCase();
    if (testDetails.includes('自动') || testDetails.includes('工具')) {
      priority += 0.2;
    }
    
    return Math.min(priority, 1.0);
  }

  /**
   * Categorize a security requirement
   * @param {Object} requirement - Security requirement object
   * @returns {string} - Category name
   */
  categorizeRequirement(requirement) {
    const details = (requirement.details || '').toLowerCase();
    
    if (details.includes('认证') || details.includes('authentication')) return 'Authentication';
    if (details.includes('授权') || details.includes('authorization')) return 'Authorization';
    if (details.includes('加密') || details.includes('encryption')) return 'Encryption';
    if (details.includes('访问控制') || details.includes('access control')) return 'Access Control';
    if (details.includes('数据') || details.includes('data')) return 'Data Protection';
    if (details.includes('网络') || details.includes('network')) return 'Network Security';
    
    return 'General Security';
  }

  /**
   * Categorize a test case
   * @param {Object} testCase - Test case object
   * @returns {string} - Category name
   */
  categorizeTestCase(testCase) {
    const details = (testCase.details || '').toLowerCase();
    
    if (details.includes('渗透') || details.includes('penetration')) return 'Penetration Testing';
    if (details.includes('自动') || details.includes('automated')) return 'Automated Testing';
    if (details.includes('手工') || details.includes('manual')) return 'Manual Testing';
    if (details.includes('工具') || details.includes('tool')) return 'Tool-based Testing';
    
    return 'Functional Testing';
  }

  /**
   * Categorize a threat
   * @param {Object} threat - Threat object
   * @returns {string} - Category name
   */
  categorizeThreat(threat) {
    const name = (threat.name || '').toLowerCase();
    const details = (threat.details || '').toLowerCase();
    const text = `${name} ${details}`;
    
    if (text.includes('注入') || text.includes('injection')) return 'Injection Attacks';
    if (text.includes('认证') || text.includes('authentication')) return 'Authentication Threats';
    if (text.includes('授权') || text.includes('authorization')) return 'Authorization Threats';
    if (text.includes('加密') || text.includes('encryption')) return 'Cryptographic Threats';
    if (text.includes('会话') || text.includes('session')) return 'Session Management';
    if (text.includes('跨站') || text.includes('xss')) return 'Cross-Site Scripting';
    
    return 'General Threats';
  }

  /**
   * Assess risk level for a threat
   * @param {Object} threat - Threat object
   * @param {Object} match - Match result
   * @returns {string} - Risk level (High/Medium/Low)
   */
  assessRiskLevel(threat, match) {
    let riskScore = match.confidence;
    
    // Increase risk for critical threats
    const criticalThreats = ['injection', '注入', 'bypass', '绕过', 'privilege escalation', '权限提升'];
    const threatText = `${threat.name} ${threat.details || ''}`.toLowerCase();
    
    for (const critical of criticalThreats) {
      if (threatText.includes(critical)) {
        riskScore += 0.3;
        break;
      }
    }
    
    if (riskScore >= 0.7) return 'High';
    if (riskScore >= 0.4) return 'Medium';
    return 'Low';
  }

  /**
   * Calculate average confidence from matched scenarios
   * @param {Array} matchedScenarios - Array of matched scenarios
   * @returns {number} - Average confidence score
   */
  calculateAverageConfidence(matchedScenarios) {
    if (matchedScenarios.length === 0) return 0;
    
    const totalConfidence = matchedScenarios.reduce((sum, scenario) => sum + scenario.confidence, 0);
    return Math.round((totalConfidence / matchedScenarios.length) * 100) / 100;
  }

  /**
   * Generate recommendations based on analysis results
   * @param {Array} matchedScenarios - Matched scenarios
   * @param {Array} requirements - Security requirements
   * @param {Array} testCases - Test cases
   * @returns {Array} - Array of recommendations
   */
  generateRecommendations(matchedScenarios, requirements, testCases) {
    const recommendations = [];
    
    // High priority requirements
    const highPriorityReqs = requirements.filter(req => req.priority > 0.7);
    if (highPriorityReqs.length > 0) {
      recommendations.push({
        type: 'security_requirement',
        priority: 'High',
        title: '优先实施高优先级安全需求',
        description: `发现 ${highPriorityReqs.length} 个高优先级安全需求，建议优先实施`,
        items: highPriorityReqs.slice(0, 3).map(req => req.name)
      });
    }
    
    // Critical test cases
    const criticalTests = testCases.filter(test => test.priority > 0.6);
    if (criticalTests.length > 0) {
      recommendations.push({
        type: 'test_case',
        priority: 'High',
        title: '执行关键安全测试',
        description: `发现 ${criticalTests.length} 个关键测试用例，建议立即执行`,
        items: criticalTests.slice(0, 3).map(test => test.name)
      });
    }
    
    // Coverage analysis
    const scenarioCount = matchedScenarios.length;
    if (scenarioCount < 3) {
      recommendations.push({
        type: 'coverage',
        priority: 'Medium',
        title: '扩大安全分析覆盖范围',
        description: '匹配的安全场景较少，建议补充更多安全相关内容进行分析'
      });
    }
    
    return recommendations;
  }

  /**
   * Get empty analysis results structure
   * @returns {Object} - Empty analysis results
   */
  getEmptyAnalysisResults() {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalScenarios: 0,
        totalRequirements: 0,
        totalTestCases: 0,
        totalThreats: 0,
        averageConfidence: 0
      },
      scenarios: [],
      securityRequirements: [],
      testCases: [],
      threats: [],
      recommendations: []
    };
  }

  /**
   * Get knowledge base statistics
   * @returns {Object} - Statistics about the knowledge base
   */
  getStatistics() {
    if (!this.isKnowledgeBaseLoaded()) {
      return {
        scenarios: 0,
        threats: 0,
        keywords: 0
      };
    }
    
    const scenarios = Object.keys(this.knowledgeBase).length;
    let threats = 0;
    
    for (const scenarioData of Object.values(this.knowledgeBase)) {
      threats += scenarioData.threats.length;
    }
    
    return {
      scenarios,
      threats,
      keywords: this.scenarioIndex.size
    };
  }
  
  /**
   * Handle matching errors with graceful degradation
   * Requirements 4.1: Graceful degradation when matching algorithms fail
   * @private
   * @param {Error} error - Original matching error
   * @param {string} content - Content being matched
   * @param {Object} errorContext - Error context
   * @param {number} processingTime - Time spent processing
   * @returns {Promise<Array>} - Fallback matching results
   */
  async _handleMatchingError(error, content, errorContext, processingTime) {
    errorContext.fallbacksAttempted.push('error_handling');
    
    try {
      // Fallback 1: Try simple keyword matching without semantic analysis
      if (!errorContext.fallbacksAttempted.includes('simple_keyword_matching')) {
        errorContext.fallbacksAttempted.push('simple_keyword_matching');
        this._logSTACError('Attempting simple keyword matching fallback', errorContext);
        
        const simpleResults = await this._performSimpleKeywordMatching(content, errorContext);
        if (simpleResults.length > 0) {
          this._logSTACError('Simple keyword matching fallback succeeded', {
            ...errorContext,
            resultCount: simpleResults.length
          });
          return simpleResults;
        }
      }
      
      // Fallback 2: Use fallback mode if available
      if (this.fallbackMode && !errorContext.fallbacksAttempted.includes('fallback_mode')) {
        errorContext.fallbacksAttempted.push('fallback_mode');
        this._logSTACError('Attempting fallback mode matching', errorContext);
        
        const fallbackResults = await this._performFallbackMatching(content, errorContext);
        if (fallbackResults.length > 0) {
          this._logSTACError('Fallback mode matching succeeded', {
            ...errorContext,
            resultCount: fallbackResults.length
          });
          return fallbackResults;
        }
      }
      
      // Fallback 3: Return basic security scenarios based on content analysis
      if (!errorContext.fallbacksAttempted.includes('basic_scenarios')) {
        errorContext.fallbacksAttempted.push('basic_scenarios');
        this._logSTACError('Generating basic security scenarios', errorContext);
        
        const basicResults = this._generateBasicSecurityScenarios(content, errorContext);
        if (basicResults.length > 0) {
          this._logSTACError('Basic security scenarios generated', {
            ...errorContext,
            resultCount: basicResults.length
          });
          return basicResults;
        }
      }
      
      // Final fallback: Return empty results with error information
      this._logSTACError('All STAC matching fallbacks exhausted', {
        ...errorContext,
        originalError: error.message,
        processingTime
      });
      
      return [];
      
    } catch (fallbackError) {
      this._logSTACError('STAC fallback handling failed', {
        ...errorContext,
        originalError: error.message,
        fallbackError: fallbackError.message,
        processingTime
      });
      
      return [];
    }
  }
  
  /**
   * Perform simple keyword matching without semantic analysis
   * @private
   * @param {string} content - Content to match
   * @param {Object} errorContext - Error context
   * @returns {Promise<Array>} - Simple matching results
   */
  async _performSimpleKeywordMatching(content, errorContext) {
    try {
      if (!this.knowledgeBase || !this.scenarioIndex) {
        return [];
      }
      
      // Extract keywords with basic error handling
      const words = content.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 100); // Limit to first 100 words for performance
      
      const matches = new Map();
      
      for (const word of words) {
        try {
          if (this.scenarioIndex.has(word)) {
            for (const scenario of this.scenarioIndex.get(word)) {
              if (!matches.has(scenario)) {
                matches.set(scenario, {
                  scenario,
                  confidence: 0.1, // Low confidence for simple matching
                  keywordMatches: 0,
                  matchedKeywords: [],
                  source: 'simple_keyword_fallback'
                });
              }
              
              const match = matches.get(scenario);
              match.keywordMatches++;
              match.matchedKeywords.push(word);
              match.confidence = Math.min(0.5, match.keywordMatches * 0.05); // Cap at 0.5
            }
          }
        } catch (wordError) {
          // Skip problematic words
          continue;
        }
      }
      
      return Array.from(matches.values())
        .filter(match => match.keywordMatches >= 2) // Require at least 2 keyword matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5); // Limit to top 5 matches
        
    } catch (error) {
      this._logSTACError('Simple keyword matching failed', {
        ...errorContext,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Perform fallback matching using minimal knowledge base
   * @private
   * @param {string} content - Content to match
   * @param {Object} errorContext - Error context
   * @returns {Promise<Array>} - Fallback matching results
   */
  async _performFallbackMatching(content, errorContext) {
    try {
      const contentLower = content.toLowerCase();
      const matches = [];
      
      // Simple pattern matching against fallback scenarios
      const fallbackScenarios = {
        'Generic Security Analysis': {
          patterns: ['security', 'authentication', 'authorization', 'encryption', 'access'],
          confidence: 0.3
        },
        'Data Protection': {
          patterns: ['data', 'database', 'storage', 'information', 'privacy'],
          confidence: 0.25
        },
        'Input Validation': {
          patterns: ['input', 'form', 'validation', 'sanitization', 'injection'],
          confidence: 0.25
        }
      };
      
      for (const [scenario, config] of Object.entries(fallbackScenarios)) {
        let matchScore = 0;
        const matchedTerms = [];
        
        for (const pattern of config.patterns) {
          if (contentLower.includes(pattern)) {
            matchScore += 0.1;
            matchedTerms.push(pattern);
          }
        }
        
        if (matchScore > 0) {
          matches.push({
            scenario,
            confidence: Math.min(matchScore, config.confidence),
            keywordMatches: matchedTerms.length,
            matchedKeywords: matchedTerms,
            source: 'fallback_mode',
            fallbackUsed: true
          });
        }
      }
      
      return matches
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3); // Limit to top 3 fallback matches
        
    } catch (error) {
      this._logSTACError('Fallback matching failed', {
        ...errorContext,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Generate basic security scenarios when all else fails
   * @private
   * @param {string} content - Content to analyze
   * @param {Object} errorContext - Error context
   * @returns {Array} - Basic security scenarios
   */
  _generateBasicSecurityScenarios(content, errorContext) {
    try {
      const contentLower = content.toLowerCase();
      const scenarios = [];
      
      // Basic security scenario patterns
      const basicPatterns = [
        {
          pattern: /authentication|login|signin|password/,
          scenario: 'Authentication Security',
          confidence: 0.3
        },
        {
          pattern: /authorization|permission|access|role/,
          scenario: 'Authorization Security',
          confidence: 0.3
        },
        {
          pattern: /data|database|storage|information/,
          scenario: 'Data Protection',
          confidence: 0.25
        },
        {
          pattern: /input|form|validation|sanitization/,
          scenario: 'Input Validation',
          confidence: 0.25
        },
        {
          pattern: /network|communication|transmission/,
          scenario: 'Network Security',
          confidence: 0.2
        }
      ];
      
      for (const { pattern, scenario, confidence } of basicPatterns) {
        if (pattern.test(contentLower)) {
          scenarios.push({
            scenario,
            confidence,
            keywordMatches: 1,
            matchedKeywords: [pattern.source],
            source: 'basic_pattern_generation',
            fallbackUsed: true,
            warning: 'Generated from basic pattern matching due to STAC service failure'
          });
        }
      }
      
      return scenarios.slice(0, 3); // Limit to top 3 basic scenarios
      
    } catch (error) {
      this._logSTACError('Basic scenario generation failed', {
        ...errorContext,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Enhanced logging for STAC errors with performance monitoring
   * Requirements 4.1: Performance monitoring and optimization
   * @private
   * @param {string} message - Log message
   * @param {Object} context - Error context with performance data
   */
  _logSTACError(message, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: context.error ? 'ERROR' : 'INFO',
      component: 'STACService',
      message: message,
      context: {
        contentLength: context.contentLength,
        knowledgeBaseSize: this.knowledgeBase ? Object.keys(this.knowledgeBase).length : 0,
        indexSize: this.scenarioIndex ? this.scenarioIndex.size : 0,
        fallbackMode: this.fallbackMode,
        fallbacksAttempted: context.fallbacksAttempted,
        processingTime: context.processingTime,
        error: context.error,
        errorType: context.errorType,
        matchCount: context.matchCount,
        topConfidence: context.topConfidence
      }
    };
    
    // Log to console with appropriate level
    if (context.error) {
      console.error('[STACService]', message, logEntry.context);
    } else {
      // Log entry recorded
    }
    
    // Store performance metrics
    this._updatePerformanceMetrics(logEntry);
    
    // Store in session storage for debugging
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('stacServiceLogs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 100 log entries
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      sessionStorage.setItem('stacServiceLogs', JSON.stringify(existingLogs));
    } catch (storageError) {
      // Failed to store log
    }
  }
  
  /**
   * Update performance metrics for monitoring
   * @private
   * @param {Object} logEntry - Log entry with performance data
   */
  _updatePerformanceMetrics(logEntry) {
    try {
      if (!this.performanceMetrics) {
        this.performanceMetrics = {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageProcessingTime: 0,
          totalProcessingTime: 0,
          fallbackUsage: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      this.performanceMetrics.totalRequests++;
      
      if (logEntry.context.error) {
        this.performanceMetrics.failedRequests++;
      } else if (logEntry.context.matchCount !== undefined) {
        this.performanceMetrics.successfulRequests++;
      }
      
      if (logEntry.context.processingTime) {
        this.performanceMetrics.totalProcessingTime += logEntry.context.processingTime;
        this.performanceMetrics.averageProcessingTime = 
          this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalRequests;
      }
      
      if (logEntry.context.fallbacksAttempted && logEntry.context.fallbacksAttempted.length > 0) {
        this.performanceMetrics.fallbackUsage++;
      }
      
      this.performanceMetrics.lastUpdated = new Date().toISOString();
      
    } catch (error) {
      // Failed to update performance metrics
    }
  }
  
  /**
   * Get STAC service performance metrics
   * Requirements 4.1: Performance monitoring and optimization
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    if (!this.performanceMetrics) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageProcessingTime: 0,
        fallbackUsage: 0,
        successRate: 0,
        fallbackRate: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalRequests > 0 
        ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests) * 100 
        : 0,
      fallbackRate: this.performanceMetrics.totalRequests > 0
        ? (this.performanceMetrics.fallbackUsage / this.performanceMetrics.totalRequests) * 100
        : 0
    };
  }
  
  /**
   * Get STAC service logs for debugging
   * @returns {Array} - Array of log entries
   */
  getServiceLogs() {
    try {
      return JSON.parse(sessionStorage.getItem('stacServiceLogs') || '[]');
    } catch (error) {
      // Failed to retrieve logs
      return [];
    }
  }
  
  /**
   * Clear STAC service logs
   * @returns {boolean} - True if successful
   */
  clearServiceLogs() {
    try {
      sessionStorage.removeItem('stacServiceLogs');
      return true;
    } catch (error) {
      // Failed to clear logs
      return false;
    }
  }
  
  /**
   * Get fallback security requirements when main knowledge base fails
   * @private
   * @param {Array} matchedScenarios - Matched scenarios (may be from fallback)
   * @returns {Array} - Fallback security requirements
   */
  _getFallbackSecurityRequirements(matchedScenarios) {
    try {
      const fallbackRequirements = [
        {
          name: 'Basic Authentication Security',
          details: 'Implement secure authentication mechanisms to verify user identity',
          scenario: 'Authentication Security',
          threatName: 'Authentication Bypass',
          confidence: 0.4,
          priority: 0.8,
          category: 'Authentication',
          source: 'FALLBACK'
        },
        {
          name: 'Access Control Implementation',
          details: 'Implement proper authorization controls to restrict access to resources',
          scenario: 'Authorization Security',
          threatName: 'Unauthorized Access',
          confidence: 0.4,
          priority: 0.7,
          category: 'Authorization',
          source: 'FALLBACK'
        },
        {
          name: 'Input Validation',
          details: 'Validate and sanitize all user inputs to prevent injection attacks',
          scenario: 'Input Validation',
          threatName: 'Injection Attack',
          confidence: 0.3,
          priority: 0.6,
          category: 'Input Validation',
          source: 'FALLBACK'
        },
        {
          name: 'Data Protection',
          details: 'Implement encryption and secure storage for sensitive data',
          scenario: 'Data Protection',
          threatName: 'Data Exposure',
          confidence: 0.3,
          priority: 0.5,
          category: 'Data Protection',
          source: 'FALLBACK'
        }
      ];
      
      // Filter requirements based on matched scenarios if available
      if (Array.isArray(matchedScenarios) && matchedScenarios.length > 0) {
        const scenarioNames = matchedScenarios.map(m => m.scenario.toLowerCase());
        return fallbackRequirements.filter(req => 
          scenarioNames.some(name => req.scenario.toLowerCase().includes(name) || 
                                   name.includes(req.scenario.toLowerCase()))
        );
      }
      
      return fallbackRequirements;
      
    } catch (error) {
      this._logSTACError('Fallback security requirements generation failed', {
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Get fallback test cases when main knowledge base fails
   * @private
   * @param {Array} matchedScenarios - Matched scenarios (may be from fallback)
   * @returns {Array} - Fallback test cases
   */
  _getFallbackTestCases(matchedScenarios) {
    try {
      const fallbackTestCases = [
        {
          name: 'Authentication Bypass Test',
          details: 'Test for authentication bypass vulnerabilities using various techniques',
          scenario: 'Authentication Security',
          threatName: 'Authentication Bypass',
          confidence: 0.4,
          priority: 0.8,
          category: 'Penetration Testing',
          relatedRequirement: 'Basic Authentication Security',
          source: 'FALLBACK'
        },
        {
          name: 'Authorization Test',
          details: 'Test access controls to ensure proper authorization enforcement',
          scenario: 'Authorization Security',
          threatName: 'Unauthorized Access',
          confidence: 0.4,
          priority: 0.7,
          category: 'Functional Testing',
          relatedRequirement: 'Access Control Implementation',
          source: 'FALLBACK'
        },
        {
          name: 'Input Validation Test',
          details: 'Test input validation mechanisms against various injection attacks',
          scenario: 'Input Validation',
          threatName: 'Injection Attack',
          confidence: 0.3,
          priority: 0.6,
          category: 'Automated Testing',
          relatedRequirement: 'Input Validation',
          source: 'FALLBACK'
        },
        {
          name: 'Data Protection Test',
          details: 'Test data encryption and secure storage mechanisms',
          scenario: 'Data Protection',
          threatName: 'Data Exposure',
          confidence: 0.3,
          priority: 0.5,
          category: 'Manual Testing',
          relatedRequirement: 'Data Protection',
          source: 'FALLBACK'
        }
      ];
      
      // Filter test cases based on matched scenarios if available
      if (Array.isArray(matchedScenarios) && matchedScenarios.length > 0) {
        const scenarioNames = matchedScenarios.map(m => m.scenario.toLowerCase());
        return fallbackTestCases.filter(test => 
          scenarioNames.some(name => test.scenario.toLowerCase().includes(name) || 
                                   name.includes(test.scenario.toLowerCase()))
        );
      }
      
      return fallbackTestCases;
      
    } catch (error) {
      this._logSTACError('Fallback test cases generation failed', {
        error: error.message
      });
      return [];
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = STACService;
}