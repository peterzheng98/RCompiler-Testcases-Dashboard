#!/bin/bash

echo "Setting up RCompiler Dashboard..."

# Setup Python backend
echo "Setting up Python backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt
deactivate

cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install

echo "Setup complete!"
echo ""
echo "To start the application:"
echo "1. Start backend: cd backend && ./start.sh"
echo "2. Start frontend: cd frontend && npm start"
echo ""
echo "The dashboard will be available at http://localhost:3000"
