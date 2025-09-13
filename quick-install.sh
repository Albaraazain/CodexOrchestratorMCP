#!/bin/bash
# One-liner installer for Claude Code Orchestrator MCP
# Usage: curl -sSL https://raw.githubusercontent.com/your-org/claude-orchestrator-mcp/main/quick-install.sh | bash

set -e

REPO="https://github.com/your-org/claude-orchestrator-mcp.git"  # Update with your repo
DIR="claude-orchestrator-mcp"

echo "🤖 Claude Code Orchestrator MCP - Quick Install"
echo "================================================"

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is required but not found"
    exit 1
fi

# Clone or update repo
if [ -d "$DIR" ]; then
    echo "📁 Updating existing installation..."
    cd "$DIR" && git pull
else
    echo "📥 Cloning repository..."
    git clone "$REPO" "$DIR"
    cd "$DIR"
fi

# Run installer
echo "🚀 Running installer..."
chmod +x install.sh
./install.sh

echo ""
echo "✅ Quick install complete!"
echo "💡 Run 'cd $DIR' to explore the installation"