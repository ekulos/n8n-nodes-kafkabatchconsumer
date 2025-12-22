#!/bin/bash

# N8N Kafka Batch Consumer - Test Runner
# This script installs dependencies and runs the test suite

echo "=========================================="
echo "N8N Kafka Batch Consumer - Test Suite"
echo "=========================================="
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Dependencies installed successfully"
echo ""

# Run tests with coverage
echo "Running tests..."
npx jest

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Tests failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ All tests passed!"
echo "=========================================="
echo ""
echo "Coverage report available in ./coverage directory"
