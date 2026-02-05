# Node.js Junior Developer Interview Questions

> **Level**: Junior (0-2 years experience)
> **Total Questions**: 50
> **Complexity**: Increases progressively from basic to intermediate concepts

---

## Table of Contents
1. [Basic Concepts (Q1-Q15)](#basic-concepts)
2. [Modules & NPM (Q16-Q25)](#modules--npm)
3. [Asynchronous Programming (Q26-Q35)](#asynchronous-programming)
4. [Core Modules (Q36-Q45)](#core-modules)
5. [Basic Error Handling & Debugging (Q46-Q50)](#basic-error-handling--debugging)

---

## Basic Concepts

### Q1: What is Node.js?

**Answer:**
Node.js is an open-source, cross-platform JavaScript runtime environment that executes JavaScript code outside of a web browser. It was created by Ryan Dahl in 2009 and is built on Chrome's V8 JavaScript engine.

**Key characteristics:**
- **Event-driven**: Uses an event-driven, non-blocking I/O model
- **Single-threaded**: Uses a single thread with event looping
- **Asynchronous**: Handles multiple concurrent operations without blocking
- **Fast**: Built on V8 engine which compiles JavaScript to native machine code

```javascript
// Simple Node.js server example
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

### Q2: What is the difference between Node.js and JavaScript?

**Answer:**

| Aspect | JavaScript | Node.js |
|--------|------------|---------|
| **Environment** | Runs in browsers | Runs on server-side |
| **Engine** | Various (V8, SpiderMonkey, etc.) | V8 engine only |
| **DOM Access** | Yes | No |
| **File System** | No | Yes |
| **APIs** | Browser APIs (window, document) | Node APIs (fs, http, path) |
| **Purpose** | Client-side scripting | Server-side applications |

```javascript
// Browser JavaScript
document.getElementById('myElement'); // Available in browser

// Node.js
const fs = require('fs'); // Available in Node.js
fs.readFileSync('file.txt'); // File system access
```

---

### Q3: What is the V8 engine?

**Answer:**
V8 is Google's open-source high-performance JavaScript and WebAssembly engine, written in C++. It is used in Chrome browser and Node.js.

**Key features:**
- Compiles JavaScript directly to native machine code
- Uses Just-In-Time (JIT) compilation
- Implements ECMAScript and WebAssembly standards
- Manages memory through garbage collection

**How V8 works:**
1. Parses JavaScript code into an Abstract Syntax Tree (AST)
2. Interprets the AST using Ignition (interpreter)
3. Optimizes hot functions with TurboFan (optimizing compiler)
4. Executes optimized machine code

---

### Q4: What is npm?

**Answer:**
npm (Node Package Manager) is the default package manager for Node.js. It serves two purposes:

1. **Online repository**: A collection of open-source packages
2. **Command-line tool**: Manages package dependencies

**Common npm commands:**
```bash
# Initialize a new project
npm init

# Install a package
npm install express

# Install as dev dependency
npm install --save-dev jest

# Install globally
npm install -g nodemon

# Update packages
npm update

# List installed packages
npm list

# Run scripts defined in package.json
npm run start
```

---

### Q5: What is package.json?

**Answer:**
`package.json` is a manifest file that contains metadata about a Node.js project and its dependencies.

**Key fields:**
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "A sample Node.js application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "keywords": ["nodejs", "api"],
  "author": "Your Name",
  "license": "MIT"
}
```

**Important distinctions:**
- `dependencies`: Required for production
- `devDependencies`: Required only for development
- `peerDependencies`: Expected to be provided by the consuming package

---

### Q6: What is the difference between `dependencies` and `devDependencies`?

**Answer:**

| Aspect | dependencies | devDependencies |
|--------|--------------|-----------------|
| **Purpose** | Required for app to run | Only needed during development |
| **Installation** | `npm install <pkg>` | `npm install --save-dev <pkg>` |
| **Production** | Installed | Not installed with `--production` |
| **Examples** | express, mongoose | jest, eslint, nodemon |

```bash
# Install as dependency
npm install express

# Install as devDependency
npm install --save-dev jest

# Install only production dependencies
npm install --production
```

---

### Q7: What is the purpose of `node_modules` folder?

**Answer:**
The `node_modules` folder is where npm installs all project dependencies and their sub-dependencies.

**Key points:**
- Contains all installed packages
- Should be added to `.gitignore`
- Recreated using `npm install`
- Can become very large (nested dependencies)
- Uses a flattened structure (npm v3+)

```bash
# .gitignore
node_modules/
```

**Best practices:**
- Never commit `node_modules` to version control
- Use `package-lock.json` to ensure consistent installs
- Use `npm ci` for clean installs in CI/CD

---

### Q8: What is `package-lock.json`?

**Answer:**
`package-lock.json` is an automatically generated file that locks the exact versions of all installed dependencies.

**Purpose:**
- Ensures consistent installations across different environments
- Records the exact version of each installed package
- Includes nested dependencies
- Improves installation speed

**Key differences from package.json:**
```json
// package.json - version range
"express": "^4.18.0"

// package-lock.json - exact version
"express": {
  "version": "4.18.2",
  "resolved": "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
  "integrity": "sha512-..."
}
```

**Best practices:**
- Commit `package-lock.json` to version control
- Use `npm ci` instead of `npm install` in CI/CD pipelines

---

### Q9: What is REPL in Node.js?

**Answer:**
REPL stands for Read-Eval-Print Loop. It's an interactive shell that processes Node.js expressions.

**Components:**
- **Read**: Reads user input
- **Eval**: Evaluates the input
- **Print**: Prints the result
- **Loop**: Loops back to read

**Usage:**
```bash
$ node
> 2 + 2
4
> const name = 'Node'
undefined
> console.log(`Hello ${name}`)
Hello Node
undefined
> .exit
```

**REPL commands:**
- `.help` - Show help
- `.break` - Exit from multiline expression
- `.clear` - Clear context
- `.exit` - Exit REPL
- `.save filename` - Save session to file
- `.load filename` - Load file into session

---

### Q10: How do you run a Node.js file?

**Answer:**
There are several ways to run a Node.js file:

```bash
# Basic execution
node filename.js

# With file path
node ./src/app.js

# Using npm scripts (defined in package.json)
npm run start

# Using npx for packages
npx nodemon app.js

# With environment variables
NODE_ENV=production node app.js

# With arguments
node app.js --port 3000
```

**Accessing command line arguments:**
```javascript
// app.js
console.log(process.argv);
// Output: ['node', '/path/to/app.js', '--port', '3000']

const args = process.argv.slice(2);
console.log(args); // ['--port', '3000']
```

---

### Q11: What is the `global` object in Node.js?

**Answer:**
The `global` object in Node.js is similar to the `window` object in browsers. It provides global variables and functions.

**Common global objects:**
```javascript
// Process information
console.log(process.version);
console.log(process.platform);

// Current directory
console.log(__dirname);
console.log(__filename);

// Timers
setTimeout(() => {}, 1000);
setInterval(() => {}, 1000);
setImmediate(() => {});

// Console
console.log('Hello');

// Buffer
const buf = Buffer.from('Hello');

// Module
module.exports = {};
require('./module');
```

**Note:** Unlike browsers, variables declared with `var` at the top level are NOT added to the global object in Node.js modules.

---

### Q12: What is `process` in Node.js?

**Answer:**
`process` is a global object that provides information about, and control over, the current Node.js process.

**Common properties and methods:**
```javascript
// Environment variables
console.log(process.env.NODE_ENV);

// Process ID
console.log(process.pid);

// Current working directory
console.log(process.cwd());

// Command line arguments
console.log(process.argv);

// Node.js version
console.log(process.version);

// Platform
console.log(process.platform);

// Memory usage
console.log(process.memoryUsage());

// Exit the process
process.exit(0); // Success
process.exit(1); // Error

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
```

---

### Q13: What are environment variables in Node.js?

**Answer:**
Environment variables are external configuration values passed to your application at runtime.

**Accessing environment variables:**
```javascript
// Access via process.env
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV;
const dbUrl = process.env.DATABASE_URL;

console.log(`Running in ${nodeEnv} mode on port ${port}`);
```

**Setting environment variables:**
```bash
# Inline (Unix)
NODE_ENV=production node app.js

# Inline (Windows)
set NODE_ENV=production && node app.js

# Using .env file with dotenv package
npm install dotenv
```

**Using dotenv:**
```javascript
// .env file
PORT=3000
DATABASE_URL=mongodb://localhost:27017/mydb

// app.js
require('dotenv').config();
console.log(process.env.PORT); // 3000
```

---

### Q14: What is the difference between `__dirname` and `__filename`?

**Answer:**

| Variable | Description |
|----------|-------------|
| `__dirname` | Absolute path of the directory containing the current file |
| `__filename` | Absolute path of the current file |

```javascript
// File location: /Users/dev/project/src/utils/helper.js

console.log(__dirname);
// Output: /Users/dev/project/src/utils

console.log(__filename);
// Output: /Users/dev/project/src/utils/helper.js
```

**Common use case - building paths:**
```javascript
const path = require('path');

// Build path relative to current file
const configPath = path.join(__dirname, '../config/settings.json');
const publicDir = path.join(__dirname, '../../public');
```

**Note:** In ES modules, `__dirname` and `__filename` are not available. Use:
```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

---

### Q15: What is the difference between synchronous and asynchronous code?

**Answer:**

**Synchronous Code:**
- Executes line by line
- Blocks execution until current operation completes
- Simpler to understand but can block the event loop

```javascript
// Synchronous - blocks
const fs = require('fs');

console.log('Start');
const data = fs.readFileSync('file.txt', 'utf8'); // Blocks here
console.log(data);
console.log('End');

// Output:
// Start
// (file contents)
// End
```

**Asynchronous Code:**
- Doesn't block execution
- Uses callbacks, promises, or async/await
- More complex but better for I/O operations

```javascript
// Asynchronous - non-blocking
const fs = require('fs');

console.log('Start');
fs.readFile('file.txt', 'utf8', (err, data) => {
  console.log(data);
});
console.log('End');

// Output:
// Start
// End
// (file contents)
```

---

## Modules & NPM

### Q16: What are modules in Node.js?

**Answer:**
Modules are reusable blocks of code that encapsulate related functionality. Node.js uses the CommonJS module system by default.

**Types of modules:**
1. **Core modules**: Built-in modules (fs, http, path)
2. **Local modules**: Your own modules
3. **Third-party modules**: Installed via npm

```javascript
// Core module
const fs = require('fs');

// Local module
const myModule = require('./myModule');

// Third-party module
const express = require('express');
```

---

### Q17: What is the difference between `require` and `import`?

**Answer:**

| Feature | require (CommonJS) | import (ES Modules) |
|---------|-------------------|---------------------|
| **Loading** | Synchronous | Asynchronous |
| **Syntax** | Dynamic | Static (usually) |
| **Hoisting** | No | Yes |
| **Tree-shaking** | Limited | Supported |
| **Default in Node** | Yes | Requires configuration |

```javascript
// CommonJS (require)
const express = require('express');
const { Router } = require('express');

// ES Modules (import)
import express from 'express';
import { Router } from 'express';

// Dynamic import (ES Modules)
const module = await import('./module.js');
```

**To use ES Modules:**
```json
// package.json
{
  "type": "module"
}
```

---

### Q18: How do you create and export a module?

**Answer:**

**CommonJS (module.exports / exports):**
```javascript
// math.js

// Single export
module.exports = function add(a, b) {
  return a + b;
};

// Multiple exports
module.exports = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b
};

// Using exports shorthand
exports.add = (a, b) => a + b;
exports.subtract = (a, b) => a - b;

// Usage
const math = require('./math');
const { add, subtract } = require('./math');
```

**ES Modules:**
```javascript
// math.js
export const add = (a, b) => a + b;
export const subtract = (a, b) => a - b;

// Default export
export default function multiply(a, b) {
  return a * b;
}

// Usage
import multiply, { add, subtract } from './math.js';
```

---

### Q19: What are core modules in Node.js? Name some important ones.

**Answer:**
Core modules are built-in modules that come with Node.js installation.

**Important core modules:**

| Module | Purpose |
|--------|---------|
| `fs` | File system operations |
| `path` | File path utilities |
| `http` | HTTP server and client |
| `https` | HTTPS server and client |
| `url` | URL parsing |
| `events` | Event emitter |
| `stream` | Streaming data |
| `buffer` | Binary data handling |
| `os` | Operating system info |
| `crypto` | Cryptographic functions |
| `util` | Utility functions |
| `child_process` | Spawn child processes |

```javascript
// Examples
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

console.log(os.platform()); // 'darwin', 'win32', 'linux'
console.log(os.cpus().length); // Number of CPUs
console.log(os.totalmem()); // Total memory in bytes
```

---

### Q20: What is the `path` module used for?

**Answer:**
The `path` module provides utilities for working with file and directory paths.

```javascript
const path = require('path');

// Join paths
const fullPath = path.join('/users', 'dev', 'file.txt');
// Output: /users/dev/file.txt

// Resolve to absolute path
const absPath = path.resolve('src', 'app.js');
// Output: /current/working/dir/src/app.js

// Get file extension
const ext = path.extname('file.txt');
// Output: .txt

// Get filename without extension
const name = path.basename('file.txt', '.txt');
// Output: file

// Get directory name
const dir = path.dirname('/users/dev/file.txt');
// Output: /users/dev

// Parse path
const parsed = path.parse('/users/dev/file.txt');
// Output: { root: '/', dir: '/users/dev', base: 'file.txt', ext: '.txt', name: 'file' }

// Normalize path
const normalized = path.normalize('/users//dev/../dev/file.txt');
// Output: /users/dev/file.txt

// Check if absolute
const isAbs = path.isAbsolute('/users/dev');
// Output: true
```

---

### Q21: What is the `fs` module? How do you read and write files?

**Answer:**
The `fs` (File System) module provides functions for interacting with the file system.

**Reading files:**
```javascript
const fs = require('fs');

// Synchronous
const data = fs.readFileSync('file.txt', 'utf8');
console.log(data);

// Asynchronous (callback)
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data);
});

// Promise-based
const fsPromises = require('fs').promises;
const data = await fsPromises.readFile('file.txt', 'utf8');
```

**Writing files:**
```javascript
// Synchronous
fs.writeFileSync('file.txt', 'Hello World');

// Asynchronous (callback)
fs.writeFile('file.txt', 'Hello World', (err) => {
  if (err) throw err;
  console.log('File written');
});

// Append to file
fs.appendFile('file.txt', '\nNew line', (err) => {
  if (err) throw err;
});

// Promise-based
await fsPromises.writeFile('file.txt', 'Hello World');
```

---

### Q22: How do you create and delete directories using the `fs` module?

**Answer:**

```javascript
const fs = require('fs');
const fsPromises = require('fs').promises;

// Create directory
fs.mkdirSync('new-folder');

// Create nested directories
fs.mkdirSync('path/to/nested/folder', { recursive: true });

// Async version
fs.mkdir('new-folder', (err) => {
  if (err) throw err;
});

// Promise version
await fsPromises.mkdir('new-folder');

// Delete empty directory
fs.rmdirSync('folder');

// Delete directory with contents (recursive)
fs.rmSync('folder', { recursive: true, force: true });

// Async version
fs.rm('folder', { recursive: true }, (err) => {
  if (err) throw err;
});

// Check if exists
const exists = fs.existsSync('folder');

// Read directory contents
const files = fs.readdirSync('folder');
console.log(files); // ['file1.txt', 'file2.txt']
```

---

### Q23: What is semantic versioning (semver)?

**Answer:**
Semantic versioning is a versioning scheme for software that conveys meaning about the underlying changes.

**Format: MAJOR.MINOR.PATCH**

| Number | When to increment |
|--------|-------------------|
| MAJOR | Breaking changes (incompatible API changes) |
| MINOR | New features (backwards compatible) |
| PATCH | Bug fixes (backwards compatible) |

**Examples:**
- `1.0.0` → `2.0.0`: Breaking changes
- `1.0.0` → `1.1.0`: New feature added
- `1.0.0` → `1.0.1`: Bug fix

**Version ranges in package.json:**
```json
{
  "dependencies": {
    "exact": "1.2.3",        // Exactly 1.2.3
    "caret": "^1.2.3",       // >=1.2.3 <2.0.0 (minor & patch updates)
    "tilde": "~1.2.3",       // >=1.2.3 <1.3.0 (patch updates only)
    "range": ">=1.0.0 <2.0.0",
    "latest": "*"            // Any version
  }
}
```

---

### Q24: What is npx and how is it different from npm?

**Answer:**

| Aspect | npm | npx |
|--------|-----|-----|
| **Purpose** | Install packages | Execute packages |
| **Installation** | Installs to node_modules | Runs without installing (or uses installed) |
| **Global packages** | Requires global install | Runs directly |

**npm examples:**
```bash
# Install globally then use
npm install -g create-react-app
create-react-app my-app
```

**npx examples:**
```bash
# Run without installing
npx create-react-app my-app

# Run specific version
npx cowsay@1.4.0 "Hello"

# Run local binary
npx jest

# Run from GitHub
npx github:user/repo
```

**Benefits of npx:**
- No global installation required
- Always uses latest version
- Avoids version conflicts
- Runs local project binaries

---

### Q25: How do you update npm packages?

**Answer:**

```bash
# Check for outdated packages
npm outdated

# Update all packages (respecting semver)
npm update

# Update specific package
npm update express

# Update to latest (ignore semver)
npm install express@latest

# Update npm itself
npm install -g npm@latest

# Update all to latest (using npm-check-updates)
npx npm-check-updates -u
npm install

# View current versions
npm list

# View installed version of specific package
npm list express
```

**Best practices:**
- Regularly check for outdated packages
- Review changelogs before major updates
- Test thoroughly after updates
- Use `package-lock.json` for consistency

---

## Asynchronous Programming

### Q26: What is a callback function?

**Answer:**
A callback is a function passed as an argument to another function, which is then invoked inside the outer function.

```javascript
// Basic callback
function greet(name, callback) {
  console.log(`Hello, ${name}`);
  callback();
}

greet('World', function() {
  console.log('Callback executed!');
});

// Async callback (Node.js convention: error-first)
const fs = require('fs');

fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('Data:', data);
});

