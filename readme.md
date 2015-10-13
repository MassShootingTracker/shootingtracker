

#Mass shooting tracker website

##Setting up the project:

### 1. Install

`npm install`

### 2. Start in dev mode

`npm start` or `gulp run`

* Uses nodemon to run node with hot reloading

### 3. Navigate to page

`http://127.0.0.1:5000`

### 4. Refresh data from google docs on app start

The app pulls shooting data from `data/shootings.json`. To tell the app to pull the latest from google docs at start, use the flag `--refreshData`

`gulp run --refreshData` or `node index.js --refreshData`

### 4. Debugging:

* Install node-inspector globally: `npm install -g node-instpector`

* Run: `gulp run --debug` or `node --debug index.js`

* run node-inspector in separate process `node-inspector --no-preload`

* Navigate to `http://127.0.0.1:8080/?ws=127.0.0.1:8080&port=5858` or whichever url is specified.

### 5. Recompile, minify the client side app:

`gulp build`

##Notes

  * Developed with node.js ~0.12.0