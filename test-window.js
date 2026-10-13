const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  console.log('App ready');
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'AutoPokeSurvivor Test',
  });

  win.on('ready-to-show', () => {
    console.log('[DIAG] event: ready-to-show, isVisible:', win.isVisible());
  });
  win.on('show', () => {
    console.log('[DIAG] event: show, isVisible:', win.isVisible());
  });
  win.on('hide', () => {
    console.log('[DIAG] event: hide');
  });
  win.on('closed', () => {
    console.log('[DIAG] event: closed');
  });

  console.log('[DIAG] after ctor isVisible:', win.isVisible());
  console.log('[DIAG] handle buf:', win.getNativeWindowHandle());

  win.loadFile(path.join(__dirname, 'dist', 'renderer', 'index.html')).then(() => {
    console.log('[DIAG] loadFile resolved');
  }).catch((err) => {
    console.error('[DIAG] loadFile error:', err);
  });

  setTimeout(() => {
    console.log('[DIAG] at 2s: isVisible:', win.isVisible(), 'isMinimized:', win.isMinimized());
    app.quit();
  }, 2500);
});
