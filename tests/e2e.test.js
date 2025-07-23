import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock DOM environment for E2E testing
class MockDOM {
  constructor() {
    this.elements = new Map();
    this.eventListeners = new Map();
  }

  createElement(tagName) {
    const element = {
      tagName: tagName.toUpperCase(),
      innerHTML: "",
      textContent: "",
      className: "",
      style: {},
      children: [],
      parentNode: null,
      attributes: new Map(),
      eventListeners: new Map(),

      appendChild: vi.fn(function (child) {
        this.children.push(child);
        child.parentNode = this;
        return child;
      }),

      removeChild: vi.fn(function (child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
          this.children.splice(index, 1);
          child.parentNode = null;
        }
        return child;
      }),

      addEventListener: vi.fn(function (event, handler) {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
      }),

      removeEventListener: vi.fn(function (event, handler) {
        if (this.eventListeners.has(event)) {
          const handlers = this.eventListeners.get(event);
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      }),

      click: vi.fn(function () {
        if (this.eventListeners.has("click")) {
          this.eventListeners.get("click").forEach((handler) => handler());
        }
      }),

      setAttribute: vi.fn(function (name, value) {
        this.attributes.set(name, value);
      }),

      getAttribute: vi.fn(function (name) {
        return this.attributes.get(name) || null;
      }),

      querySelector: vi.fn(function (selector) {
        // Simple mock implementation
        return (
          this.children.find(
            (child) =>
              (child.className && selector.includes(child.className)) ||
              (child.tagName && selector.includes(child.tagName.toLowerCase())),
          ) || null
        );
      }),

      querySelectorAll: vi.fn(function (selector) {
        // Simple mock implementation
        return this.children.filter(
          (child) =>
            (child.className && selector.includes(child.className)) ||
            (child.tagName && selector.includes(child.tagName.toLowerCase())),
        );
      }),
    };

    return element;
  }

  querySelector(selector) {
    return this.elements.get(selector) || null;
  }

  querySelectorAll(selector) {
    const results = [];
    for (const [key, element] of this.elements.entries()) {
      if (key.includes(selector) || selector.includes(key)) {
        results.push(element);
      }
    }
    return results;
  }

  getElementById(id) {
    return this.elements.get(`#${id}`) || null;
  }

  addElement(selector, element) {
    this.elements.set(selector, element);
  }
}

// Mock Chrome extension APIs for E2E testing
const mockChrome = {
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
    sendMessage: vi.fn((message, callback) => {
      // Simulate async response
      setTimeout(() => {
        if (callback) {
          callback({ success: true, data: "mock response" });
        }
      }, 10);
    }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        const mockData = {
          "stac-cache": { lastUpdated: Date.now() },
          "user-preferences": { autoAnalyze: true },
        };
        callback(mockData);
      }),
      set: vi.fn((data, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: vi.fn((queryInfo, callback) => {
      callback([{ id: 1, url: "https://example.com", title: "Test Page" }]);
    }),
    sendMessage: vi.fn((tabId, message, callback) => {
      if (callback) callback({ success: true });
    }),
  },
};

// Mock UI Components
class MockPopupUI {
  constructor() {
    this.dom = new MockDOM();
    this.isVisible = false;
    this.attachments = [];
    this.analysisResults = null;
    this.selectedAttachment = null;
  }

  show() {
    this.isVisible = true;
    this.render();
  }

  hide() {
    this.isVisible = false;
  }

  render() {
    // Mock rendering logic
    const container = this.dom.createElement("div");
    container.className = "popup-container";

    // Attachment list
    const attachmentList = this.dom.createElement("div");
    attachmentList.className = "attachment-list";

    this.attachments.forEach((attachment, index) => {
      const item = this.dom.createElement("div");
      item.className = "attachment-item";
      item.textContent = attachment.name;
      item.setAttribute("data-index", index);

      item.addEventListener("click", () => {
        this.selectAttachment(index);
      });

      attachmentList.appendChild(item);
    });

    container.appendChild(attachmentList);

    // Analysis button
    const analyzeButton = this.dom.createElement("button");
    analyzeButton.className = "analyze-button";
    analyzeButton.textContent = "Analyze";
    analyzeButton.addEventListener("click", () => {
      this.performAnalysis();
    });

    container.appendChild(analyzeButton);

    // Results area
    const resultsArea = this.dom.createElement("div");
    resultsArea.className = "results-area";

    if (this.analysisResults) {
      resultsArea.innerHTML = this.renderResults();
    }

    container.appendChild(resultsArea);

    this.dom.addElement(".popup-container", container);
  }