// Custom async function with callback
function fetchData(callback) {
  setTimeout(() => {
    const data = { id: 1, name: 'Product' };
    callback(null, data); // Error-first pattern
  }, 1000);
}

fetchData((err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});
```

---

### Q27: What is callback hell and how do you avoid it?

**Answer:**
Callback hell (also called "pyramid of doom") occurs when multiple nested callbacks make code hard to read and maintain.

**Example of callback hell:**
```javascript
getData(function(a) {
  getMoreData(a, function(b) {
    getEvenMoreData(b, function(c) {
      getYetMoreData(c, function(d) {
        getFinalData(d, function(e) {
          console.log(e);
        });
      });
    });
  });
});
```

**Solutions:**

1. **Named functions:**
```javascript
function handleA(a) {
  getMoreData(a, handleB);
}

function handleB(b) {
  getEvenMoreData(b, handleC);
}

getData(handleA);
```

2. **Promises:**
```javascript
getData()
  .then(a => getMoreData(a))
  .then(b => getEvenMoreData(b))
  .then(c => console.log(c))
  .catch(err => console.error(err));
```

3. **Async/Await:**
```javascript
async function fetchAllData() {
  try {
    const a = await getData();
    const b = await getMoreData(a);
    const c = await getEvenMoreData(b);
    console.log(c);
  } catch (err) {
    console.error(err);
  }
}
```

---

### Q28: What are Promises in JavaScript?

**Answer:**
A Promise is an object representing the eventual completion or failure of an asynchronous operation.

**Promise states:**
- **Pending**: Initial state
- **Fulfilled**: Operation completed successfully
- **Rejected**: Operation failed

```javascript
// Creating a Promise
const myPromise = new Promise((resolve, reject) => {
  setTimeout(() => {
    const success = true;
    if (success) {
      resolve('Operation successful!');
    } else {
      reject(new Error('Operation failed!'));
    }
  }, 1000);
});

