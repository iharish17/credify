# Credify - Bulk Certificate Generator

A modern full-stack application for generating personalized certificates in bulk from a template and participant list. Designed for simplicity, speed, and scalability.

## 🎯 Overview

Credify streamlines the certificate generation process by allowing users to:
- Upload a template (PDF, PNG, or JPG)
- Provide a list of participant names via CSV
- Customize placement, fonts, colors, and certificate IDs
- Generate batch certificates with a single click
- Track progress in real-time
- Download all certificates as a ZIP file

Perfect for educational institutions, conferences, online courses, and corporate training programs.

## ✨ Features

### Template Management
- 📄 **Multiple Formats** - Support for PDF, PNG, and JPG templates
- 💾 **Saved Templates** - Upload once, use for multiple batches
- 🎨 **Template Library** - Browse and manage saved templates
- 🗑️ **Easy Deletion** - Remove templates with confirmation dialog

### Certificate Customization
- 📍 **Precise Positioning** - X/Y coordinates for exact name placement
- ✏️ **Drag & Drop** - Visually position names on preview
- 🎨 **Color Control** - Customize participant name color
- 🔢 **Dynamic Sizing** - Adjust font size for different templates
- 🏷️ **Certificate IDs** - Add sequential IDs (e.g., CERT-001, CERT-002)
- 📱 **QR Codes** - Optional QR codes on certificates

### Batch Management
- 📊 **Progress Tracking** - Real-time status updates
- 👥 **Participant List** - View and manage all participants
- 📥 **Download Options** - Individual certificates or batch ZIP
- ✅ **Batch History** - Track all generated batches
- ♻️ **Re-edit** - Adjust and regenerate batches with new settings
- 🗑️ **Batch Deletion** - Remove batches with confirmation

### CSV Support
- 📋 **Standard Format** - Simple Name column in CSV
- 📥 **Template Download** - Pre-formatted CSV template
- 🔄 **Flexible Parsing** - Handles various CSV formats
- ✨ **Clean Data** - Automatic name normalization

## 🏗️ Project Structure

```
Credify/
├── backend/                    # Node.js/Express API Server
│   ├── .gitignore
│   ├── package.json            # Backend dependencies
│   ├── package-lock.json
│   ├── node_modules/           # Isolated backend packages
│   ├── src/
│   │   ├── server.js           # Express app & API routes
│   │   ├── services/
│   │   │   ├── certificateService.js    # PDF generation logic
│   │   │   └── csvService.js            # CSV parsing
│   │   └── utils/
│   │       ├── batchStore.js            # In-memory batch tracking
│   │       ├── errors.js                # Error handling
│   │       ├── fileSystem.js            # File operations
│   │       └── fontConfig.js            # Font configuration
│   ├── storage/                # Persistent template storage
│   └── fonts/                  # Font files for certificates
│
├── frontend/                   # React SPA (Vite)
│   ├── .gitignore
│   ├── package.json            # Frontend dependencies
│   ├── package-lock.json
│   ├── node_modules/           # Isolated frontend packages
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx             # Main app component
│   │   ├── main.jsx            # React entry point
│   │   ├── styles.css          # Global styles
│   │   ├── fontOptions.js      # Font configuration
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx       # Batch history & management
│   │   │   ├── GeneratorPage.jsx       # Certificate generator
│   │   │   └── TemplatesPage.jsx       # Template management
│   │   ├── components/
│   │   │   ├── CertificatePreview.jsx
│   │   │   └── FileDropInput.jsx
│   │   └── utils/
│   │       └── templateHelpers.js      # File utilities
│   ├── public/                 # Static assets
│   └── dist/                   # Built production files
│
├── .gitignore                  # Root-level ignores
├── DEPLOYMENT.md               # Deployment guide
├── README.md                   # This file
└── package.json                # (Root - removed, use per-service)
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** 9+

### Installation

**1. Clone repository**
```bash
git clone https://github.com/iharish17/credify.git
cd credify
```

**2. Install Backend Dependencies**
```bash
cd backend
npm install
```

**3. Install Frontend Dependencies** (in another terminal)
```bash
cd frontend
npm install
```

### Development Setup

**Terminal 1 - Start Backend (port 4000)**
```bash
cd backend
npm run dev
```

**Terminal 2 - Start Frontend (port 5173)**
```bash
cd frontend
npm run dev
```

**3. Open in Browser**
```
http://localhost:5173
```

The app will automatically connect to the backend at `http://localhost:4000`

## 🔧 Available Scripts

### Backend

```bash
npm run dev      # Start with nodemon (hot reload)
npm start        # Start production server
npm run build    # Validate syntax
```

### Frontend

```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 📦 Production Build

### Backend
```bash
cd backend
npm run build    # Validate
npm install --production
npm start
```

**Runs on:** `http://localhost:4000`

### Frontend
```bash
cd frontend
npm run build
npm install --production
```

**Output:** `frontend/dist/`

Serve with nginx, apache, or any static host.

## 🛠️ Technology Stack

