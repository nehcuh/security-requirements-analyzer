#!/bin/bash

# Build script for Security Requirements Analyzer Chrome Extension
# This script prepares the extension for production deployment
# Updated for new modular directory structure

set -e  # Exit on any error

echo "🚀 Starting build process..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/
rm -f security-requirements-analyzer.zip

# Create dist directory structure
mkdir -p dist/
mkdir -p dist/src/

echo "📝 Processing files for production..."

# Copy core files
cp manifest.json dist/

# Copy modular source structure
echo "  📂 Copying core modules..."
cp -r src/core/ dist/src/core/
cp -r src/ui/ dist/src/ui/
cp -r src/integrations/ dist/src/integrations/
cp -r src/utils/ dist/src/utils/
cp -r src/background/ dist/src/background/
cp -r src/content/ dist/src/content/

# Copy config directory to UI
echo "  📂 Copying configuration..."
cp -r src/config/ dist/src/ui/config/ 2>/dev/null || echo "⚠️  No config directory found"

# Copy assets and libraries
echo "  📂 Copying assets and libraries..."
cp -r assets/ dist/assets/ 2>/dev/null || echo "⚠️  No assets directory found"
cp -r libs/ dist/libs/ 2>/dev/null || echo "⚠️  No libs directory found"

# Copy essential documentation
echo "  📂 Copying documentation..."
cp LICENSE dist/ 2>/dev/null || echo "⚠️  No LICENSE file found"
cp README.md dist/ 2>/dev/null || echo "⚠️  No README file found"

echo "🔧 Optimizing for production..."

# Remove debug code and console statements
echo "  🧹 Removing debug code..."
find dist/src -name "*.js" -type f -exec sed -i '' '/console\.debug/d' {} \;
find dist/src -name "*.js" -type f -exec sed -i '' '/Logger\.debug/d' {} \;
find dist/src -name "*.js" -type f -exec sed -i '' '/\.debug(/d' {} \;

# Remove development-only files and directories
echo "  🗑️  Removing development files..."
rm -rf dist/.tasks/ 2>/dev/null || true
rm -rf dist/tools/ 2>/dev/null || true
rm -rf dist/tests/ 2>/dev/null || true
rm -rf dist/debug-tools/ 2>/dev/null || true

# Validate critical files exist
echo "🔍 Validating build..."
if [ ! -f "dist/manifest.json" ]; then
    echo "❌ Error: manifest.json not found in dist/"
    exit 1
fi

if [ ! -f "dist/src/content/content-script.js" ]; then
    echo "❌ Error: content-script.js not found"
    exit 1
fi

if [ ! -f "dist/src/background/service-worker.js" ]; then
    echo "❌ Error: service-worker.js not found"
    exit 1
fi

if [ ! -f "dist/src/ui/popup/popup.html" ]; then
    echo "❌ Error: popup.html not found"
    exit 1
fi

echo "📦 Creating extension package..."

# Create zip file
cd dist
zip -r ../security-requirements-analyzer.zip . -x "*.DS_Store" "*.git*" "*.task*" "*.debug*"
cd ..

echo "✅ Build completed successfully!"
echo "📋 Build summary:"
echo "   - Extension package: security-requirements-analyzer.zip"
echo "   - Distribution files: dist/"
echo "   - Size: $(du -h security-requirements-analyzer.zip | cut -f1)"
echo "   - Structure: Modular (core, ui, integrations, utils)"

echo ""
echo "🎯 Next steps:"
echo "   1. Test the extension by loading dist/ folder in Chrome"
echo "   2. Verify all modular components work correctly"
echo "   3. Upload security-requirements-analyzer.zip to Chrome Web Store"
echo "   4. Test production build functionality"