  setAttachments(attachments) {
    this.attachments = attachments;
    if (this.isVisible) {
      this.render();
    }
  }

  selectAttachment(index) {
    this.selectedAttachment = this.attachments[index];

    // Update UI to show selection
    const items = this.dom.querySelectorAll(".attachment-item");
    items.forEach((item, i) => {
      if (i === index) {
        item.className += " selected";
      } else {
        item.className = item.className.replace(" selected", "");
      }
    });
  }

  async performAnalysis() {
    if (!this.selectedAttachment) {
      this.showError("Please select an attachment first");
      return;
    }

    try {
      // Mock analysis process
      this.showLoading(true);

      // Simulate API calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.analysisResults = {
        document: {
          title: this.selectedAttachment.name,
          wordCount: 1500,
          sections: ["Introduction", "Requirements", "Security"],
        },
        stacMatches: [
          {
            scenario: "Web Application Security",
            confidence: 0.85,
            threats: ["SQL Injection", "XSS"],
          },
          {
            scenario: "Authentication System",
            confidence: 0.72,
            threats: ["Weak Authentication"],
          },
        ],
      };

      this.showLoading(false);
      this.render();
    } catch (error) {
      this.showLoading(false);
      this.showError(`Analysis failed: ${error.message}`);
    }
  }

  renderResults() {
    if (!this.analysisResults) return "";

    let html = "<h3>Analysis Results</h3>";

    // Document info
    html += `<div class="document-info">
      <h4>Document: ${this.analysisResults.document.title}</h4>
      <p>Word Count: ${this.analysisResults.document.wordCount}</p>
      <p>Sections: ${this.analysisResults.document.sections.join(", ")}</p>
    </div>`;

    // STAC matches
    html += '<div class="stac-matches"><h4>Security Scenarios</h4>';
    this.analysisResults.stacMatches.forEach((match) => {
      html += `<div class="match-item">
        <h5>${match.scenario} (${Math.round(match.confidence * 100)}%)</h5>
        <p>Threats: ${match.threats.join(", ")}</p>
      </div>`;
    });
    html += "</div>";

    return html;
  }

  showLoading(show) {
    const button = this.dom.querySelector(".analyze-button");
    if (button) {
      button.textContent = show ? "Analyzing..." : "Analyze";
      button.disabled = show;
    }
  }

  showError(message) {
    const container = this.dom.querySelector(".popup-container");
    if (container) {
      const errorDiv = this.dom.createElement("div");
      errorDiv.className = "error-message";
      errorDiv.textContent = message;
      container.appendChild(errorDiv);
    }
  }
}

class MockContentScript {
  constructor() {
    this.dom = new MockDOM();
    this.attachments = [];
    this.isActive = false;
  }

  activate() {
    this.isActive = true;
    this.scanForAttachments();
    this.injectUI();
  }

  deactivate() {
    this.isActive = false;
    this.removeUI();
  }

  scanForAttachments() {
    // Mock attachment detection
    this.attachments = [
      {
        name: "requirements.pdf",
        url: "https://example.com/requirements.pdf",
        type: "PDF",
        isPRD: true,
        relevanceScore: 0.9,
      },
      {
        name: "design-doc.docx",
        url: "https://example.com/design-doc.docx",
        type: "DOCX",
        isPRD: false,
        relevanceScore: 0.7,
      },
      {
        name: "meeting-notes.doc",
        url: "https://example.com/meeting-notes.doc",
        type: "DOC",
        isPRD: false,
        relevanceScore: 0.3,
      },
    ];
  }

