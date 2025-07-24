// Export Manager - Handles analysis result export functionality
export class ExportManager {
  constructor() {
    this.exportFormats = ['json', 'csv', 'pdf', 'txt'];
    this.lastResult = null;
  }

  /**
   * Initialize export manager
   */
  init() {
    this.bindExportEvents();
  }

  /**
   * Bind export related events
   */
  bindExportEvents() {
    const exportBtns = document.querySelectorAll('.export-btn');
    exportBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const format = e.target.dataset.format;
        if (format) {
          this.exportResults(format);
        }
      });
    });

    // Custom export button
    const customExportBtn = document.getElementById('custom-export-btn');
    if (customExportBtn) {
      customExportBtn.addEventListener('click', this.showCustomExportDialog.bind(this));
    }
  }

  /**
   * Set analysis result for export
   */
  setResult(result) {
    this.lastResult = result;
  }

  /**
   * Export results in specified format
   */
  async exportResults(format) {
    if (!this.lastResult) {
      this.showError('No analysis results to export');
      return;
    }

    try {
      let exportData;
      let filename;
      let mimeType;

      switch (format.toLowerCase()) {
        case 'json':
          exportData = this.exportAsJSON();
          filename = this.generateFilename('json');
          mimeType = 'application/json';
          break;
          
        case 'csv':
          exportData = this.exportAsCSV();
          filename = this.generateFilename('csv');
          mimeType = 'text/csv';
          break;
          
        case 'txt':
          exportData = this.exportAsText();
          filename = this.generateFilename('txt');
          mimeType = 'text/plain';
          break;
          
        case 'pdf':
          await this.exportAsPDF();
          return; // PDF export handles download separately
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      this.downloadFile(exportData, filename, mimeType);
      this.showSuccess(`Results exported as ${format.toUpperCase()}`);

    } catch (error) {
      console.error('Export failed:', error);
      this.showError(`Export failed: ${error.message}`);
    }
  }

  /**
   * Export results as JSON
   */
  exportAsJSON() {
    return JSON.stringify({
      exportInfo: {
        timestamp: new Date().toISOString(),
        format: 'JSON',
        version: '1.0'
      },
      analysisResult: this.lastResult
    }, null, 2);
  }

  /**
   * Export results as CSV
   */
  exportAsCSV() {
    const csv = [];
    
    // Header
    csv.push('Category,Type,Description,Level,Impact');
    
    // Threats
    if (this.lastResult.threats) {
      this.lastResult.threats.forEach(threat => {
        csv.push(`Threat,"${threat.type || 'N/A'}","${threat.description || 'N/A'}","${threat.level || 'N/A'}","${threat.impact || 'N/A'}"`);
      });
    }
    
    // Test Scenarios
    if (this.lastResult.testScenarios) {
      this.lastResult.testScenarios.forEach(scenario => {
        csv.push(`Test Scenario,"${scenario.category || 'N/A'}","${scenario.description || 'N/A'}","N/A","N/A"`);
      });
    }
    
    // Recommendations
    if (this.lastResult.recommendations) {
      this.lastResult.recommendations.forEach(recommendation => {
        csv.push(`Recommendation,"N/A","${recommendation}","N/A","N/A"`);
      });
    }
    
    return csv.join('\n');
  }

  /**
   * Export results as plain text
   */
  exportAsText() {
    const lines = [];
    
    lines.push('SECURITY ANALYSIS REPORT');
    lines.push('========================');
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    
    // Summary
    if (this.lastResult.summary) {
      lines.push('SUMMARY');
      lines.push('-------');
      lines.push(this.lastResult.summary);
      lines.push('');
    }
    
    // Threats
    if (this.lastResult.threats && this.lastResult.threats.length > 0) {
      lines.push('SECURITY THREATS');
      lines.push('----------------');
      this.lastResult.threats.forEach((threat, index) => {
        lines.push(`${index + 1}. ${threat.type || 'Unknown Threat'}`);
        lines.push(`   Description: ${threat.description || 'No description'}`);
        lines.push(`   Level: ${threat.level || 'Unknown'}`);
        if (threat.impact) {
          lines.push(`   Impact: ${threat.impact}`);
        }
        lines.push('');
      });
    }
    
    // Test Scenarios
    if (this.lastResult.testScenarios && this.lastResult.testScenarios.length > 0) {
      lines.push('TEST SCENARIOS');
      lines.push('--------------');
      this.lastResult.testScenarios.forEach((scenario, index) => {
        lines.push(`${index + 1}. ${scenario.category || 'General Test'}`);
        lines.push(`   ${scenario.description || 'No description'}`);
        if (scenario.steps && scenario.steps.length > 0) {
          lines.push('   Steps:');
          scenario.steps.forEach((step, stepIndex) => {
            lines.push(`     ${stepIndex + 1}. ${step}`);
          });
        }
        lines.push('');
      });
    }
    
    // Recommendations
    if (this.lastResult.recommendations && this.lastResult.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS');
      lines.push('---------------');
      this.lastResult.recommendations.forEach((recommendation, index) => {
        lines.push(`${index + 1}. ${recommendation}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Export results as PDF
   */
  async exportAsPDF() {
    // For PDF export, we'll create a formatted HTML and let the browser handle PDF generation
    const htmlContent = this.generatePDFHTML();
    
    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Trigger print dialog
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      throw new Error('Failed to open print window. Please check popup blocker settings.');
    }
  }

  /**
   * Generate HTML content for PDF export
   */
  generatePDFHTML() {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Security Analysis Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          h1 { color: #333; border-bottom: 2px solid #333; }
          h2 { color: #666; margin-top: 30px; }
          .threat-item { margin: 15px 0; padding: 10px; border-left: 4px solid #ff6b6b; }
          .scenario-item { margin: 15px 0; padding: 10px; border-left: 4px solid #4ecdc4; }
          .recommendation-item { margin: 10px 0; padding: 5px; }
          .level-high { color: #d63031; font-weight: bold; }
          .level-medium { color: #f39c12; font-weight: bold; }
          .level-low { color: #00b894; font-weight: bold; }
          @media print { 
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Security Analysis Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        
        ${this.lastResult.summary ? `
          <h2>Summary</h2>
          <p>${this.lastResult.summary}</p>
        ` : ''}
        
        ${this.generatePDFThreats()}
        ${this.generatePDFScenarios()}
        ${this.generatePDFRecommendations()}
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * Generate PDF threats section
   */
  generatePDFThreats() {
    if (!this.lastResult.threats || this.lastResult.threats.length === 0) return '';
    
    let html = '<h2>Security Threats</h2>';
    this.lastResult.threats.forEach(threat => {
      html += `
        <div class="threat-item">
          <h3>${threat.type || 'Unknown Threat'}</h3>
          <p>${threat.description || 'No description'}</p>
          ${threat.level ? `<p><strong>Level:</strong> <span class="level-${threat.level.toLowerCase()}">${threat.level}</span></p>` : ''}
          ${threat.impact ? `<p><strong>Impact:</strong> ${threat.impact}</p>` : ''}
        </div>
      `;
    });
    
    return html;
  }

  /**
   * Generate PDF scenarios section
   */
  generatePDFScenarios() {
    if (!this.lastResult.testScenarios || this.lastResult.testScenarios.length === 0) return '';
    
    let html = '<h2>Test Scenarios</h2>';
    this.lastResult.testScenarios.forEach(scenario => {
      html += `
        <div class="scenario-item">
          <h3>${scenario.category || 'General Test'}</h3>
          <p>${scenario.description || 'No description'}</p>
          ${scenario.steps && scenario.steps.length > 0 ? `
            <ol>
              ${scenario.steps.map(step => `<li>${step}</li>`).join('')}
            </ol>
          ` : ''}
        </div>
      `;
    });
    
    return html;
  }

  /**
   * Generate PDF recommendations section
   */
  generatePDFRecommendations() {
    if (!this.lastResult.recommendations || this.lastResult.recommendations.length === 0) return '';
    
    let html = '<h2>Recommendations</h2><ul>';
    this.lastResult.recommendations.forEach(recommendation => {
      html += `<li class="recommendation-item">${recommendation}</li>`;
    });
    html += '</ul>';
    
    return html;
  }

  /**
   * Generate filename for export
   */
  generateFilename(extension) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    return `security-analysis-${timestamp}.${extension}`;
  }

  /**
   * Download file
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Show custom export dialog
   */
  showCustomExportDialog() {
    // This would show a dialog with custom export options
    // For now, just show available formats
    const formats = this.exportFormats.join(', ');
    alert(`Available export formats: ${formats}`);
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const successDiv = document.getElementById('export-success');
    if (successDiv) {
      successDiv.textContent = message;
      successDiv.style.display = 'block';
      
      setTimeout(() => {
        successDiv.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.getElementById('export-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Check if results are available for export
   */
  hasResults() {
    return this.lastResult !== null;
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats() {
    return [...this.exportFormats];
  }
}

export default ExportManager;