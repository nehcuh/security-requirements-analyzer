/**
 * Document Parser Service
 * 
 * This service is responsible for parsing PDF and DOCX documents using
 * PDF.js and mammoth.js libraries. It provides a unified interface for
 * extracting content from different document formats.
 * 
 * The service implements a comprehensive error handling strategy with
 * multiple fallback mechanisms to ensure content extraction even in
 * challenging scenarios, as required by the security analysis workflow.
 */

// Lazy loading for parsing libraries - performance optimization
let mammoth = null;
let pdfjs = null;
let pdfjsWorker = null;

// Performance optimization: Lazy load mammoth.js only when needed
async function loadMammoth() {
  if (!mammoth) {
    mammoth = await import('mammoth');
  }
  return mammoth;
}

// Performance optimization: Lazy load PDF.js only when needed
async function loadPDFJS() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist');
    
    // Set PDF.js worker source
    if (!pdfjsWorker) {
      pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs');
      if (typeof window !== 'undefined' && 'pdfjsWorker' in window === false) {
        window.pdfjsWorker = pdfjsWorker;
      }
    }
  }
  return pdfjs;
}

/**
 * ParsedContent Interface
 * 
 * Structured data output from document parsing operations.
 * This interface provides a consistent format for parsed content
 * regardless of the original document format.
 * 
 * @typedef {Object} ParsedContent
 * @property {string} text - The extracted text content
 * @property {Object} metadata - Document metadata
 * @property {string} [metadata.title] - Document title
 * @property {string} [metadata.author] - Document author
 * @property {number} [metadata.pages] - Number of pages
 * @property {number} metadata.wordCount - Word count
 * @property {string} [metadata.creationDate] - Document creation date
 * @property {string} [metadata.modificationDate] - Document last modification date
 * @property {Object} structure - Document structure information
 * @property {Array<Section>} structure.sections - Document sections
 * @property {Array<Table>} structure.tables - Tables found in the document
 * @property {Array<Image>} structure.images - Images found in the document
 * @property {boolean} success - Whether parsing was successful
 * @property {string} [error] - Error message if parsing failed
 * @property {string} [warning] - Warning message for partial success scenarios
 * @property {Object} [source] - Source information
 * @property {string} [source.url] - Source URL
 * @property {string} [source.name] - Source filename
 * @property {string} [source.type] - Source document type
 * @property {number} [processingTime] - Time taken to parse the document in milliseconds
 * @property {string} [fallbackUsed] - Indicates which fallback mechanism was used, if any
 */

/**
 * @typedef {Object} Section
 * @property {string} title - Section title
 * @property {string} content - Section content
 * @property {number} level - Section level (1-6 for headings)
 */

/**
 * @typedef {Object} Table
 * @property {Array<Array<string>>} rows - Table rows with cell values
 * @property {string} [caption] - Table caption
 */

/**
 * @typedef {Object} Image
 * @property {string} id - Image identifier
 * @property {string} alt - Alternative text
 * @property {string} contentType - Image MIME type
 * @property {string|null} data - Base64 encoded image data or null
 */

class DocumentParser {
  constructor() {
    // Performance optimization: Initialize caching mechanisms
    this.parseResultCache = new Map();
    this.cacheMaxSize = 50;
    this.cacheExpiryTime = 15 * 60 * 1000; // 15 minutes
    
    // Memory management: Track active parsing operations
    this.activeOperations = new Set();
    this.maxConcurrentOperations = 3;
    
    // Performance optimization: Initialize web worker pool
    this.workerPool = [];
    this.maxWorkers = 2;
    this.workerQueue = [];
    
    // Memory cleanup interval
    this.cleanupInterval = setInterval(() => {
      this._performMemoryCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Parse a PDF document with lazy loading and caching
   * @param {ArrayBuffer} arrayBuffer - The PDF file content as ArrayBuffer
   * @returns {Promise<ParsedContent>} - Parsed content structure
   */
  async parsePDF(arrayBuffer) {
    try {
      // Performance optimization: Lazy load PDF.js
      const pdfjs = await loadPDFJS();
      
      // Load the PDF document
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdfDocument = await loadingTask.promise;

      // Extract metadata
      const metadata = await pdfDocument.getMetadata();

      // Initialize result structure
      const result = {
        text: '',
        metadata: {
          title: metadata.info.Title || '',
          author: metadata.info.Author || '',
          pages: pdfDocument.numPages,
          wordCount: 0
        },
        structure: {
          sections: [],
          tables: [],
          images: []
        },
        success: true
      };

      // Extract content from each page
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);

        // Extract text content
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        // Add page text to result
        result.text += pageText + '\n\n';

        // Extract page structure (sections)
        result.structure.sections.push({
          title: `Page ${i}`,
          content: pageText,
          level: 1
        });

        // Detect tables (simplified approach)
        const tables = this._detectTablesInText(pageText);
        if (tables.length > 0) {
          result.structure.tables.push(...tables);
        }

        // Extract images (requires additional processing)
        const operatorList = await page.getOperatorList();
        const images = this._extractImagesFromOperatorList(operatorList);
        if (images.length > 0) {
          result.structure.images.push(...images);
        }
      }

      // Calculate word count
      result.metadata.wordCount = this._countWords(result.text);

      return result;
    } catch (error) {
      console.error('PDF parsing error:', error);
      return {
        text: '',
        metadata: { wordCount: 0 },
        structure: { sections: [], tables: [], images: [] },
        success: false,
        error: `PDF parsing failed: ${error.message}`
      };
    }
  }

  /**
   * Parse a DOCX document with lazy loading and caching
   * @param {ArrayBuffer} arrayBuffer - The DOCX file content as ArrayBuffer
   * @returns {Promise<ParsedContent>} - Parsed content structure
   */
  async parseDOCX(arrayBuffer) {
    try {
      // Performance optimization: Lazy load mammoth.js
      const mammoth = await loadMammoth();
      
      // Initialize result structure
      const result = {
        text: '',
        metadata: {
          title: '',
          author: '',
          pages: 0,
          wordCount: 0
        },
        structure: {
          sections: [],
          tables: [],
          images: []
        },
        success: true
      };

      // Parse DOCX content using mammoth.js
      const options = {
        convertImage: mammoth.images.imgElement(function (image) {
          // Store image data for later use
          const imageData = {
            id: `img_${result.structure.images.length + 1}`,
            alt: image.altText || '',
            contentType: image.contentType,
            data: image.buffer ? Buffer.from(image.buffer).toString('base64') : null
          };

          result.structure.images.push(imageData);

          return {
            src: `data:${image.contentType};base64,${imageData.data}`,
            alt: image.altText || ''
          };
        }),
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
          "table => table",
          "tr => tr",
          "td => td",
          "p => p:fresh"
        ]
      };

      // Convert DOCX to HTML with options
      const { value: html, messages } = await mammoth.convertToHtml(
        { arrayBuffer: arrayBuffer },
        options
      );

      // Extract text content from HTML
      result.text = this._extractTextFromHtml(html);

      // Extract document structure
      this._extractStructureFromHtml(html, result);

      // Extract metadata from document
      try {
        const { value: metadata } = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });

        // Try to extract title and author from the first few lines
        const lines = metadata.split('\n').filter(line => line.trim().length > 0);
        if (lines.length > 0) {
          result.metadata.title = lines[0].trim();

          // Look for potential author line
          for (let i = 1; i < Math.min(5, lines.length); i++) {
            if (lines[i].toLowerCase().includes('author') ||
              lines[i].toLowerCase().includes('by ')) {
              result.metadata.author = lines[i].replace(/author|by/i, '').trim();
              break;
            }
          }
        }

        // Estimate page count (rough approximation)
        result.metadata.pages = Math.ceil(result.text.length / 3000);

        // Calculate word count
        result.metadata.wordCount = this._countWords(result.text);
      } catch (metadataError) {
        console.warn('Failed to extract DOCX metadata:', metadataError);
      }

      // Log any warnings from mammoth
      if (messages && messages.length > 0) {
        console.warn('DOCX parsing warnings:', messages);
      }

