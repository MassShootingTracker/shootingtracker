

#Mass shooting tracker website

##Setting up the project:

### 1. Install

`npm install`

### 2. Start in dev mode

`npm start` or `gulp run`

* Uses nodemon to run node with hot reloading

### 3. Navigate to page

`http://127.0.0.1:3030`

### Refresh data from google docs

From a bash command line: `curl --data "key=[api key from config]" http://[url]:[port]/update` when the site is running. For prior years add the year to the data: `curl --data "key=fkjnwkj2nk3r43tklnf4al&year=2014" http://localhost:3030/update` 



### Debugging:

* Install node-inspector globally: `npm install -g node-inspector`

* Run: `gulp run --debug` or `node --debug index.js`

* run node-inspector in separate process `node-inspector --no-preload`

* Navigate to `http://127.0.0.1:8080/?ws=127.0.0.1:8080&port=5858` or whichever url is specified.

### Rebuild the client side app:

`gulp build`