### Backend
| Tool | Purpose |
|------|---------|
| **Express.js** | REST API framework |
| **Node.js** | JavaScript runtime |
| **pdf-lib** | PDF generation & manipulation |
| **QRCode** | QR code generation |
| **multer** | File upload handling |
| **csv-parser** | CSV parsing |
| **cors** | Cross-origin requests |
| **morgan** | HTTP logging |
| **archiver** | ZIP file creation |

### Frontend
| Tool | Purpose |
|------|---------|
| **React 18** | UI component library |
| **Vite** | Build tool & dev server |
| **React Router** | Page navigation |
| **PDF.js** | PDF preview rendering |
| **CSS3** | Styling & responsive design |

## 📡 API Endpoints

### Templates
```
GET  /api/templates                        # List all templates
POST /api/templates                        # Upload new template
GET  /api/templates/:id                    # Download template
DELETE /api/templates/:id                  # Delete template
```

### Batches
```
POST /api/batches                          # Create & start batch
GET  /api/batches                          # List recent batches
GET  /api/batches/:batchId/status          # Get batch status
GET  /api/batches/:batchId/download        # Download ZIP
GET  /api/batches/:batchId/participants    # List participants
GET  /api/batches/:batchId/certificates/:fileName/view     # Preview cert
GET  /api/batches/:batchId/certificates/:fileName/download # Download cert
GET  /api/batches/:batchId/reedit-config   # Get re-edit settings
GET  /api/batches/:batchId/template        # Get template file
GET  /api/batches/:batchId/csv/download    # Get CSV file
DELETE /api/batches/:batchId                # Delete batch
```

## 💡 How It Works

### Certificate Generation Flow

1. **Upload Phase**
   - User uploads template (PDF/PNG/JPG)
   - User uploads CSV with participant names
   - User configures name placement, font, colors, and optional certificate IDs

2. **Processing Phase**
   - Backend validates files and settings
   - CSV is parsed to extract participant names
   - Batch is queued for processing with concurrent workers
   - Each participant name is drawn onto template using pdf-lib
   - Optional certificate IDs are added sequentially
   - Individual PDFs are generated and stored

3. **Download Phase**
   - All PDFs are packaged into a ZIP file
   - User can download individual certificates or full batch
   - Batch metadata is persisted for re-editing

### Data Persistence

- **Batch Metadata**: Saved to disk in JSON format for recovery
- **Template Files**: Stored in `backend/storage/templates/`
- **Participant CSVs**: Saved with batch for re-edit support
- **Generated Certificates**: Stored in OS temp directory

### Re-edit Feature

Users can revisit any batch and:
- Change name placement without re-uploading
- Adjust font sizes and colors
- Modify certificate ID settings
- Add or remove QR codes
- Regenerate all certificates with new settings
- Original template and CSV are automatically loaded

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions including:
- Docker setup (single service and compose)
- Environment variables
- Nginx configuration
- Production best practices
- Troubleshooting guide

## 📋 CSV Format

Simple format with a `Name` column:

```csv
Name
Alex Johnson
Priya Sharma
Chris Evans
Jordan Lee
Morgan Taylor
```

Download the template from the Generator page to get started!

## 🔒 Security

- File upload validation (MIME types, size limits - max 15MB)
- Sanitized file names to prevent vulnerabilities
- CORS configuration for controlled access
- Error messages don't expose sensitive system details
- Temporary files auto-cleanup after expiration (30 minutes)
- No user authentication required (design choice for MVP)

## 📝 License

GNU Affero General Public License v3.0 (AGPL-3.0)

## 👥 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🆘 Troubleshooting

### Backend won't start

**Port 4000 in use?**
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti :4000 | xargs kill -9
```

**Dependencies issue?**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Frontend won't connect

- Ensure backend is running on port 4000
- Check http://localhost:4000/api/batches works in browser
- Check CORS settings in backend/src/server.js
- Check browser console for API errors (F12)

### Build issues

```bash
# Clear everything and reinstall
rm -rf node_modules package-lock.json
npm install

# Frontend: clear Vite cache
rm -rf dist .vite
```

### Certificates not generating

- Verify CSV has "Name" column
- Check template format (PDF, PNG, or JPG only)
- Ensure X/Y coordinates are within template bounds
- Check backend logs for detailed error messages
- Verify font is available (default: Helvetica)

## 📊 Performance

- **Concurrent Processing**: Uses worker pool for fast batch generation
- **Real-time Updates**: WebSocket-ready architecture (future enhancement)
- **Batch Caching**: Recent batches stored in memory for quick access
- **Disk Fallback**: Persisted batches recoverable after restart

## 🚢 Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `PORT` environment variable
- [ ] Set up reverse proxy (nginx) for frontend
- [ ] Enable HTTPS with SSL certificate
- [ ] Configure CORS for your domain
- [ ] Set up logging and monitoring
- [ ] Configure backup for templates directory
- [ ] Test re-edit and batch recovery flows

## 📞 Support

For issues and questions:
- Review terminal output for error messages and stack traces
- Check browser console for frontend errors (F12 → Console)
- Enable Morgan logging to debug API requests

## 🎉 Credits

Built with ❤️ using modern web technologies.

---

**Current Version**: 1.0.0  
**Last Updated**: March 2026  
**Developed By**: Harish Kumar

