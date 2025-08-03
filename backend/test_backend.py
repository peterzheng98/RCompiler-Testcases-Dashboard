#!/usr/bin/env python3
"""
Test script to verify the backend setup and database functionality
"""

import os
import sys
import sqlite3
import json
from pathlib import Path

# Add the backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

try:
    from app import init_db, update_database, get_git_info, REPO_PATH, DB_PATH
    print("✓ Successfully imported backend modules")
except ImportError as e:
    print(f"✗ Failed to import backend modules: {e}")
    print("Make sure to install requirements: pip install -r requirements.txt")
    sys.exit(1)

def test_database():
    """Test database initialization and basic operations"""
    print("\n=== Testing Database ===")
    
    # Initialize database
    try:
        init_db()
        print("✓ Database initialized successfully")
    except Exception as e:
        print(f"✗ Database initialization failed: {e}")
        return False
    
    # Test database connection
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        expected_tables = {'stages', 'testcases', 'git_info'}
        actual_tables = {table[0] for table in tables}
        
        if expected_tables.issubset(actual_tables):
            print("✓ All required tables exist")
        else:
            missing = expected_tables - actual_tables
            print(f"✗ Missing tables: {missing}")
            return False
        
        conn.close()
    except Exception as e:
        print(f"✗ Database connection test failed: {e}")
        return False
    
    return True

def test_git_repo():
    """Test git repository access"""
    print("\n=== Testing Git Repository ===")
    
    if not os.path.exists(REPO_PATH):
        print(f"✗ Repository path does not exist: {REPO_PATH}")
        return False
    
    if not os.path.exists(os.path.join(REPO_PATH, '.git')):
        print(f"✗ Not a git repository: {REPO_PATH}")
        return False
    
    try:
        git_info = get_git_info()
        print(f"✓ Git repository accessible")
        print(f"  Latest commit: {git_info['hash'][:8]}")
        print(f"  Commit date: {git_info['date']}")
    except Exception as e:
        print(f"✗ Git repository access failed: {e}")
        return False
    
    return True

def test_data_update():
    """Test data update functionality"""
    print("\n=== Testing Data Update ===")
    
    try:
        success = update_database()
        if success:
            print("✓ Database update completed successfully")
            
            # Check if data was inserted
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM stages")
            stage_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM testcases")
            testcase_count = cursor.fetchone()[0]
            conn.close()
            
            print(f"  Stages: {stage_count}")
            print(f"  Test cases: {testcase_count}")
            
            if stage_count > 0:
                print("✓ Data successfully loaded")
            else:
                print("⚠ No stages found - check if RCompiler-Testcases has valid data")
        else:
            print("✗ Database update failed")
            return False
    except Exception as e:
        print(f"✗ Data update test failed: {e}")
        return False
    
    return True

def main():
    print("RCompiler Dashboard Backend Test")
    print("=" * 35)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print(f"✗ Python 3.8+ required, got {sys.version}")
        sys.exit(1)
    else:
        print(f"✓ Python version: {sys.version}")
    
    # Run tests
    tests = [
        test_database,
        test_git_repo,
        test_data_update
    ]
    
    all_passed = True
    for test in tests:
        if not test():
            all_passed = False
    
    print("\n" + "=" * 35)
    if all_passed:
        print("✓ All tests passed! Backend is ready to run.")
        print("\nTo start the backend server:")
        print("  ./start.sh")
        print("  or: python app.py")
    else:
        print("✗ Some tests failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
