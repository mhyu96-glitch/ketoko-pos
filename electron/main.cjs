const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");
const lanServer = require("./lanServer.cjs");

// Fix SIGBUS crash on Linux (Fedora/SELinux) — disable Chromium sandbox
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");

let mainWindow = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Ketoko POS - Sistem Kasir & Manajemen Toko",
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    backgroundColor: "#fcf9f5",
    show: false
  });

  Menu.setApplicationMenu(null);

  // Handle external links by opening in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:") || url.startsWith("tel:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Desktop keyboard shortcuts: Fullscreen (F11), Reload (F5 / Ctrl+R), DevTools (F12 / Ctrl+Shift+I)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    if (input.key === "F11") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
      mainWindow.reload();
      event.preventDefault();
    } else if (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.control && (input.key === "=" || input.key === "+")) {
      const zoom = mainWindow.webContents.getZoomFactor();
      mainWindow.webContents.setZoomFactor(Math.min(zoom + 0.1, 2.0));
      event.preventDefault();
    } else if (input.control && input.key === "-") {
      const zoom = mainWindow.webContents.getZoomFactor();
      mainWindow.webContents.setZoomFactor(Math.max(zoom - 0.1, 0.6));
      event.preventDefault();
    } else if (input.control && input.key === "0") {
      mainWindow.webContents.setZoomFactor(1.0);
      event.preventDefault();
    }
  });

  const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");
  
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Auto-start Central LAN Server on port 5858
  try {
    lanServer.startLanServer({
      port: 5858,
      distPath: path.join(__dirname, "../dist"),
      dataDir: app.getPath("userData")
    });
  } catch (err) {
    console.error("[Main] Error auto-starting LAN server:", err);
  }

  // Register IPC handlers for LAN Server control
  ipcMain.handle("lan:getStatus", () => {
    return lanServer.getLanServerStatus();
  });

  ipcMain.handle("lan:start", (event, port) => {
    return lanServer.startLanServer({
      port: port || 5858,
      distPath: path.join(__dirname, "../dist"),
      dataDir: app.getPath("userData")
    });
  });

  ipcMain.handle("lan:stop", () => {
    return lanServer.stopLanServer();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  try {
    lanServer.stopLanServer();
  } catch {}
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
