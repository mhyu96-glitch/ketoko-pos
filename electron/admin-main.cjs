const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

let adminWindow = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (adminWindow) {
      if (adminWindow.isMinimized()) adminWindow.restore();
      adminWindow.focus();
    }
  });
}

function createAdminWindow() {
  adminWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "Ketoko POS — Super Admin & Vendor Control Center",
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    backgroundColor: "#f8fafc",
    show: false
  });

  Menu.setApplicationMenu(null);

  // Handle external links (WhatsApp, Google Maps, URLs) by opening in default OS browser
  adminWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:") || url.startsWith("tel:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Desktop keyboard shortcuts: Fullscreen (F11), Reload (F5 / Ctrl+R), DevTools (F12 / Ctrl+Shift+I)
  adminWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    if (input.key === "F11") {
      adminWindow.setFullScreen(!adminWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
      adminWindow.reload();
      event.preventDefault();
    } else if (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")) {
      adminWindow.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.control && (input.key === "=" || input.key === "+")) {
      const zoom = adminWindow.webContents.getZoomFactor();
      adminWindow.webContents.setZoomFactor(Math.min(zoom + 0.1, 2.0));
      event.preventDefault();
    } else if (input.control && input.key === "-") {
      const zoom = adminWindow.webContents.getZoomFactor();
      adminWindow.webContents.setZoomFactor(Math.max(zoom - 0.1, 0.6));
      event.preventDefault();
    } else if (input.control && input.key === "0") {
      adminWindow.webContents.setZoomFactor(1.0);
      event.preventDefault();
    }
  });

  adminWindow.loadFile(path.join(__dirname, "../super-admin.html"));

  adminWindow.once("ready-to-show", () => {
    adminWindow.maximize();
    adminWindow.show();
  });

  adminWindow.on("closed", () => {
    adminWindow = null;
  });
}

app.whenReady().then(() => {
  createAdminWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createAdminWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