// Consuming a Promise
myPromise
  .then(result => {
    console.log(result); // 'Operation successful!'
  })
  .catch(error => {
    console.error(error);
  })
  .finally(() => {
    console.log('Cleanup code');
  });

// Converting callback to Promise
function readFilePromise(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
```

---

### Q29: What is the difference between `.then()` and `.catch()`?

**Answer:**

| Method | Purpose |
|--------|---------|
| `.then()` | Handles fulfilled promises (and optionally rejected) |
| `.catch()` | Handles rejected promises |
| `.finally()` | Runs regardless of outcome |

```javascript
// .then() can take two callbacks
promise.then(
  value => console.log(value),    // onFulfilled
  error => console.error(error)   // onRejected
);

// .catch() is preferred for error handling
promise
  .then(value => console.log(value))
  .catch(error => console.error(error));

// Error in .then() is caught by .catch()
Promise.resolve('Start')
  .then(value => {
    throw new Error('Something went wrong');
    return value + ' -> Middle';
  })
  .then(value => console.log(value)) // Skipped
  .catch(error => console.error('Caught:', error.message))
  .finally(() => console.log('Done'));

// Output:
// Caught: Something went wrong
// Done
```

---

### Q30: What is async/await?

**Answer:**
`async/await` is syntactic sugar over Promises that makes asynchronous code look and behave more like synchronous code.

```javascript
// Async function always returns a Promise
async function fetchData() {
  return 'data'; // Automatically wrapped in Promise.resolve()
}

// Using await
async function processData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Calling async function
processData()
  .then(data => console.log('Success'))
  .catch(err => console.log('Failed'));

// Parallel execution with async/await
async function fetchAll() {
  const [users, products] = await Promise.all([
    fetch('/api/users').then(r => r.json()),
    fetch('/api/products').then(r => r.json())
  ]);
  return { users, products };
}
```

**Rules:**
- `await` can only be used inside `async` functions
- `await` pauses execution until the Promise resolves
- Use `try/catch` for error handling

---

### Q31: What is `Promise.all()`?

**Answer:**
`Promise.all()` takes an array of promises and returns a single Promise that resolves when all promises resolve, or rejects when any one rejects.

```javascript
const promise1 = Promise.resolve(1);
const promise2 = Promise.resolve(2);
const promise3 = Promise.resolve(3);

Promise.all([promise1, promise2, promise3])
  .then(values => {
    console.log(values); // [1, 2, 3]
  })
  .catch(error => {
    console.error(error);
  });

// Practical example
async function fetchUserData(userId) {
  const [profile, posts, comments] = await Promise.all([
    fetch(`/api/users/${userId}`).then(r => r.json()),
    fetch(`/api/users/${userId}/posts`).then(r => r.json()),
    fetch(`/api/users/${userId}/comments`).then(r => r.json())
  ]);
  
  return { profile, posts, comments };
}

// If any promise rejects, Promise.all rejects immediately
Promise.all([
  Promise.resolve(1),
  Promise.reject(new Error('Failed')),
  Promise.resolve(3)
]).catch(error => {
  console.log(error.message); // 'Failed'
});
```

---

### Q32: What is the difference between `Promise.all()` and `Promise.allSettled()`?

**Answer:**

| Method | Behavior |
|--------|----------|
| `Promise.all()` | Rejects immediately if any promise rejects |
| `Promise.allSettled()` | Waits for all promises to settle (resolve or reject) |

```javascript
const promises = [
  Promise.resolve('Success 1'),
  Promise.reject(new Error('Failed')),
  Promise.resolve('Success 2')
];

// Promise.all - rejects immediately
Promise.all(promises)
  .then(results => console.log(results))
  .catch(error => console.log('Rejected:', error.message));
// Output: Rejected: Failed

// Promise.allSettled - waits for all
Promise.allSettled(promises)
  .then(results => {
    console.log(results);
  });
// Output:
// [
//   { status: 'fulfilled', value: 'Success 1' },
//   { status: 'rejected', reason: Error: Failed },
//   { status: 'fulfilled', value: 'Success 2' }
// ]

// Practical use: Process results even if some fail
const results = await Promise.allSettled(fetchPromises);
const successful = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason);
```

---

### Q33: What is `Promise.race()`?

**Answer:**
`Promise.race()` returns a promise that resolves or rejects as soon as the first promise in the array settles.

```javascript
// Basic example
Promise.race([
  new Promise(resolve => setTimeout(() => resolve('Fast'), 100)),
  new Promise(resolve => setTimeout(() => resolve('Slow'), 500))
])
.then(result => console.log(result)); // 'Fast'

