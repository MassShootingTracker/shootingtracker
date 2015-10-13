

#Mass shooting tracker website

##Setting up the project:

### 1. Install

`npm install`

### 2. Start in dev mode

`npm start` or `gulp run`

* Uses nodemon to run node with hot reloading

### 3. Navigate to page

`http://127.0.0.1:5000`

### Refresh data from google docs on app start

The app pulls shooting data from `data/shootings.json`. To tell the app to repopulate this file from google docs before the app starts, use the flag `--refreshData`

`gulp run --refreshData` or `node index.js --refreshData`

### Debugging:

* Install node-inspector globally: `npm install -g node-inspector`

* Run: `gulp run --debug` or `node --debug index.js`

* run node-inspector in separate process `node-inspector --no-preload`

* Navigate to `http://127.0.0.1:8080/?ws=127.0.0.1:8080&port=5858` or whichever url is specified.

### Rebuild the client side app:

`gulp build`