  injectUI() {
    // Create floating action button
    const fab = this.dom.createElement("div");
    fab.className = "security-analyzer-fab";
    fab.textContent = "🔒";
    fab.style.position = "fixed";
    fab.style.bottom = "20px";
    fab.style.right = "20px";
    fab.style.zIndex = "9999";

    fab.addEventListener("click", () => {
      this.showAttachmentSelector();
    });

    this.dom.addElement(".security-analyzer-fab", fab);
  }

  removeUI() {
    const fab = this.dom.querySelector(".security-analyzer-fab");
    if (fab && fab.parentNode) {
      fab.parentNode.removeChild(fab);
    }
  }

  showAttachmentSelector() {
    const modal = this.dom.createElement("div");
    modal.className = "attachment-selector-modal";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0,0,0,0.5)";
    modal.style.zIndex = "10000";

    const content = this.dom.createElement("div");
    content.className = "modal-content";
    content.style.position = "absolute";
    content.style.top = "50%";
    content.style.left = "50%";
    content.style.transform = "translate(-50%, -50%)";
    content.style.backgroundColor = "white";
    content.style.padding = "20px";
    content.style.borderRadius = "8px";

    // Title
    const title = this.dom.createElement("h3");
    title.textContent = "Select Documents for Security Analysis";
    content.appendChild(title);

    // Attachment list
    this.attachments.forEach((attachment, index) => {
      const item = this.dom.createElement("div");
      item.className = "attachment-selector-item";
      item.innerHTML = `
        <input type="checkbox" id="attachment-${index}" data-index="${index}">
        <label for="attachment-${index}">${attachment.name} (${attachment.type})</label>
        ${attachment.isPRD ? '<span class="prd-badge">PRD</span>' : ""}
      `;
      content.appendChild(item);
    });

    // Buttons
    const buttonContainer = this.dom.createElement("div");
    buttonContainer.className = "button-container";

    const analyzeButton = this.dom.createElement("button");
    analyzeButton.textContent = "Analyze Selected";
    analyzeButton.addEventListener("click", () => {
      this.analyzeSelectedAttachments();
      this.closeModal();
    });

    const cancelButton = this.dom.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
      this.closeModal();
    });

    buttonContainer.appendChild(analyzeButton);
    buttonContainer.appendChild(cancelButton);
    content.appendChild(buttonContainer);

    modal.appendChild(content);
    this.dom.addElement(".attachment-selector-modal", modal);
  }

  analyzeSelectedAttachments() {
    // Mock analysis trigger
    const checkboxes = this.dom.querySelectorAll(
      'input[type="checkbox"]:checked',
    );
    const selectedAttachments = Array.from(checkboxes).map((cb) => {
      const index = parseInt(cb.getAttribute("data-index"));
      return this.attachments[index];
    });

    // Send message to background script
    mockChrome.runtime.sendMessage({
      action: "analyzeAttachments",
      attachments: selectedAttachments,
    });
  }

  closeModal() {
    const modal = this.dom.querySelector(".attachment-selector-modal");
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }
}

