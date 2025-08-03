#!/bin/bash

# Python backend startup script
echo "Starting RCompiler Dashboard Backend (Python)..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Start the Flask application
echo "Starting Flask server on port 3001..."
python app.py
