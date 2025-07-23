import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Chrome extension APIs
global.chrome = {
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  }
};

// Mock fetch for testing
global.fetch = vi.fn();

// Mock DOM APIs
global.document = {
  querySelectorAll: vi.fn(),
  querySelector: vi.fn(),
  createElement: vi.fn(),
  addEventListener: vi.fn()
};

// Mock window object
global.window = {
  location: { href: 'https://example.com' },
  addEventListener: vi.fn()
};

// Mock classes for integration testing
class MockDocumentParser {
  async parseDocument(attachment, options = {}) {
    if (!attachment) {
      if (options.fallbackContent) {
        return {
          text: options.fallbackContent,
          metadata: { title: 'Webpage Content', wordCount: 10 },
          structure: { sections: [], tables: [], images: [] },
          success: true,
          source: { type: 'WEBPAGE' }
        };
      }
      return {
        text: '',
        metadata: { wordCount: 0 },
        structure: { sections: [], tables: [], images: [] },
        success: false,
        error: 'No attachment provided'
      };
    }

    // Simulate parsing based on file type
    if (attachment.type === 'PDF') {
      return {
        text: 'Sample PDF content about security requirements and authentication',
        metadata: { title: 'Security Requirements', wordCount: 8 },
        structure: { sections: [{ title: 'Security', content: 'Requirements', level: 1 }], tables: [], images: [] },
        success: true,
        source: { url: attachment.url, type: 'PDF' }
      };
    } else if (attachment.type === 'DOCX') {
      return {
        text: 'Sample DOCX content about user authentication and SQL injection prevention',
        metadata: { title: 'Authentication Guide', wordCount: 10 },
        structure: { sections: [{ title: 'Auth', content: 'Guide', level: 1 }], tables: [], images: [] },
        success: true,
        source: { url: attachment.url, type: 'DOCX' }
      };
    }

    return {
      text: '',
      metadata: { wordCount: 0 },
      structure: { sections: [], tables: [], images: [] },
      success: false,
      error: 'Unsupported file type'
    };
  }
}

class MockSTACService {
  constructor() {
    this.isLoaded = false;
  }

  async loadKnowledgeBase() {
    this.isLoaded = true;
  }

  isKnowledgeBaseLoaded() {
    return this.isLoaded;
  }

