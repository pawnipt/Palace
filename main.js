const {app, Menu, BrowserWindow} = require('electron');
const path = require('path');
const url = require('url');
const os = require('os');
const Raven = require('raven');

Raven.config('https://2e2f7f94e86c471189b46bc12abcf6c9@sentry.pchat.palaceworld.net/2', {
    captureUnhandledRejections: true,
    tags: {
        process: process.type,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        platform: os.platform(),
        platform_release: os.release()
    }
}).install();
let win;

app.commandLine.appendSwitch('high-dpi-support', 'true'); // might not be needed
app.commandLine.appendSwitch('force-device-scale-factor', '1'); // quick fix for user coordinates offset when windows desktop scaling is active

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.


function createWindow () {
	let screen = require('electron').screen;
    let display = screen.getPrimaryDisplay();
    let area = display.workArea;



  // Create the browser window.
  win = new BrowserWindow({width: area.width, height: area.height});


  //win.hide(); // seems to make launching look alittle better...
  win.maximize();

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Open the DevTools.
  //win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
    app.quit()
  });
  //win.toggleDevTools();

const template = [
  {
    label: 'Edit',
    submenu: [
      {role: 'undo'},
      {role: 'redo'},
      {type: 'separator'},
      {role: 'cut'},
      {role: 'copy'},
      {role: 'paste'},
      {role: 'pasteandmatchstyle'},
      {role: 'delete'},
      {role: 'selectall'}
    ]
  },
  {
    label: 'View',
    submenu: [
      {role: 'resetzoom'},
      {role: 'zoomin'},
      {role: 'zoomout'},
      {type: 'separator'},
      {role: 'togglefullscreen'}
    ]
  },
  {
	label: 'Developer',
	submenu: [
	  {role: 'reload'},
	  {role: 'forcereload'},
	  {label: 'Clear Cache...',
	   click() {
		   win.webContents.session.clearCache(function(){
		   //some callback.
		   });
	   }
	  },
	  {type: 'separator'},
	  {role: 'toggledevtools'}
	]
  },
  // {
  //   role: 'window',
  //   submenu: [
  //     {role: 'minimize'},
  //     {role: 'close'}
  //   ]
  // },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click () { require('electron').shell.openExternal('https://electron.atom.io') }
      }
    ]
  }
]

if (process.platform === 'darwin') {
  template.unshift({
    label: app.getName(),
    submenu: [
      {role: 'about'},
      {type: 'separator'},
      {role: 'services', submenu: []},
      {type: 'separator'},
      {role: 'hide'},
      {role: 'hideothers'},
      {role: 'unhide'},
      {type: 'separator'},
      {role: 'quit'}
    ]
  })

  // Edit menu
  template[1].submenu.push(
    {type: 'separator'},
    {
      label: 'Speech',
      submenu: [
        {role: 'startspeaking'},
        {role: 'stopspeaking'}
      ]
    }
  )

  // Window menu
  // template[3].submenu = [
  //   {role: 'close'},
  //   {role: 'minimize'},
  //   {role: 'zoom'},
  //   {type: 'separator'},
  //   {role: 'front'}
  // ]
} else {
  template.unshift({
    label: 'File',
    submenu: [
		{role: 'quit'}
    ]
  })
}
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();

  }
});
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
