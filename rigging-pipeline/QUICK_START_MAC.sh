#!/bin/bash

# Quick Start Script for macOS
# Run this on your Mac, not in the container!

set -e  # Exit on error

echo "🚀 Code Platformer AI - Rigging Pipeline Setup"
echo "================================================"
echo ""

# Check if running on Mac
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: This script is designed for macOS"
    echo "   You appear to be running: $OSTYPE"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found!"
    echo "   Install with: brew install node"
    exit 1
fi

echo "✅ Node.js $(node --version)"
echo "✅ npm $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Check Blender MCP connection
echo "🔍 Checking Blender MCP server..."
if npm run check-blender 2>&1 | grep -q "✅"; then
    echo "✅ Blender MCP server is running!"
    echo ""
    
    # Ask if ready to process
    echo "Ready to process characters!"
    echo ""
    read -p "Process all 4 characters now? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "🎨 Processing characters..."
        echo "This will take about 5-10 minutes..."
        echo ""
        npm run rig -- batch
        echo ""
        echo "✅ All done! Check: ../public/assets/models/rigged/"
    else
        echo ""
        echo "To process later, run:"
        echo "  npm run rig -- batch"
    fi
else
    echo "❌ Blender MCP server not running on port 9876"
    echo ""
    echo "To start the server:"
    echo "1. Open Blender"
    echo "2. Edit → Preferences → Add-ons"
    echo "3. Find 'MCP Blender Server'"
    echo "4. Click 'Start Server' (port 9876)"
    echo ""
    echo "Then run this script again!"
    exit 1
fi