  async matchScenarios(content) {
    if (!this.isLoaded || !content) {
      return [];
    }

    // Simple matching logic for testing
    const matches = [];
    
    if (content.toLowerCase().includes('authentication')) {
      matches.push({
        scenario: 'Authentication System',
        confidence: 0.8,
        matchedKeywords: ['authentication'],
        matchedThreats: [{
          threat: {
            name: 'Weak Authentication',
            security_requirement: { name: 'Strong Auth', details: 'Implement MFA' },
            security_design: { name: 'Auth Design', details: 'Secure flow' },
            test_case: { name: 'Auth Testing', details: 'Test auth' }
          }
        }]
      });
    }

    if (content.toLowerCase().includes('sql') || content.toLowerCase().includes('injection')) {
      matches.push({
        scenario: 'Web Application Security',
        confidence: 0.9,
        matchedKeywords: ['sql', 'injection'],
        matchedThreats: [{
          threat: {
            name: 'SQL Injection',
            security_requirement: { name: 'Input Validation', details: 'Validate inputs' },
            security_design: { name: 'DB Security', details: 'Use prepared statements' },
            test_case: { name: 'SQL Injection Tests', details: 'Test for SQLi' }
          }
        }]
      });
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}

class MockAttachmentSorter {
  static sortByRelevance(attachments) {
    return [...attachments].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  static sortByPRDStatus(attachments) {
    return [...attachments].sort((a, b) => {
      if (a.isPRD && !b.isPRD) return -1;
      if (!a.isPRD && b.isPRD) return 1;
      return (b.relevanceScore || 0) - (a.relevanceScore || 0);
    });
  }

  static sortByFileType(attachments) {
    const typeOrder = { 'PDF': 1, 'DOCX': 2, 'DOC': 3 };
    return [...attachments].sort((a, b) => {
      const aOrder = typeOrder[a.type] || 999;
      const bOrder = typeOrder[b.type] || 999;
      return aOrder - bOrder;
    });
  }
}

// Integration workflow class
class DocumentProcessingWorkflow {
  constructor() {
    this.documentParser = new MockDocumentParser();
    this.stacService = new MockSTACService();
    this.attachmentSorter = MockAttachmentSorter;
  }

  async initialize() {
    await this.stacService.loadKnowledgeBase();
  }

  async processDocuments(attachments, options = {}) {
    const results = {
      processedDocuments: [],
      stacMatches: [],
      combinedResults: [],
      errors: []
    };

    try {
      // Sort attachments by priority
      const sortedAttachments = this.attachmentSorter.sortByPRDStatus(attachments);

      // Process each document
      for (const attachment of sortedAttachments) {
        try {
          // Parse document
          const parseResult = await this.documentParser.parseDocument(attachment, options);
          results.processedDocuments.push({
            attachment,
            parseResult
          });

          // If parsing successful, get STAC matches
          if (parseResult.success && parseResult.text) {
            const stacMatches = await this.stacService.matchScenarios(parseResult.text);
            results.stacMatches.push({
              attachment,
              matches: stacMatches
            });

            // Combine results
            results.combinedResults.push({
              attachment,
              document: parseResult,
              stacMatches,
              combinedScore: this.calculateCombinedScore(parseResult, stacMatches)
            });
          }
        } catch (error) {
          results.errors.push({
            attachment,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      results.errors.push({ error: error.message });
      return results;
    }
  }

  calculateCombinedScore(parseResult, stacMatches) {
    const documentScore = parseResult.metadata.wordCount > 0 ? 0.3 : 0;
    const stacScore = stacMatches.length > 0 ? stacMatches[0].confidence * 0.7 : 0;
    return documentScore + stacScore;
  }
}

describe('Integration Tests - Complete Document Processing Workflow', () => {
  let workflow;
  
  beforeEach(async () => {
    workflow = new DocumentProcessingWorkflow();
    await workflow.initialize();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Document Processing', () => {
    it('should process PDF documents through complete workflow', async () => {
      const attachments = [{
        url: 'https://example.com/security-requirements.pdf',
        type: 'PDF',
        name: 'security-requirements.pdf',
        isPRD: true,
        relevanceScore: 0.9
      }];

      const results = await workflow.processDocuments(attachments);

      expect(results.processedDocuments).toHaveLength(1);
      expect(results.processedDocuments[0].parseResult.success).toBe(true);
      expect(results.stacMatches).toHaveLength(1);
      expect(results.stacMatches[0].matches.length).toBeGreaterThan(0);
      expect(results.combinedResults).toHaveLength(1);
      expect(results.errors).toHaveLength(0);
    });

    it('should process DOCX documents through complete workflow', async () => {
      const attachments = [{
        url: 'https://example.com/auth-guide.docx',
        type: 'DOCX',
        name: 'auth-guide.docx',
        isPRD: false,
        relevanceScore: 0.7
      }];

      const results = await workflow.processDocuments(attachments);

      expect(results.processedDocuments).toHaveLength(1);
      expect(results.processedDocuments[0].parseResult.success).toBe(true);
      expect(results.stacMatches).toHaveLength(1);
      expect(results.combinedResults).toHaveLength(1);
      expect(results.combinedResults[0].combinedScore).toBeGreaterThan(0);
    });

    it('should handle multiple documents with different priorities', async () => {
      const attachments = [
        {
          url: 'https://example.com/low-priority.pdf',
          type: 'PDF',
          name: 'low-priority.pdf',
          isPRD: false,
          relevanceScore: 0.3
        },
        {
          url: 'https://example.com/high-priority.docx',
          type: 'DOCX',
          name: 'high-priority.docx',
          isPRD: true,
          relevanceScore: 0.9
        }
      ];

      const results = await workflow.processDocuments(attachments);

      expect(results.processedDocuments).toHaveLength(2);
      // PRD document should be processed first
      expect(results.processedDocuments[0].attachment.isPRD).toBe(true);
      expect(results.processedDocuments[1].attachment.isPRD).toBe(false);
    });

    it('should combine STAC and AI results effectively', async () => {
      const attachments = [{
        url: 'https://example.com/security-doc.pdf',
        type: 'PDF',
        name: 'security-doc.pdf',
        isPRD: true,
        relevanceScore: 0.8
      }];

      const results = await workflow.processDocuments(attachments);

      expect(results.combinedResults).toHaveLength(1);
      const combined = results.combinedResults[0];
      
      expect(combined.document).toBeDefined();
      expect(combined.stacMatches).toBeDefined();
      expect(combined.combinedScore).toBeGreaterThan(0);
      expect(combined.attachment).toBeDefined();
    });
  });

  describe('Error Handling and Fallback Scenarios', () => {
    it('should handle document parsing failures gracefully', async () => {
      const attachments = [{
        url: 'https://example.com/unsupported.txt',
        type: 'TXT',
        name: 'unsupported.txt',
        isPRD: false,
        relevanceScore: 0.5
      }];

      const results = await workflow.processDocuments(attachments);

      expect(results.processedDocuments).toHaveLength(1);
      expect(results.processedDocuments[0].parseResult.success).toBe(false);
      expect(results.stacMatches).toHaveLength(0); // No STAC matching for failed parsing
      expect(results.combinedResults).toHaveLength(0);
    });

    it('should use webpage content as fallback when no attachments available', async () => {
      const attachments = [];
      const options = {
        fallbackContent: 'This webpage contains information about authentication security and SQL injection prevention'
      };

      const results = await workflow.processDocuments(attachments, options);

      // Should process fallback content
      expect(results.processedDocuments).toHaveLength(0);
      
      // Test fallback directly
      const fallbackResult = await workflow.documentParser.parseDocument(null, options);
      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.source.type).toBe('WEBPAGE');
    });

    it('should handle STAC service failures gracefully', async () => {
      // Simulate STAC service failure
      workflow.stacService.isLoaded = false;

      const attachments = [{
        url: 'https://example.com/test.pdf',
        type: 'PDF',
        name: 'test.pdf',
        isPRD: true,
        relevanceScore: 0.8
      }];

      const results = await workflow.processDocuments(attachments);

      expect(results.processedDocuments).toHaveLength(1);
      expect(results.processedDocuments[0].parseResult.success).toBe(true);
      expect(results.stacMatches).toHaveLength(1);
      expect(results.stacMatches[0].matches).toHaveLength(0); // No matches due to service failure
    });

    it('should collect and report errors appropriately', async () => {
      const attachments = [
        {
          url: 'https://example.com/valid.pdf',
          type: 'PDF',
          name: 'valid.pdf',
          isPRD: true,
          relevanceScore: 0.8
        },
        {
          url: 'https://example.com/invalid.xyz',
          type: 'XYZ',
          name: 'invalid.xyz',
          isPRD: false,
          relevanceScore: 0.3
        }
      ];

      const results = await workflow.processDocuments(attachments);

      expect(results.processedDocuments).toHaveLength(2);
      expect(results.processedDocuments[0].parseResult.success).toBe(true);
      expect(results.processedDocuments[1].parseResult.success).toBe(false);
      expect(results.errors).toHaveLength(0); // Errors are handled, not thrown
    });
  });

  describe('UI Interaction Tests', () => {
    it('should handle attachment selection UI interactions', () => {
      const attachments = [
        { name: 'doc1.pdf', type: 'PDF', relevanceScore: 0.9 },
        { name: 'doc2.docx', type: 'DOCX', relevanceScore: 0.7 },
        { name: 'doc3.doc', type: 'DOC', relevanceScore: 0.5 }
      ];

      // Test sorting functionality
      const sortedByRelevance = MockAttachmentSorter.sortByRelevance(attachments);
      expect(sortedByRelevance[0].relevanceScore).toBe(0.9);
      expect(sortedByRelevance[2].relevanceScore).toBe(0.5);

      const sortedByType = MockAttachmentSorter.sortByFileType(attachments);
      expect(sortedByType[0].type).toBe('PDF');
      expect(sortedByType[1].type).toBe('DOCX');
      expect(sortedByType[2].type).toBe('DOC');
    });

    it('should prioritize PRD documents in UI', () => {
      const attachments = [
        { name: 'regular.pdf', type: 'PDF', isPRD: false, relevanceScore: 0.9 },
        { name: 'prd.docx', type: 'DOCX', isPRD: true, relevanceScore: 0.7 }
      ];

      const sorted = MockAttachmentSorter.sortByPRDStatus(attachments);
      
      expect(sorted[0].isPRD).toBe(true);
      expect(sorted[0].name).toBe('prd.docx');
      expect(sorted[1].isPRD).toBe(false);
      expect(sorted[1].name).toBe('regular.pdf');
    });

    it('should handle empty attachment lists', () => {
      const emptyAttachments = [];
      
      const sortedByRelevance = MockAttachmentSorter.sortByRelevance(emptyAttachments);
      const sortedByPRD = MockAttachmentSorter.sortByPRDStatus(emptyAttachments);
      const sortedByType = MockAttachmentSorter.sortByFileType(emptyAttachments);
      
      expect(sortedByRelevance).toHaveLength(0);
      expect(sortedByPRD).toHaveLength(0);
      expect(sortedByType).toHaveLength(0);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should process multiple documents within reasonable time', async () => {
      const attachments = Array.from({ length: 5 }, (_, i) => ({
        url: `https://example.com/doc${i}.pdf`,
        type: 'PDF',
        name: `doc${i}.pdf`,
        isPRD: i % 2 === 0,
        relevanceScore: 0.5 + (i * 0.1)
      }));

      const startTime = Date.now();
      const results = await workflow.processDocuments(attachments);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.processedDocuments).toHaveLength(5);
      expect(results.combinedResults).toHaveLength(5);
    });

    it('should handle concurrent processing efficiently', async () => {
      const attachmentSets = [
        [{ url: 'https://example.com/set1.pdf', type: 'PDF', name: 'set1.pdf' }],
        [{ url: 'https://example.com/set2.docx', type: 'DOCX', name: 'set2.docx' }],
        [{ url: 'https://example.com/set3.pdf', type: 'PDF', name: 'set3.pdf' }]
      ];

      const startTime = Date.now();
      const promises = attachmentSets.map(set => workflow.processDocuments(set));
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.processedDocuments).toHaveLength(1);
      });
    });
  });

  describe('Data Flow Integration Tests', () => {
    it('should maintain data integrity through the entire pipeline', async () => {
      const attachment = {
        url: 'https://example.com/security-requirements.pdf',
        type: 'PDF',
        name: 'security-requirements.pdf',
        isPRD: true,
        relevanceScore: 0.9
      };

      const results = await workflow.processDocuments([attachment]);

      // Verify data flows correctly through each stage
      const processed = results.processedDocuments[0];
      const stacMatch = results.stacMatches[0];
      const combined = results.combinedResults[0];

      // Check attachment data is preserved
      expect(processed.attachment).toEqual(attachment);
      expect(stacMatch.attachment).toEqual(attachment);
      expect(combined.attachment).toEqual(attachment);

      // Check document parsing results are preserved
      expect(combined.document).toEqual(processed.parseResult);

      // Check STAC matches are preserved
      expect(combined.stacMatches).toEqual(stacMatch.matches);

      // Check combined score is calculated
      expect(typeof combined.combinedScore).toBe('number');
      expect(combined.combinedScore).toBeGreaterThan(0);
    });

    it('should handle partial failures without corrupting data', async () => {
      const attachments = [
        {
          url: 'https://example.com/valid.pdf',
          type: 'PDF',
          name: 'valid.pdf',
          isPRD: true,
          relevanceScore: 0.8
        },
        {
          url: 'https://example.com/invalid.xyz',
          type: 'XYZ',
          name: 'invalid.xyz',
          isPRD: false,
          relevanceScore: 0.3
        }
      ];

      const results = await workflow.processDocuments(attachments);

      // Valid document should be processed successfully
      expect(results.processedDocuments).toHaveLength(2);
      expect(results.processedDocuments[0].parseResult.success).toBe(true);
      expect(results.processedDocuments[1].parseResult.success).toBe(false);

      // Only valid document should have STAC matches and combined results
      expect(results.stacMatches).toHaveLength(1);
      expect(results.combinedResults).toHaveLength(1);

      // Data integrity should be maintained
      expect(results.combinedResults[0].attachment.name).toBe('valid.pdf');
    });
  });
});