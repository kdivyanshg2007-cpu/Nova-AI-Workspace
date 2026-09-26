# Nova AI Workspace

Nova AI Workspace is a full-stack AI productivity workspace built with React, FastAPI, PostgreSQL, and Gemini.

## Overview

Nova AI Workspace brings AI chat, document intelligence, coding, research, data analysis, productivity tools, memory, and workspace management into one application.

The project is designed as a portfolio-level full-stack AI application with user authentication, workspace-based data organization, document retrieval/RAG, AI-powered workflows, and production deployment.

## Core Features

- AI Chat & Multimodal interaction
- PDF / Document Intelligence
- Document Q&A with RAG and source references
- AI Agents
- AI Autopilot / Workflows
- AI Coding Workspace
- AI Research workspace
- AI Data Analysis
- Content and file generation
- Workspace, memory, notes, tasks, preferences, and usage features
- Security, personalization, and AI evaluation features

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- Tailwind CSS / UI components

### Backend
- Python
- FastAPI
- Uvicorn
- Pydantic
- Google Gemini API

### Database
- PostgreSQL
- psycopg2

### AI / RAG
- Gemini API
- Document embeddings
- Semantic retrieval
- Workspace and user scoped document retrieval

### Development
- Git
- GitHub
- Visual Studio Code

### Deployment
- Frontend: Vercel
- Backend: Render
- Database: Hosted PostgreSQL

## Project Structure

```text
Nova-AI-Workspace/
├── backend/
│   ├── main.py
│   ├── document_qa.py
│   ├── retrieval_service.py
│   ├── rag_service.py
│   ├── ai_service.py
│   ├── database.py
│   ├── settings.py
│   ├── auth.py
│   ├── tests/
│   └── ...
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── uploads/
├── .env.example
├── .gitignore
├── config.py
├── config.yaml
└── README.md
```

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/kdivyanshg2007-cpu/Nova-AI-Workspace.git
cd Nova-AI-Workspace
```

### 2. Backend setup

Create/activate a Python environment as preferred, then install backend dependencies.

```bash
cd backend
python -m pip install -r requirements.txt
```

If your local project uses a different dependency installation method, follow the files currently present in `backend/`.

### 3. Environment variables

Create the backend environment file from the example configuration and add your own values.

Important values include:

```text
DATABASE_URL=your_database_url
GEMINI_API_KEY=your_gemini_api_key
```

Never commit real API keys or secrets to GitHub.

### 4. Run the backend

From the `backend` directory:

```bash
python -m uvicorn main:app --reload
```

The API uses the `/api/v1` prefix.

### 5. Run the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will display the local frontend URL.

## Document Q&A / RAG

Document Q&A follows this flow:

```text
User question
      ↓
Authenticated workspace
      ↓
Document retrieval
      ↓
Relevant document chunks
      ↓
Grounded prompt
      ↓
Gemini
      ↓
Answer + sources
```

Document retrieval is scoped to the authenticated user and selected workspace.

The production retrieval layer is designed to work with the current hosted database schema without requiring `document_chunks.file_id` to exist.

## Testing

Document Q&A has dedicated regression tests.

Run them from the backend directory:

```bash
python -m pytest tests/test_document_qa.py -q
```

The current local regression suite verifies key cases including:

- Successful grounded document answering
- Empty retrieval handling
- Invalid user/workspace handling
- Retrieval user scoping
- Graceful AI/retrieval failure behavior

## Security Notes

- Authentication is required for protected workspace operations.
- Workspace ownership is checked before document Q&A access.
- Document retrieval is scoped to the authenticated user.
- API keys are kept in environment variables.
- Secrets should never be committed to Git.
- File and document access should remain isolated by user/workspace.

## Production Deployment

The project is connected to GitHub and deployed using separate frontend and backend services.

Typical release flow:

```text
Local change
   ↓
Run tests
   ↓
Git commit
   ↓
git push origin master
   ↓
Render / Vercel deployment
   ↓
Production smoke test
```

## Production Verification

A production Document Q&A flow has been verified after the retrieval/schema hardening work:

```text
Upload document
   ↓
Document processed
   ↓
Ask question
   ↓
Relevant answer returned
```

## Development Notes

This project is continuously evolving. Dependency versions, AI model configuration, deployment settings, and provider limits may change over time.

Keep production secrets outside source control and verify provider/library documentation when updating integrations.

## Future Improvements

- Expand end-to-end regression coverage
- Improve retrieval ranking and evaluation datasets
- Add deeper observability and cost controls
- Improve mobile/accessibility polish
- Expand documentation and architecture diagrams
- Add portfolio screenshots and demo materials

## Author

Nova AI Workspace — personal full-stack AI portfolio project.

## License

Add a project license here if you plan to publish the repository under a specific open-source license.
