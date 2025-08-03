import React, { useState, useEffect } from 'react';
import axios from 'axios';

// API Base URL Configuration
const API_BASE_URL = 'http://10.5.5.103:30025';

function App() {
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [expandedTestCase, setExpandedTestCase] = useState(null);
  const [gitInfo, setGitInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/stages`);
      setStages(response.data.stages);
      setGitInfo(response.data.gitInfo);
      setError(null);
    } catch (err) {
      setError('Failed to fetch stages: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestCases = async (stageName) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/stages/${stageName}/testcases`);
      setTestCases(response.data.testcases);
      setGitInfo(response.data.gitInfo);
      setSelectedStage(stageName);
      setExpandedTestCase(null);
      setFileContents({});
    } catch (err) {
      setError('Failed to fetch test cases: ' + err.message);
    }
  };

  const fetchFileContent = async (stageName, filePath) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/file-content`, {
        params: { stageName, filePath }
      });
      return response.data.content;
    } catch (err) {
      return 'Error loading file content';
    }
  };

  const handleTestCaseExpand = async (testCase) => {
    if (expandedTestCase === testCase.id) {
      setExpandedTestCase(null);
      return;
    }

    setExpandedTestCase(testCase.id);

    // Fetch file contents for visible files
    const contents = {};
    if (testCase.source_visible && testCase.source_path) {
      contents.source = await fetchFileContent(selectedStage, testCase.source_path);
    }
    if (testCase.input_visible && testCase.input_path) {
      contents.input = await fetchFileContent(selectedStage, testCase.input_path);
    }
    if (testCase.output_visible && testCase.output_path) {
      contents.output = await fetchFileContent(selectedStage, testCase.output_path);
    }

    setFileContents(prev => ({
      ...prev,
      [testCase.id]: contents
    }));
  };

  const handleUpdate = async () => {
    try {
      setUpdating(true);
      await axios.post(`${API_BASE_URL}/api/update`);
      await fetchStages();
      if (selectedStage) {
        await fetchTestCases(selectedStage);
      }
    } catch (err) {
      setError('Failed to update: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const formatLimit = (limit) => {
    if (limit === -1) return '∞';
    if (limit === 0) return '0';
    return limit.toString();
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="header">
        <div className="container">
          <h1>RCompiler Test Cases Dashboard</h1>
        </div>
      </div>

      <div className="container">
        {error && <div className="error">{error}</div>}

        <div className="git-info">
          <strong>Last Updated:</strong> {formatDateTime(gitInfo?.last_updated)} | 
          <strong> Git Hash:</strong> {gitInfo?.git_hash?.substring(0, 8) || 'unknown'} | 
          <strong> Git Time:</strong> {formatDateTime(gitInfo?.git_time)}
          <button 
            className="update-button" 
            onClick={handleUpdate}
            disabled={updating}
            style={{ marginLeft: '20px' }}
          >
            {updating ? 'Updating...' : 'Manual Update'}
          </button>
        </div>

        <div className="stages-grid">
          {stages.map(stage => (
            <div
              key={stage.id}
              className={`stage-card ${selectedStage === stage.name ? 'selected' : ''}`}
              onClick={() => fetchTestCases(stage.name)}
            >
              <h3>{stage.name}</h3>
              <div className="testcase-count">
                {stage.testcase_count} test case(s)
              </div>
            </div>
          ))}
        </div>

        {selectedStage && (
          <div className="testcases-section">
            <h2>Test Cases - {selectedStage}</h2>
            
            {testCases.map(testCase => (
              <div key={testCase.id} className="testcase-item">
                <div 
                  className="testcase-header"
                  onClick={() => handleTestCaseExpand(testCase)}
                >
                  <div className="testcase-basic-info">
                    <div className="testcase-name">{testCase.name}</div>
                    <div className="testcase-status">
                      <span className={`status-badge ${testCase.active ? 'status-active' : 'status-inactive'}`}>
                        {testCase.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`status-badge ${testCase.compileexitcode === 0 ? 'status-success' : 'status-error'}`}>
                        Compile: {testCase.compileexitcode}
                      </span>
                    </div>
                    <div className="testcase-limits">
                      <div className="limit-item">
                        <div className="limit-label">Compile Time</div>
                        <div className="limit-value">{formatLimit(testCase.compiletimelimit)}s</div>
                      </div>
                      <div className="limit-item">
                        <div className="limit-label">Compile Mem</div>
                        <div className="limit-value">{formatLimit(testCase.compilememorylimit)}MB</div>
                      </div>
                      <div className="limit-item">
                        <div className="limit-label">Runtime</div>
                        <div className="limit-value">{formatLimit(testCase.runtimelimit)}s</div>
                      </div>
                      <div className="limit-item">
                        <div className="limit-label">Runtime Mem</div>
                        <div className="limit-value">{formatLimit(testCase.runtimememorylimit)}MB</div>
                      </div>
                    </div>
                  </div>
                  <div className={`expand-icon ${expandedTestCase === testCase.id ? 'expanded' : ''}`}>
                    ▼
                  </div>
                </div>

                {expandedTestCase === testCase.id && (
                  <div className="testcase-details">
                    <div className="details-grid">
                      {/* Comparison and Provide Info */}
                      <div className="detail-section">
                        <h4>Comparison & Provide</h4>
                        <div className="meta-info">
                          <div className="meta-item">
                            <span className="meta-label">Compare:</span>
                            <span className="meta-value">{testCase.cmp.join(', ') || 'None'}</span>
                          </div>
                          <div className="meta-item">
                            <span className="meta-label">Provide:</span>
                            <span className="meta-value">{testCase.provide.join(', ') || 'None'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Meta Information */}
                      <div className="detail-section">
                        <h4>Meta Information</h4>
                        <div className="meta-info">
                          {Object.entries(testCase.metainfo).map(([key, value]) => (
                            <div key={key} className="meta-item">
                              <span className="meta-label">{key}:</span>
                              <span className="meta-value">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* File Contents */}
                      {testCase.source_visible && fileContents[testCase.id]?.source && (
                        <div className="detail-section">
                          <h4>Source Code ({testCase.source_path})</h4>
                          <div className="file-content">
                            {fileContents[testCase.id].source}
                          </div>
                        </div>
                      )}

                      {testCase.input_visible && fileContents[testCase.id]?.input !== undefined && (
                        <div className="detail-section">
                          <h4>Input ({testCase.input_path})</h4>
                          <div className="file-content">
                            {fileContents[testCase.id].input || '(empty)'}
                          </div>
                        </div>
                      )}

                      {testCase.output_visible && fileContents[testCase.id]?.output !== undefined && (
                        <div className="detail-section">
                          <h4>Expected Output ({testCase.output_path})</h4>
                          <div className="file-content">
                            {fileContents[testCase.id].output || '(empty)'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
