import {Menu, app, dialog, BrowserWindow, ipcMain} from "electron"
import { SelectedPopulation } from "./src/interfaces/ImageInterfaces"
import * as _ from "underscore"

const path = require('path')
const url = require('url')


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: Electron.BrowserWindow | null
let plotWindow: Electron.BrowserWindow | null

function generateMenuTemplate(imageLoaded: boolean) {
  return [{
    label: "File",
    submenu: [
    {
      label: "Open folder",
      click: () => {
        dialog.showOpenDialog({properties: ["openDirectory"]}, (dirName:string[]) => {
          if(mainWindow != null && dirName != null)
            mainWindow.webContents.send("open-directory", dirName[0])
            if(plotWindow != null) plotWindow.webContents.send("open-directory", dirName[0])
            // Send the window size when loading a new directory so the PIXI stage resizes to fit the window.
            sendWindowSize()
        })
      }
    },
    {
    label: "Open segmentation file",
    enabled: imageLoaded,
    click: () => {
      dialog.showOpenDialog({properties: ["openFile"]},  (fileNames:string[]) => {
        if(mainWindow != null && fileNames != null)
          mainWindow.webContents.send("open-segmentation-file", fileNames[0])
          if(plotWindow != null) plotWindow.webContents.send("open-segmentation-file", fileNames[0])
        })
      }
    },
    {
      label: "Add populations from CSV",
      enabled: imageLoaded,
      click: () => {
        dialog.showOpenDialog({properties: ["openFile"], filters: [{ name: 'csv', extensions: ['csv'] }]},  (fileNames:string[]) => {
          if(mainWindow != null && fileNames != null)
            mainWindow.webContents.send("add-populations-csv", fileNames[0])
        })
      }
    },
    {
      label: "Import selected populations",
      enabled: imageLoaded,
      click: () => {
        dialog.showOpenDialog({properties: ["openFile"], filters: [{ name: 'json', extensions: ['json'] }]},  (fileNames:string[]) => {
          if(mainWindow != null && fileNames != null)
            mainWindow.webContents.send("import-selected-populations", fileNames[0])
          })
        }
      },
    {
      label: "Export selected populations",
      enabled: imageLoaded,
      click: () => {
        dialog.showSaveDialog({filters: [{ name: 'json', extensions: ['json'] }]},  (filename:string) => {
          if(mainWindow != null && filename != null)
            mainWindow.webContents.send("export-selected-populations", filename)
        })
      }
    },
      {
        label: "Quit",
        click: () => {
          app.quit()
        }
      }
    ],
  },
{
  label: "Window",
  submenu: [
    {
      label: "Open Plot Window",
      click: () => {
        if(plotWindow != null) plotWindow.show()
      }
    }
  ]
}]
}

function sendWindowSize() {
  if(mainWindow != null){
    let dimensions = mainWindow.getSize()
    mainWindow.webContents.send("window-size", dimensions[0], dimensions[1])
  }
  if(plotWindow != null){
    let dimensions = plotWindow.getSize()
    plotWindow.webContents.send("window-size", dimensions[0], dimensions[1])
  }
}

function setMenu(imageLoaded = false) {
  let menuTemplate = generateMenuTemplate(imageLoaded)
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
}

function createMainWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1540, height: 740, show: false, webPreferences: { experimentalFeatures: true, nodeIntegrationInWorker: true }})
  setMenu()
  
  // TODO: Set to 1280 x 720 when not using DevTools.
  mainWindow.setMinimumSize(1540, 740)

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'app', 'mainWindow.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  // Use throttle so that when we resize we only send the window size every 333 ms
  mainWindow.on('resize', _.throttle(sendWindowSize, 333))
  mainWindow.on('enter-full-screen', sendWindowSize)
  mainWindow.on('leave-full-screen', sendWindowSize)

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
    plotWindow = null
  })

  mainWindow.on('ready-to-show', () => {
    if(mainWindow != null) mainWindow.show()
  })
}

function createPlotWindow() {
  plotWindow = new BrowserWindow({width: 800, height: 800, show: false, webPreferences: { experimentalFeatures: true, nodeIntegrationInWorker: true}})

  plotWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'app', 'plotWindow.html'),
      protocol: 'file:',
      slashes: true
    }))

  plotWindow.webContents.openDevTools()

  plotWindow.on('close', function (event: Electron.Event) {
    event.preventDefault()
    if(plotWindow != null) plotWindow.hide()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createMainWindow)
app.on('ready', createPlotWindow)

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
    createMainWindow()
  }
})

ipcMain.on('update-menu', (event:Electron.Event, imageLoaded:boolean) => {
  setMenu(imageLoaded)
})

ipcMain.on('set-plot-populations', (event:Electron.Event, populations:SelectedPopulation[]) => {
  if(plotWindow != null) plotWindow.webContents.send("set-populations", populations)
})

ipcMain.on('add-selected-population', (event:Electron.Event, segmentIds: number[]) => {
  if(mainWindow != null) mainWindow.webContents.send('add-selected-population', segmentIds)
})

ipcMain.on('set-hovered-segments', (event:Electron.Event, segmentIds: number[]) => {
  if(mainWindow != null) mainWindow.webContents.send('set-hovered-segments', segmentIds)
})