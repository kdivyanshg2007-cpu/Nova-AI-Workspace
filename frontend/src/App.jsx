import "./App.css";

import { useState } from "react";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Document from "./pages/Document";
import Chat from "./pages/Chat";
import DataAnalysis from "./pages/DataAnalysis";

import Workspace from "../Workspace";
import CodingWorkspace from "./components/CodingWorkspace";
import ResearchWorkspace from "./components/ResearchWorkspace";
import SharedResearch from "./components/SharedResearch";

function App() {
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;

    if (path === "/chat") return "chat";
    if (path === "/document") return "document";
    if (path === "/coding") return "coding";
    if (path === "/research") return "research";
    if (path === "/data-analysis") return "data-analysis";

    if (path.startsWith("/shared/")) {
      return "shared-research";
    }

    return localStorage.getItem("nova_token")
      ? "dashboard"
      : "login";
  });

  const [selectedWorkspace, setSelectedWorkspace] = useState(() => {
    const savedWorkspace = localStorage.getItem("nova_workspace");

    if (!savedWorkspace) {
      return null;
    }

    try {
      return JSON.parse(savedWorkspace);
    } catch {
      return null;
    }
  });

  const handleLogin = () => {
    setPage("dashboard");
    window.history.pushState({}, "", "/");
  };

  const handleLogout = () => {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_user");
    localStorage.removeItem("nova_workspace_id");
    localStorage.removeItem("nova_workspace");

    setSelectedWorkspace(null);
    setPage("login");

    window.history.pushState({}, "", "/");
  };

  const handleOpenWorkspace = (workspace) => {
    const workspaceId =
      workspace?.id ??
      workspace?.workspace_id ??
      null;

    const normalizedWorkspace = {
      ...workspace,
      id: workspaceId,
    };

    setSelectedWorkspace(normalizedWorkspace);

    localStorage.setItem(
      "nova_workspace",
      JSON.stringify(normalizedWorkspace),
    );

    if (workspaceId) {
      localStorage.setItem(
        "nova_workspace_id",
        String(workspaceId),
      );
    }

    setPage("workspace");
    window.history.pushState({}, "", "/");
  };

  const handleBackToDashboard = () => {
    setSelectedWorkspace(null);
    setPage("dashboard");
    window.history.pushState({}, "", "/");
  };

  const handleBackToWorkspace = () => {
    setPage("workspace");
    window.history.pushState({}, "", "/");
  };

  const handleOpenDataAnalysis = () => {
    setPage("data-analysis");
    window.history.pushState(
      {},
      "",
      "/data-analysis",
    );
  };

  if (page === "shared-research") {
    return <SharedResearch />;
  }

  if (page === "login") {
    return (
      <div className="nova-route nova-route-auth">
        <Login
          onSignup={() => setPage("signup")}
          onLogin={handleLogin}
        />
      </div>
    );
  }

  if (page === "signup") {
    return (
      <div className="nova-route nova-route-auth">
        <Signup
          onLogin={() => setPage("login")}
        />
      </div>
    );
  }

  if (page === "dashboard") {
    return (
      <div className="nova-route nova-route-app">
        <Dashboard
          onLogout={handleLogout}
          onOpenWorkspace={handleOpenWorkspace}
        />
      </div>
    );
  }

  if (page === "workspace") {
    return (
      <div className="nova-route nova-route-app">
        <Workspace
          workspace={selectedWorkspace}
          onBack={handleBackToDashboard}
          onOpenDataAnalysis={handleOpenDataAnalysis}
        />
      </div>
    );
  }

  if (page === "data-analysis") {
    return (
      <div className="nova-route nova-route-app">
        <DataAnalysis
          workspace={selectedWorkspace}
          onBack={handleBackToWorkspace}
        />
      </div>
    );
  }

  if (page === "chat") {
    return (
      <div className="nova-route nova-route-app">
        <Chat
          workspace={selectedWorkspace}
          onBack={handleBackToWorkspace}
        />
      </div>
    );
  }

  if (page === "document") {
    return (
      <div className="nova-route nova-route-app">
        <Document
          workspace={selectedWorkspace}
          onBack={handleBackToWorkspace}
        />
      </div>
    );
  }

  if (page === "coding") {
    return (
      <div className="nova-route nova-route-app">
        <CodingWorkspace
          workspace={selectedWorkspace}
          onBack={handleBackToWorkspace}
        />
      </div>
    );
  }

  if (page === "research") {
    return (
      <div className="nova-route nova-route-app">
        <ResearchWorkspace
          workspace={selectedWorkspace}
          onBack={handleBackToWorkspace}
        />
      </div>
    );
  }

  return null;
}

export default App;