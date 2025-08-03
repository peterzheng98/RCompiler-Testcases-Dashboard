const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('./testcases.db');

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    path TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS testcases (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS git_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    git_hash TEXT,
    git_time DATETIME
  )`);
});

// Git repository path
const REPO_PATH = path.join(__dirname, '../../RCompiler-Testcases');
const git = simpleGit(REPO_PATH);

// Helper function to get git info
async function getGitInfo() {
  try {
    const log = await git.log(['-1']);
    const latestCommit = log.latest;
    return {
      hash: latestCommit.hash,
      date: latestCommit.date
    };
  } catch (error) {
    console.error('Error getting git info:', error);
    return { hash: 'unknown', date: new Date() };
  }
}

// Helper function to read global.json files
async function readGlobalJson(stagePath) {
  try {
    const globalJsonPath = path.join(stagePath, 'global.json');
    const content = await fs.readFile(globalJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading global.json from ${stagePath}:`, error);
    return [];
  }
}

// Helper function to update database with test cases
async function updateDatabase() {
  try {
    console.log('Updating database...');
    
    // Pull latest changes from git
    await git.pull();
    
    // Get git info
    const gitInfo = await getGitInfo();
    
    // Clear existing data
    db.run('DELETE FROM testcases');
    db.run('DELETE FROM stages');
    
    // Read all stage directories
    const repoContents = await fs.readdir(REPO_PATH);
    const stageDirs = [];
    
    for (const item of repoContents) {
      const itemPath = path.join(REPO_PATH, item);
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        stageDirs.push({ name: item, path: itemPath });
      }
    }
    
    // Process each stage
    for (const stage of stageDirs) {
      // Insert stage
      const stageResult = await new Promise((resolve, reject) => {
        db.run('INSERT INTO stages (name, path) VALUES (?, ?)', 
          [stage.name, stage.path], 
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Read test cases from global.json
      const testCases = await readGlobalJson(stage.path);
      
      // Insert test cases
      for (const testCase of testCases) {
        const values = [
          stageResult,
          testCase.name || '',
          testCase.name_visible || false,
          testCase.active || false,
          testCase.source ? testCase.source[0] : '',
          testCase.source ? testCase.source[1] === 'visible' : false,
          testCase.input ? testCase.input[0] : '',
          testCase.input ? testCase.input[1] === 'visible' : false,
          testCase.output ? testCase.output[0] : '',
          testCase.output ? testCase.output[1] === 'visible' : false,
          testCase.exitcode || 0,
          testCase.compileexitcode || 0,
          testCase.compiletimelimit || 0,
          testCase.compilememorylimit || 0,
          testCase.runtimelimit || 0,
          testCase.runtimememorylimit || 0,
          JSON.stringify(testCase.cmp || []),
          JSON.stringify(testCase.provide || []),
          JSON.stringify(testCase.metainfo || {})
        ];
        
        db.run(`INSERT INTO testcases (
          stage_id, name, name_visible, active, source_path, source_visible,
          input_path, input_visible, output_path, output_visible,
          exitcode, compileexitcode, compiletimelimit, compilememorylimit,
          runtimelimit, runtimememorylimit, cmp, provide, metainfo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);
      }
    }
    
    // Update git info
    db.run('INSERT INTO git_info (git_hash, git_time) VALUES (?, ?)', 
      [gitInfo.hash, gitInfo.date]);
    
    console.log('Database updated successfully');
  } catch (error) {
    console.error('Error updating database:', error);
  }
}

// API Routes

// Get all stages with test cases
app.get('/api/stages', (req, res) => {
  db.all(`
    SELECT s.*, COUNT(t.id) as testcase_count
    FROM stages s
    LEFT JOIN testcases t ON s.id = t.stage_id
    GROUP BY s.id
    ORDER BY s.name
  `, (err, stages) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Get git info
    db.get('SELECT * FROM git_info ORDER BY last_updated DESC LIMIT 1', (err, gitInfo) => {
      res.json({
        stages,
        gitInfo: gitInfo || { last_updated: null, git_hash: 'unknown', git_time: null }
      });
    });
  });
});

// Get test cases for a specific stage
app.get('/api/stages/:stageName/testcases', (req, res) => {
  const { stageName } = req.params;
  
  db.all(`
    SELECT t.*, s.name as stage_name
    FROM testcases t
    JOIN stages s ON t.stage_id = s.id
    WHERE s.name = ?
    ORDER BY t.name
  `, [stageName], (err, testcases) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse JSON fields
    const processedTestcases = testcases.map(tc => ({
      ...tc,
      cmp: JSON.parse(tc.cmp || '[]'),
      provide: JSON.parse(tc.provide || '[]'),
      metainfo: JSON.parse(tc.metainfo || '{}')
    }));
    
    // Get git info
    db.get('SELECT * FROM git_info ORDER BY last_updated DESC LIMIT 1', (err, gitInfo) => {
      res.json({
        testcases: processedTestcases,
        gitInfo: gitInfo || { last_updated: null, git_hash: 'unknown', git_time: null }
      });
    });
  });
});

// Get file content for visible files
app.get('/api/file-content', async (req, res) => {
  const { stageName, filePath } = req.query;
  
  if (!stageName || !filePath) {
    return res.status(400).json({ error: 'Stage name and file path are required' });
  }
  
  try {
    const fullPath = path.join(REPO_PATH, stageName, filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content });
  } catch (error) {
    res.status(404).json({ error: 'File not found or not readable' });
  }
});

// Manual update endpoint
app.post('/api/update', async (req, res) => {
  try {
    await updateDatabase();
    res.json({ message: 'Database updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule automatic updates every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('Running scheduled database update...');
  updateDatabase();
});

// Initial database update
updateDatabase();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