// Timeout pattern
function fetchWithTimeout(url, timeout = 5000) {
  const fetchPromise = fetch(url);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeout);
  });
  
  return Promise.race([fetchPromise, timeoutPromise]);
}

// Usage
try {
  const response = await fetchWithTimeout('/api/data', 3000);
  const data = await response.json();
} catch (error) {
  if (error.message === 'Request timeout') {
    console.log('Request took too long');
  }
}
```

---

### Q34: What is `setTimeout()` and `setInterval()`?

**Answer:**
Both are timer functions used to schedule code execution.

**setTimeout:**
```javascript
// Execute once after delay
const timerId = setTimeout(() => {
  console.log('Executed after 2 seconds');
}, 2000);

// Cancel timeout
clearTimeout(timerId);

// With arguments
setTimeout((a, b) => {
  console.log(a + b); // 3
}, 1000, 1, 2);
```

**setInterval:**
```javascript
// Execute repeatedly
let count = 0;
const intervalId = setInterval(() => {
  count++;
  console.log(`Count: ${count}`);
  
  if (count >= 5) {
    clearInterval(intervalId);
  }
}, 1000);

// Practical example: Polling
function pollServer() {
  const intervalId = setInterval(async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      if (data.complete) {
        clearInterval(intervalId);
        console.log('Task completed!');
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 5000);
}
```

---

### Q35: What is `setImmediate()` in Node.js?

**Answer:**
`setImmediate()` schedules a callback to execute in the next iteration of the event loop, after I/O events.

```javascript
console.log('Start');

setImmediate(() => {
  console.log('setImmediate');
});

setTimeout(() => {
  console.log('setTimeout');
}, 0);

process.nextTick(() => {
  console.log('nextTick');
});

console.log('End');

// Output:
// Start
// End
// nextTick
// setTimeout (or setImmediate - order may vary)
// setImmediate (or setTimeout - order may vary)
```

**Order of execution:**
1. Synchronous code
2. `process.nextTick()` - Microtask queue
3. Promises - Microtask queue
4. `setTimeout/setInterval` - Timer phase
5. `setImmediate` - Check phase

**Use case:**
```javascript
// Break up heavy computation
function processLargeData(data, callback) {
  const results = [];
  let index = 0;
  
  function processChunk() {
    const chunkSize = 100;
    for (let i = 0; i < chunkSize && index < data.length; i++, index++) {
      results.push(data[index] * 2);
    }
    
    if (index < data.length) {
      setImmediate(processChunk); // Allow I/O between chunks
    } else {
      callback(results);
    }
  }
  
  processChunk();
}
```

---

## Core Modules

### Q36: What is the `http` module?

**Answer:**
The `http` module provides functionality to create HTTP servers and make HTTP requests.

**Creating a server:**
```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  // Request info
  console.log(req.method);  // GET, POST, etc.
  console.log(req.url);     // /path
  console.log(req.headers); // Request headers
  
  // Send response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Hello World' }));
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**Making HTTP requests:**
```javascript
const http = require('http');

const options = {
  hostname: 'api.example.com',
  port: 80,
  path: '/data',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(JSON.parse(data));
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
```

---

### Q37: How do you handle different HTTP methods (GET, POST, PUT, DELETE)?

**Answer:**

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  const { method, url } = req;
  
  res.setHeader('Content-Type', 'application/json');
  
  if (method === 'GET' && url === '/users') {
    res.writeHead(200);
    res.end(JSON.stringify({ users: [] }));
  }
  else if (method === 'POST' && url === '/users') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      const user = JSON.parse(body);
      res.writeHead(201);
      res.end(JSON.stringify({ message: 'User created', user }));
    });
  }
  else if (method === 'PUT' && url.startsWith('/users/')) {
    const id = url.split('/')[2];
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      res.writeHead(200);
      res.end(JSON.stringify({ message: `User ${id} updated` }));
    });
  }
  else if (method === 'DELETE' && url.startsWith('/users/')) {
    const id = url.split('/')[2];
    res.writeHead(200);
    res.end(JSON.stringify({ message: `User ${id} deleted` }));
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3000);
```

---

### Q38: What is the `url` module?

**Answer:**
The `url` module provides utilities for URL resolution and parsing.

```javascript
const url = require('url');

