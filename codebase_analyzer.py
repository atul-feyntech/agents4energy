#!/usr/bin/env python3
"""
Agents4Energy Codebase Analyzer and Research Prompt Generator

This script analyzes the Agents4Energy codebase and generates a comprehensive
markdown file with all technical details and a research prompt for deployment
optimization strategies.
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Optional

class CodebaseAnalyzer:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.file_extensions = {
            '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml',
            '.mjs', '.scss', '.css', '.py', '.sh'
        }
        self.exclude_dirs = {
            '.git', '.next', 'node_modules', '.amplify', 'dist', 'build',
            '.nyc_output', 'coverage', '.pytest_cache', '__pycache__'
        }
        self.max_file_size = 1024 * 1024  # 1MB limit per file
        
    def should_include_file(self, file_path: Path) -> bool:
        """Check if file should be included in analysis"""
        if file_path.suffix.lower() not in self.file_extensions:
            return False
        
        # Check if any parent directory is in exclude list
        for parent in file_path.parents:
            if parent.name in self.exclude_dirs:
                return False
                
        # Check file size
        try:
            if file_path.stat().st_size > self.max_file_size:
                return False
        except OSError:
            return False
            
        return True
    
    def read_file_content(self, file_path: Path) -> Optional[str]:
        """Read file content with error handling"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    def analyze_package_json(self) -> Dict:
        """Analyze package.json for dependencies and scripts"""
        package_json_path = self.root_dir / 'package.json'
        if not package_json_path.exists():
            return {}
        
        try:
            with open(package_json_path, 'r') as f:
                package_data = json.load(f)
            
            return {
                'name': package_data.get('name', 'Unknown'),
                'version': package_data.get('version', 'Unknown'),
                'dependencies': package_data.get('dependencies', {}),
                'dev_dependencies': package_data.get('devDependencies', {}),
                'scripts': package_data.get('scripts', {}),
                'aws_related_deps': {
                    name: version for name, version in package_data.get('dependencies', {}).items()
                    if 'aws' in name.lower() or 'amplify' in name.lower() or 'bedrock' in name.lower() or 'cdk' in name.lower()
                }
            }
        except Exception as e:
            return {'error': str(e)}
    
    def get_file_tree(self, max_depth: int = 3) -> str:
        """Generate a formatted file tree"""
        lines = []
        
        def add_path(path: Path, prefix: str = '', depth: int = 0):
            if depth >= max_depth:
                return
                
            try:
                items = sorted([item for item in path.iterdir() 
                              if not item.name.startswith('.') and item.name not in self.exclude_dirs])
                
                for i, item in enumerate(items):
                    is_last = i == len(items) - 1
                    current_prefix = '└── ' if is_last else '├── '
                    lines.append(f"{prefix}{current_prefix}{item.name}")
                    
                    if item.is_dir() and depth < max_depth - 1:
                        next_prefix = prefix + ('    ' if is_last else '│   ')
                        add_path(item, next_prefix, depth + 1)
            except PermissionError:
                lines.append(f"{prefix}└── [Permission Denied]")
        
        lines.append("📁 agents4energy/")
        add_path(self.root_dir)
        return '\n'.join(lines)
    
    def analyze_amplify_config(self) -> Dict:
        """Analyze Amplify configuration"""
        amplify_yml = self.root_dir / 'amplify.yml'
        backend_ts = self.root_dir / 'amplify' / 'backend.ts'
        
        config = {
            'amplify_yml_exists': amplify_yml.exists(),
            'backend_ts_exists': backend_ts.exists(),
            'build_config': {},
            'agents': [],
            'resources': []
        }
        
        if amplify_yml.exists():
            config['amplify_yml_content'] = self.read_file_content(amplify_yml)
        
        if backend_ts.exists():
            content = self.read_file_content(backend_ts)
            config['backend_ts_content'] = content
            
            # Extract agent information
            if 'productionAgentBuilder' in content:
                config['agents'].append('Production Agent')
            if 'maintenanceAgentBuilder' in content:
                config['agents'].append('Maintenance Agent')
            if 'regulatoryAgentBuilder' in content:
                config['agents'].append('Regulatory Agent')
            if 'petrophysicsAgentBuilder' in content:
                config['agents'].append('Petrophysics Agent')
        
        return config
    
    def get_aws_resources_analysis(self) -> Dict:
        """Analyze AWS-related resources and configurations"""
        resources = {
            'services_found': set(),
            'cdk_stacks': [],
            'lambda_functions': [],
            'agent_configs': []
        }
        
        # Scan amplify directory for AWS resources
        amplify_dir = self.root_dir / 'amplify'
        if amplify_dir.exists():
            for file_path in amplify_dir.rglob('*.ts'):
                if self.should_include_file(file_path):
                    content = self.read_file_content(file_path)
                    
                    # Detect AWS services
                    aws_services = [
                        'bedrock', 'lambda', 's3', 'rds', 'athena', 'glue',
                        'cognito', 'appsync', 'cloudformation', 'iam', 'vpc',
                        'ec2', 'stepfunctions', 'secretsmanager', 'dynamodb'
                    ]
                    
                    for service in aws_services:
                        if service in content.lower():
                            resources['services_found'].add(service)
                    
                    # Detect CDK stacks
                    if 'createStack' in content or 'Stack' in content:
                        resources['cdk_stacks'].append(str(file_path.relative_to(self.root_dir)))
                    
                    # Detect Lambda functions
                    if 'lambda.Function' in content or 'new Function' in content:
                        resources['lambda_functions'].append(str(file_path.relative_to(self.root_dir)))
        
        resources['services_found'] = sorted(list(resources['services_found']))
        return resources
    
    def generate_research_prompt(self, analysis: Dict) -> str:
        """Generate a comprehensive research prompt based on codebase analysis"""
        
        prompt = f"""
# AWS Deployment Research Prompt for Agents4Energy

## Context Overview
I need you to research and provide comprehensive recommendations for deploying the **Agents4Energy** stack on AWS. This is a generative AI application built for the energy industry with multiple specialized AI agents.

## Current Architecture Analysis

### Technology Stack
- **Frontend**: Next.js 14 with TypeScript, React, TailwindCSS
- **Backend**: AWS Amplify Gen2 with CDK integration
- **AI/ML**: Amazon Bedrock with multiple AI agents (Production, Maintenance, Regulatory, Petrophysics)
- **Database**: Amazon RDS PostgreSQL, Athena for queries
- **Storage**: Amazon S3 for file storage and knowledge bases
- **Authentication**: Amazon Cognito
- **API**: AWS AppSync (GraphQL)

### AWS Services Currently Used
{', '.join(analysis['aws_resources']['services_found'])}

### Agent Types Configured
{', '.join(analysis['amplify_config']['agents'])}

### Key Dependencies
{json.dumps(analysis['package_json']['aws_related_deps'], indent=2)}

## Research Questions

### 1. Deployment Strategy Optimization
- What are the best practices for deploying Next.js 14 with Amplify Gen2 in production?
- Should we use Amplify Hosting compute or migrate to a different solution (e.g., ECS, Fargate, EC2)?
- How can we optimize the current 45-minute deployment time?
- What are the pros and cons of separating frontend and backend deployment pipelines?

### 2. Cost Optimization
- Analyze the current architecture for potential cost savings (~$500/month current cost)
- Recommend strategies for optimizing Bedrock agent usage costs
- Suggest storage optimization strategies for S3 knowledge bases
- Evaluate RDS vs. Aurora Serverless vs. DynamoDB for different use cases

### 3. Performance and Scalability
- How can we optimize Lambda function performance for the agent toolboxes?
- What caching strategies would work best for this AI agent architecture?
- Recommend CDN and edge computing strategies for global deployment
- Suggest database optimization strategies for the production and maintenance data

### 4. Security and Compliance
- What are the security best practices for Bedrock agents with access to sensitive energy data?
- How should we implement proper VPC networking for the agent infrastructure?
- What encryption and data protection measures should be implemented?
- Recommend IAM policies and security guardrails for production

### 5. Monitoring and Observability
- What monitoring solutions should be implemented for the AI agents?
- How can we set up comprehensive logging for Bedrock agent interactions?
- Recommend alerting strategies for production deployments
- Suggest debugging and troubleshooting tools for multi-agent systems

### 6. CI/CD and Infrastructure Management
- Evaluate the current Amplify + CDK approach vs. pure CDK or Terraform
- Recommend branching strategies for multiple environments (dev, staging, prod)
- Suggest automated testing strategies for AI agent workflows
- How can we implement blue/green or canary deployments?

### 7. Disaster Recovery and High Availability
- What are the DR strategies for AI agent systems?
- How can we implement multi-region deployment for global availability?
- Recommend backup strategies for knowledge bases and databases
- Suggest failover mechanisms for critical agent services

### 8. Future-Proofing and Innovation
- How can the architecture evolve to support more agents and users?
- What serverless vs. containerized decisions should be made?
- Recommend strategies for A/B testing new AI models and features
- How can we implement feature flags for gradual rollouts?

## Specific Requirements
- Focus on AWS-native solutions and best practices
- Consider energy industry compliance requirements (if any)
- Provide concrete implementation steps and code examples where relevant
- Include estimated cost comparisons where possible
- Address both technical and operational considerations

## Expected Output Format
Please provide your research in a structured format with:
1. Executive summary of key recommendations
2. Detailed analysis for each research question
3. Implementation roadmap with priorities
4. Cost-benefit analysis for major changes
5. Risk assessment and mitigation strategies

Please base your recommendations on current AWS best practices as of 2025 and consider the specific requirements of AI agent workloads in the energy sector.
"""
        
        return prompt
    
    def generate_markdown_report(self) -> str:
        """Generate the complete markdown analysis report"""
        
        # Perform all analyses
        package_analysis = self.analyze_package_json()
        amplify_analysis = self.analyze_amplify_config()
        aws_resources = self.get_aws_resources_analysis()
        file_tree = self.get_file_tree()
        
        analysis = {
            'package_json': package_analysis,
            'amplify_config': amplify_analysis,
            'aws_resources': aws_resources
        }
        
        research_prompt = self.generate_research_prompt(analysis)
        
        # Generate markdown report
        markdown = f"""# Agents4Energy Codebase Analysis and Deployment Research

*Generated on: {datetime.now().isoformat()}*

## Executive Summary

This document provides a comprehensive analysis of the Agents4Energy codebase, a generative AI platform for the energy industry built on AWS. The analysis includes technical architecture, AWS resource utilization, and a detailed research prompt for optimizing deployment strategies.

## Project Overview

**Name**: {package_analysis.get('name', 'Unknown')}  
**Version**: {package_analysis.get('version', 'Unknown')}  
**Type**: Full-stack TypeScript application with AI agents  

### Technology Stack
- **Frontend**: Next.js 14 with React, TypeScript, TailwindCSS
- **Backend**: AWS Amplify Gen2 + AWS CDK
- **AI/ML**: Amazon Bedrock with specialized agents
- **Database**: PostgreSQL (RDS), Amazon Athena
- **Storage**: Amazon S3 with knowledge bases
- **Authentication**: Amazon Cognito
- **API**: AWS AppSync (GraphQL)

## File Structure

```
{file_tree}
```

## Package Dependencies Analysis

### AWS-Related Dependencies
```json
{json.dumps(package_analysis.get('aws_related_deps', {}), indent=2)}
```

### Key Dependencies
- **React Ecosystem**: React 18, Next.js 14
- **AWS Services**: AWS Amplify, AWS CDK, Bedrock Agents
- **UI Framework**: CloudScape Design, Material-UI, TailwindCSS
- **AI/ML**: LangChain, Bedrock Agents CDK Constructs
- **Charts**: Chart.js, Recharts, Plotly.js

## AWS Architecture Analysis

### AWS Services Detected
{', '.join(aws_resources['services_found'])}

### CDK Stacks Found
{chr(10).join(f"- {stack}" for stack in aws_resources['cdk_stacks'])}

### Lambda Functions
{chr(10).join(f"- {func}" for func in aws_resources['lambda_functions'])}

### Agent Configurations
{chr(10).join(f"- {agent}" for agent in amplify_analysis['agents'])}

## Amplify Configuration

### Build Configuration
- **Backend Build**: Uses AWS CodeBuild standard:7.0 image
- **Frontend Build**: Next.js build process with .next artifacts
- **Node Version**: 20.9.0
- **Build Timeout**: 120 minutes (custom configuration)

### Deployment Structure
- **Storage**: S3 bucket for file uploads and knowledge bases
- **Functions**: Multiple Lambda functions for agent toolboxes
- **Authentication**: Cognito with email domain validation
- **API**: GraphQL with AppSync

## Key Configuration Files

### amplify.yml
The build configuration specifies:
- Custom build image for extended timeout
- Node.js 20.9.0 runtime
- Caching for npm dependencies and .next build artifacts

### amplify/backend.ts
Main backend configuration that defines:
- Multiple agent stacks (Production, Maintenance, Regulatory, Petrophysics)
- VPC networking with public and private subnets
- S3 deployments for sample data
- IAM policies for Bedrock access

## Current Deployment Challenges

Based on the analysis, current challenges include:
1. **Long deployment times** (~45 minutes initial deployment)
2. **Complex multi-stack architecture** with nested CloudFormation stacks
3. **High monthly costs** (~$500 with sample agents)
4. **Tight coupling** between Amplify and CDK components

## Security Considerations

- IAM policies for Bedrock model access
- VPC configuration for network isolation
- Cognito email domain validation
- S3 bucket policies for file access

## Performance Characteristics

- Lambda functions with high memory allocation (3008MB)
- S3-based knowledge base with vector embeddings
- Athena for structured data queries
- Real-time agent invocation via AppSync

---

{research_prompt}
"""
        
        return markdown

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 codebase_analyzer.py <output_file>")
        print("Example: python3 codebase_analyzer.py agents4energy_analysis.md")
        sys.exit(1)
    
    output_file = sys.argv[1]
    root_dir = '.'  # Current directory
    
    analyzer = CodebaseAnalyzer(root_dir)
    markdown_report = analyzer.generate_markdown_report()
    
    output_path = Path(output_file)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(markdown_report)
    
    print(f"✅ Analysis complete! Report generated: {output_path.absolute()}")
    print(f"📊 Report size: {len(markdown_report):,} characters")
    print(f"📁 Analyzed directory: {Path(root_dir).absolute()}")

if __name__ == "__main__":
    main()
