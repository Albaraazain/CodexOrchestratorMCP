#!/usr/bin/env python3
"""
Setup script for Claude Code Orchestrator MCP
Proper Python package installation
"""

from setuptools import setup, find_packages
import os

# Read long description from README
def read_readme():
    with open("README.md", "r", encoding="utf-8") as fh:
        return fh.read()

# Read requirements
def read_requirements():
    with open("requirements.txt", "r", encoding="utf-8") as fh:
        return [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="claude-orchestrator-mcp",
    version="1.0.0",
    description="MCP server for orchestrating headless Claude agents with anti-spiral protection",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    author="Your Name",
    author_email="your.email@example.com",
    url="https://github.com/your-org/claude-orchestrator-mcp",
    license="MIT",
    
    # Package discovery
    packages=find_packages(),
    py_modules=["real_mcp_server"],
    
    # Requirements
    python_requires=">=3.8",
    install_requires=read_requirements(),
    
    # Optional dependencies
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black",
            "flake8",
        ]
    },
    
    # Entry points for CLI commands
    entry_points={
        "console_scripts": [
            "claude-orchestrator=real_mcp_server:main",
        ],
    },
    
    # Include additional files
    include_package_data=True,
    package_data={
        "": ["*.md", "*.txt", "*.json", "*.sh"],
    },
    
    # Classifiers
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    
    # Keywords
    keywords="claude, mcp, orchestrator, agents, ai, automation, model-context-protocol",
)