// Parse URL (legacy API)
const parsedUrl = url.parse('https://example.com:8080/path?name=john#section', true);
console.log(parsedUrl);
// {
//   protocol: 'https:',
//   host: 'example.com:8080',
//   hostname: 'example.com',
//   port: '8080',
//   pathname: '/path',
//   search: '?name=john',
//   query: { name: 'john' },
//   hash: '#section'
// }

// Modern URL API (WHATWG)
const myUrl = new URL('https://example.com:8080/path?name=john');
console.log(myUrl.hostname);    // 'example.com'
console.log(myUrl.pathname);    // '/path'
console.log(myUrl.searchParams.get('name')); // 'john'

// Manipulating URLs
myUrl.searchParams.append('age', '30');
console.log(myUrl.href); // 'https://example.com:8080/path?name=john&age=30'

// In request handlers
const http = require('http');
http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const name = reqUrl.searchParams.get('name');
  res.end(`Hello, ${name}`);
}).listen(3000);
```

---

### Q39: What is the `os` module?

**Answer:**
The `os` module provides operating system-related utility methods and properties.

```javascript
const os = require('os');

// Platform info
console.log(os.platform());     // 'darwin', 'win32', 'linux'
console.log(os.type());         // 'Darwin', 'Windows_NT', 'Linux'
console.log(os.arch());         // 'x64', 'arm64'
console.log(os.release());      // OS version