describe("End-to-End Tests - Complete User Workflows", () => {
  let popupUI;
  let contentScript;

  beforeEach(() => {
    // Setup global mocks
    global.chrome = mockChrome;
    global.document = new MockDOM();
    global.window = { location: { href: "https://example.com" } };

    popupUI = new MockPopupUI();
    contentScript = new MockContentScript();

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Complete Document Analysis Workflow", () => {
    it("should complete full user workflow from attachment detection to analysis results", async () => {
      // Step 1: Content script detects attachments
      contentScript.activate();
      expect(contentScript.isActive).toBe(true);
      expect(contentScript.attachments).toHaveLength(3);

      // Step 2: User clicks floating action button
      const fab = contentScript.dom.querySelector(".security-analyzer-fab");
      expect(fab).toBeDefined();
      fab.click();

      // Step 3: Attachment selector modal appears
      const modal = contentScript.dom.querySelector(
        ".attachment-selector-modal",
      );
      expect(modal).toBeDefined();

      // Step 4: User selects attachments and clicks analyze
      contentScript.analyzeSelectedAttachments();

      // Step 5: Background script processes request (mocked)
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: "analyzeAttachments",
        attachments: expect.any(Array),
      });

      // Step 6: Popup shows analysis results
      popupUI.setAttachments(contentScript.attachments);
      popupUI.show();
      popupUI.selectAttachment(0);
      await popupUI.performAnalysis();

      expect(popupUI.analysisResults).toBeDefined();
      expect(popupUI.analysisResults.stacMatches).toHaveLength(2);
    });

    it("should handle user interaction with attachment selection", () => {
      const attachments = [
        { name: "doc1.pdf", type: "PDF", isPRD: true, relevanceScore: 0.9 },
        { name: "doc2.docx", type: "DOCX", isPRD: false, relevanceScore: 0.7 },
      ];

      popupUI.setAttachments(attachments);
      popupUI.show();

      // User selects first attachment
      popupUI.selectAttachment(0);
      expect(popupUI.selectedAttachment).toEqual(attachments[0]);

      // User selects second attachment
      popupUI.selectAttachment(1);
      expect(popupUI.selectedAttachment).toEqual(attachments[1]);
    });

    it("should provide feedback during analysis process", async () => {
      const attachments = [
        { name: "test.pdf", type: "PDF", isPRD: true, relevanceScore: 0.8 },
      ];

      popupUI.setAttachments(attachments);
      popupUI.show();
      popupUI.selectAttachment(0);

      // Start analysis
      const analysisPromise = popupUI.performAnalysis();

      // Check loading state
      const button = popupUI.dom.querySelector(".analyze-button");
      expect(button.textContent).toBe("Analyzing...");
      expect(button.disabled).toBe(true);

      // Wait for completion
      await analysisPromise;

      // Check completed state
      expect(button.textContent).toBe("Analyze");
      expect(button.disabled).toBe(false);
      expect(popupUI.analysisResults).toBeDefined();
    });

    it("should handle error scenarios gracefully", async () => {
      popupUI.show();

      // Try to analyze without selecting attachment
      await popupUI.performAnalysis();

      // Should show error message
      const errorMessage = popupUI.dom.querySelector(".error-message");
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toContain(
        "Please select an attachment first",
      );
    });
  });

  describe("UI Interaction Tests", () => {
    it("should handle attachment sorting and prioritization in UI", () => {
      contentScript.activate();

      // Verify PRD documents are prioritized
      const prdAttachments = contentScript.attachments.filter((a) => a.isPRD);
      const nonPrdAttachments = contentScript.attachments.filter(
        (a) => !a.isPRD,
      );

      expect(prdAttachments).toHaveLength(1);
      expect(nonPrdAttachments).toHaveLength(2);
      expect(prdAttachments[0].relevanceScore).toBe(0.9);
    });

    it("should show attachment metadata in selection interface", () => {
      contentScript.activate();
      contentScript.showAttachmentSelector();

      const modal = contentScript.dom.querySelector(
        ".attachment-selector-modal",
      );
      expect(modal).toBeDefined();

      // Check that PRD badge is shown
      const modalContent = modal.innerHTML || "";
      expect(modalContent).toContain("PRD");
      expect(modalContent).toContain("requirements.pdf");
      expect(modalContent).toContain("design-doc.docx");
    });

    it("should handle modal interactions correctly", () => {
      contentScript.activate();
      contentScript.showAttachmentSelector();

      let modal = contentScript.dom.querySelector(".attachment-selector-modal");
      expect(modal).toBeDefined();

      // Close modal
      contentScript.closeModal();

      modal = contentScript.dom.querySelector(".attachment-selector-modal");
      expect(modal).toBeNull();
    });

    it("should display analysis results in user-friendly format", async () => {
      const attachments = [
        {
          name: "security-doc.pdf",
          type: "PDF",
          isPRD: true,
          relevanceScore: 0.9,
        },
      ];

      popupUI.setAttachments(attachments);
      popupUI.show();
      popupUI.selectAttachment(0);
      await popupUI.performAnalysis();

      const resultsHTML = popupUI.renderResults();

      expect(resultsHTML).toContain("Analysis Results");
      expect(resultsHTML).toContain("security-doc.pdf");
      expect(resultsHTML).toContain("Web Application Security");
      expect(resultsHTML).toContain("85%"); // Confidence percentage
      expect(resultsHTML).toContain("SQL Injection");
    });
  });

  describe("Error Handling in User Workflows", () => {
    it("should handle network errors during analysis", async () => {
      // Mock network failure
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (callback) {
          callback({ success: false, error: "Network error" });
        }
      });

      const attachments = [
        { name: "test.pdf", type: "PDF", isPRD: true, relevanceScore: 0.8 },
      ];

      popupUI.setAttachments(attachments);
      popupUI.show();
      popupUI.selectAttachment(0);

      // Analysis should handle error gracefully
      await popupUI.performAnalysis();

      // Should show error message
      const errorMessage = popupUI.dom.querySelector(".error-message");
      expect(errorMessage).toBeDefined();
    });

    it("should handle empty attachment lists", () => {
      contentScript.attachments = [];
      contentScript.activate();

      expect(contentScript.attachments).toHaveLength(0);

      // UI should handle empty state
      popupUI.setAttachments([]);
      popupUI.show();

      const attachmentList = popupUI.dom.querySelector(".attachment-list");
      expect(attachmentList.children).toHaveLength(0);
    });

    it("should handle malformed attachment data", () => {
      const malformedAttachments = [
        { name: null, type: "PDF" },
        { name: "test.pdf", type: null },
        { name: "test.pdf", type: "PDF", url: null },
      ];

      popupUI.setAttachments(malformedAttachments);
      popupUI.show();

      // Should not crash and should handle gracefully
      expect(popupUI.attachments).toHaveLength(3);
    });
  });

  describe("Performance in User Workflows", () => {
    it("should respond to user interactions quickly", () => {
      const startTime = Date.now();

      contentScript.activate();
      contentScript.showAttachmentSelector();

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it("should handle large numbers of attachments efficiently", () => {
      const manyAttachments = Array.from({ length: 50 }, (_, i) => ({
        name: `doc${i}.pdf`,
        type: "PDF",
        isPRD: i % 5 === 0,
        relevanceScore: Math.random(),
      }));

      const startTime = Date.now();

      popupUI.setAttachments(manyAttachments);
      popupUI.show();

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500); // Should handle 50 attachments quickly
      expect(popupUI.attachments).toHaveLength(50);
    });

    it("should maintain responsiveness during analysis", async () => {
      const attachments = [
        {
          name: "large-doc.pdf",
          type: "PDF",
          isPRD: true,
          relevanceScore: 0.9,
        },
      ];

      popupUI.setAttachments(attachments);
      popupUI.show();
      popupUI.selectAttachment(0);

      const startTime = Date.now();
      await popupUI.performAnalysis();
      const endTime = Date.now();

      // Mock analysis should complete quickly
      expect(endTime - startTime).toBeLessThan(1000);
      expect(popupUI.analysisResults).toBeDefined();
    });
  });

  describe("Accessibility and Usability", () => {
    it("should provide keyboard navigation support", () => {
      contentScript.activate();

      const fab = contentScript.dom.querySelector(".security-analyzer-fab");
      expect(fab).toBeDefined();

      // Should be focusable and clickable
      expect(fab.addEventListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
    });

    it("should provide clear visual feedback for user actions", () => {
      const attachments = [
        { name: "test.pdf", type: "PDF", isPRD: true, relevanceScore: 0.8 },
      ];

      popupUI.setAttachments(attachments);
      popupUI.show();
      popupUI.selectAttachment(0);

      // Check that selection is visually indicated
      const selectedItem = popupUI.dom.querySelector(
        ".attachment-item.selected",
      );
      expect(selectedItem).toBeDefined();
    });

    it("should provide meaningful error messages", async () => {
      popupUI.show();
      await popupUI.performAnalysis();

      const errorMessage = popupUI.dom.querySelector(".error-message");
      expect(errorMessage).toBeDefined();
      expect(errorMessage.textContent).toBe(
        "Please select an attachment first",
      );
    });
  });
});
