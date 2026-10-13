const { app, BrowserWindow, BrowserView, session } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  console.log('App ready');
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'AutoPokeSurvivor Test with BrowserView',
  });

  win.on('ready-to-show', () => {
    console.log('[WIN] ready-to-show, isVisible:', win.isVisible());
  });
  win.on('show', () => {
    console.log('[WIN] show, isVisible:', win.isVisible());
  });
  win.on('hide', () => {
    console.log('[WIN] hide');
  });
  win.on('closed', () => {
    console.log('[WIN] closed');
  });

  win.loadFile(path.join(__dirname, 'dist', 'renderer', 'index.html')).then(() => {
    console.log('[WIN] loadFile resolved');
  }).catch((err) => {
    console.error('[WIN] loadFile error:', err);
  });

  const gameSession = session.fromPartition('persist:pokesurvivor', { cache: true });
  const gameView = new BrowserView({
    webPreferences: {
      session: gameSession,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.addBrowserView(gameView);
  const bounds = win.getContentBounds();
  console.log('[WIN] contentBounds:', bounds);
  gameView.setBounds({
    x: 320,
    y: 0,
    width: Math.max(bounds.width - 320, 200),
    height: bounds.height,
  });

  gameView.webContents.on('did-finish-load', () => {
    console.log('[GAMEVIEW] did-finish-load');
  });
  gameView.webContents.on('did-fail-load', (_e, code, desc) => {
    console.log('[GAMEVIEW] did-fail-load:', code, desc);
  });

  gameView.webContents.loadURL('https://pokesurvivor.com/').then(() => {
    console.log('[GAMEVIEW] loadURL resolved');
  });

  setTimeout(() => {
    console.log('[CHECK at 3s] win isVisible:', win.isVisible(), 'isMinimized:', win.isMinimized());
    console.log('[CHECK at 3s] nativeHandle:', win.getNativeWindowHandle().readInt32LE(0));
    app.quit();
  }, 4000);
});
