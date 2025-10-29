#!/usr/bin/env python3
"""
Simple script to run the codebase analyzer
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from codebase_analyzer import CodebaseAnalyzer

def main():
    output_file = "agents4energy_deployment_research.md"
    root_dir = '.'  # Current directory
    
    analyzer = CodebaseAnalyzer(root_dir)
    markdown_report = analyzer.generate_markdown_report()
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown_report)
    
    print(f"✅ Analysis complete! Report generated: {os.path.abspath(output_file)}")
    print(f"📊 Report size: {len(markdown_report):,} characters")

if __name__ == "__main__":
    main()
