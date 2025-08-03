# RCompiler Test Cases Dashboard

A full-stack web application to display and manage RCompiler test cases with automatic git synchronization.

## Features

- 📊 **Dashboard Overview**: View all test stages with case counts
- 🔍 **Detailed View**: Expand each test case to see configuration, meta info, and file contents
- 🔄 **Auto-sync**: Automatically updates from git repository every 10 minutes
- 📋 **Comprehensive Info**: Shows compile/runtime limits, exit codes, and visibility settings
- 🕒 **Git Tracking**: Displays last update time, git hash, and commit time
- 💾 **Local Database**: SQLite database for fast querying

## Architecture

- **Frontend**: React application with responsive design
- **Backend**: Python Flask API with SQLite database
- **Data Source**: RCompiler-Testcases git repository
- **Sync**: Automatic git pull and database update every 10 minutes

## Setup

### Prerequisites

- Python 3.8 or higher
- Node.js (v16 or higher) for frontend
- npm or yarn

### Installation

1. **Setup Backend (Python)**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Configure Frontend (Optional)**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env to set your backend URL if different from default
   # REACT_APP_API_URL=http://localhost:3001
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   ./start.sh
   # or manually:
   source venv/bin/activate
   python app.py
   ```
   The backend will run on http://localhost:3001

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm start
   ```
   The frontend will run on http://localhost:3000

### Production Build

1. **Build the Frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Serve the Built Frontend**
   The backend can be configured to serve the built frontend files for production deployment.

## API Endpoints

- `GET /api/stages` - Get all stages with test case counts and git info
- `GET /api/stages/:stageName/testcases` - Get test cases for a specific stage
- `GET /api/file-content?stageName=X&filePath=Y` - Get content of visible files
- `POST /api/update` - Manually trigger database update

## Database Schema

### stages
- id (PRIMARY KEY)
- name (stage directory name)
- path (full path to stage directory)
- last_updated (timestamp)

### testcases
- id (PRIMARY KEY)
- stage_id (FOREIGN KEY)
- name, active, source_path, input_path, output_path
- exitcode, compileexitcode, compiletimelimit, compilememorylimit
- runtimelimit, runtimememorylimit
- cmp (JSON), provide (JSON), metainfo (JSON)
- visibility flags for each file type

### git_info
- id (PRIMARY KEY)
- last_updated (timestamp)
- git_hash (commit hash)
- git_time (commit timestamp)

## Configuration

The application reads test cases from the `global.json` file in each stage directory of the RCompiler-Testcases repository. Each test case should follow this structure:

```json
{
  "name": "test_name",
  "name_visible": true,
  "active": true,
  "source": ["src/path/file.rx", "visible"],
  "input": ["src/path/file.in", "visible"],
  "output": ["src/path/file.out", "visible"],
  "exitcode": 0,
  "compileexitcode": 0,
  "compiletimelimit": 15,
  "compilememorylimit": 256,
  "runtimelimit": -1,
  "runtimememorylimit": 256,
  "cmp": ["compileexitcode"],
  "provide": ["compilestderr", "compileexitcode"],
  "metainfo": {
    "caseauthor": "Author Name",
    "lastmodified": "2025-08-03",
    "comment": "Description"
  }
}
```

## Features Detail

### Stage View
- Grid layout showing all stages
- Test case count for each stage
- Click to view stage details

### Test Case View
- List all test cases for selected stage
- Show key information: name, active status, compile exit code, limits
- Expandable details for each test case

### Expanded Test Case Details
- **Comparison & Provide**: What the test compares and provides
- **Meta Information**: Author, last modified, comments
- **File Contents**: Source code, input, and expected output (when visible)

### Git Integration
- Automatic git pull every 10 minutes
- Display last update time, git hash, and commit time
- Manual update button for immediate sync

## Development

### Development

### Backend Development
```bash
cd backend
source venv/bin/activate
python app.py  # Flask development server with auto-reload
```

### Frontend Development
```bash
cd frontend
npm start  # React development server with hot reload
```

### Adding New Features
- Backend routes in `backend/app.py`
- Frontend components in `frontend/src/App.js`
- Styling in `frontend/src/index.css`

## Troubleshooting

1. **Database Issues**: Delete `backend/testcases.db` to reset the database
2. **Git Sync Issues**: Check that the RCompiler-Testcases directory is a valid git repository
3. **Port Conflicts**: Change ports in the respective package.json files
4. **File Access Issues**: Ensure proper permissions on the RCompiler-Testcases directory