// CPU info
console.log(os.cpus());         // Array of CPU core info
console.log(os.cpus().length);  // Number of CPU cores

// Memory info
console.log(os.totalmem());     // Total memory in bytes
console.log(os.freemem());      // Free memory in bytes
console.log((os.freemem() / os.totalmem() * 100).toFixed(2) + '%'); // Free memory %

// User info
console.log(os.userInfo());     // { username, uid, gid, shell, homedir }
console.log(os.homedir());      // User's home directory
console.log(os.tmpdir());       // Temp directory

// Network interfaces
console.log(os.networkInterfaces());

// System uptime
console.log(os.uptime());       // Seconds since boot

// End of line character
console.log(os.EOL);            // '\n' on POSIX, '\r\n' on Windows
```

---

### Q40: What is the `events` module?

**Answer:**
The `events` module provides the EventEmitter class, which is the foundation of event-driven architecture in Node.js.

```javascript
const EventEmitter = require('events');

// Create emitter instance
const emitter = new EventEmitter();

// Register event listener
emitter.on('userCreated', (user) => {
  console.log(`User created: ${user.name}`);
});

// One-time listener
emitter.once('firstVisit', () => {
  console.log('This only runs once');
});

// Emit events
emitter.emit('userCreated', { name: 'John' });
emitter.emit('firstVisit'); // Runs
emitter.emit('firstVisit'); // Doesn't run

// Remove listener
const listener = () => console.log('Hello');
emitter.on('greet', listener);
emitter.removeListener('greet', listener);

// Remove all listeners
emitter.removeAllListeners('eventName');

// Get listener count
console.log(emitter.listenerCount('userCreated'));

// Extend EventEmitter
class MyEmitter extends EventEmitter {
  constructor() {
    super();
  }
  
  doSomething() {
    // ... do work
    this.emit('done', { result: 'success' });
  }
}

const myEmitter = new MyEmitter();
myEmitter.on('done', (data) => console.log(data));
myEmitter.doSomething();
```

---

### Q41: What is a Buffer in Node.js?

**Answer:**
Buffer is a class for handling binary data directly in memory. It represents a fixed-size chunk of memory allocated outside the V8 heap.

```javascript
// Creating Buffers
const buf1 = Buffer.alloc(10);           // Creates buffer of 10 bytes, filled with 0s
const buf2 = Buffer.alloc(10, 1);        // Filled with 1s
const buf3 = Buffer.allocUnsafe(10);     // Uninitialized (faster, but may contain old data)
const buf4 = Buffer.from('Hello');       // From string
const buf5 = Buffer.from([1, 2, 3]);     // From array

// Writing to Buffer
const buf = Buffer.alloc(5);
buf.write('Hi');
console.log(buf); // <Buffer 48 69 00 00 00>

// Reading from Buffer
const buf6 = Buffer.from('Hello World');
console.log(buf6.toString());           // 'Hello World'
console.log(buf6.toString('utf8', 0, 5)); // 'Hello'