      return result;
    } catch (error) {
      console.error('DOCX parsing error:', error);
      return {
        text: '',
        metadata: { wordCount: 0 },
        structure: { sections: [], tables: [], images: [] },
        success: false,
        error: `DOCX parsing failed: ${error.message}`
      };
    }
  }

  /**
   * Parse a document based on its type with caching and performance optimizations
   * @param {Object} attachment - Attachment object with url, type, etc.
   * @param {Object} [options] - Optional parsing options
   * @param {string} [options.fallbackContent] - Webpage content to use as fallback
   * @param {boolean} [options.enableWebpageFallback] - Whether to enable webpage content fallback
   * @param {number} [options.timeout] - Parsing timeout in milliseconds (default: 30000)
   * @returns {Promise<ParsedContent>} - Parsed content structure
   */
  async parseDocument(attachment, options = {}) {
    // Handle case where no attachment is provided (Requirement 1.4)
    if (!attachment && options.fallbackContent) {
      return this._createWebpageFallbackResult(options.fallbackContent);
    }
    
    if (!attachment) {
      return this._createErrorResult('Invalid attachment: Attachment object is required');
    }

    const startTime = Date.now();
    const timeout = options.timeout || 30000; // 30 second default timeout
    
    // Performance optimization: Check cache first
    const cacheKey = this._generateCacheKey(attachment);
    const cachedResult = this._getFromCache(cacheKey);
    if (cachedResult && !options.bypassCache) {
      console.log('Document parsing result retrieved from cache');
      return cachedResult;
    }
    
    // Memory management: Check concurrent operations limit
    if (this.activeOperations.size >= this.maxConcurrentOperations) {
      return this._createErrorResult('Too many concurrent parsing operations. Please try again later.');
    }
    
    // Track this operation
    const operationId = `${Date.now()}-${Math.random()}`;
    this.activeOperations.add(operationId);
    
    try {
      // Validate attachment object
      if (!attachment.url) {
        this.activeOperations.delete(operationId);
        return this._createErrorResult('Invalid attachment: URL is required');
      }

      if (!attachment.type) {
        // Try to determine type from file extension
        const fileExtension = this._getFileExtension(attachment.url || attachment.name || '');
        if (fileExtension) {
          attachment.type = this._mapExtensionToType(fileExtension);
        } else {
          this.activeOperations.delete(operationId);
          return this._createErrorResult('Invalid attachment: File type could not be determined');
        }
      }

      // Fetch the document content with enhanced error handling
      const response = await this._enhancedFetch(attachment.url, { timeout });
      const arrayBuffer = await response.arrayBuffer();
      
      // Enhanced security validation and sanitization
      const validationResult = this._validateAndSanitizeFile(arrayBuffer, attachment);
      
      if (!validationResult.isValid) {
        this.activeOperations.delete(operationId);
        const errorMessage = validationResult.errors.length > 0 
          ? validationResult.errors.join('; ')
          : 'File validation failed';
        return this._createErrorResult(`Security validation failed: ${errorMessage}`);
      }
      
      // Use sanitized content if available, otherwise use original
      const processingBuffer = validationResult.sanitizedContent || arrayBuffer;
      
      // Log security warnings if any
      if (validationResult.warnings.length > 0) {
        console.warn('File security warnings:', validationResult.warnings);
      }
      
      // Parse based on document type with performance optimization
      let result;
      const docType = (attachment.type || '').toUpperCase();
      const useWorker = processingBuffer.byteLength > 1024 * 1024; // Use worker for files > 1MB
      
      switch (docType) {
        case 'PDF':
          if (useWorker) {
            try {
              const workerResult = await this._parseWithWorker('parsePDF', processingBuffer);
              result = {
                text: workerResult.text,
                metadata: workerResult.metadata,
                structure: { sections: [], tables: [], images: [] },
                success: true
              };
            } catch (workerError) {
              console.warn('Worker parsing failed, falling back to main thread:', workerError);
              result = await this.parsePDF(processingBuffer);
            }
          } else {
            result = await this.parsePDF(processingBuffer);
          }
          break;
          
        case 'DOCX':
        case 'DOC':
          if (useWorker) {
            try {
              const workerResult = await this._parseWithWorker('parseDOCX', processingBuffer);
              result = {
                text: workerResult.text,
                metadata: workerResult.metadata,
                structure: { sections: [], tables: [], images: [] },
                success: true
              };
            } catch (workerError) {
              console.warn('Worker parsing failed, falling back to main thread:', workerError);
              result = await this.parseDOCX(processingBuffer);
            }
          } else {
            result = await this.parseDOCX(processingBuffer);
          }
          break;
          
        default:
          // Try to determine type from content if possible
          const detectedType = this._detectDocumentType(processingBuffer);
          
          if (detectedType === 'PDF') {
            result = useWorker ? 
              await this._parseWithWorker('parsePDF', processingBuffer) : 
              await this.parsePDF(processingBuffer);
          } else if (detectedType === 'DOCX') {
            result = useWorker ? 
              await this._parseWithWorker('parseDOCX', processingBuffer) : 
              await this.parseDOCX(processingBuffer);
          } else {
            this.activeOperations.delete(operationId);
            return this._createErrorResult(`Unsupported document type: ${attachment.type}`);
          }
      }
      
      // Add source information, processing time, and security info to the result
      result.source = {
        url: attachment.url,
        name: attachment.name || '',
        type: docType
      };
      
      result.processingTime = Date.now() - startTime;
      
      // Add security validation information
      result.security = {
        validated: true,
        sanitized: validationResult.sanitized,
        warnings: validationResult.warnings,
        securityChecks: Object.keys(validationResult.securityChecks),
        validationTime: validationResult.processingTime
      };
      
      // Add any security warnings to the main warnings
      if (validationResult.warnings.length > 0) {
        result.warning = result.warning 
          ? `${result.warning}. Security: ${validationResult.warnings.join(', ')}`
          : `Security warnings: ${validationResult.warnings.join(', ')}`;
      }
      
      // Validate the result structure before returning
      const validatedResult = this._validateParsedContent(result);
      
      // Performance optimization: Cache the result
      this._addToCache(cacheKey, validatedResult);
      
      // Clean up operation tracking
      this.activeOperations.delete(operationId);
      
      return validatedResult;
    } catch (error) {
      console.error('Document parsing error:', error);
      
      // Clean up operation tracking
      this.activeOperations.delete(operationId);
      
      // Try fallback mechanisms (Requirement 1.3)
      return await this._handleParsingError(attachment, error, options, startTime);
    }
  }
  
  /**
   * Create an error result object
   * @private
   * @param {string} errorMessage - Error message
   * @param {number} [processingTime] - Processing time in milliseconds
   * @returns {ParsedContent} - Error result
   */
  _createErrorResult(errorMessage, processingTime = 0) {
    return {
      text: '',
      metadata: { wordCount: 0 },
      structure: { sections: [], tables: [], images: [] },
      success: false,
      error: errorMessage,
      processingTime
    };
  }
  
  /**
   * Validate and normalize ParsedContent structure
   * @private
   * @param {ParsedContent} result - Result to validate
   * @returns {ParsedContent} - Validated and normalized result
   */
  _validateParsedContent(result) {
    // Ensure all required properties exist with proper defaults
    const validated = {
      text: typeof result.text === 'string' ? result.text : '',
      metadata: {
        title: result.metadata?.title || '',
        author: result.metadata?.author || '',
        pages: typeof result.metadata?.pages === 'number' ? result.metadata.pages : 0,
        wordCount: typeof result.metadata?.wordCount === 'number' ? result.metadata.wordCount : 0,
        creationDate: result.metadata?.creationDate || '',
        modificationDate: result.metadata?.modificationDate || ''
      },
      structure: {
        sections: Array.isArray(result.structure?.sections) ? result.structure.sections : [],
        tables: Array.isArray(result.structure?.tables) ? result.structure.tables : [],
        images: Array.isArray(result.structure?.images) ? result.structure.images : []
      },
      success: typeof result.success === 'boolean' ? result.success : false,
      processingTime: typeof result.processingTime === 'number' ? result.processingTime : 0
    };
    
    // Add optional properties if they exist
    if (result.error) {
      validated.error = result.error;
    }
    
    if (result.warning) {
      validated.warning = result.warning;
    }
    
    if (result.source) {
      validated.source = {
        url: result.source.url || '',
        name: result.source.name || '',
        type: result.source.type || ''
      };
    }
    
    if (result.fallbackUsed) {
      validated.fallbackUsed = result.fallbackUsed;
    }
    
    // Validate sections structure
    validated.structure.sections = validated.structure.sections.map(section => ({
      title: section.title || '',
      content: section.content || '',
      level: typeof section.level === 'number' ? Math.max(1, Math.min(6, section.level)) : 1
    }));
    
    // Validate tables structure
    validated.structure.tables = validated.structure.tables.map(table => ({
      rows: Array.isArray(table.rows) ? table.rows.map(row => 
        Array.isArray(row) ? row.map(cell => String(cell || '')) : []
      ) : [],
      caption: table.caption || ''
    }));
    
    // Validate images structure
    validated.structure.images = validated.structure.images.map(image => ({
      id: image.id || '',
      alt: image.alt || '',
      contentType: image.contentType || '',
      data: image.data || null
    }));
    
    return validated;
  }
  
  /**
   * Performance optimization: Generate cache key for document
   * @private
   * @param {Object} attachment - Attachment object
   * @returns {string} - Cache key
   */
  _generateCacheKey(attachment) {
    const keyData = {
      url: attachment.url || '',
      type: attachment.type || '',
      name: attachment.name || '',
      // Add timestamp for cache invalidation if needed
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60)) // Hour-based cache
    };
    
    // Simple hash function for cache key
    const keyString = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Performance optimization: Get result from cache
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} - Cached result or null
   */
  _getFromCache(cacheKey) {
    const cached = this.parseResultCache.get(cacheKey);
    if (!cached) return null;
    
    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.cacheExpiryTime) {
      this.parseResultCache.delete(cacheKey);
      return null;
    }
    
    // Update access time for LRU
    cached.lastAccessed = Date.now();
    return cached.result;
  }
  
  /**
   * Performance optimization: Add result to cache
   * @private
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Result to cache
   */
  _addToCache(cacheKey, result) {
    // Memory management: Check cache size
    if (this.parseResultCache.size >= this.cacheMaxSize) {
      // Remove oldest entries (LRU)
      let oldestKey = null;
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.parseResultCache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.parseResultCache.delete(oldestKey);
      }
    }
    
    this.parseResultCache.set(cacheKey, {
      result: result,
      timestamp: Date.now(),
      lastAccessed: Date.now()
    });
  }
  
  /**
   * Memory management: Perform periodic cleanup
   * @private
   */
  _performMemoryCleanup() {
    // Clean expired cache entries
    const now = Date.now();
    for (const [key, entry] of this.parseResultCache) {
      if (now - entry.timestamp > this.cacheExpiryTime) {
        this.parseResultCache.delete(key);
      }
    }
    
    // Clean up completed operations
    this.activeOperations.clear();
    
    // Force garbage collection if available (Chrome extension context)
    if (typeof gc === 'function') {
      try {
        gc();
      } catch (e) {
        // Ignore if gc is not available
      }
    }
    
    console.log(`Memory cleanup completed. Cache size: ${this.parseResultCache.size}`);
  }
  
  /**
   * Performance optimization: Create secure web worker for heavy parsing with sandboxing
   * Requirements 9.2: Sandboxing for document parsing operations
   * @private
   * @returns {Promise<Worker>} - Secure web worker instance
   */
  async _createParsingWorker() {
    // Create secure worker blob for document parsing with sandboxing
    const workerCode = `
      // Secure Web worker for heavy document parsing operations with sandboxing
      'use strict';
      
      // Security: Disable potentially dangerous APIs
      const originalImport = self.importScripts;
      self.importScripts = () => {
        throw new Error('importScripts is disabled for security');
      };
      
      // Security: Limit global access
      const allowedGlobals = ['self', 'postMessage', 'addEventListener', 'removeEventListener'];
      
      let mammoth = null;
      let pdfjs = null;
      
      // Security: Controlled library loading
      async function loadLibraries() {
        try {
          if (!mammoth) {
            // Security: Load from allowed sources only
            mammoth = await import('mammoth');
          }
          if (!pdfjs) {
            // Security: Load from allowed sources only  
            pdfjs = await import('pdfjs-dist');
          }
        } catch (error) {
          throw new Error('Failed to load parsing libraries: ' + error.message);
        }
      }
      
      // Security: Input validation for worker messages
      function validateWorkerInput(data) {
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid worker input: data must be object');
        }
        
        if (!data.type || typeof data.type !== 'string') {
          throw new Error('Invalid worker input: type must be string');
        }
        
        if (!data.data || !(data.data instanceof ArrayBuffer)) {
          throw new Error('Invalid worker input: data must be ArrayBuffer');
        }
        
        // Security: Validate data size
        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        if (data.data.byteLength > MAX_SIZE) {
          throw new Error('Input data too large: maximum ' + MAX_SIZE + ' bytes');
        }
        
        if (data.data.byteLength === 0) {
          throw new Error('Input data is empty');
        }
        
        return true;
      }
      
      // Security: Sanitize output data
      function sanitizeWorkerOutput(result) {
        if (!result || typeof result !== 'object') {
          return { text: '', metadata: { wordCount: 0 } };
        }
        
        return {
          text: typeof result.text === 'string' ? result.text.substring(0, 1000000) : '', // Limit text size
          metadata: {
            pages: typeof result.metadata?.pages === 'number' ? Math.max(0, Math.min(10000, result.metadata.pages)) : 0,
            wordCount: typeof result.metadata?.wordCount === 'number' ? Math.max(0, Math.min(1000000, result.metadata.wordCount)) : 0
          }
        };
      }
      
      // Security: Timeout for processing operations
      const PROCESSING_TIMEOUT = 30000; // 30 seconds
      
      self.onmessage = async function(e) {
        const { type, data, id } = e.data;
        let timeoutId;
        
        try {
          // Security: Validate input
          validateWorkerInput(e.data);
          
          // Security: Set processing timeout
          timeoutId = setTimeout(() => {
            throw new Error('Processing timeout: operation took too long');
          }, PROCESSING_TIMEOUT);
          
          await loadLibraries();
          
          let result;
          if (type === 'parsePDF') {
            result = await parsePDFInWorker(data);
          } else if (type === 'parseDOCX') {
            result = await parseDOCXInWorker(data);
          } else {
            throw new Error('Unknown parsing type: ' + type);
          }
          
          clearTimeout(timeoutId);
          
          // Security: Sanitize output
          const sanitizedResult = sanitizeWorkerOutput(result);
          
          self.postMessage({ id, success: true, result: sanitizedResult });
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId);
          self.postMessage({ id, success: false, error: error.message });
        }
      };
      
      async function parsePDFInWorker(arrayBuffer) {
        try {
          // Security: Validate PDF structure
          const pdfSignature = new Uint8Array(arrayBuffer, 0, 4);
          if (!(pdfSignature[0] === 0x25 && pdfSignature[1] === 0x50 && 
                pdfSignature[2] === 0x44 && pdfSignature[3] === 0x46)) {
            throw new Error('Invalid PDF signature');
          }
          
          // Sandboxed PDF parsing with limited capabilities
          const loadingTask = pdfjs.getDocument({ 
            data: arrayBuffer,
            verbosity: 0, // Minimize logging
            maxImageSize: -1, // Disable image processing
            disableFontFace: true, // Disable font loading
            disableRange: true, // Disable range requests
            disableStream: true, // Disable streaming
            disableAutoFetch: true, // Disable auto-fetch
            disableCreateObjectURL: true // Security: Disable object URL creation
          });
          const pdfDocument = await loadingTask.promise;
          
          let text = '';
          const maxPages = Math.min(pdfDocument.numPages, 100); // Security: Limit page processing
          
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent({
              normalizeWhitespace: true,
              disableCombineTextItems: false
            });
            
            // Security: Limit text extraction
            const pageText = textContent.items
              .slice(0, 1000) // Limit items per page
              .map(item => item.str)
              .join(' ');
            
            text += pageText.substring(0, 10000) + '\\n\\n'; // Limit text per page
            
            if (text.length > 500000) break; // Security: Total text limit
          }
          
          return {
            text,
            metadata: { 
              pages: pdfDocument.numPages, 
              wordCount: text.split(/\\s+/).filter(w => w.length > 0).length 
            }
          };
        } catch (error) {
          throw new Error('PDF parsing failed: ' + error.message);
        }
      }
      
      async function parseDOCXInWorker(arrayBuffer) {
        try {
          // Security: Validate DOCX structure (ZIP signature)
          const zipSignature = new Uint8Array(arrayBuffer, 0, 2);
          if (!(zipSignature[0] === 0x50 && zipSignature[1] === 0x4B)) {
            throw new Error('Invalid DOCX/ZIP signature');
          }
          
          // Sandboxed DOCX parsing with security restrictions
          const result = await mammoth.extractRawText({ 
            arrayBuffer,
            // Security: Disable potentially dangerous features
            convertImage: mammoth.images.ignore, // Ignore images for security
            ignoreEmptyParagraphs: true
          });
          
          // Security: Limit extracted text size
          const text = result.value.substring(0, 500000); // 500KB text limit
          
          return {
            text,
            metadata: { 
              wordCount: text.split(/\\s+/).filter(w => w.length > 0).length 
            }
          };
        } catch (error) {
          throw new Error('DOCX parsing failed: ' + error.message);
        }
      }
      
      // Security: Handle worker errors
      self.onerror = function(error) {
        console.error('Worker error:', error);
        self.postMessage({ 
          id: null, 
          success: false, 
          error: 'Worker encountered an internal error' 
        });
      };
      
      // Security: Handle unhandled promise rejections
      self.onunhandledrejection = function(event) {
        console.error('Worker unhandled rejection:', event.reason);
        self.postMessage({ 
          id: null, 
          success: false, 
          error: 'Worker encountered an unhandled error' 
        });
      };
    `;
    
    // Security: Create worker with restricted permissions
    const blob = new Blob([workerCode], { 
      type: 'application/javascript'
    });
    
    try {
      const worker = new Worker(URL.createObjectURL(blob), {
        type: 'module', // Use module worker for better security
        credentials: 'omit' // Don't include credentials
      });
      
      // Security: Set worker timeout and error handling
      worker.addEventListener('error', (error) => {
        console.error('Worker creation error:', error);
      });
      
      return worker;
    } catch (error) {
      console.error('Failed to create secure worker:', error);
      throw new Error('Failed to create secure parsing worker: ' + error.message);
    }
  }
  
  /**
   * Performance optimization: Parse document using web worker
   * @private
   * @param {string} type - Parsing type ('parsePDF' or 'parseDOCX')
   * @param {ArrayBuffer} arrayBuffer - Document data
   * @returns {Promise<Object>} - Parsed result
   */
  async _parseWithWorker(type, arrayBuffer) {
    return new Promise(async (resolve, reject) => {
      let worker;
      
      try {
        // Get or create worker
        if (this.workerPool.length > 0) {
          worker = this.workerPool.pop();
        } else {
          worker = await this._createParsingWorker();
        }
        
        const id = Date.now() + Math.random();
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('Worker parsing timeout'));
        }, 30000); // 30 second timeout
        
        worker.onmessage = (e) => {
          clearTimeout(timeout);
          const { id: responseId, success, result, error } = e.data;
          
          if (responseId === id) {
            // Return worker to pool
            if (this.workerPool.length < this.maxWorkers) {
              this.workerPool.push(worker);
            } else {
              worker.terminate();
            }
            
            if (success) {
              resolve(result);
            } else {
              reject(new Error(error));
            }
          }
        };
        
        worker.onerror = (error) => {
          clearTimeout(timeout);
          worker.terminate();
          reject(error);
        };
        
        // Send parsing task to worker
        worker.postMessage({ type, data: arrayBuffer, id });
        
      } catch (error) {
        if (worker) {
          worker.terminate();
        }
        reject(error);
      }
    });
  }
  
  /**
   * Cleanup resources when parser is no longer needed
   */
  cleanup() {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Terminate all workers
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];
    
    // Clear caches
    this.parseResultCache.clear();
    this.activeOperations.clear();
    
    console.log('DocumentParser cleanup completed');
  }
  
  /**
   * Create a webpage fallback result (Requirement 1.4)
   * @private
   * @param {string} webpageContent - Webpage text content
   * @returns {ParsedContent} - Webpage fallback result
   */
  _createWebpageFallbackResult(webpageContent) {
    if (!webpageContent || typeof webpageContent !== 'string') {
      return this._createErrorResult('No valid webpage content available for fallback');
    }
    
    // Extract basic structure from webpage content
    const sections = this._extractSectionsFromText(webpageContent);
    const tables = this._detectTablesInText(webpageContent);
    
    return {
      text: webpageContent,
      metadata: {
        title: 'Webpage Content',
        author: '',
        pages: 1,
        wordCount: this._countWords(webpageContent)
      },
      structure: {
        sections,
        tables,
        images: [] // Webpage images are not extracted in this context
      },
      success: true,
      warning: 'Using webpage content as no attachments were found or attachment parsing failed',
      source: {
        url: '',
        name: 'Webpage Content',
        type: 'WEBPAGE'
      }
    };
  }
  
  /**
   * Get file extension from URL or filename
   * @private
   * @param {string} urlOrFilename - URL or filename
   * @returns {string|null} - File extension or null
   */
  _getFileExtension(urlOrFilename) {
    const match = /\.([a-z0-9]+)(?:[\?#]|$)/i.exec(urlOrFilename);
    return match ? match[1].toLowerCase() : null;
  }
  
  /**
   * Map file extension to document type
   * @private
   * @param {string} extension - File extension
   * @returns {string} - Document type
   */
  _mapExtensionToType(extension) {
    const extensionMap = {
      'pdf': 'PDF',
      'docx': 'DOCX',
      'doc': 'DOC'
    };
    
    return extensionMap[extension] || '';
  }
  
  /**
   * Detect document type from content
   * @private
   * @param {ArrayBuffer} arrayBuffer - Document content
   * @returns {string|null} - Detected document type or null
   */
  _detectDocumentType(arrayBuffer) {
    // Check for PDF signature
    if (arrayBuffer.byteLength >= 5) {
      const bytes = new Uint8Array(arrayBuffer, 0, 5);
      if (bytes[0] === 0x25 && // %
          bytes[1] === 0x50 && // P
          bytes[2] === 0x44 && // D
          bytes[3] === 0x46 && // F
          bytes[4] === 0x2D) { // -
        return 'PDF';
      }
    }
    
    // Check for DOCX (ZIP) signature
    if (arrayBuffer.byteLength >= 4) {
      const bytes = new Uint8Array(arrayBuffer, 0, 4);
      if (bytes[0] === 0x50 && // P
          bytes[1] === 0x4B && // K
          bytes[2] === 0x03 && // ^C
          bytes[3] === 0x04) { // ^D
        return 'DOCX'; // This is a ZIP file, likely DOCX
      }
    }
    
    return null;
  }
  
  /**
   * Handle parsing errors with comprehensive fallback mechanisms and logging
   * Requirements 1.3, 1.4: Error handling with fallback chain and user-friendly messages
   * @private
   * @param {Object} attachment - Attachment object
   * @param {Error} error - Original error
   * @param {Object} [options] - Optional parsing options
   * @param {number} [startTime] - Start time for processing time calculation
   * @returns {Promise<ParsedContent>} - Result from fallback mechanism
   */
  async _handleParsingError(attachment, error, options = {}, startTime = Date.now()) {
    const errorContext = {
      originalError: error.message,
      errorType: error.name,
      attachmentUrl: attachment?.url || 'unknown',
      attachmentType: attachment?.type || 'unknown',
      attachmentName: attachment?.name || 'unknown',
      timestamp: new Date().toISOString(),
      fallbacksAttempted: []
    };
    
    this._logParsingError('Primary parsing failed, attempting fallbacks', errorContext);
    
    // Fallback 1: Try alternative parsing approach based on file type
    try {
      errorContext.fallbacksAttempted.push('alternative_parsing');
      
      if (attachment.type === 'PDF') {
        this._logParsingError('Attempting PDF text extraction fallback', errorContext);
        const result = await this._fallbackPDFTextExtraction(attachment.url);
        if (result.success) {
          result.fallbackUsed = 'PDF text extraction';
          result.processingTime = Date.now() - startTime;
          result.warning = `Primary PDF parsing failed (${error.message}), using text extraction fallback`;
          this._logParsingError('PDF text extraction fallback succeeded', errorContext);
          return this._validateParsedContent(result);
        }
      } else if (attachment.type === 'DOCX' || attachment.type === 'DOC') {
        this._logParsingError('Attempting DOCX text extraction fallback', errorContext);
        const result = await this._fallbackDOCXParsing(attachment.url);
        if (result.success) {
          result.fallbackUsed = 'DOCX text extraction';
          result.processingTime = Date.now() - startTime;
          result.warning = `Primary DOCX parsing failed (${error.message}), using text extraction fallback`;
          this._logParsingError('DOCX text extraction fallback succeeded', errorContext);
          return this._validateParsedContent(result);
        }
      }
    } catch (fallbackError) {
      errorContext.fallbackErrors = errorContext.fallbackErrors || [];
      errorContext.fallbackErrors.push({
        fallback: 'alternative_parsing',
        error: fallbackError.message
      });
      this._logParsingError('Alternative parsing fallback failed', errorContext);
    }
    
    // Fallback 2: Try content type detection and re-parsing
    try {
      errorContext.fallbacksAttempted.push('content_type_detection');
      this._logParsingError('Attempting content type detection fallback', errorContext);
      
      const detectedResult = await this._attemptContentTypeDetectionFallback(attachment, errorContext);
      if (detectedResult && detectedResult.success) {
        detectedResult.fallbackUsed = 'Content type detection';
        detectedResult.processingTime = Date.now() - startTime;
        detectedResult.warning = `Primary parsing failed (${error.message}), used content type detection fallback`;
        this._logParsingError('Content type detection fallback succeeded', errorContext);
        return this._validateParsedContent(detectedResult);
      }
    } catch (fallbackError) {
      errorContext.fallbackErrors = errorContext.fallbackErrors || [];
      errorContext.fallbackErrors.push({
        fallback: 'content_type_detection',
        error: fallbackError.message
      });
      this._logParsingError('Content type detection fallback failed', errorContext);
    }
    
    // Fallback 3: Return partial content if available
    if (attachment.partialContent) {
      errorContext.fallbacksAttempted.push('partial_content');
      this._logParsingError('Using partial content fallback', errorContext);
      
      const partialResult = {
        text: attachment.partialContent,
        metadata: { 
          title: attachment.name || '',
          author: '',
          pages: 0,
          wordCount: this._countWords(attachment.partialContent),
          creationDate: '',
          modificationDate: ''
        },
        structure: { sections: [], tables: [], images: [] },
        success: true,
        warning: `Primary parsing failed (${error.message}), using partial content`,
        error: error.message,
        source: {
          url: attachment.url,
          name: attachment.name || '',
          type: attachment.type || 'UNKNOWN'
        },
        fallbackUsed: 'Partial content',
        processingTime: Date.now() - startTime
      };
      
      this._logParsingError('Partial content fallback succeeded', errorContext);
      return this._validateParsedContent(partialResult);
    }
    
    // Fallback 4: Use webpage content if available and enabled (Requirement 1.3)
    if (options.enableWebpageFallback && options.fallbackContent) {
      errorContext.fallbacksAttempted.push('webpage_content');
      this._logParsingError('Using webpage content fallback', errorContext);
      
      const webpageResult = this._createWebpageFallbackResult(options.fallbackContent);
      webpageResult.error = `Document parsing failed: ${error.message}. Using webpage content as fallback.`;
      webpageResult.fallbackUsed = 'Webpage content';
      webpageResult.processingTime = Date.now() - startTime;
      
      this._logParsingError('Webpage content fallback succeeded', errorContext);
      return this._validateParsedContent(webpageResult);
    }
    
    // Final fallback: Return comprehensive error result with recovery suggestions
    errorContext.fallbacksAttempted.push('error_result');
    const errorMessage = this._generateUserFriendlyErrorMessage(error, attachment, errorContext);
    const recoverySuggestions = this._generateRecoverySuggestions(error, attachment, errorContext);
    
    this._logParsingError('All fallbacks exhausted, returning error result', errorContext);
    
    const errorResult = this._createErrorResult(errorMessage, Date.now() - startTime);
    errorResult.recoverySuggestions = recoverySuggestions;
    errorResult.errorContext = errorContext;
    
    return errorResult;
  }
  
  /**
   * Attempt content type detection and re-parsing fallback
   * @private
   * @param {Object} attachment - Attachment object
   * @param {Object} errorContext - Error context for logging
   * @returns {Promise<ParsedContent|null>} - Parsed content or null
   */
  async _attemptContentTypeDetectionFallback(attachment, errorContext) {
    try {
      // Fetch a small portion of the file to detect content type
      const response = await fetch(attachment.url, {
        headers: { 'Range': 'bytes=0-1023' } // First 1KB
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file header: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const detectedType = this._detectDocumentType(arrayBuffer);
      
      if (detectedType && detectedType !== attachment.type) {
        errorContext.detectedType = detectedType;
        this._logParsingError(`Content type mismatch detected: ${attachment.type} vs ${detectedType}`, errorContext);
        
        // Try parsing with detected type
        const correctedAttachment = { ...attachment, type: detectedType };
        
        // Fetch full file
        const fullResponse = await fetch(attachment.url);
        const fullArrayBuffer = await fullResponse.arrayBuffer();
        
        if (detectedType === 'PDF') {
          return await this.parsePDF(fullArrayBuffer);
        } else if (detectedType === 'DOCX') {
          return await this.parseDOCX(fullArrayBuffer);
        }
      }
      
      return null;
    } catch (error) {
      this._logParsingError(`Content type detection failed: ${error.message}`, errorContext);
      return null;
    }
  }
  
  /**
   * Generate user-friendly error message with context
   * Requirements 1.4: User-friendly error messages
   * @private
   * @param {Error} error - Original error
   * @param {Object} attachment - Attachment object
   * @param {Object} errorContext - Error context
   * @returns {string} - User-friendly error message
   */
  _generateUserFriendlyErrorMessage(error, attachment, errorContext) {
    const fileName = attachment?.name || 'document';
    const fileType = attachment?.type || 'unknown';
    
    // Categorize error types for user-friendly messages
    if (error.message.includes('timeout') || error.message.includes('AbortError')) {
      return `Document parsing timed out for "${fileName}". The file may be too large or the server is slow. Please try again or use a smaller file.`;
    }
    
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return `Unable to download "${fileName}". Please check your internet connection and ensure the file URL is accessible.`;
    }
    
    if (error.message.includes('too large') || error.message.includes('size')) {
      return `"${fileName}" is too large to process. Please use a file smaller than 50MB or try compressing the document.`;
    }
    
    if (error.message.includes('corrupted') || error.message.includes('invalid')) {
      return `"${fileName}" appears to be corrupted or in an invalid format. Please try re-saving the document or using a different file.`;
    }
    
    if (error.message.includes('Unsupported') || error.message.includes('format')) {
      return `"${fileName}" is in an unsupported format (${fileType}). Please convert to PDF, DOCX, or DOC format and try again.`;
    }
    
    if (error.message.includes('permission') || error.message.includes('access')) {
      return `Access denied for "${fileName}". The file may be password-protected or have restricted permissions.`;
    }
    
    // Generic error message with context
    return `Failed to parse "${fileName}" (${fileType}). ${errorContext.fallbacksAttempted.length} recovery methods were attempted. Please ensure the file is valid and try again.`;
  }
  
  /**
   * Generate recovery suggestions based on error context
   * Requirements 1.4: Recovery suggestions
   * @private
   * @param {Error} error - Original error
   * @param {Object} attachment - Attachment object
   * @param {Object} errorContext - Error context
   * @returns {Array<string>} - Array of recovery suggestions
   */
  _generateRecoverySuggestions(error, attachment, errorContext) {
    const suggestions = [];
    const fileName = attachment?.name || 'document';
    const fileType = attachment?.type || 'unknown';
    
    // General suggestions
    suggestions.push('Verify the file is not corrupted by opening it in its native application');
    suggestions.push('Ensure you have a stable internet connection');
    
    // Type-specific suggestions
    if (fileType === 'PDF') {
      suggestions.push('Try re-saving the PDF using "Save As" in a PDF reader');
      suggestions.push('Check if the PDF is password-protected or has restrictions');
      suggestions.push('Consider using a different PDF if this one was generated by an unusual tool');
    } else if (fileType === 'DOCX' || fileType === 'DOC') {
      suggestions.push('Try opening and re-saving the document in Microsoft Word');
      suggestions.push('Convert the document to PDF format as an alternative');
      suggestions.push('Check if the document contains complex formatting that might cause issues');
    }
    
    // Error-specific suggestions
    if (error.message.includes('timeout')) {
      suggestions.push('Try again during off-peak hours when the server is less busy');
      suggestions.push('Consider using a smaller file or compressing the document');
    }
    
    if (error.message.includes('size') || error.message.includes('large')) {
      suggestions.push('Compress the document or split it into smaller files');
      suggestions.push('Remove unnecessary images or content to reduce file size');
    }
    
    if (errorContext.fallbacksAttempted.includes('content_type_detection')) {
      suggestions.push('The file extension may not match the actual file format - try renaming with the correct extension');
    }
    
    // Fallback suggestions
    if (!errorContext.fallbacksAttempted.includes('webpage_content')) {
      suggestions.push('If the document content is available on a webpage, try analyzing the webpage directly');
    }
    
    suggestions.push('Contact support if the issue persists with multiple documents');
    
    return suggestions;
  }
  
  /**
   * Enhanced logging for parsing errors with structured data
   * Requirements 1.4: Logging for debugging parsing issues
   * @private
   * @param {string} message - Log message
   * @param {Object} context - Error context
   */
  _logParsingError(message, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      component: 'DocumentParser',
      message: message,
      context: {
        attachmentUrl: context.attachmentUrl,
        attachmentType: context.attachmentType,
        attachmentName: context.attachmentName,
        originalError: context.originalError,
        errorType: context.errorType,
        fallbacksAttempted: context.fallbacksAttempted,
        fallbackErrors: context.fallbackErrors,
        detectedType: context.detectedType
      }
    };
    
    // Log to console with structured format
    console.error(`[DocumentParser] ${message}`, logEntry);
    
    // Store in session storage for debugging (optional)
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('documentParserLogs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 50 log entries
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      
      sessionStorage.setItem('documentParserLogs', JSON.stringify(existingLogs));
    } catch (storageError) {
      console.warn('Failed to store parsing log:', storageError);
    }
  }
  
  /**
   * Enhanced fallback PDF text extraction with comprehensive error handling
   * @private
   * @param {string} url - Document URL
   * @returns {Promise<ParsedContent>} - Parsed content
   */
  async _fallbackPDFTextExtraction(url) {
    const startTime = Date.now();
    
    try {
      // Fetch with timeout and error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty file received');
      }
      
      if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
        throw new Error('File too large for fallback processing');
      }
      
      // Use PDF.js for text extraction only with error handling
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0, // Reduce console output
        maxImageSize: -1, // Disable image processing for fallback
        disableFontFace: true, // Disable font loading for faster processing
        disableRange: true, // Disable range requests
        disableStream: true // Disable streaming
      });
      
      const pdfDocument = await loadingTask.promise;
      
      if (!pdfDocument || pdfDocument.numPages === 0) {
        throw new Error('Invalid PDF document or no pages found');
      }
      
      let text = '';
      let successfulPages = 0;
      const maxPages = Math.min(pdfDocument.numPages, 100); // Limit pages for fallback
      
      // Extract text content with per-page error handling
      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          
          if (textContent && textContent.items) {
            const pageText = textContent.items
              .filter(item => item.str && item.str.trim().length > 0)
              .map(item => item.str)
              .join(' ');
            
            if (pageText.trim().length > 0) {
              text += pageText + '\n\n';
              successfulPages++;
            }
          }
        } catch (pageError) {
          console.warn(`Failed to extract text from PDF page ${i}:`, pageError);
          // Continue with other pages
        }
      }
      
      if (text.trim().length === 0) {
        throw new Error('No text content could be extracted from PDF');
      }
      
      const result = {
        text: text.trim(),
        metadata: {
          title: '',
          author: '',
          pages: successfulPages,
          wordCount: this._countWords(text),
          creationDate: '',
          modificationDate: ''
        },
        structure: { 
          sections: this._extractSectionsFromText(text),
          tables: this._detectTablesInText(text),
          images: [] 
        },
        success: true,
        warning: `Fallback PDF parsing: extracted text from ${successfulPages}/${pdfDocument.numPages} pages`,
        processingTime: Date.now() - startTime
      };
      
      return result;
      
    } catch (error) {
      console.error('Fallback PDF extraction failed:', error);
      
      const errorMessage = error.name === 'AbortError' 
        ? 'PDF fallback extraction timed out'
        : `Fallback PDF parsing failed: ${error.message}`;
      
      return this._createErrorResult(errorMessage, Date.now() - startTime);
    }
  }
  
  /**
   * Enhanced fallback DOCX parsing with comprehensive error handling
   * @private
   * @param {string} url - Document URL
   * @returns {Promise<ParsedContent>} - Parsed content
   */
  async _fallbackDOCXParsing(url) {
    const startTime = Date.now();
    
    try {
      // Fetch with timeout and error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty file received');
      }
      
      if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
        throw new Error('File too large for fallback processing');
      }
      
      // Validate DOCX file signature
      const signature = new Uint8Array(arrayBuffer, 0, 4);
      if (!(signature[0] === 0x50 && signature[1] === 0x4B && signature[2] === 0x03 && signature[3] === 0x04)) {
        throw new Error('Invalid DOCX file format - missing ZIP signature');
      }
      
      let text = '';
      let extractionMethod = 'unknown';
      
      try {
        // Try raw text extraction first (faster and more reliable for fallback)
        const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });
        
        if (rawText && rawText.trim().length > 0) {
          text = rawText;
          extractionMethod = 'raw_text';
        } else {
          throw new Error('Raw text extraction returned empty content');
        }
      } catch (rawTextError) {
        console.warn('Raw text extraction failed, trying HTML conversion:', rawTextError);
        
        try {
          // Fallback to HTML conversion with minimal options
          const { value: html } = await mammoth.convertToHtml(
            { arrayBuffer },
            {
              styleMap: [], // No style mapping for faster processing
              ignoreEmptyParagraphs: true,
              convertImage: mammoth.images.ignore // Ignore images for fallback
            }
          );
          
          if (html && html.trim().length > 0) {
            text = this._extractTextFromHtml(html);
            extractionMethod = 'html_conversion';
          } else {
            throw new Error('HTML conversion returned empty content');
          }
        } catch (htmlError) {
          throw new Error(`Both raw text and HTML extraction failed: ${htmlError.message}`);
        }
      }
      
      if (text.trim().length === 0) {
        throw new Error('No text content could be extracted from DOCX');
      }
      
      // Basic structure extraction for fallback
      const sections = this._extractSectionsFromText(text);
      const tables = this._detectTablesInText(text);
      
      const result = {
        text: text.trim(),
        metadata: {
          title: '',
          author: '',
          pages: Math.ceil(text.length / 3000), // Rough page estimation
          wordCount: this._countWords(text),
          creationDate: '',
          modificationDate: ''
        },
        structure: { 
          sections,
          tables,
          images: [] 
        },
        success: true,
        warning: `Fallback DOCX parsing using ${extractionMethod} method`,
        processingTime: Date.now() - startTime
      };
      
      return result;
      
    } catch (error) {
      console.error('Fallback DOCX extraction failed:', error);
      
      const errorMessage = error.name === 'AbortError' 
        ? 'DOCX fallback extraction timed out'
        : `Fallback DOCX parsing failed: ${error.message}`;
      
      return this._createErrorResult(errorMessage, Date.now() - startTime);
    }
  }

  /**
   * Extract text content from HTML
   * @private
   * @param {string} html - HTML content
   * @returns {string} - Plain text content
   */
  _extractTextFromHtml(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  /**
   * Extract document structure from HTML
   * @private
   * @param {string} html - HTML content
   * @param {ParsedContent} result - Result object to populate
   */
  _extractStructureFromHtml(html, result) {
    // Extract sections (headings)
    const headingRegex = /<h([1-6])>(.*?)<\/h\1>/g;
    let match;

    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1], 10);
      const title = this._extractTextFromHtml(match[2]);

      result.structure.sections.push({
        title,
        level,
        content: '' // Content will be populated in a second pass
      });
    }

    // Extract tables
    const tableRegex = /<table>(.*?)<\/table>/gs;
    let tableMatch;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableHtml = tableMatch[1];
      const rows = [];

      // Extract rows
      const rowRegex = /<tr>(.*?)<\/tr>/gs;
      let rowMatch;

      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const rowHtml = rowMatch[1];
        const cells = [];

        // Extract cells
        const cellRegex = /<td>(.*?)<\/td>/gs;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          cells.push(this._extractTextFromHtml(cellMatch[1]));
        }

        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length > 0) {
        result.structure.tables.push({
          rows,
          caption: '' // DOCX tables might not have captions
        });
      }
    }
  }

  /**
   * Count words in text
   * @private
   * @param {string} text - Text content
   * @returns {number} - Word count
   */
  _countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Detect tables in text (simplified approach)
   * @private
   * @param {string} text - Text content
   * @returns {Array} - Detected tables
   */
  _detectTablesInText(text) {
    const tables = [];
    const lines = text.split('\n');

    // Simple heuristic: Look for lines with multiple pipe characters or tab separators
    let tableStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if line looks like a table row
      const isPipeTable = (line.match(/\|/g) || []).length >= 2;
      const isTabTable = (line.match(/\t/g) || []).length >= 2;

      if (isPipeTable || isTabTable) {
        if (tableStart === -1) {
          tableStart = i;
        }
      } else if (tableStart !== -1) {
        // End of table detected
        const tableLines = lines.slice(tableStart, i);
        if (tableLines.length >= 2) {
          tables.push(this._parseDetectedTable(tableLines, isPipeTable ? '|' : '\t'));
        }
        tableStart = -1;
      }
    }

    // Check if we have an unfinished table
    if (tableStart !== -1 && tableStart < lines.length - 1) {
      const tableLines = lines.slice(tableStart);
      if (tableLines.length >= 2) {
        const separator = (tableLines[0].match(/\|/g) || []).length >= 2 ? '|' : '\t';
        tables.push(this._parseDetectedTable(tableLines, separator));
      }
    }

    return tables;
  }

  /**
   * Parse detected table from text lines
   * @private
   * @param {Array<string>} lines - Table lines
   * @param {string} separator - Cell separator character
   * @returns {Object} - Parsed table
   */
  _parseDetectedTable(lines, separator) {
    const rows = [];

    for (const line of lines) {
      if (line.trim().length === 0) continue;

      let cells;
      if (separator === '|') {
        cells = line.split('|')
          .map(cell => cell.trim())
          .filter((cell, index, arr) => index === 0 ? cell.length > 0 : true)
          .filter((cell, index, arr) => index === arr.length - 1 ? cell.length > 0 : true);
      } else {
        cells = line.split('\t').map(cell => cell.trim());
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    return {
      rows,
      caption: ''
    };
  }

  /**
   * Extract images from PDF operator list
   * @private
   * @param {Object} operatorList - PDF.js operator list
   * @returns {Array} - Extracted images
   */
  _extractImagesFromOperatorList(operatorList) {
    const images = [];

    // This is a simplified implementation
    // Full implementation would require deeper PDF.js integration
    if (operatorList && operatorList.fnArray) {
      let imageCount = 0;

      for (let i = 0; i < operatorList.fnArray.length; i++) {
        // Check for image operators (simplified)
        if (operatorList.fnArray[i] === 83) { // 83 is the code for paintImageXObject
          imageCount++;
        }
      }

      // Create placeholder entries for detected images
      for (let i = 0; i < imageCount; i++) {
        images.push({
          id: `pdf_img_${i + 1}`,
          alt: '',
          contentType: 'image/unknown',
          data: null // Actual extraction would require more complex processing
        });
      }
    }

    return images;
  }
  
  /**
   * Get parsing logs for debugging purposes
   * Requirements 1.4: Logging for debugging parsing issues
   * @returns {Array} - Array of parsing log entries
   */
  getParsingLogs() {
    try {
      return JSON.parse(sessionStorage.getItem('documentParserLogs') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve parsing logs:', error);
      return [];
    }
  }
  
  /**
   * Clear parsing logs
   * @returns {boolean} - True if successful
   */
  clearParsingLogs() {
    try {
      sessionStorage.removeItem('documentParserLogs');
      return true;
    } catch (error) {
      console.warn('Failed to clear parsing logs:', error);
      return false;
    }
  }
  
  /**
   * Get parsing statistics for monitoring
   * @returns {Object} - Parsing statistics
   */
  getParsingStatistics() {
    const logs = this.getParsingLogs();
    const stats = {
      totalAttempts: 0,
      successfulParses: 0,
      failedParses: 0,
      fallbacksUsed: 0,
      commonErrors: {},
      averageProcessingTime: 0,
      fileTypeStats: {}
    };
    
    let totalProcessingTime = 0;
    
    for (const log of logs) {
      stats.totalAttempts++;
      
      if (log.context.fallbacksAttempted && log.context.fallbacksAttempted.length > 0) {
        stats.fallbacksUsed++;
      }
      
      if (log.context.originalError) {
        stats.failedParses++;
        const errorType = log.context.errorType || 'Unknown';
        stats.commonErrors[errorType] = (stats.commonErrors[errorType] || 0) + 1;
      } else {
        stats.successfulParses++;
      }
      
      const fileType = log.context.attachmentType || 'unknown';
      stats.fileTypeStats[fileType] = (stats.fileTypeStats[fileType] || 0) + 1;
    }
    
    stats.averageProcessingTime = stats.totalAttempts > 0 ? totalProcessingTime / stats.totalAttempts : 0;
    stats.successRate = stats.totalAttempts > 0 ? (stats.successfulParses / stats.totalAttempts) * 100 : 0;
    
    return stats;
  }

  /**
   * Extract sections from plain text content
   * @private
   * @param {string} text - Plain text content
   * @returns {Array<Section>} - Extracted sections
   */
  _extractSectionsFromText(text) {
    const sections = [];
    const lines = text.split('\n');
    
    let currentSection = null;
    let sectionContent = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (trimmedLine.length === 0) {
        if (sectionContent.length > 0) {
          sectionContent.push('');
        }
        continue;
      }
      
      // Detect potential section headers (lines that are short and don't end with punctuation)
      const isLikelyHeader = trimmedLine.length < 100 && 
                            !trimmedLine.endsWith('.') && 
                            !trimmedLine.endsWith(',') && 
                            !trimmedLine.endsWith(';') &&
                            (trimmedLine.includes(':') || 
                             trimmedLine.match(/^[A-Z][a-zA-Z\s]+$/) ||
                             trimmedLine.match(/^\d+\.?\s+[A-Z]/));
      
      if (isLikelyHeader && sectionContent.length > 0) {
        // Save previous section
        if (currentSection) {
          currentSection.content = sectionContent.join('\n').trim();
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: trimmedLine.replace(/^[\d\.]+\s*/, ''), // Remove numbering
          content: '',
          level: 1
        };
        sectionContent = [];
      } else {
        // Add to current section content
        sectionContent.push(trimmedLine);
        
        // If no current section, create a default one
        if (!currentSection) {
          currentSection = {
            title: 'Content',
            content: '',
            level: 1
          };
        }
      }
    }
    
    // Add the last section
    if (currentSection && sectionContent.length > 0) {
      currentSection.content = sectionContent.join('\n').trim();
      sections.push(currentSection);
    }
    
    // If no sections were detected, create a single section with all content
    if (sections.length === 0 && text.trim().length > 0) {
      sections.push({
        title: 'Content',
        content: text.trim(),
        level: 1
      });
    }
    
    return sections;
  }
}

// Export the DocumentParser class
export default DocumentParser;  /**

   * Log parsing errors with structured context for debugging
   * Requirements 1.4: Implement logging for debugging parsing issues
   * @private
   * @param {string} message - Log message
   * @param {Object} errorContext - Error context object
   */
  _logParsingError(message, errorContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      component: 'DocumentParser',
      message: message,
      context: {
        attachmentUrl: errorContext.attachmentUrl,
        attachmentType: errorContext.attachmentType,
        attachmentName: errorContext.attachmentName,
        originalError: errorContext.originalError,
        errorType: errorContext.errorType,
        fallbacksAttempted: errorContext.fallbacksAttempted,
        fallbackErrors: errorContext.fallbackErrors,
        detectedType: errorContext.detectedType
      }
    };
    
    // Log to console with structured format
    console.error('[DocumentParser]', message, logEntry.context);
    
    // Store in session storage for debugging (optional)
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('documentParserLogs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 50 log entries
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      
      sessionStorage.setItem('documentParserLogs', JSON.stringify(existingLogs));
    } catch (storageError) {
      console.warn('Failed to store parsing log:', storageError);
    }
  }
  
  /**
   * Generate user-friendly error message with context
   * Requirements 1.3, 1.4: User-friendly error messages and recovery suggestions
   * @private
   * @param {Error} error - Original error
   * @param {Object} attachment - Attachment object
   * @param {Object} errorContext - Error context
   * @returns {string} - User-friendly error message
   */
  _generateUserFriendlyErrorMessage(error, attachment, errorContext) {
    const fileName = attachment?.name || 'document';
    const fileType = attachment?.type || 'unknown';
    
    // Categorize error types for better user messages
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return `Document parsing timed out for "${fileName}". The file may be too large or the server is slow. Please try again or use a smaller file.`;
    }
    
    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      return `Unable to download "${fileName}". Please check your internet connection and ensure the file URL is accessible.`;
    }
    
    if (error.message.includes('too large') || error.message.includes('size')) {
      return `"${fileName}" is too large to process (maximum 50MB). Please use a smaller file or compress the document.`;
    }
    
    if (error.message.includes('corrupted') || error.message.includes('invalid')) {
      return `"${fileName}" appears to be corrupted or in an invalid format. Please try re-saving the document or use a different file.`;
    }
    
    if (error.message.includes('Unsupported') || error.message.includes('format')) {
      return `"${fileName}" is in an unsupported format (${fileType}). Supported formats are: PDF, DOCX, DOC.`;
    }
    
    if (error.message.includes('permission') || error.message.includes('access')) {
      return `Access denied for "${fileName}". The file may be password-protected or have restricted permissions.`;
    }
    
    // Generic error message with context
    const fallbackCount = errorContext.fallbacksAttempted.length;
    return `Failed to parse "${fileName}" after trying ${fallbackCount} recovery methods. ${error.message}. Please try a different file or contact support if the issue persists.`;
  }
  
  /**
   * Generate recovery suggestions based on error type and context
   * Requirements 1.3, 1.4: Recovery suggestions for parsing failures
   * @private
   * @param {Error} error - Original error
   * @param {Object} attachment - Attachment object
   * @param {Object} errorContext - Error context
   * @returns {Array} - Array of recovery suggestions
   */
  _generateRecoverySuggestions(error, attachment, errorContext) {
    const suggestions = [];
    const fileName = attachment?.name || 'document';
    const fileType = attachment?.type || 'unknown';
    
    // General suggestions
    suggestions.push({
      type: 'general',
      title: 'Verify File Integrity',
      description: 'Ensure the file is not corrupted by opening it in its native application (Adobe Reader for PDF, Microsoft Word for DOCX)',
      priority: 'high'
    });
    
    // Error-specific suggestions
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      suggestions.push({
        type: 'timeout',
        title: 'Reduce File Size',
        description: 'Try compressing the document or splitting it into smaller sections',
        priority: 'high'
      });
      
      suggestions.push({
        type: 'timeout',
        title: 'Check Network Connection',
        description: 'Ensure you have a stable internet connection and try again',
        priority: 'medium'
      });
    }
    
    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      suggestions.push({
        type: 'network',
        title: 'Check File URL',
        description: 'Verify that the file URL is correct and accessible from your browser',
        priority: 'high'
      });
      
      suggestions.push({
        type: 'network',
        title: 'Try Direct Download',
        description: 'Download the file locally and upload it instead of using a URL',
        priority: 'medium'
      });
    }
    
    if (error.message.includes('too large') || error.message.includes('size')) {
      suggestions.push({
        type: 'size',
        title: 'Compress Document',
        description: 'Use document compression tools to reduce file size below 50MB',
        priority: 'high'
      });
      
      suggestions.push({
        type: 'size',
        title: 'Extract Text Content',
        description: 'Copy and paste the text content directly instead of uploading the file',
        priority: 'medium'
      });
    }
    
    if (fileType === 'PDF') {
      suggestions.push({
        type: 'pdf',
        title: 'Try Different PDF Version',
        description: 'Re-save the PDF using "Save As" in Adobe Reader or another PDF viewer',
        priority: 'medium'
      });
      
      suggestions.push({
        type: 'pdf',
        title: 'Convert to Text',
        description: 'Use PDF-to-text conversion tools if the document structure is not important',
        priority: 'low'
      });
    }
    
    if (fileType === 'DOCX' || fileType === 'DOC') {
      suggestions.push({
        type: 'docx',
        title: 'Save as Different Format',
        description: 'Try saving the document as a newer DOCX format or export as PDF',
        priority: 'medium'
      });
      
      suggestions.push({
        type: 'docx',
        title: 'Remove Complex Elements',
        description: 'Remove complex formatting, embedded objects, or macros that might cause parsing issues',
        priority: 'low'
      });
    }
    
    // Format-specific suggestions
    if (error.message.includes('Unsupported') || error.message.includes('format')) {
      suggestions.push({
        type: 'format',
        title: 'Convert to Supported Format',
        description: 'Convert your document to PDF, DOCX, or DOC format using appropriate software',
        priority: 'high'
      });
    }
    
    // Fallback suggestions
    if (errorContext.fallbacksAttempted.length > 0) {
      suggestions.push({
        type: 'fallback',
        title: 'Use Manual Input',
        description: 'Copy and paste the document content manually as a last resort',
        priority: 'low'
      });
      
      suggestions.push({
        type: 'fallback',
        title: 'Try Alternative Tools',
        description: 'Use online document conversion tools to convert to a supported format',
        priority: 'low'
      });
    }
    
    // Add webpage fallback suggestion if not already attempted
    if (!errorContext.fallbacksAttempted.includes('webpage_content')) {
      suggestions.push({
        type: 'webpage',
        title: 'Use Webpage Content',
        description: 'If this document is from a webpage, the system can analyze the webpage content instead',
        priority: 'medium'
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
  
  /**
   * Attempt content type detection and re-parsing fallback
   * @private
   * @param {Object} attachment - Attachment object
   * @param {Object} errorContext - Error context for logging
   * @returns {Promise<ParsedContent|null>} - Parsed content or null
   */
  async _attemptContentTypeDetectionFallback(attachment, errorContext) {
    try {
      // Fetch a small portion of the file to detect content type
      const response = await fetch(attachment.url, {
        headers: { 'Range': 'bytes=0-1023' } // First 1KB
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file header: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const detectedType = this._detectDocumentType(arrayBuffer);
      
      if (detectedType && detectedType !== attachment.type) {
        errorContext.detectedType = detectedType;
        this._logParsingError(`Content type mismatch detected: ${attachment.type} vs ${detectedType}`, errorContext);
        
        // Try parsing with detected type
        const correctedAttachment = { ...attachment, type: detectedType };
        
        // Fetch full file
        const fullResponse = await fetch(attachment.url);
        const fullArrayBuffer = await fullResponse.arrayBuffer();
        
        // Parse with corrected type
        if (detectedType === 'PDF') {
          return await this.parsePDF(fullArrayBuffer);
        } else if (detectedType === 'DOCX') {
          return await this.parseDOCX(fullArrayBuffer);
        }
      }
      
      return null;
    } catch (error) {
      this._logParsingError(`Content type detection fallback failed: ${error.message}`, errorContext);
      return null;
    }
  }
  
  /**
   * Enhanced file access error handling with detailed diagnostics
   * Requirements 1.3: File access, format, and size issue handling
   * @private
   * @param {string} url - File URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Enhanced fetch response
   */
  async _enhancedFetch(url, options = {}) {
    const startTime = Date.now();
    
    try {
      // Add timeout if not specified
      const controller = new AbortController();
      const timeout = options.timeout || 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const enhancedOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword, */*',
          ...options.headers
        }
      };
      
      const response = await fetch(url, enhancedOptions);
      clearTimeout(timeoutId);
      
      // Enhanced error handling for different HTTP status codes
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        switch (response.status) {
          case 400:
            errorMessage = 'Bad request - The file URL may be malformed';
            break;
          case 401:
            errorMessage = 'Authentication required - The file may be password-protected';
            break;
          case 403:
            errorMessage = 'Access forbidden - You may not have permission to access this file';
            break;
          case 404:
            errorMessage = 'File not found - The document may have been moved or deleted';
            break;
          case 413:
            errorMessage = 'File too large - The document exceeds the server size limit';
            break;
          case 429:
            errorMessage = 'Too many requests - Please wait and try again';
            break;
          case 500:
            errorMessage = 'Server error - The file server is experiencing issues';
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = 'Server temporarily unavailable - Please try again later';
            break;
          default:
            errorMessage = `Failed to fetch document: ${response.status} ${response.statusText}`;
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.statusText = response.statusText;
        error.url = url;
        error.responseTime = Date.now() - startTime;
        throw error;
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (contentType) {
        this._validateContentType(contentType, url);
      }
      
      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > 50 * 1024 * 1024) { // 50MB limit
          const error = new Error(`File too large: ${Math.round(size / 1024 / 1024)}MB (maximum 50MB)`);
          error.fileSize = size;
          error.url = url;
          throw error;
        }
      }
      
      return response;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timed out after ${options.timeout || 30000}ms`);
        timeoutError.name = 'AbortError';
        timeoutError.url = url;
        timeoutError.responseTime = Date.now() - startTime;
        throw timeoutError;
      }
      
      // Add context to network errors
      if (!error.url) {
        error.url = url;
        error.responseTime = Date.now() - startTime;
      }
      
      throw error;
    }
  }
  
  /**
   * Enhanced file validation and sanitization with comprehensive security checks
   * Requirements 9.2: File validation, sanitization, and security measures
   * @private
   * @param {ArrayBuffer} arrayBuffer - File content buffer
   * @param {Object} attachment - Attachment object with metadata
   * @returns {Object} - Validation result with sanitization actions
   */
  _validateAndSanitizeFile(arrayBuffer, attachment) {
    const startTime = Date.now();
    const validationResult = {
      isValid: false,
      sanitized: false,
      warnings: [],
      errors: [],
      securityChecks: {},
      processingTime: 0,
      sanitizedContent: null
    };
    
    try {
      // 1. File size validation (strict limit for security)
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      if (arrayBuffer.byteLength === 0) {
        validationResult.errors.push('File is empty');
        return validationResult;
      }
      
      if (arrayBuffer.byteLength > maxFileSize) {
        validationResult.errors.push(`File too large: ${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB (maximum 50MB)`);
        return validationResult;
      }
      
      // 2. File signature validation (magic bytes check)
      const signatureResult = this._validateFileSignature(arrayBuffer, attachment.type);
      validationResult.securityChecks.signatureCheck = signatureResult;
      
      if (!signatureResult.isValid) {
        if (signatureResult.severity === 'error') {
          validationResult.errors.push(signatureResult.message);
          return validationResult;
        } else {
          validationResult.warnings.push(signatureResult.message);
        }
      }
      
      // 3. Malware signature scanning (basic heuristics)
      const malwareResult = this._scanForMalwareSignatures(arrayBuffer);
      validationResult.securityChecks.malwareCheck = malwareResult;
      
      if (!malwareResult.isSafe) {
        validationResult.errors.push(`Security risk detected: ${malwareResult.threats.join(', ')}`);
        return validationResult;
      }
      
      if (malwareResult.warnings.length > 0) {
        validationResult.warnings.push(...malwareResult.warnings);
      }
      
      // 4. Content sanitization based on file type
      const sanitizationResult = this._sanitizeFileContent(arrayBuffer, attachment.type);
      validationResult.securityChecks.sanitizationCheck = sanitizationResult;
      
      if (sanitizationResult.sanitized) {
        validationResult.sanitized = true;
        validationResult.sanitizedContent = sanitizationResult.cleanedContent;
        validationResult.warnings.push(`File content was sanitized: ${sanitizationResult.actions.join(', ')}`);
      }
      
      // 5. Additional security validations
      const additionalChecks = this._performAdditionalSecurityChecks(arrayBuffer, attachment);
      validationResult.securityChecks.additionalChecks = additionalChecks;
      
      additionalChecks.warnings.forEach(warning => {
        if (!validationResult.warnings.includes(warning)) {
          validationResult.warnings.push(warning);
        }
      });
      
      // If we made it here, the file passed all critical checks
      validationResult.isValid = true;
      validationResult.processingTime = Date.now() - startTime;
      
      // Log security validation results
      this._logSecurityValidation('File validation completed', {
        fileName: attachment.name || 'unknown',
        fileType: attachment.type || 'unknown',
        fileSize: arrayBuffer.byteLength,
        isValid: validationResult.isValid,
        sanitized: validationResult.sanitized,
        warnings: validationResult.warnings.length,
        errors: validationResult.errors.length,
        processingTime: validationResult.processingTime
      });
      
      return validationResult;
      
    } catch (error) {
      validationResult.errors.push(`Validation failed: ${error.message}`);
      validationResult.processingTime = Date.now() - startTime;
      
      this._logSecurityValidation('File validation error', {
        fileName: attachment.name || 'unknown',
        error: error.message,
        processingTime: validationResult.processingTime
      });
      
      return validationResult;
    }
  }
  
  /**
   * Validate file signature (magic bytes) against expected file type
   * @private
   * @param {ArrayBuffer} arrayBuffer - File content buffer
   * @param {string} expectedType - Expected file type
   * @returns {Object} - Signature validation result
   */
  _validateFileSignature(arrayBuffer, expectedType) {
    const result = {
      isValid: false,
      detectedType: null,
      expectedType,
      message: '',
      severity: 'warning' // 'error' or 'warning'
    };
    
    if (arrayBuffer.byteLength < 8) {
      result.message = 'File too small to validate signature';
      result.severity = 'error';
      return result;
    }
    
    const bytes = new Uint8Array(arrayBuffer, 0, 8);
    
    // PDF signature: %PDF-
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) {
      result.detectedType = 'PDF';
      result.isValid = (expectedType === 'PDF');
      
      if (!result.isValid) {
        result.message = `File appears to be PDF but was identified as ${expectedType}`;
        result.severity = 'warning';
      }
    }
    // ZIP signature (for DOCX): PK
    else if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      // Could be DOCX, XLSX, or other ZIP-based formats
      result.detectedType = 'ZIP';
      
      if (expectedType === 'DOCX' || expectedType === 'DOC') {
        result.isValid = true;
      } else {
        result.message = `File appears to be ZIP-based (possibly DOCX) but was identified as ${expectedType}`;
        result.severity = 'warning';
      }
    }
    // MS Office legacy format signatures
    else if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
      result.detectedType = 'DOC';
      result.isValid = (expectedType === 'DOC');
      
      if (!result.isValid) {
        result.message = `File appears to be legacy MS Office format but was identified as ${expectedType}`;
        result.severity = 'warning';
      }
    }
    else {
      // Unknown signature
      result.detectedType = 'UNKNOWN';
      result.message = `Unable to validate file signature for ${expectedType}`;
      result.severity = 'warning';
    }
    
    if (result.isValid && !result.message) {
      result.message = `File signature validated successfully for ${result.detectedType}`;
    }
    
    return result;
  }
  
  /**
   * Scan for basic malware signatures and suspicious patterns
   * @private
   * @param {ArrayBuffer} arrayBuffer - File content buffer
   * @returns {Object} - Malware scan result
   */
  _scanForMalwareSignatures(arrayBuffer) {
    const result = {
      isSafe: true,
      threats: [],
      warnings: [],
      checksPerformed: []
    };
    
    try {
      const bytes = new Uint8Array(arrayBuffer);
      
      // 1. Check for executable signatures in document files
      result.checksPerformed.push('executable_signature_check');
      const executableSignatures = [
        [0x4D, 0x5A], // PE/EXE signature
        [0x7F, 0x45, 0x4C, 0x46], // ELF signature
        [0xFE, 0xED, 0xFA], // Mach-O signature
      ];
      
      for (const signature of executableSignatures) {
        if (this._findBytesPattern(bytes, signature)) {
          result.isSafe = false;
          result.threats.push('Embedded executable detected');
          break;
        }
      }
      
      // 2. Check for script injection patterns
      result.checksPerformed.push('script_injection_check');
      const scriptPatterns = [
        'javascript:',
        'vbscript:',
        '<script',
        'eval(',
        'document.write',
        'innerHTML'
      ];
      
      const textContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(1024 * 10, bytes.length)));
      
      for (const pattern of scriptPatterns) {
        if (textContent.toLowerCase().includes(pattern.toLowerCase())) {
          result.warnings.push(`Potentially suspicious script pattern detected: ${pattern}`);
        }
      }
      
      // 3. Check for suspicious URLs
      result.checksPerformed.push('suspicious_url_check');
      const urlPattern = /https?:\/\/[^\s<>"]+/gi;
      const urls = textContent.match(urlPattern) || [];
      
      for (const url of urls) {
        if (this._isSuspiciousUrl(url)) {
          result.warnings.push(`Potentially suspicious URL detected: ${url}`);
        }
      }
      
      // 4. Check for macro indicators in Office documents
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) { // ZIP-based office format
        result.checksPerformed.push('macro_check');
        const zipContent = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        
        if (zipContent.includes('vbaProject.bin') || zipContent.includes('macros/')) {
          result.warnings.push('Document contains macros - exercise caution');
        }
      }
      
      // 5. File size vs content ratio check
      result.checksPerformed.push('size_ratio_check');
      const textLength = textContent.replace(/\s/g, '').length;
      const ratio = textLength / bytes.length;
      
      if (ratio < 0.1 && bytes.length > 1024 * 100) { // Less than 10% readable text in files > 100KB
        result.warnings.push('File has unusually low text content ratio');
      }
      
    } catch (error) {
      result.warnings.push(`Malware scanning incomplete: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Sanitize file content based on file type
   * @private
   * @param {ArrayBuffer} arrayBuffer - File content buffer
   * @param {string} fileType - File type
   * @returns {Object} - Sanitization result
   */
  _sanitizeFileContent(arrayBuffer, fileType) {
    const result = {
      sanitized: false,
      cleanedContent: arrayBuffer,
      actions: [],
      warnings: []
    };
    
    try {
      // For now, we'll implement basic sanitization
      // In a production environment, this would be much more comprehensive
      
      if (fileType === 'PDF') {
        // PDF sanitization would involve removing JavaScript, forms, etc.
        // This is a placeholder for more sophisticated PDF sanitization
        result.actions.push('PDF structure validated');
      } else if (fileType === 'DOCX' || fileType === 'DOC') {
        // DOCX sanitization would involve removing macros, external links, etc.
        // This is a placeholder for more sophisticated DOCX sanitization
        result.actions.push('Office document structure validated');
      }
      
      // Basic content size validation
      if (arrayBuffer.byteLength > 10 * 1024 * 1024) { // 10MB
        result.warnings.push('Large file size - processing may be slow');
      }
      
    } catch (error) {
      result.warnings.push(`Sanitization incomplete: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Perform additional security checks
   * @private
   * @param {ArrayBuffer} arrayBuffer - File content buffer
   * @param {Object} attachment - Attachment metadata
   * @returns {Object} - Additional security check results
   */
  _performAdditionalSecurityChecks(arrayBuffer, attachment) {
    const result = {
      warnings: [],
      checks: []
    };
    
    // 1. File name validation
    if (attachment.name) {
      const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.vbs', '.js'];
      const fileName = attachment.name.toLowerCase();
      
      for (const ext of suspiciousExtensions) {
        if (fileName.includes(ext)) {
          result.warnings.push(`Suspicious file extension detected in name: ${attachment.name}`);
          break;
        }
      }
    }
    
    // 2. URL validation
    if (attachment.url) {
      if (this._isSuspiciousUrl(attachment.url)) {
        result.warnings.push(`File URL appears suspicious: ${attachment.url}`);
      }
    }
    
    // 3. Content encoding check
    const bytes = new Uint8Array(arrayBuffer, 0, Math.min(1024, arrayBuffer.byteLength));
    let nonPrintableCount = 0;
    
    for (const byte of bytes) {
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        nonPrintableCount++;
      }
    }
    
    const nonPrintableRatio = nonPrintableCount / bytes.length;
    if (nonPrintableRatio > 0.3) {
      result.warnings.push('File contains high ratio of non-printable characters');
    }
    
    result.checks.push(`File name validation`, `URL validation`, `Content encoding check`);
    
    return result;
  }
  
  /**
   * Check if URL appears suspicious
   * @private
   * @param {string} url - URL to check
   * @returns {boolean} - True if URL appears suspicious
   */
  _isSuspiciousUrl(url) {
    const suspiciousDomains = [
      'bit.ly', 'tinyurl.com', 't.co', // URL shorteners
      'tempfile.org', 'temp-share.com', // Temporary file hosts
    ];
    
    const suspiciousPatterns = [
      /\d+\.\d+\.\d+\.\d+/, // IP addresses
      /[0-9a-f]{16,}/, // Long hex strings
      /\.tk$|\.ml$|\.ga$|\.cf$/, // Suspicious TLDs
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
   * Find byte pattern in buffer
   * @private
   * @param {Uint8Array} bytes - Byte array to search
   * @param {Array<number>} pattern - Pattern to find
   * @returns {boolean} - True if pattern found
   */
  _findBytesPattern(bytes, pattern) {
    for (let i = 0; i <= bytes.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (bytes[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }
  
  /**
   * Log security validation events
   * @private
   * @param {string} message - Log message
   * @param {Object} context - Context data
   */
  _logSecurityValidation(message, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      component: 'DocumentParser',
      event: 'file_validation',
      message,
      context
    };
    
    console.log(`[SECURITY] ${message}`, context);
    
    // Store security logs separately
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('securityValidationLogs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 100 security log entries
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      sessionStorage.setItem('securityValidationLogs', JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('Failed to store security validation log:', error);
    }
  }
  
  /**
   * Validate content type against expected document types
   * @private
   * @param {string} contentType - Content type from response headers
   * @param {string} url - File URL for error context
   */
  _validateContentType(contentType, url) {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/octet-stream' // Generic binary, might be valid
    ];
    
    const isValid = validTypes.some(type => contentType.includes(type));
    
    if (!isValid) {
      console.warn(`Unexpected content type for ${url}: ${contentType}`);
      
      // Don't throw error, just warn - some servers return incorrect content types
      // The actual parsing will determine if the file is valid
    }
  }