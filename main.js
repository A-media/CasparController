const electron = require('electron')
// Module to control application life.
const {app} = require('electron')
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const Menu = electron.Menu;
const {webContents} = require('electron')
const {ipcMain} = require('electron')
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let contents
function createWindow () {
  // Create the browser window.
  mainWindow  = new BrowserWindow({width: 800, height: 600, resizable: false})
  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
  }))
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
    app.quit()
  })
}

function createLogWin() {
  logWindow = null
  logWindow   = new BrowserWindow({width: 600, height: 400, show: false})
  logWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'log.html'),
    protocol: 'file',
    slashes: true,
  }))
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
  createWindow();
  createLogWin();
  const menuTemplate = [
    {
      label: app.getName(),
      submenu: [
        {
          label: "Om Caspar controller",
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Tjänster',
          role: 'services',
          submenu: []
        },
        {
          label: 'Stäng fönster',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        },
        {
          label: 'Dölj Caspar controller',
          accelerator: 'CmdOrCtrl+H',
          role: 'hide'
        },
        {
          role: 'hideothers',
          accelerator: 'CmdOrCtrl+Alt+H'
        },
        {
          label: 'Visa alla',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Avsluta Caspar controller',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            mainWindow.webContents.executeJavaScript("ccg.clear(2);");
            mainWindow.webContents.executeJavaScript("ccg.disconnect();");
            mainWindow.webContents.executeJavaScript("xkeys.setAllBlueBackLights(true);");
            mainWindow.webContents.executeJavaScript("xkeys.setAllRedBackLights(true);");
            setTimeout(function(){app.quit()},1000);
          }
        }
      ]
    },
    {
      label: 'Redigera',
      submenu: [
        {
          label: 'uppdatera',
          accelerator: 'CmdOrCtrl+R',
          role: 'reload'
        },
        {
          label: 'Klip ut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'Kopiera',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Klistra in',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        }
      ]
    },
    {
      label: 'Playout',
      submenu: [
        {
          label: 'Starta/Stoppa',
          accelerator: 'Alt+shift+F1',
          click: () => {
            mainWindow.webContents.executeJavaScript("ccgRun();");
          }
        },
        {
          label: 'Play',
          accelerator: 'Alt+F2',
          click: () => {
            mainWindow.webContents.executeJavaScript("sendPlayToCCG();");
          }
        },
        {
          label: 'Pause',
          accelerator: 'Alt+F4',
          click: () => {
            mainWindow.webContents.executeJavaScript("sendPauseToCCG();");
          }
        },
        {
          label: 'Next',
          accelerator: 'Alt+F5',
          click: () => {
            mainWindow.webContents.executeJavaScript("nextOnList();");
          }
        },
        {
          label: 'Previous',
          accelerator: 'Alt+F6',
          click: () => {
            mainWindow.webContents.executeJavaScript("previousOnList();");
          }
        },
        {
        type: 'separator'
        },
        {
          label: '10 frames Bak',
          accelerator: 'Alt+1',
          click: () => {
            mainWindow.webContents.executeJavaScript("nudge('backward',10)")
          }
        },
        {
          label: '10 frames fram',
          accelerator: 'Alt+2',
          click: () => {
            mainWindow.webContents.executeJavaScript("nudge('forward',10)")
          }
        },
        {
          label: '1 frame Bak',
          accelerator: 'Alt+3',
          click: () => {
            mainWindow.webContents.executeJavaScript("nudge('backward',1)")
          }
        },
        {
          label: '1 frame Fram',
          accelerator: 'Alt+4',
          click: () => {
            mainWindow.webContents.executeJavaScript("nudge('forward',1)")
          }
        },
        {
        type: 'separator'
        },
        {
          label: 'Klocka',
          accelerator: 'Alt+F7',
          click: () => {
            mainWindow.webContents.executeJavaScript("ChannelClock();");
          }
        },
        {
          label: 'Logo',
          accelerator: 'Alt+F8',
          click: () => {
            mainWindow.webContents.executeJavaScript("ChannelLogo();");
          }
        },
      ]
    },
    {
      label: 'Teleprompter',
      submenu: [
        {
          label: 'Starta/Stoppa',
          accelerator: 'alt+F12',
          click: () => {
            mainWindow.webContents.executeJavaScript("PrompterRun();");
          }
        },
        {
          label: 'Previous',
          accelerator: 'alt+a',
          click: () => {
            mainWindow.webContents.executeJavaScript("sendPrompterCommand('previous');");
          }
        },
        {
          label: 'Next',
          accelerator: 'alt+s',
          click: () => {
            mainWindow.webContents.executeJavaScript("sendPrompterCommand('next');");
          }
        },
        {
          label: 'Slower',
          accelerator: 'alt+d',
          click: () => {
            mainWindow.webContents.executeJavaScript("sendPrompterCommand('minus');");
          }
        },
        {
          label: 'Faster',
          accelerator: 'alt+f',
          click: () => {
            mainWindow.webContents.executeJavaScript("sendPrompterCommand('plus');");
          }
        },
      ]
    },
    {
      label: 'Fönster',
      submenu: [
        {
          label: 'Visa log',
          accelerator: 'CmdOrCtrl+shift+L',
          click: () => {
            createLogWin()
            logWindow.show()
          }
        },
        {
          label: 'Minimera',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        }
      ]
    },
    {
      label: 'Hjälp',
      role: 'help',
      submenu: [
      {
       label: 'Learn More',
       click () { require('electron').shell.openExternal('http://electron.atom.io') }
      }
      ]
    }
];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
  if (logWindow === null) {
    createLogWin()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


app.setAboutPanelOptions({
  copyright: "Copyright \u00A9 2017 A Media",
  credits: "Skapad av: Andreas Andersson"
})

ipcMain.on('asynchronous-message', (event, data, err) => {
  logWindow.webContents.send('asynchronous-reply', data, err)
})