// Buffer operations
console.log(buf6.length);               // 11
console.log(buf6[0]);                   // 72 (ASCII for 'H')
console.log(buf6.slice(0, 5).toString()); // 'Hello'

// Comparing Buffers
const a = Buffer.from('ABC');
const b = Buffer.from('ABC');
console.log(a.equals(b));               // true
console.log(Buffer.compare(a, b));      // 0 (equal)

// Concatenating Buffers
const combined = Buffer.concat([buf4, Buffer.from(' World')]);
console.log(combined.toString()); // 'Hello World'
```

---

### Q42: What is the `crypto` module?

**Answer:**
The `crypto` module provides cryptographic functionality including hashing, encryption, and random number generation.

```javascript
const crypto = require('crypto');

// Hashing
const hash = crypto.createHash('sha256');
hash.update('password123');
console.log(hash.digest('hex'));
// '5e884898da28047d872...'

// Hashing shorthand
const quickHash = crypto.createHash('md5').update('text').digest('hex');

// HMAC (Hash-based Message Authentication Code)
const hmac = crypto.createHmac('sha256', 'secret-key');
hmac.update('message');
console.log(hmac.digest('hex'));

// Random bytes
const randomBytes = crypto.randomBytes(16);
console.log(randomBytes.toString('hex'));

// Random UUID
const uuid = crypto.randomUUID();
console.log(uuid); // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

// Password hashing with salt (using scrypt)
const password = 'userPassword';
const salt = crypto.randomBytes(16).toString('hex');

crypto.scrypt(password, salt, 64, (err, derivedKey) => {
  if (err) throw err;
  const hashedPassword = salt + ':' + derivedKey.toString('hex');
  console.log(hashedPassword);
});

// Encryption/Decryption (AES)
const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

### Q43: What is the `util` module?

**Answer:**
The `util` module provides utility functions that are useful for debugging and other purposes.

```javascript
const util = require('util');

// Promisify - convert callback-based to Promise-based
const fs = require('fs');
const readFile = util.promisify(fs.readFile);

async function read() {
  const data = await readFile('file.txt', 'utf8');
  console.log(data);
}

// Callbackify - convert Promise-based to callback-based
async function fetchData() {
  return { data: 'result' };
}
const fetchDataCallback = util.callbackify(fetchData);

// Format strings
console.log(util.format('%s:%s', 'foo', 'bar')); // 'foo:bar'
console.log(util.format('%d + %d = %d', 1, 2, 3)); // '1 + 2 = 3'
console.log(util.format('%j', { name: 'John' })); // '{"name":"John"}'

// Inspect objects
const obj = { name: 'John', nested: { deep: { value: 42 } } };
console.log(util.inspect(obj, { depth: null, colors: true }));

// Deprecate functions
const oldFunction = util.deprecate(() => {
  // old code
}, 'oldFunction() is deprecated. Use newFunction() instead.');

// Type checking
console.log(util.types.isDate(new Date()));     // true
console.log(util.types.isPromise(Promise.resolve())); // true
console.log(util.types.isArrayBuffer(new ArrayBuffer(8))); // true

// Debug logging
const debuglog = util.debuglog('myapp');
debuglog('Hello from %s', 'myapp');
// Run with: NODE_DEBUG=myapp node app.js
```

---

### Q44: What is the `stream` module?

**Answer:**
Streams are objects that allow reading or writing data piece by piece (chunks), rather than loading everything into memory at once.

**Types of streams:**
- **Readable**: Source of data (fs.createReadStream)
- **Writable**: Destination for data (fs.createWriteStream)
- **Duplex**: Both readable and writable (TCP socket)
- **Transform**: Duplex that can modify data (zlib compression)

```javascript
const fs = require('fs');
const { Transform } = require('stream');

// Reading file as stream
const readStream = fs.createReadStream('large-file.txt', 'utf8');

readStream.on('data', (chunk) => {
  console.log('Received chunk:', chunk.length);
});

readStream.on('end', () => {
  console.log('Finished reading');
});

// Writing to stream
const writeStream = fs.createWriteStream('output.txt');
writeStream.write('Hello ');
writeStream.write('World');
writeStream.end();

// Piping streams
const source = fs.createReadStream('input.txt');
const destination = fs.createWriteStream('output.txt');
source.pipe(destination);

// Transform stream
const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
});

fs.createReadStream('input.txt')
  .pipe(upperCase)
  .pipe(fs.createWriteStream('output.txt'));
```

---

### Q45: How do you read a large file efficiently in Node.js?

**Answer:**
Use streams to read large files in chunks instead of loading the entire file into memory.

```javascript
const fs = require('fs');
const readline = require('readline');

// Method 1: Using createReadStream
const readStream = fs.createReadStream('large-file.txt', {
  encoding: 'utf8',
  highWaterMark: 64 * 1024 // 64KB chunks
});

let lineCount = 0;
let data = '';

readStream.on('data', (chunk) => {
  data += chunk;
  // Process chunk
});

readStream.on('end', () => {
  console.log('File read complete');
});

// Method 2: Reading line by line
const rl = readline.createInterface({
  input: fs.createReadStream('large-file.txt'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  lineCount++;
  // Process each line
});

rl.on('close', () => {
  console.log(`Total lines: ${lineCount}`);
});

// Method 3: Using async iterator (Node.js 10+)
async function processFile() {
  const fileStream = fs.createReadStream('large-file.txt');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    // Process line
    console.log(line);
  }
}

// Streaming JSON parser for large JSON files
const JSONStream = require('JSONStream'); // npm package

fs.createReadStream('large-data.json')
  .pipe(JSONStream.parse('*'))
  .on('data', (item) => {
    // Process each item
  });
```

