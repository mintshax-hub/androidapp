import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Play, Square, Trash2, Clock, Video, Download, Link as LinkIcon, Globe } from 'lucide-react';
// .env se URL uthayega (Replit ke liye), default localhost
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL, {
    transports: ['websocket'],
    reconnection: true
});

function App() {
  const [files, setFiles] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Screen size monitor karne ke liye
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    // Socket Listeners
    socket.on('download-progress', (data) => {
        setFiles(prev => prev.map(f => f.id === data.id ? { ...f, progress: data.percent, eta: 'Downloading...' } : f));
    });

    socket.on('progress-update', (data) => {
      setFiles(prev => prev.map(f => f.id === data.id ? { ...f, progress: data.percent, eta: data.eta, status: 'processing' } : f));
    });

    socket.on('estimate-ready', (data) => setFiles(prev => prev.map(f => f.id === data.id ? { ...f, eta: data.eta, thumbnail: data.thumbnail } : f)));
    
    socket.on('download-complete', (data) => {
        setFiles(prev => prev.map(f => f.id === data.id ? { ...f, name: data.name, path: data.path, status: 'idle', thumbnail: data.thumbnail, eta: 'Ready', progress: 0 } : f));
    });

    socket.on('render-finished', (data) => {
      setFiles(prev => prev.map(f => f.id === data.id ? { ...f, status: 'completed', progress: 100, tempPath: data.tempPath, name: data.originalName } : f));
    });

    socket.on('render-error', (data) => {
      const silent = ['taskkill', 'null', 'sigkill'];
      if (silent.some(s => data.error?.toLowerCase().includes(s))) return;
      alert("Error: " + data.error);
      setFiles(prev => prev.map(f => f.id === data.id ? { ...f, status: 'idle', progress: 0 } : f));
    });

    return () => {
        socket.removeAllListeners();
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleAddLink = () => {
    if (!videoUrl) return;
    const id = Math.random().toString(36).substr(2, 9);
    setFiles(prev => [{ id, name: "Connecting...", path: videoUrl, status: 'downloading', progress: 0, eta: '...', thumbnail: null }, ...prev]);
    socket.emit('download-social-video', { id, url: videoUrl });
    setVideoUrl(''); 
  };

  const startOrStopRender = (file) => {
    if (file.status === 'processing') {
        socket.emit('stop-render', { id: file.id });
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'idle', progress: 0, eta: 'Stopped' } : f));
    } else {
        socket.emit('start-single-render', file);
    }
  };

  return (
    <div className="container-fluid bg-dark text-white min-vh-100 p-2 p-md-4" style={{ background: '#0a0a0a' }}>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
      
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 mb-md-4 p-2">
          <h3 className="text-info fw-bold m-0 d-flex align-items-center gap-2">
            <Video size={isMobile ? 24 : 32} /> {isMobile ? 'Studio' : 'Batch Video Studio'}
          </h3>
          <div className="badge bg-secondary bg-opacity-25 p-2 rounded-pill small">v2.0 Beta</div>
      </div>

      {/* Input Bar */}
      <div className="p-3 p-md-4 rounded-4 mb-4 shadow" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="d-flex gap-2 bg-black rounded-pill p-1 border border-secondary border-opacity-25">
            <div className="d-flex align-items-center ps-3 flex-grow-1">
                <LinkIcon size={18} className="text-info me-2 d-none d-md-block"/>
                <input type="text" className="form-control bg-transparent border-0 text-white shadow-none py-1 py-md-2" placeholder="Paste link..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}/>
            </div>
            <button onClick={handleAddLink} className="btn btn-primary rounded-pill px-3 px-md-4 fw-bold shadow">
                <Globe size={18} className={isMobile ? '' : 'me-1'}/> {isMobile ? '' : 'Add Link'}
            </button>
        </div>
      </div>

      {/* Conditional Rendering: Mobile Cards or Desktop Table */}
      <div className="flex-grow-1">
        {isMobile ? (
          /* MOBILE VIEW (CARDS) */
          <div className="row g-3">
            {files.map(file => (
              <div key={file.id} className="col-12">
                <div className="p-3 rounded-4 border border-secondary border-opacity-10 bg-black bg-opacity-40 shadow-sm">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    {file.thumbnail ? <img src={file.thumbnail} alt="t" className="rounded border border-secondary border-opacity-20" style={{ width: '80px', height: '45px', objectFit: 'cover' }} /> : <div className="bg-secondary bg-opacity-10 rounded d-flex align-items-center justify-content-center" style={{ width: '80px', height: '45px' }}><Video className="text-muted" size={18}/></div>}
                    <div className="flex-grow-1 overflow-hidden">
                        <div className="fw-bold text-truncate small text-white">{file.name}</div>
                        <div className="d-flex justify-content-between align-items-center mt-1">
                            <span className={`badge rounded-pill ${file.status === 'completed' ? 'bg-success' : 'bg-primary'}`} style={{fontSize: '9px'}}>{file.status}</span>
                            <span className="text-warning fw-bold" style={{fontSize: '10px'}}><Clock size={12}/> {file.eta}</span>
                        </div>
                    </div>
                    <button onClick={() => setFiles(f => f.filter(x => x.id !== file.id))} className="btn text-danger p-1"><Trash2 size={20}/></button>
                  </div>
                  <div className="progress bg-black bg-opacity-50 mb-3" style={{height: '6px', borderRadius: '10px'}}>
                    <div className={`progress-bar rounded-pill ${file.status === 'completed' ? 'bg-success' : 'bg-info'}`} style={{width: `${file.progress}%`}}></div>
                  </div>
                  <div className="d-flex gap-2">
                    {file.status !== 'completed' && file.status !== 'downloading' && (
                        <button onClick={() => startOrStopRender(file)} className={`btn btn-sm flex-grow-1 rounded-pill fw-bold ${file.status === 'processing' ? 'btn-danger' : 'btn-outline-info'}`}>
                            {file.status === 'processing' ? 'Stop' : 'Start'}
                        </button>
                    )}
                    {file.status === 'completed' && <button className="btn btn-sm btn-success flex-grow-1 rounded-pill fw-bold"><Download size={14}/> Save</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* DESKTOP VIEW (TABLE) */
          <div className="overflow-auto rounded-4 border border-secondary border-opacity-10 bg-black bg-opacity-40 shadow-lg">
            <table className="table table-dark table-hover m-0 align-middle">
              <thead className="small text-uppercase fw-bold text-muted" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <tr><th className="ps-4 py-3">File Info</th><th style={{width: '35%'}}>Progress</th><th className="text-center py-3">Actions</th></tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file.id} className="border-bottom border-secondary border-opacity-10">
                    <td className="ps-4 py-3">
                      <div className="d-flex align-items-center gap-3">
                        {file.thumbnail ? <img src={file.thumbnail} alt="t" className="rounded border border-secondary border-opacity-20 shadow-sm" style={{ width: '100px', height: '56px', objectFit: 'cover' }} /> : <div className="bg-secondary bg-opacity-10 rounded d-flex align-items-center justify-content-center shadow-inner" style={{ width: '100px', height: '56px' }}>{file.status === 'downloading' ? <div className="spinner-border spinner-border-sm text-info"></div> : <Video className="text-muted" size={20}/>}</div>}
                        <div style={{ maxWidth: '280px' }}><div className="fw-bold text-truncate text-white" title={file.name}>{file.name}</div><div className="text-muted small text-truncate" style={{ fontSize: '10px', opacity: 0.5 }}>{file.path}</div></div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex justify-content-between mb-2 small font-monospace">
                        <span className={`badge rounded-pill px-3 ${file.status === 'completed' ? 'bg-success' : file.status === 'downloading' ? 'bg-info text-dark' : 'bg-primary'}`}>{file.status}</span>
                        <span className="text-warning fw-bold d-flex align-items-center gap-1"><Clock size={14}/> {file.status === 'completed' ? 'Done' : file.eta}</span>
                      </div>
                      <div className="progress bg-black bg-opacity-50" style={{height: '10px', borderRadius: '10px', padding: '1px'}}>
                        <div className={`progress-bar rounded-pill ${file.status === 'completed' ? 'bg-success' : 'bg-info progress-bar-striped progress-bar-animated'}`} style={{width: `${file.progress}%`, transition: 'width 0.4s ease'}}>{file.progress > 5 && <span style={{fontSize: '8px'}}>{Math.round(file.progress)}%</span>}</div>
                      </div>
                    </td>
                    <td className="text-center px-4">
                      <div className="d-flex justify-content-center align-items-center gap-2">
                        {file.status !== 'completed' && file.status !== 'downloading' && (
                          <button onClick={() => startOrStopRender(file)} className={`btn btn-sm rounded-pill px-4 fw-bold shadow-sm ${file.status === 'processing' ? 'btn-danger' : 'btn-outline-info'}`}>
                             {file.status === 'processing' ? <Square size={12} fill="currentColor" className="me-1"/> : <Play size={12} fill="currentColor" className="me-1"/>} {file.status === 'processing' ? 'Stop' : 'Start'}
                          </button>
                        )}
                        {file.status === 'completed' && <button className="btn btn-sm btn-success rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-1"><Download size={14}/> Save</button>}
                        <button onClick={() => setFiles(f => f.filter(x => x.id !== file.id))} className="btn btn-sm rounded-circle p-2 text-danger hover-bg-danger transition-all" style={{ background: 'rgba(255,255,255,0.05)' }}><Trash2 size={18}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`
        .shadow-info { box-shadow: 0 0 10px rgba(13, 202, 240, 0.4); }
        .hover-bg-danger:hover { background: rgba(220, 53, 69, 0.2) !important; }
        .transition-all { transition: all 0.2s ease; }
        .shadow-inner { box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06); }
      `}</style>
    </div>
  );
}

export default App;