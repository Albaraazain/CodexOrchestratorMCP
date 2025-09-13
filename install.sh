#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# 🤖 Claude Code Orchestrator MCP - One-Click Installer
# ═══════════════════════════════════════════════════════════════════

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
header() { echo -e "\n${PURPLE}═══ $1 ═══${NC}\n"; }

# Detect OS for Claude path recommendations
detect_os() {
    case "$OSTYPE" in
        darwin*)  echo "macOS" ;;
        linux*)   echo "Linux" ;;
        msys*)    echo "Windows" ;;
        cygwin*)  echo "Windows" ;;
        *)        echo "Unknown" ;;
    esac
}

OS=$(detect_os)

header "🚀 Installing Claude Code Orchestrator MCP"
echo -e "${CYAN}This will set up MCP server for headless Claude agent orchestration${NC}\n"

# 1. Check Prerequisites
header "🔍 Checking Prerequisites"

# Check Python
if ! command -v python3 &> /dev/null; then
    error "Python 3 is required but not installed"
    echo "Please install Python 3.8+ from https://python.org"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
log "Found Python $PYTHON_VERSION"

# Check Claude CLI
if ! command -v claude &> /dev/null; then
    warning "Claude CLI not found in PATH"
    echo "  The MCP server will work, but headless agents require Claude CLI"
    echo "  Install from: https://claude.ai/download"
    echo ""
else
    success "Claude CLI found: $(which claude)"
fi

# Check tmux (required for headless agents)
if ! command -v tmux &> /dev/null; then
    warning "tmux not found - required for headless agents"
    case $OS in
        "macOS")
            echo "  Install with: brew install tmux"
            ;;
        "Linux")
            echo "  Install with: sudo apt install tmux  # or your package manager"
            ;;
        *)
            echo "  Install tmux for your system"
            ;;
    esac
    echo ""
else
    success "tmux found: $(which tmux)"
fi

# 2. Install Python Dependencies
header "📦 Installing Python Dependencies"

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    log "Creating virtual environment..."
    python3 -m venv venv
    success "Virtual environment created"
else
    log "Using existing virtual environment"
fi

# Activate venv
log "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
log "Upgrading pip..."
pip install --upgrade pip --quiet

# Install dependencies with modern Python tools
if command -v uv &> /dev/null; then
    log "Installing with uv (fast Python package manager)..."
    uv sync --quiet
    success "Dependencies installed with uv"
else
    log "Installing with pip..."
    pip install -r requirements.txt --quiet
    if [ $? -eq 0 ]; then
        success "Dependencies installed successfully"
    else
        error "Failed to install dependencies"
        exit 1
    fi
fi

# 3. Test MCP Server
header "🧪 Testing MCP Server"

log "Testing MCP server import..."
python3 -c "from real_mcp_server import mcp; print('✅ MCP server ready')" 2>/dev/null

if [ $? -eq 0 ]; then
    success "MCP server test passed"
else
    error "MCP server test failed"
    exit 1
fi

# 4. MCP Configuration
header "⚙️  MCP Configuration"

CURRENT_DIR=$(pwd)
SERVER_PATH="$CURRENT_DIR/real_mcp_server.py"

echo "Choose installation scope:"
echo "  1) Project-local (recommended for testing)"
echo "  2) Global (available in all Claude Code projects)"
echo -n "Enter choice [1-2]: "
read -r CHOICE

case $CHOICE in
    1)
        log "Adding MCP server to current project..."
        claude mcp add --project claude-orchestrator python "$SERVER_PATH" 2>/dev/null || {
            warning "Failed to add via claude mcp - you can add manually"
        }
        ;;
    2)
        log "Adding MCP server globally..."
        claude mcp add --global claude-orchestrator python "$SERVER_PATH" 2>/dev/null || {
            warning "Failed to add via claude mcp - you can add manually"
        }
        ;;
    *)
        warning "Invalid choice - you can add MCP server manually"
        ;;
esac

# 5. Display Configuration Info
header "📋 Manual Configuration (if needed)"

echo -e "${YELLOW}If automatic MCP configuration failed, add this to your Claude Code:${NC}\n"

case $OS in
    "macOS")
        CONFIG_PATH="~/Library/Application Support/Claude/claude_desktop_config.json"
        ;;
    "Linux")
        CONFIG_PATH="~/.config/claude/claude_desktop_config.json"
        ;;
    "Windows")
        CONFIG_PATH="%APPDATA%/Claude/claude_desktop_config.json"
        ;;
esac

echo -e "${CYAN}Configuration file location:${NC} $CONFIG_PATH"
echo ""
echo -e "${CYAN}Add this MCP server configuration:${NC}"
cat << EOF
{
  "mcpServers": {
    "claude-orchestrator": {
      "command": "python",
      "args": ["$SERVER_PATH"],
      "env": {
        "CLAUDE_ORCHESTRATOR_WORKSPACE": "$CURRENT_DIR/.agent-workspace"
      }
    }
  }
}
EOF

# 6. Create workspace structure
header "📁 Setting up Workspace"

log "Creating workspace structure..."
mkdir -p .agent-workspace/registry

# Create spawn rules
if [ ! -f ".agent-workspace/SPAWN_RULES.json" ]; then
    log "Creating default spawn rules..."
    cat > .agent-workspace/SPAWN_RULES.json << 'EOF'
{
  "orchestrator": ["investigator", "fixer", "analyzer", "tester", "specialist"],
  "investigator": ["specialist", "data-collector"],
  "fixer": ["tester", "validator"],
  "analyzer": ["specialist"],
  "tester": ["validator"],
  "specialist": [],
  "data-collector": [],
  "validator": []
}
EOF
    success "Spawn rules created"
fi

# 7. Final Success Message
header "🎉 Installation Complete!"

echo -e "${GREEN}Claude Code Orchestrator MCP is now installed!${NC}\n"

echo -e "${CYAN}🔧 Quick Test:${NC}"
echo "  1. Open Claude Code"
echo "  2. Try: \`create_real_task(\"Test orchestrator\", \"P2\")\`"
echo "  3. Then: \`deploy_headless_agent(...)\`"
echo ""

echo -e "${CYAN}📚 Available Tools:${NC}"
echo "  • create_real_task - Create orchestration task"
echo "  • deploy_headless_agent - Deploy background Claude agent"
echo "  • get_real_task_status - Check task and agent status"
echo "  • get_agent_output - Get agent output"
echo "  • kill_real_agent - Terminate agent"
echo "  • update_agent_progress - Agent self-reporting"
echo "  • report_agent_finding - Agent discovery reporting"
echo "  • spawn_child_agent - Child agent spawning"
echo ""

echo -e "${CYAN}📖 Documentation:${NC}"
echo "  • README.md - Full documentation"
echo "  • docs/MCP_TOOLS.md - Tool reference"
echo ""

echo -e "${CYAN}🚀 To run manually:${NC}"
echo "  source venv/bin/activate && python real_mcp_server.py"
echo ""

echo -e "${PURPLE}Happy orchestrating! 🤖${NC}"