---

## Basic Error Handling & Debugging

### Q46: How do you handle errors in Node.js?

**Answer:**
Error handling in Node.js depends on whether code is synchronous or asynchronous.

```javascript
// 1. Synchronous code - try/catch
try {
  const data = JSON.parse('invalid json');
} catch (error) {
  console.error('Parse error:', error.message);
}

// 2. Callbacks - error-first pattern
fs.readFile('file.txt', (err, data) => {
  if (err) {
    console.error('Error:', err.message);
    return;
  }
  console.log(data);
});

// 3. Promises - .catch()
fetch('/api/data')
  .then(response => response.json())
  .catch(error => console.error('Fetch error:', error));

// 4. Async/await - try/catch
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error; // Re-throw if needed
  }
}

// 5. Event emitters
const emitter = new EventEmitter();
emitter.on('error', (error) => {
  console.error('Emitter error:', error);
});

// 6. Global handlers (last resort)
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
```

---

### Q47: What is the difference between `throw` and `return` an error?

**Answer:**

| Aspect | throw | return |
|--------|-------|--------|
| **Flow** | Interrupts execution immediately | Continues execution |
| **Catching** | Requires try/catch | Check return value |
| **Async** | Works with try/catch in async/await | Works with callbacks |

```javascript
// Using throw
function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

try {
  divide(10, 0);
} catch (error) {
  console.error(error.message);
}

// Using return (callback pattern)
function divideCallback(a, b, callback) {
  if (b === 0) {
    return callback(new Error('Division by zero'));
  }
  callback(null, a / b);
}

divideCallback(10, 0, (err, result) => {
  if (err) {
    console.error(err.message);
    return;
  }
  console.log(result);
});

// Using throw with async/await
async function fetchUser(id) {
  const user = await db.findUser(id);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

// Using return with Promises
function fetchUserSafe(id) {
  return db.findUser(id)
    .then(user => {
      if (!user) {
        return { error: 'User not found' };
      }
      return { data: user };
    });
}
```

---

### Q48: What are Error objects and how do you create custom errors?

**Answer:**

```javascript
// Built-in Error types
new Error('Generic error');
new TypeError('Type error');
new RangeError('Range error');
new SyntaxError('Syntax error');
new ReferenceError('Reference error');

// Error properties
const error = new Error('Something went wrong');
console.log(error.name);    // 'Error'
console.log(error.message); // 'Something went wrong'
console.log(error.stack);   // Stack trace

// Creating custom errors
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends Error {
  constructor(resource) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

// Using custom errors
function validateUser(user) {
  if (!user.email) {
    throw new ValidationError('Email is required', 'email');
  }
  if (!user.email.includes('@')) {
    throw new ValidationError('Invalid email format', 'email');
  }
}

try {
  validateUser({ name: 'John' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Validation failed on ${error.field}: ${error.message}`);
  } else {
    throw error;
  }
}
```

---

### Q49: How do you debug a Node.js application?

**Answer:**

**1. Console logging:**
```javascript
console.log('Value:', variable);
console.error('Error:', error);
console.table([{ a: 1, b: 2 }]);
console.time('operation');
// ... code
console.timeEnd('operation');
```

**2. Node.js debugger:**
```bash
# Start with inspector
node --inspect app.js

# Break on first line
node --inspect-brk app.js

# Then open chrome://inspect in Chrome
```

**3. Using debugger statement:**
```javascript
function problematicFunction(data) {
  debugger; // Execution pauses here when inspector is attached
  return data.map(item => item.value);
}
```

**4. VS Code debugging:**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Program",
      "program": "${workspaceFolder}/app.js"
    }
  ]
}
```

**5. Debug module:**
```bash
npm install debug
```

```javascript
const debug = require('debug')('app:server');
debug('Server starting on port %d', 3000);
// Run with: DEBUG=app:* node app.js
```

---

### Q50: What is `console.trace()` and when would you use it?

**Answer:**
`console.trace()` prints a stack trace to the console, showing the call path to the current location.

```javascript
function a() {
  b();
}

function b() {
  c();
}

function c() {
  console.trace('Trace from c()');
}

a();

// Output:
// Trace: Trace from c()
//     at c (/path/to/file.js:10:11)
//     at b (/path/to/file.js:6:3)
//     at a (/path/to/file.js:2:3)
//     at Object.<anonymous> (/path/to/file.js:13:1)

// Practical use case: Finding where a function is called from
class UserService {
  getUser(id) {
    console.trace('getUser called');
    // ... implementation
  }
}

// Debugging async flows
async function processOrder(orderId) {
  console.trace('processOrder start');
  
  const order = await fetchOrder(orderId);
  console.trace('After fetchOrder');
  
  await validateOrder(order);
  console.trace('After validateOrder');
  
  return order;
}
```

**When to use:**
- Debugging complex call chains
- Understanding how a function is being called
- Tracing issues in callbacks and async code
- Finding the source of unexpected function calls

---

## Summary

This guide covers fundamental Node.js concepts for junior developers:

1. **Basic Concepts**: Understanding what Node.js is and its core components
2. **Modules & NPM**: Working with the module system and package management
3. **Asynchronous Programming**: Callbacks, Promises, and async/await
4. **Core Modules**: Using built-in modules like fs, path, http
5. **Error Handling**: Properly handling and debugging errors

**Next Steps:**
- Practice building small projects
- Explore Express.js for web applications
- Learn about databases (MongoDB, PostgreSQL)
- Study testing frameworks (Jest, Mocha)
