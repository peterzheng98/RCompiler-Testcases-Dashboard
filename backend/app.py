import os
import json
import sqlite3
import threading
import time
import schedule
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
import git

app = Flask(__name__)

# CORS configuration - allow requests from frontend
CORS(app, origins=['http://localhost:30026', 'http://127.0.0.1:30026'], 
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])

# Additional CORS headers for all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Configuration
REPO_PATH = os.path.join(os.path.dirname(__file__), '../../RCompiler-Testcases')
DB_PATH = os.path.join(os.path.dirname(__file__), 'testcases.db')

# Database setup
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            path TEXT,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS testcases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stage_id INTEGER,
            name TEXT,
            name_visible BOOLEAN,
            active BOOLEAN,
            source_path TEXT,
            source_visible BOOLEAN,
            input_path TEXT,
            input_visible BOOLEAN,
            output_path TEXT,
            output_visible BOOLEAN,
            exitcode INTEGER,
            compileexitcode INTEGER,
            compiletimelimit INTEGER,
            compilememorylimit INTEGER,
            runtimelimit INTEGER,
            runtimememorylimit INTEGER,
            cmp TEXT,
            provide TEXT,
            metainfo TEXT,
            FOREIGN KEY(stage_id) REFERENCES stages(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS git_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            git_hash TEXT,
            git_time DATETIME
        )
    ''')
    
    conn.commit()
    conn.close()

# Helper functions
def get_git_info():
    try:
        repo = git.Repo(REPO_PATH)
        latest_commit = repo.head.commit
        return {
            'hash': latest_commit.hexsha,
            'date': datetime.fromtimestamp(latest_commit.committed_date).isoformat()
        }
    except Exception as e:
        print(f"Error getting git info: {e}")
        return {'hash': 'unknown', 'date': datetime.now().isoformat()}

def read_global_json(stage_path):
    try:
        global_json_path = os.path.join(stage_path, 'global.json')
        with open(global_json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading global.json from {stage_path}: {e}")
        return []

def update_database():
    try:
        print('Updating database...')
        
        # Pull latest changes from git
        try:
            repo = git.Repo(REPO_PATH)
            repo.remotes.origin.pull()
        except Exception as e:
            print(f"Git pull failed: {e}")
        
        # Get git info
        git_info = get_git_info()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Clear existing data
        cursor.execute('DELETE FROM testcases')
        cursor.execute('DELETE FROM stages')
        
        # Read all stage directories
        stage_dirs = []
        for item in os.listdir(REPO_PATH):
            item_path = os.path.join(REPO_PATH, item)
            if os.path.isdir(item_path) and not item.startswith('.') and item != 'node_modules':
                stage_dirs.append({'name': item, 'path': item_path})
        
        # Process each stage
        for stage in stage_dirs:
            # Insert stage
            cursor.execute('INSERT INTO stages (name, path) VALUES (?, ?)', 
                         (stage['name'], stage['path']))
            stage_id = cursor.lastrowid
            
            # Read test cases from global.json
            test_cases = read_global_json(stage['path'])
            
            # Insert test cases
            for test_case in test_cases:
                values = (
                    stage_id,
                    test_case.get('name', ''),
                    test_case.get('name_visible', False),
                    test_case.get('active', False),
                    test_case.get('source', [''])[0] if test_case.get('source') else '',
                    test_case.get('source', ['', ''])[1] == 'visible' if test_case.get('source') and len(test_case.get('source')) > 1 else False,
                    test_case.get('input', [''])[0] if test_case.get('input') else '',
                    test_case.get('input', ['', ''])[1] == 'visible' if test_case.get('input') and len(test_case.get('input')) > 1 else False,
                    test_case.get('output', [''])[0] if test_case.get('output') else '',
                    test_case.get('output', ['', ''])[1] == 'visible' if test_case.get('output') and len(test_case.get('output')) > 1 else False,
                    test_case.get('exitcode', 0),
                    test_case.get('compileexitcode', 0),
                    test_case.get('compiletimelimit', 0),
                    test_case.get('compilememorylimit', 0),
                    test_case.get('runtimelimit', 0),
                    test_case.get('runtimememorylimit', 0),
                    json.dumps(test_case.get('cmp', [])),
                    json.dumps(test_case.get('provide', [])),
                    json.dumps(test_case.get('metainfo', {}))
                )
                
                cursor.execute('''
                    INSERT INTO testcases (
                        stage_id, name, name_visible, active, source_path, source_visible,
                        input_path, input_visible, output_path, output_visible,
                        exitcode, compileexitcode, compiletimelimit, compilememorylimit,
                        runtimelimit, runtimememorylimit, cmp, provide, metainfo
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', values)
        
        # Update git info
        cursor.execute('INSERT INTO git_info (git_hash, git_time) VALUES (?, ?)', 
                      (git_info['hash'], git_info['date']))
        
        conn.commit()
        conn.close()
        
        print('Database updated successfully')
        return True
    except Exception as e:
        print(f'Error updating database: {e}')
        return False

# API Routes
@app.route('/api/stages', methods=['GET'])
def get_stages():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT s.*, COUNT(t.id) as testcase_count
            FROM stages s
            LEFT JOIN testcases t ON s.id = t.stage_id
            GROUP BY s.id
            ORDER BY s.name
        ''')
        stages = [dict(row) for row in cursor.fetchall()]
        
        # Get git info
        cursor.execute('SELECT * FROM git_info ORDER BY last_updated DESC LIMIT 1')
        git_info_row = cursor.fetchone()
        git_info = dict(git_info_row) if git_info_row else {
            'last_updated': None, 'git_hash': 'unknown', 'git_time': None
        }
        
        conn.close()
        
        return jsonify({
            'stages': stages,
            'gitInfo': git_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stages/<stage_name>/testcases', methods=['GET'])
def get_testcases(stage_name):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT t.*, s.name as stage_name
            FROM testcases t
            JOIN stages s ON t.stage_id = s.id
            WHERE s.name = ?
            ORDER BY t.name
        ''', (stage_name,))
        testcases = cursor.fetchall()
        
        # Parse JSON fields
        processed_testcases = []
        for tc in testcases:
            tc_dict = dict(tc)
            tc_dict['cmp'] = json.loads(tc_dict['cmp'] or '[]')
            tc_dict['provide'] = json.loads(tc_dict['provide'] or '[]')
            tc_dict['metainfo'] = json.loads(tc_dict['metainfo'] or '{}')
            processed_testcases.append(tc_dict)
        
        # Get git info
        cursor.execute('SELECT * FROM git_info ORDER BY last_updated DESC LIMIT 1')
        git_info_row = cursor.fetchone()
        git_info = dict(git_info_row) if git_info_row else {
            'last_updated': None, 'git_hash': 'unknown', 'git_time': None
        }
        
        conn.close()
        
        return jsonify({
            'testcases': processed_testcases,
            'gitInfo': git_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/file-content', methods=['GET'])
def get_file_content():
    stage_name = request.args.get('stageName')
    file_path = request.args.get('filePath')
    
    if not stage_name or not file_path:
        return jsonify({'error': 'Stage name and file path are required'}), 400
    
    try:
        full_path = os.path.join(REPO_PATH, stage_name, file_path)
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': 'File not found or not readable'}), 404

@app.route('/api/update', methods=['POST'])
def manual_update():
    try:
        success = update_database()
        if success:
            return jsonify({'message': 'Database updated successfully'})
        else:
            return jsonify({'error': 'Failed to update database'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Background scheduler
def run_scheduler():
    def scheduled_update():
        print('Running scheduled database update...')
        update_database()
    
    schedule.every(10).minutes.do(scheduled_update)
    
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == '__main__':
    # Initialize database
    init_db()
    
    # Initial database update
    update_database()
    
    # Start background scheduler
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    
    # Start Flask app
    app.run(debug=True, host='0.0.0.0', port=3001)
