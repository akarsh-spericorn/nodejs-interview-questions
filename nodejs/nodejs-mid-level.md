# Node.js Mid-Level Developer Interview Questions

> **Level**: Mid-Level (2-4 years experience)
> **Total Questions**: 50
> **Complexity**: Intermediate to advanced concepts

---

## Table of Contents
1. [Event Loop Deep Dive (Q1-Q10)](#event-loop-deep-dive)
2. [Advanced Async Patterns (Q11-Q20)](#advanced-async-patterns)
3. [Streams & Buffers (Q21-Q28)](#streams--buffers)
4. [Express.js & Web Development (Q29-Q38)](#expressjs--web-development)
5. [Testing & Best Practices (Q39-Q50)](#testing--best-practices)

---

## Event Loop Deep Dive

### Q1: Explain the Node.js Event Loop in detail.

**Answer:**
The Event Loop is the mechanism that allows Node.js to perform non-blocking I/O operations despite JavaScript being single-threaded.

**Phases of the Event Loop:**

```
   ┌───────────────────────────┐
┌─>│           timers          │ (setTimeout, setInterval)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │ (I/O callbacks deferred)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │ (internal use)
│  └─────────────┬─────────────┘      ┌───────────────┐
│  ┌─────────────┴─────────────┐      │   incoming:   │
│  │           poll            │<─────┤  connections, │
│  └─────────────┬─────────────┘      │   data, etc.  │
│  ┌─────────────┴─────────────┐      └───────────────┘
│  │           check           │ (setImmediate)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │ (socket.on('close'))
   └───────────────────────────┘
```

**Phase Details:**

1. **Timers**: Executes callbacks scheduled by `setTimeout()` and `setInterval()`
2. **Pending callbacks**: Executes I/O callbacks deferred to the next loop iteration
3. **Idle, prepare**: Used internally by Node.js
4. **Poll**: Retrieves new I/O events; executes I/O related callbacks
5. **Check**: Executes `setImmediate()` callbacks
6. **Close callbacks**: Executes close event callbacks (e.g., `socket.on('close')`)

```javascript
console.log('Start');

setTimeout(() => console.log('setTimeout'), 0);

setImmediate(() => console.log('setImmediate'));

Promise.resolve().then(() => console.log('Promise'));

process.nextTick(() => console.log('nextTick'));

console.log('End');

// Output:
// Start
// End
// nextTick
// Promise
// setTimeout (order with setImmediate may vary)
// setImmediate
```

---

### Q2: What is the difference between `process.nextTick()` and `setImmediate()`?

**Answer:**

| Aspect | process.nextTick() | setImmediate() |
|--------|-------------------|----------------|
| **Queue** | Microtask queue | Check phase (macrotask) |
| **Execution** | Before event loop continues | After I/O in check phase |
| **Priority** | Higher | Lower |
| **Recursion risk** | Can starve I/O | Cannot starve I/O |

```javascript
// process.nextTick runs before any I/O
process.nextTick(() => console.log('nextTick 1'));
process.nextTick(() => console.log('nextTick 2'));

// setImmediate runs in the check phase
setImmediate(() => console.log('immediate 1'));
setImmediate(() => console.log('immediate 2'));

// Output:
// nextTick 1
// nextTick 2
// immediate 1
// immediate 2
```

**I/O Starvation Example:**
```javascript
// Dangerous: Can starve I/O
function recursiveNextTick() {
  process.nextTick(recursiveNextTick);
}
// recursiveNextTick(); // Don't do this!

// Safe: I/O can execute between iterations
function recursiveImmediate() {
  setImmediate(recursiveImmediate);
}
```

**Use cases:**
- `process.nextTick()`: When you need callback to run immediately after current operation
- `setImmediate()`: When you want to yield to I/O before running callback

---

### Q3: What are microtasks and macrotasks?

**Answer:**

**Microtasks** (higher priority):
- `process.nextTick()`
- Promise callbacks (`.then()`, `.catch()`, `.finally()`)
- `queueMicrotask()`

**Macrotasks** (lower priority):
- `setTimeout()`
- `setInterval()`
- `setImmediate()`
- I/O operations
- UI rendering (browser)

```javascript
console.log('1: Start');

setTimeout(() => console.log('2: setTimeout'), 0);

Promise.resolve()
  .then(() => console.log('3: Promise 1'))
  .then(() => console.log('4: Promise 2'));

process.nextTick(() => console.log('5: nextTick'));

queueMicrotask(() => console.log('6: queueMicrotask'));

console.log('7: End');

// Output:
// 1: Start
// 7: End
// 5: nextTick
// 3: Promise 1
// 6: queueMicrotask
// 4: Promise 2
// 2: setTimeout
```

**Execution order:**
1. Synchronous code
2. All microtasks (nextTick first, then promises)
3. One macrotask
4. All microtasks again
5. Repeat 3-4

---

### Q4: How does the libuv thread pool work?

**Answer:**
libuv is a C library that provides the event loop and async I/O for Node.js. It uses a thread pool for operations that can't be done asynchronously at the OS level.

**Operations using the thread pool:**
- File system operations (fs module)
- DNS lookups (dns.lookup)
- Crypto operations
- Zlib compression
- Some custom C++ addons

```javascript
// Default thread pool size is 4
// Can be changed via UV_THREADPOOL_SIZE environment variable
// Maximum: 1024

// Set before requiring any module
process.env.UV_THREADPOOL_SIZE = 8;

const crypto = require('crypto');
const fs = require('fs');

// Demonstrating thread pool limit
const start = Date.now();

// These 4 will run in parallel (4 threads)
// 5th will wait for a free thread
for (let i = 0; i < 5; i++) {
  crypto.pbkdf2('password', 'salt', 100000, 512, 'sha512', () => {
    console.log(`Hash ${i + 1}:`, Date.now() - start, 'ms');
  });
}

// Output (approx):
// Hash 1: 500 ms
// Hash 2: 500 ms
// Hash 3: 500 ms
// Hash 4: 500 ms
// Hash 5: 1000 ms (waited for free thread)
```

**Network I/O does NOT use thread pool:**
```javascript
const https = require('https');

// These use OS async primitives (epoll, kqueue, IOCP)
// Not limited by thread pool
for (let i = 0; i < 10; i++) {
  https.get('https://google.com', () => {
    console.log('Request completed');
  });
}
```

---

### Q5: What is the `worker_threads` module?

**Answer:**
The `worker_threads` module enables running JavaScript in parallel threads for CPU-intensive tasks.

```javascript
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
  // Main thread
  console.log('Main thread running');
  
  const worker = new Worker(__filename, {
    workerData: { num: 5 }
  });
  
  worker.on('message', (result) => {
    console.log('Factorial result:', result);
  });
  
  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });
  
  worker.on('exit', (code) => {
    console.log('Worker exited with code:', code);
  });
  
} else {
  // Worker thread
  const num = workerData.num;
  
  function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  }
  
  const result = factorial(num);
  parentPort.postMessage(result);
}
```

**Using Worker Pool pattern:**
```javascript
// worker-pool.js
const { Worker } = require('worker_threads');
const os = require('os');

class WorkerPool {
  constructor(workerPath, size = os.cpus().length) {
    this.workerPath = workerPath;
    this.size = size;
    this.workers = [];
    this.freeWorkers = [];
    this.queue = [];
    
    for (let i = 0; i < size; i++) {
      this.addWorker();
    }
  }
  
  addWorker() {
    const worker = new Worker(this.workerPath);
    worker.on('message', (result) => {
      worker.currentResolve(result);
      this.freeWorkers.push(worker);
      this.processQueue();
    });
    this.workers.push(worker);
    this.freeWorkers.push(worker);
  }
  
  runTask(data) {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });
      this.processQueue();
    });
  }
  
  processQueue() {
    if (this.queue.length && this.freeWorkers.length) {
      const worker = this.freeWorkers.pop();
      const { data, resolve } = this.queue.shift();
      worker.currentResolve = resolve;
      worker.postMessage(data);
    }
  }
}
```

---

### Q6: What is the `cluster` module?

**Answer:**
The `cluster` module allows creating child processes (workers) that share the same server port, enabling load balancing across CPU cores.

```javascript
const cluster = require('cluster');
const http = require('http');
const os = require('os');

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    // Optionally restart the worker
    cluster.fork();
  });
  
  // Listen for messages from workers
  for (const id in cluster.workers) {
    cluster.workers[id].on('message', (msg) => {
      console.log(`Message from worker ${id}:`, msg);
    });
  }
  
} else {
  // Workers share the TCP connection
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Hello from worker ${process.pid}\n`);
    
    // Send message to primary
    process.send({ msg: 'Request handled' });
  }).listen(8000);
  
  console.log(`Worker ${process.pid} started`);
}
```

**Graceful shutdown:**
```javascript
if (cluster.isPrimary) {
  process.on('SIGTERM', () => {
    console.log('Primary received SIGTERM');
    
    for (const id in cluster.workers) {
      cluster.workers[id].send('shutdown');
    }
    
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });
} else {
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      // Finish current requests then exit
      server.close(() => {
        process.exit(0);
      });
    }
  });
}
```

---

### Q7: What is the difference between `fork()` and `spawn()` in `child_process`?

**Answer:**

| Method | Purpose | Communication | Shell |
|--------|---------|---------------|-------|
| `spawn()` | Run any command | stdout/stderr streams | No (by default) |
| `fork()` | Run Node.js scripts | IPC channel (send/receive) | No |
| `exec()` | Run command in shell | Buffered output | Yes |
| `execFile()` | Run executable file | Buffered output | No |

```javascript
const { spawn, fork, exec, execFile } = require('child_process');

// spawn - for streaming output
const ls = spawn('ls', ['-la', '/usr']);
ls.stdout.on('data', (data) => console.log(`stdout: ${data}`));
ls.stderr.on('data', (data) => console.error(`stderr: ${data}`));
ls.on('close', (code) => console.log(`child exited with code ${code}`));

// fork - for Node.js scripts with IPC
// parent.js
const child = fork('./child.js');
child.send({ type: 'TASK', data: [1, 2, 3] });
child.on('message', (msg) => {
  console.log('Received from child:', msg);
});

// child.js
process.on('message', (msg) => {
  if (msg.type === 'TASK') {
    const result = msg.data.reduce((a, b) => a + b, 0);
    process.send({ type: 'RESULT', data: result });
  }
});

// exec - for shell commands (buffered)
exec('cat *.js | wc -l', (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`Line count: ${stdout}`);
});

// execFile - for executables (safer, no shell)
execFile('node', ['--version'], (error, stdout) => {
  console.log(`Node version: ${stdout}`);
});
```

---

### Q8: How do you handle blocking operations in Node.js?

**Answer:**
Several strategies to handle CPU-intensive or blocking operations:

**1. Worker Threads (recommended for CPU tasks):**
```javascript
const { Worker } = require('worker_threads');

function runHeavyTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./heavy-task.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

**2. Child Process:**
```javascript
const { fork } = require('child_process');

function processData(data) {
  return new Promise((resolve) => {
    const child = fork('./processor.js');
    child.send(data);
    child.on('message', resolve);
  });
}
```

**3. Break up work with setImmediate:**
```javascript
function processLargeArray(array, callback) {
  const results = [];
  let index = 0;
  
  function processChunk() {
    const chunkSize = 1000;
    const chunkEnd = Math.min(index + chunkSize, array.length);
    
    while (index < chunkEnd) {
      results.push(expensiveOperation(array[index]));
      index++;
    }
    
    if (index < array.length) {
      setImmediate(processChunk); // Yield to event loop
    } else {
      callback(results);
    }
  }
  
  processChunk();
}
```

**4. External service/microservice:**
```javascript
// Offload to separate service
async function processImage(imageBuffer) {
  const response = await fetch('http://image-processor/process', {
    method: 'POST',
    body: imageBuffer
  });
  return response.buffer();
}
```

---

### Q9: What is event-driven architecture in Node.js?

**Answer:**
Event-driven architecture is a pattern where the flow of the program is determined by events (user actions, sensor outputs, messages).

```javascript
const EventEmitter = require('events');

// Order processing system using events
class OrderSystem extends EventEmitter {
  constructor() {
    super();
    this.orders = [];
  }
  
  createOrder(order) {
    this.orders.push(order);
    this.emit('orderCreated', order);
  }
  
  processPayment(orderId, paymentInfo) {
    const order = this.orders.find(o => o.id === orderId);
    // Process payment...
    this.emit('paymentProcessed', order, paymentInfo);
  }
  
  shipOrder(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    // Ship order...
    this.emit('orderShipped', order);
  }
}

// Usage - loose coupling through events
const orderSystem = new OrderSystem();

// Notification service
orderSystem.on('orderCreated', (order) => {
  console.log(`Sending confirmation email for order ${order.id}`);
});

// Inventory service
orderSystem.on('orderCreated', (order) => {
  console.log(`Updating inventory for order ${order.id}`);
});

// Analytics service
orderSystem.on('orderCreated', (order) => {
  console.log(`Tracking order ${order.id} in analytics`);
});

orderSystem.on('paymentProcessed', (order) => {
  console.log(`Payment received for order ${order.id}`);
  orderSystem.shipOrder(order.id);
});

orderSystem.on('orderShipped', (order) => {
  console.log(`Sending shipping notification for order ${order.id}`);
});

// Create an order
orderSystem.createOrder({ id: '001', items: ['book', 'pen'] });
```

---

### Q10: How do you measure the performance of Node.js applications?

**Answer:**

**1. Built-in Performance Hooks:**
```javascript
const { performance, PerformanceObserver } = require('perf_hooks');

// Measure execution time
const start = performance.now();
// ... code to measure
const end = performance.now();
console.log(`Execution time: ${end - start}ms`);

// Using performance marks
performance.mark('start-operation');
// ... operation
performance.mark('end-operation');
performance.measure('operation', 'start-operation', 'end-operation');

// Observer for performance entries
const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});
obs.observe({ entryTypes: ['measure'] });
```

**2. Process metrics:**
```javascript
// Memory usage
const used = process.memoryUsage();
console.log({
  heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
  heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
  external: `${Math.round(used.external / 1024 / 1024)} MB`,
  rss: `${Math.round(used.rss / 1024 / 1024)} MB`
});

// CPU usage
const startUsage = process.cpuUsage();
// ... operation
const endUsage = process.cpuUsage(startUsage);
console.log(`CPU User: ${endUsage.user / 1000}ms`);
console.log(`CPU System: ${endUsage.system / 1000}ms`);
```

**3. Profiling with clinic.js:**
```bash
npm install -g clinic
clinic doctor -- node app.js
clinic flame -- node app.js
clinic bubbleprof -- node app.js
```

**4. Load testing with autocannon:**
```bash
npm install -g autocannon
autocannon -c 100 -d 10 http://localhost:3000
```

---

## Advanced Async Patterns

### Q11: What is the difference between `Promise.all()`, `Promise.race()`, `Promise.allSettled()`, and `Promise.any()`?

**Answer:**

| Method | Resolves when | Rejects when |
|--------|---------------|--------------|
| `Promise.all()` | All promises fulfill | Any promise rejects |
| `Promise.race()` | First promise settles | First promise rejects |
| `Promise.allSettled()` | All promises settle | Never rejects |
| `Promise.any()` | First promise fulfills | All promises reject |

```javascript
const promises = [
  Promise.resolve(1),
  Promise.reject('error'),
  Promise.resolve(3)
];

// Promise.all - fails fast
Promise.all(promises)
  .then(results => console.log('all:', results))
  .catch(error => console.log('all error:', error));
// Output: all error: error

// Promise.allSettled - waits for all
Promise.allSettled(promises)
  .then(results => console.log('allSettled:', results));
// Output: allSettled: [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: 'error' },
//   { status: 'fulfilled', value: 3 }
// ]

// Promise.race - first to settle wins
Promise.race([
  new Promise(r => setTimeout(() => r('slow'), 500)),
  new Promise(r => setTimeout(() => r('fast'), 100))
]).then(result => console.log('race:', result));
// Output: race: fast

// Promise.any - first to fulfill wins
Promise.any([
  Promise.reject('error 1'),
  Promise.resolve('success'),
  Promise.reject('error 2')
]).then(result => console.log('any:', result));
// Output: any: success

// Promise.any with all rejections
Promise.any([
  Promise.reject('error 1'),
  Promise.reject('error 2')
]).catch(error => console.log('any error:', error));
// Output: AggregateError: All promises were rejected
```

---

### Q12: How do you implement a retry mechanism for async operations?

**Answer:**

```javascript
// Basic retry with delay
async function retry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Usage
await retry(() => fetch('https://api.example.com/data'), 3, 1000);

// Exponential backoff
async function retryWithBackoff(fn, options = {}) {
  const {
    retries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    shouldRetry = () => true
  } = options;
  
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === retries - 1 || !shouldRetry(error)) {
        throw error;
      }
      
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * factor, maxDelay);
    }
  }
  
  throw lastError;
}

// Usage with options
await retryWithBackoff(
  () => fetchData(),
  {
    retries: 5,
    initialDelay: 500,
    factor: 2,
    shouldRetry: (error) => error.code !== 'AUTH_FAILED'
  }
);

// Retry with jitter (prevents thundering herd)
function addJitter(delay, jitterFactor = 0.1) {
  const jitter = delay * jitterFactor * Math.random();
  return delay + jitter;
}
```

---

### Q13: How do you implement a debounce function?

**Answer:**
Debounce delays the execution of a function until a certain time has passed since the last call.

```javascript
function debounce(fn, delay) {
  let timeoutId;
  
  return function (...args) {
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// Usage
const debouncedSearch = debounce((query) => {
  console.log('Searching for:', query);
  // API call
}, 300);

// These rapid calls will only trigger one search
debouncedSearch('h');
debouncedSearch('he');
debouncedSearch('hel');
debouncedSearch('hell');
debouncedSearch('hello');
// Only "hello" search executes after 300ms

// Advanced debounce with leading/trailing options
function advancedDebounce(fn, delay, options = {}) {
  const { leading = false, trailing = true } = options;
  let timeoutId;
  let lastArgs;
  
  return function (...args) {
    const isFirstCall = !timeoutId;
    lastArgs = args;
    
    clearTimeout(timeoutId);
    
    if (leading && isFirstCall) {
      fn.apply(this, args);
    }
    
    timeoutId = setTimeout(() => {
      if (trailing && lastArgs) {
        fn.apply(this, lastArgs);
      }
      timeoutId = null;
      lastArgs = null;
    }, delay);
  };
}
```

---

### Q14: How do you implement a throttle function?

**Answer:**
Throttle ensures a function is called at most once in a specified time period.

```javascript
function throttle(fn, limit) {
  let inThrottle = false;
  
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Usage - for scroll events or resize
const throttledScroll = throttle((e) => {
  console.log('Scroll position:', window.scrollY);
}, 100);

window.addEventListener('scroll', throttledScroll);

// Advanced throttle with trailing call
function advancedThrottle(fn, limit, options = {}) {
  const { leading = true, trailing = true } = options;
  let lastFunc;
  let lastRan;
  
  return function (...args) {
    const context = this;
    
    if (!lastRan) {
      if (leading) {
        fn.apply(context, args);
      }
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          if (trailing) {
            fn.apply(context, args);
          }
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

// Rate limiter for API calls
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  
  async execute(fn) {
    const now = Date.now();
    this.requests = this.requests.filter(time => time > now - this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.requests[0] + this.timeWindow - now;
      await new Promise(r => setTimeout(r, waitTime));
      return this.execute(fn);
    }
    
    this.requests.push(now);
    return fn();
  }
}
```

---

### Q15: How do you implement a Promise-based queue?

**Answer:**

```javascript
class PromiseQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  add(promiseFactory) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        promiseFactory,
        resolve,
        reject
      });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.running >= this.concurrency) return;
    if (this.queue.length === 0) return;
    
    const { promiseFactory, resolve, reject } = this.queue.shift();
    this.running++;
    
    try {
      const result = await promiseFactory();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.processQueue();
    }
  }
  
  get size() {
    return this.queue.length;
  }
  
  get pending() {
    return this.running;
  }
}

// Usage
const queue = new PromiseQueue(2); // Max 2 concurrent

async function fetchData(id) {
  console.log(`Fetching ${id}...`);
  await new Promise(r => setTimeout(r, 1000));
  return `Data ${id}`;
}

// Add tasks to queue
const results = await Promise.all([
  queue.add(() => fetchData(1)),
  queue.add(() => fetchData(2)),
  queue.add(() => fetchData(3)),
  queue.add(() => fetchData(4)),
  queue.add(() => fetchData(5))
]);

console.log(results);
```

---

### Q16: What are async iterators and generators?

**Answer:**

**Async Generators:**
```javascript
// Async generator function
async function* asyncGenerator() {
  yield await Promise.resolve(1);
  yield await Promise.resolve(2);
  yield await Promise.resolve(3);
}

// Consuming with for-await-of
async function consume() {
  for await (const value of asyncGenerator()) {
    console.log(value);
  }
}

// Practical example: Paginated API
async function* fetchAllPages(baseUrl) {
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(`${baseUrl}?page=${page}`);
    const data = await response.json();
    
    yield data.items;
    
    hasMore = data.hasNextPage;
    page++;
  }
}

// Usage
async function processAllItems() {
  for await (const items of fetchAllPages('/api/items')) {
    for (const item of items) {
      await processItem(item);
    }
  }
}
```

**Async Iterator Protocol:**
```javascript
const asyncIterable = {
  [Symbol.asyncIterator]() {
    let i = 0;
    return {
      async next() {
        if (i < 3) {
          await new Promise(r => setTimeout(r, 100));
          return { value: i++, done: false };
        }
        return { done: true };
      }
    };
  }
};

for await (const num of asyncIterable) {
  console.log(num); // 0, 1, 2
}

// Stream to async iterator
const fs = require('fs');
const readline = require('readline');

async function* readLines(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });
  
  for await (const line of rl) {
    yield line;
  }
}

for await (const line of readLines('./large-file.txt')) {
  console.log(line);
}
```

---

### Q17: How do you handle errors in async/await properly?

**Answer:**

```javascript
// 1. Try-catch blocks
async function fetchUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error; // Re-throw to propagate
  }
}

// 2. Centralized error handler
async function withErrorHandler(fn) {
  try {
    return await fn();
  } catch (error) {
    logError(error);
    throw error;
  }
}

// 3. Error wrapper utility
function to(promise) {
  return promise
    .then(data => [null, data])
    .catch(error => [error, null]);
}

// Usage
async function example() {
  const [error, user] = await to(fetchUser(123));
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('User:', user);
}

// 4. Handling multiple parallel operations
async function fetchUserData(userId) {
  const results = await Promise.allSettled([
    fetchProfile(userId),
    fetchPosts(userId),
    fetchFriends(userId)
  ]);
  
  const [profile, posts, friends] = results;
  
  return {
    profile: profile.status === 'fulfilled' ? profile.value : null,
    posts: posts.status === 'fulfilled' ? posts.value : [],
    friends: friends.status === 'fulfilled' ? friends.value : [],
    errors: results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason)
  };
}

// 5. Cleanup with finally
async function processWithCleanup() {
  const connection = await createConnection();
  try {
    await doWork(connection);
  } catch (error) {
    await handleError(error);
    throw error;
  } finally {
    await connection.close();
  }
}
```

---

### Q18: What is AbortController and how do you use it?

**Answer:**
AbortController allows you to abort async operations like fetch requests.

```javascript
// Basic usage
const controller = new AbortController();
const signal = controller.signal;

fetch('/api/data', { signal })
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Fetch aborted');
    } else {
      console.error('Fetch error:', error);
    }
  });

// Abort after timeout
setTimeout(() => controller.abort(), 5000);

// Request with timeout utility
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Abort multiple requests
const controller = new AbortController();

Promise.all([
  fetch('/api/endpoint1', { signal: controller.signal }),
  fetch('/api/endpoint2', { signal: controller.signal }),
  fetch('/api/endpoint3', { signal: controller.signal })
]).catch(error => {
  if (error.name === 'AbortError') {
    console.log('All fetches aborted');
  }
});

// Abort on component unmount (React pattern)
function useApi(url) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const controller = new AbortController();
    
    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then(setData)
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      });
    
    return () => controller.abort();
  }, [url]);
  
  return data;
}
```

---

### Q19: How do you implement parallel execution with limits?

**Answer:**

```javascript
// Method 1: Using p-limit pattern
async function pLimit(concurrency) {
  const queue = [];
  let activeCount = 0;
  
  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()();
    }
  };
  
  const run = async (fn) => {
    activeCount++;
    const result = fn();
    try {
      return await result;
    } finally {
      next();
    }
  };
  
  const enqueue = (fn) => {
    return new Promise((resolve, reject) => {
      const task = () => run(fn).then(resolve, reject);
      
      if (activeCount < concurrency) {
        task();
      } else {
        queue.push(task);
      }
    });
  };
  
  return enqueue;
}

// Usage
const limit = await pLimit(3);

const urls = [/* 100 urls */];
const results = await Promise.all(
  urls.map(url => limit(() => fetch(url)))
);

// Method 2: Batch processing
async function batchProcess(items, batchSize, processor) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

// Usage
const users = await batchProcess(userIds, 10, fetchUser);

// Method 3: Pool-based execution
async function asyncPool(poolLimit, iterable, iteratorFn) {
  const ret = [];
  const executing = new Set();
  
  for (const item of iterable) {
    const promise = Promise.resolve().then(() => iteratorFn(item));
    ret.push(promise);
    executing.add(promise);
    
    const clean = () => executing.delete(promise);
    promise.then(clean, clean);
    
    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(ret);
}

// Usage
await asyncPool(5, urls, async (url) => {
  const response = await fetch(url);
  return response.json();
});
```

---

### Q20: What is the Event Loop blocking and how do you detect it?

**Answer:**

```javascript
// Detecting event loop blocking
function detectBlocking(threshold = 100) {
  let lastCheck = Date.now();
  
  setInterval(() => {
    const now = Date.now();
    const delay = now - lastCheck - 1000;
    
    if (delay > threshold) {
      console.warn(`Event loop blocked for ${delay}ms`);
    }
    
    lastCheck = now;
  }, 1000);
}

// Using blocked-at package for detailed info
const blocked = require('blocked-at');

blocked((time, stack) => {
  console.log(`Blocked for ${time}ms, operation started here:`, stack);
}, { threshold: 100 });

// Using perf_hooks
const { monitorEventLoopDelay } = require('perf_hooks');

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  console.log({
    min: histogram.min / 1e6,
    max: histogram.max / 1e6,
    mean: histogram.mean / 1e6,
    stddev: histogram.stddev / 1e6,
    percentile99: histogram.percentile(99) / 1e6
  });
  histogram.reset();
}, 5000);

// Avoiding blocking
// Bad - blocks event loop
function processSync(data) {
  for (let i = 0; i < data.length; i++) {
    heavyComputation(data[i]);
  }
}

// Good - yields to event loop
async function processAsync(data) {
  for (let i = 0; i < data.length; i++) {
    heavyComputation(data[i]);
    
    if (i % 100 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

// Better - use worker threads
const { Worker } = require('worker_threads');

async function processInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./processor-worker.js', {
      workerData: data
    });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

---

## Streams & Buffers

### Q21: Explain the different types of streams in Node.js.

**Answer:**

```javascript
const { Readable, Writable, Duplex, Transform, PassThrough } = require('stream');

// 1. Readable Stream - source of data
const readable = new Readable({
  read(size) {
    this.push('Hello ');
    this.push('World');
    this.push(null); // Signal end of data
  }
});

readable.on('data', chunk => console.log(chunk.toString()));

// 2. Writable Stream - destination for data
const writable = new Writable({
  write(chunk, encoding, callback) {
    console.log('Received:', chunk.toString());
    callback();
  }
});

writable.write('Hello');
writable.end('World');

// 3. Duplex Stream - both readable and writable
const duplex = new Duplex({
  read(size) {
    this.push('data from read');
    this.push(null);
  },
  write(chunk, encoding, callback) {
    console.log('Received:', chunk.toString());
    callback();
  }
});

// 4. Transform Stream - modify data
const transform = new Transform({
  transform(chunk, encoding, callback) {
    const upperCase = chunk.toString().toUpperCase();
    callback(null, upperCase);
  }
});

// 5. PassThrough - passes data through unchanged
const passThrough = new PassThrough();

// Practical examples
const fs = require('fs');
const zlib = require('zlib');

// Reading and writing
const readStream = fs.createReadStream('input.txt');
const writeStream = fs.createWriteStream('output.txt');

// Compression transform
const gzip = zlib.createGzip();

// Pipeline
readStream
  .pipe(transform)
  .pipe(gzip)
  .pipe(fs.createWriteStream('output.txt.gz'));
```

---

### Q22: How does backpressure work in streams?

**Answer:**
Backpressure is a mechanism to handle situations where a readable stream produces data faster than a writable stream can consume it.

```javascript
const fs = require('fs');

// Problem: No backpressure handling
const readable = fs.createReadStream('huge-file.txt');
const writable = fs.createWriteStream('output.txt');

// This can cause memory issues with large files
readable.on('data', (chunk) => {
  writable.write(chunk); // May return false if buffer is full
});

// Solution 1: Handle write return value
readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);
  
  if (!canContinue) {
    readable.pause();
    writable.once('drain', () => readable.resume());
  }
});

// Solution 2: Use pipe (handles backpressure automatically)
readable.pipe(writable);

// Solution 3: Use pipeline (with error handling)
const { pipeline } = require('stream');

pipeline(
  fs.createReadStream('input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('output.txt.gz'),
  (err) => {
    if (err) {
      console.error('Pipeline failed:', err);
    } else {
      console.log('Pipeline succeeded');
    }
  }
);

// Promise-based pipeline (Node.js 15+)
const { pipeline } = require('stream/promises');

await pipeline(
  fs.createReadStream('input.txt'),
  transform,
  fs.createWriteStream('output.txt')
);

// Custom writable with highWaterMark
const writable = new Writable({
  highWaterMark: 16384, // 16KB buffer
  write(chunk, encoding, callback) {
    // Slow consumer
    setTimeout(() => {
      console.log('Processed chunk');
      callback();
    }, 100);
  }
});
```

---

### Q23: How do you implement a custom readable stream?

**Answer:**

```javascript
const { Readable } = require('stream');

// Method 1: Subclass
class CounterStream extends Readable {
  constructor(max) {
    super();
    this.max = max;
    this.current = 0;
  }
  
  _read() {
    if (this.current <= this.max) {
      this.push(String(this.current++));
    } else {
      this.push(null);
    }
  }
}

const counter = new CounterStream(5);
counter.on('data', (chunk) => console.log(chunk.toString()));

// Method 2: Constructor options
const readable = new Readable({
  read(size) {
    this.push('data');
    this.push(null);
  }
});

// Method 3: Object mode for non-string data
const objectStream = new Readable({
  objectMode: true,
  read() {
    this.push({ id: 1, name: 'Item 1' });
    this.push({ id: 2, name: 'Item 2' });
    this.push(null);
  }
});

objectStream.on('data', (obj) => console.log(obj));

// Method 4: Async readable (database pagination)
class DatabaseStream extends Readable {
  constructor(query) {
    super({ objectMode: true });
    this.query = query;
    this.page = 0;
    this.pageSize = 100;
  }
  
  async _read() {
    try {
      const results = await this.fetchPage(this.page);
      
      if (results.length === 0) {
        this.push(null);
        return;
      }
      
      for (const row of results) {
        if (!this.push(row)) {
          return; // Backpressure
        }
      }
      
      this.page++;
    } catch (error) {
      this.destroy(error);
    }
  }
  
  async fetchPage(page) {
    // Database query
    return db.query(this.query, { offset: page * this.pageSize, limit: this.pageSize });
  }
}
```

---

### Q24: How do you implement a custom transform stream?

**Answer:**

```javascript
const { Transform } = require('stream');

// Method 1: Subclass
class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    const upperCase = chunk.toString().toUpperCase();
    callback(null, upperCase);
  }
  
  _flush(callback) {
    // Called when no more data
    this.push('\n--- END ---');
    callback();
  }
}

// Method 2: Constructor
const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
});

// Method 3: Object mode - JSON parser
const jsonParser = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    try {
      const obj = JSON.parse(chunk);
      callback(null, obj);
    } catch (error) {
      callback(error);
    }
  }
});

// Practical example: CSV to JSON
class CsvToJson extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: true });
    this.headers = null;
    this.buffer = '';
  }
  
  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const values = line.split(',');
      
      if (!this.headers) {
        this.headers = values;
      } else {
        const obj = {};
        this.headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim();
        });
        this.push(obj);
      }
    }
    
    callback();
  }
  
  _flush(callback) {
    if (this.buffer.trim()) {
      const values = this.buffer.split(',');
      const obj = {};
      this.headers.forEach((header, i) => {
        obj[header.trim()] = values[i]?.trim();
      });
      this.push(obj);
    }
    callback();
  }
}
```

---

### Q25: What is `pipeline()` and why should you use it over `pipe()`?

**Answer:**

| Feature | pipe() | pipeline() |
|---------|--------|------------|
| Error handling | Manual | Automatic |
| Stream cleanup | Manual | Automatic |
| Async/Promise | No | Yes (Node 15+) |
| Multiple streams | Chain calls | Single call |

```javascript
const { pipeline } = require('stream');
const { pipeline: pipelinePromise } = require('stream/promises');
const fs = require('fs');
const zlib = require('zlib');

// Using pipe() - error handling is difficult
fs.createReadStream('input.txt')
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('output.txt.gz'));

// Problem: If any stream errors, others may not be cleaned up
// Need to add error handlers to each stream

// Using pipeline() - proper error handling and cleanup
pipeline(
  fs.createReadStream('input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('output.txt.gz'),
  (err) => {
    if (err) {
      console.error('Pipeline failed:', err);
    } else {
      console.log('Pipeline succeeded');
    }
  }
);

// Using pipeline with promises (Node.js 15+)
async function compressFile(input, output) {
  try {
    await pipelinePromise(
      fs.createReadStream(input),
      zlib.createGzip(),
      fs.createWriteStream(output)
    );
    console.log('Compression complete');
  } catch (err) {
    console.error('Compression failed:', err);
    throw err;
  }
}

// Pipeline with multiple transforms
await pipelinePromise(
  fs.createReadStream('data.csv'),
  csvParser,
  dataTransformer,
  jsonSerializer,
  fs.createWriteStream('data.json')
);

// AbortController support
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

await pipelinePromise(
  fs.createReadStream('huge-file.txt'),
  transform,
  fs.createWriteStream('output.txt'),
  { signal: controller.signal }
);
```

---

### Q26: How do you convert a stream to a string or buffer?

**Answer:**

```javascript
const fs = require('fs');
const { Readable } = require('stream');

// Method 1: Collecting chunks manually
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Method 2: Using buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Method 3: Using consumers from stream module (Node.js 16+)
const { text, json, buffer } = require('stream/consumers');

const readStream = fs.createReadStream('file.txt');
const content = await text(readStream);

const jsonStream = fs.createReadStream('data.json');
const data = await json(jsonStream);

// Method 4: Convert string to stream
function stringToStream(str) {
  return Readable.from([str]);
}

const stream = stringToStream('Hello World');

// Method 5: Convert array to stream
function arrayToStream(array) {
  return Readable.from(array);
}

const stream2 = arrayToStream(['line1\n', 'line2\n', 'line3\n']);

// Method 6: Readable.from with async iterator
async function* generateData() {
  for (let i = 0; i < 10; i++) {
    yield `Item ${i}\n`;
    await new Promise(r => setTimeout(r, 100));
  }
}

const stream3 = Readable.from(generateData());
```

---

### Q27: What are highWaterMark and the internal buffer?

**Answer:**
`highWaterMark` is the maximum number of bytes (or objects in object mode) that a stream will buffer internally.

```javascript
const fs = require('fs');
const { Readable, Writable } = require('stream');

// Readable stream with custom highWaterMark
const readable = fs.createReadStream('large-file.txt', {
  highWaterMark: 64 * 1024 // 64KB (default is 16KB)
});

// This affects when 'data' events fire
// Larger = fewer events, more memory
// Smaller = more events, less memory

// Writable stream with custom highWaterMark
const writable = fs.createWriteStream('output.txt', {
  highWaterMark: 16 * 1024 // 16KB (default)
});

// When buffer exceeds highWaterMark, write returns false
const canWrite = writable.write(data);
if (!canWrite) {
  // Buffer is full, wait for 'drain'
  await new Promise(resolve => writable.once('drain', resolve));
}

// Checking buffer state
console.log(writable.writableLength); // Current buffer size
console.log(writable.writableHighWaterMark); // Threshold

// Object mode streams
const objectStream = new Readable({
  objectMode: true,
  highWaterMark: 16 // 16 objects (default)
});

// Performance tuning example
async function copyFile(source, dest) {
  const readable = fs.createReadStream(source, {
    highWaterMark: 256 * 1024 // 256KB for better throughput
  });
  
  const writable = fs.createWriteStream(dest, {
    highWaterMark: 256 * 1024
  });
  
  return new Promise((resolve, reject) => {
    readable.pipe(writable);
    readable.on('error', reject);
    writable.on('error', reject);
    writable.on('finish', resolve);
  });
}
```

---

### Q28: How do you handle binary data in Node.js?

**Answer:**

```javascript
// Creating Buffers
const buf1 = Buffer.alloc(10);         // 10 bytes, zero-filled
const buf2 = Buffer.allocUnsafe(10);   // 10 bytes, uninitialized
const buf3 = Buffer.from('Hello');     // From string
const buf4 = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // From array
const buf5 = Buffer.from('Hello', 'utf8'); // With encoding

// Encodings
const str = buf3.toString('utf8');     // 'Hello'
const base64 = buf3.toString('base64'); // 'SGVsbG8='
const hex = buf3.toString('hex');      // '48656c6c6f'

// Converting between encodings
function base64Encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function base64Decode(base64Str) {
  return Buffer.from(base64Str, 'base64').toString('utf8');
}

// Reading binary files
const fs = require('fs');

async function readBinaryFile(path) {
  const buffer = await fs.promises.readFile(path);
  // buffer is a Buffer object
  return buffer;
}

// Working with typed arrays
const buffer = Buffer.alloc(16);
const view = new DataView(buffer.buffer);

view.setInt32(0, 42, true);       // Little-endian
view.setFloat64(4, 3.14, true);
view.setInt32(12, -1, true);

console.log(view.getInt32(0, true));   // 42
console.log(view.getFloat64(4, true)); // 3.14

// Binary protocols
function parseHeader(buffer) {
  return {
    version: buffer.readUInt8(0),
    type: buffer.readUInt16BE(1),
    length: buffer.readUInt32BE(3),
    timestamp: buffer.readBigUInt64BE(7)
  };
}

function createHeader(version, type, length, timestamp) {
  const buffer = Buffer.alloc(15);
  buffer.writeUInt8(version, 0);
  buffer.writeUInt16BE(type, 1);
  buffer.writeUInt32BE(length, 3);
  buffer.writeBigUInt64BE(BigInt(timestamp), 7);
  return buffer;
}

// Image processing example
async function resizeImage(inputPath, outputPath, width, height) {
  const sharp = require('sharp');
  
  await sharp(inputPath)
    .resize(width, height)
    .toFile(outputPath);
}
```

---

## Express.js & Web Development

### Q29: What is middleware in Express.js?

**Answer:**
Middleware are functions that have access to the request, response objects, and the next middleware function in the application's request-response cycle.

```javascript
const express = require('express');
const app = express();

// Application-level middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  req.requestTime = Date.now();
  next();
});

// Built-in middleware
app.use(express.json());       // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded
app.use(express.static('public')); // Serve static files

// Third-party middleware
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

// Router-level middleware
const router = express.Router();

router.use((req, res, next) => {
  console.log('Router middleware');
  next();
});

// Route-specific middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Verify token...
  next();
};

app.get('/protected', authenticate, (req, res) => {
  res.json({ data: 'secret' });
});

// Error-handling middleware (4 parameters)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// Async middleware wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(users);
}));
```

---

### Q30: How do you handle different HTTP methods and routes?

**Answer:**

```javascript
const express = require('express');
const app = express();

// Basic routes
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/users', (req, res) => {
  res.status(201).json({ message: 'User created' });
});

app.put('/users/:id', (req, res) => {
  res.json({ message: `User ${req.params.id} updated` });
});

app.patch('/users/:id', (req, res) => {
  res.json({ message: `User ${req.params.id} patched` });
});

app.delete('/users/:id', (req, res) => {
  res.status(204).send();
});

// Route parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// Query parameters
app.get('/search', (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  res.json({ query: q, page, limit });
});

// Multiple handlers
app.get('/example',
  (req, res, next) => {
    console.log('First handler');
    next();
  },
  (req, res, next) => {
    console.log('Second handler');
    next();
  },
  (req, res) => {
    res.send('Final handler');
  }
);

// Route chaining
app.route('/articles')
  .get((req, res) => res.send('Get all articles'))
  .post((req, res) => res.send('Create article'))
  .put((req, res) => res.send('Update article'));

// Express Router for modular routes
const userRouter = express.Router();

userRouter.get('/', getAllUsers);
userRouter.get('/:id', getUser);
userRouter.post('/', createUser);
userRouter.put('/:id', updateUser);
userRouter.delete('/:id', deleteUser);

app.use('/api/users', userRouter);

// Wildcard routes
app.get('/files/*', (req, res) => {
  const filePath = req.params[0];
  res.send(`Requested file: ${filePath}`);
});

// 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

---

### Q31: How do you validate request data in Express?

**Answer:**

```javascript
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Joi = require('joi');

const app = express();
app.use(express.json());

// Method 1: Manual validation
function validateUser(req, res, next) {
  const { email, password, name } = req.body;
  const errors = [];
  
  if (!email || !email.includes('@')) {
    errors.push({ field: 'email', message: 'Valid email required' });
  }
  
  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be 8+ chars' });
  }
  
  if (!name || name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be 2+ chars' });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  
  next();
}

app.post('/users', validateUser, createUser);

// Method 2: express-validator
const userValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).trim(),
  body('name').notEmpty().trim().escape(),
  body('age').optional().isInt({ min: 0, max: 150 })
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

app.post('/users', userValidation, validate, createUser);

// Method 3: Joi validation
const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(50).required(),
  age: Joi.number().integer().min(0).max(150)
});

const validateJoi = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return res.status(400).json({ errors });
  }
  
  req.body = value; // Use validated/sanitized data
  next();
};

app.post('/users', validateJoi(userSchema), createUser);

// Param validation
app.get('/users/:id',
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  getUser
);

// Query validation
app.get('/search',
  query('q').notEmpty().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
  search
);
```

---

### Q32: How do you handle file uploads in Express?

**Answer:**

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Basic memory storage
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  // file.buffer contains the file data
  res.json({
    filename: file.originalname,
    size: file.size,
    mimetype: file.mimetype
  });
});

// Disk storage with custom naming
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filtering
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and GIF allowed.'), false);
  }
};

const uploadConfig = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// Single file upload
app.post('/upload/single', uploadConfig.single('image'), (req, res) => {
  res.json({ file: req.file });
});

// Multiple files (same field)
app.post('/upload/multiple', uploadConfig.array('images', 10), (req, res) => {
  res.json({ files: req.files });
});

// Multiple fields
app.post('/upload/fields', uploadConfig.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'gallery', maxCount: 8 }
]), (req, res) => {
  res.json({
    avatar: req.files['avatar'],
    gallery: req.files['gallery']
  });
});

// Error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  next(err);
});

// Stream upload to S3
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

const s3 = new AWS.S3();

const s3Upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'my-bucket',
    key: (req, file, cb) => {
      cb(null, `uploads/${Date.now()}-${file.originalname}`);
    }
  })
});
```

---

### Q33: How do you implement rate limiting?

**Answer:**

```javascript
const express = require('express');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const app = express();

// Basic rate limiting (in-memory)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
});

app.use(limiter);

// Different limits for different routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 login attempts per hour
  message: { error: 'Too many login attempts' },
  skipSuccessfulRequests: true // Don't count successful attempts
});

app.post('/login', authLimiter, loginHandler);

// Custom key generator (by user ID instead of IP)
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Redis store for distributed systems
const redisClient = new Redis();

const redisLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args)
  }),
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Custom rate limiter implementation
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  
  consume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
  
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}

const buckets = new Map();

function tokenBucketLimiter(req, res, next) {
  const key = req.ip;
  
  if (!buckets.has(key)) {
    buckets.set(key, new TokenBucket(100, 10)); // 100 capacity, 10/sec
  }
  
  const bucket = buckets.get(key);
  
  if (bucket.consume()) {
    next();
  } else {
    res.status(429).json({ error: 'Rate limit exceeded' });
  }
}
```

---

### Q34: How do you implement authentication with JWT?

**Answer:**

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

// User registration
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Save user to database
  const user = await User.create({ email, password: hashedPassword });
  
  res.status(201).json({ message: 'User created' });
});

// Login - generate tokens
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate tokens
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  // Store refresh token
  await RefreshToken.create({ token: refreshToken, userId: user.id });
  
  res.json({ accessToken, refreshToken });
});

// Auth middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Refresh token endpoint
app.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  // Verify token exists in database
  const storedToken = await RefreshToken.findOne({ token: refreshToken });
  if (!storedToken) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    const accessToken = jwt.sign(
      { userId: decoded.userId },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    res.json({ accessToken });
  } catch (error) {
    await RefreshToken.deleteOne({ token: refreshToken });
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Protected route
app.get('/profile', authenticate, async (req, res) => {
  const user = await User.findById(req.user.userId);
  res.json({ user });
});

// Logout
app.post('/logout', authenticate, async (req, res) => {
  await RefreshToken.deleteMany({ userId: req.user.userId });
  res.json({ message: 'Logged out' });
});
```

---

### Q35: How do you handle CORS in Express?

**Answer:**

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Enable all CORS requests (not recommended for production)
app.use(cors());

// Specific origin
app.use(cors({
  origin: 'https://example.com'
}));

// Multiple origins
app.use(cors({
  origin: ['https://example.com', 'https://app.example.com']
}));

// Dynamic origin
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = ['https://example.com', 'https://app.example.com'];
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Full configuration
app.use(cors({
  origin: 'https://example.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  credentials: true, // Allow cookies
  maxAge: 86400, // Cache preflight for 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Per-route CORS
app.get('/public', cors(), (req, res) => {
  res.json({ message: 'Public endpoint' });
});

app.get('/private', cors({ origin: 'https://admin.example.com' }), (req, res) => {
  res.json({ message: 'Private endpoint' });
});

// Manual CORS implementation
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://example.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  
  next();
});

// Environment-based CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? 'https://example.com'
    : 'http://localhost:3000',
  credentials: true
};

app.use(cors(corsOptions));
```

---

### Q36: How do you implement session management?

**Answer:**

```javascript
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const Redis = require('ioredis');

const app = express();

// Basic session (memory store - not for production)
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Redis session store (recommended for production)
const redisClient = new Redis();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax'
  }
}));

// Using sessions
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = await authenticateUser(email, password);
  
  if (user) {
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.roles = user.roles;
    
    res.json({ message: 'Logged in' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Session middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

app.get('/profile', requireAuth, (req, res) => {
  res.json({
    userId: req.session.userId,
    email: req.session.email
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// Regenerate session (after login for security)
app.post('/login', async (req, res) => {
  const user = await authenticateUser(req.body);
  
  if (user) {
    // Regenerate session ID to prevent session fixation
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      
      req.session.userId = user.id;
      res.json({ message: 'Logged in' });
    });
  }
});

// Touch session to extend expiry
app.use((req, res, next) => {
  if (req.session.userId) {
    req.session.touch();
  }
  next();
});
```

---

### Q37: How do you implement request logging and monitoring?

**Answer:**

```javascript
const express = require('express');
const morgan = require('morgan');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Winston logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Morgan for HTTP request logging
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

// Custom token for request ID
morgan.token('id', (req) => req.id);

app.use(morgan(':id :method :url :status :response-time ms', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Custom logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      requestId: req.id,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.id
    });
  });
  
  next();
});

// Error logging
app.use((err, req, res, next) => {
  logger.error({
    requestId: req.id,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    userId: req.user?.id
  });
  
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id
  });
});

// Performance monitoring
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.send(await promClient.register.metrics());
});
```

---

### Q38: How do you implement graceful shutdown?

**Answer:**

```javascript
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Track active connections
const connections = new Set();

server.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
});

// Health check endpoint
let isShuttingDown = false;

app.get('/health', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting down' });
  }
  res.json({ status: 'healthy' });
});

// Cleanup function
async function cleanup() {
  console.log('Cleaning up resources...');
  
  // Close database connections
  await mongoose.connection.close();
  
  // Close Redis connections
  await redisClient.quit();
  
  // Close message queue connections
  await rabbitMQConnection.close();
  
  console.log('Cleanup complete');
}

// Graceful shutdown function
function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;
  
  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    
    console.log('HTTP server closed');
    
    try {
      await cleanup();
      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.exit(1);
    }
  });
  
  // Force close connections after timeout
  setTimeout(() => {
    console.log('Force closing remaining connections');
    connections.forEach(conn => conn.destroy());
  }, 10000);
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Forcefully shutting down');
    process.exit(1);
  }, 30000);
}

// Handle signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Testing & Best Practices

### Q39: How do you write unit tests in Node.js?

**Answer:**

```javascript
// Using Jest

// userService.js
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }
  
  async createUser(userData) {
    if (!userData.email) {
      throw new Error('Email is required');
    }
    
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }
    
    return this.userRepository.create(userData);
  }
  
  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}

// userService.test.js
const UserService = require('./userService');

describe('UserService', () => {
  let userService;
  let mockUserRepository;
  
  beforeEach(() => {
    // Create mock repository
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn()
    };
    
    userService = new UserService(mockUserRepository);
  });
  
  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const userData = { email: 'test@example.com', name: 'Test User' };
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({ id: '1', ...userData });
      
      const result = await userService.createUser(userData);
      
      expect(result.id).toBe('1');
      expect(result.email).toBe('test@example.com');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
    });
    
    it('should throw error if email is missing', async () => {
      await expect(userService.createUser({ name: 'Test' }))
        .rejects.toThrow('Email is required');
    });
    
    it('should throw error if user already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({ id: '1' });
      
      await expect(userService.createUser({ email: 'test@example.com' }))
        .rejects.toThrow('User already exists');
    });
  });
  
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const result = await userService.getUserById('1');
      
      expect(result).toEqual(mockUser);
    });
    
    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      
      await expect(userService.getUserById('999'))
        .rejects.toThrow('User not found');
    });
  });
});

// Testing async functions
describe('Async tests', () => {
  it('should work with async/await', async () => {
    const result = await asyncFunction();
    expect(result).toBe('expected');
  });
  
  it('should work with promises', () => {
    return asyncFunction().then(result => {
      expect(result).toBe('expected');
    });
  });
  
  it('should test rejected promises', async () => {
    await expect(failingAsyncFunction()).rejects.toThrow('error');
  });
});
```

---

### Q40: How do you write integration tests for Express APIs?

**Answer:**

```javascript
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// App setup
const app = express();
app.use(express.json());

app.post('/users', async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json(user);
});

app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// Test file
describe('User API Integration Tests', () => {
  let mongoServer;
  
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(async () => {
    await User.deleteMany({});
  });
  
  describe('POST /users', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body.email).toBe(userData.email);
      expect(response.body.name).toBe(userData.name);
      expect(response.body._id).toBeDefined();
      
      // Verify in database
      const userInDb = await User.findById(response.body._id);
      expect(userInDb.email).toBe(userData.email);
    });
    
    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/users')
        .send({})
        .expect(400);
      
      expect(response.body.error).toBeDefined();
    });
  });
  
  describe('GET /users/:id', () => {
    it('should return user by id', async () => {
      const user = await User.create({
        email: 'test@example.com',
        name: 'Test User'
      });
      
      const response = await request(app)
        .get(`/users/${user._id}`)
        .expect(200);
      
      expect(response.body.email).toBe('test@example.com');
    });
    
    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/users/${fakeId}`)
        .expect(404);
    });
  });
  
  // Test with authentication
  describe('Protected routes', () => {
    let authToken;
    
    beforeEach(async () => {
      const user = await User.create({
        email: 'auth@example.com',
        password: 'hashedPassword'
      });
      authToken = generateToken(user);
    });
    
    it('should access protected route with token', async () => {
      await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
    
    it('should reject without token', async () => {
      await request(app)
        .get('/protected')
        .expect(401);
    });
  });
});
```

---

### Q41: What are mocks, stubs, and spies?

**Answer:**

```javascript
const sinon = require('sinon');

// SPY - Observes function calls without changing behavior
describe('Spies', () => {
  it('should track function calls', () => {
    const callback = sinon.spy();
    
    [1, 2, 3].forEach(callback);
    
    expect(callback.callCount).toBe(3);
    expect(callback.firstCall.args[0]).toBe(1);
    expect(callback.calledWith(2)).toBe(true);
  });
  
  it('should spy on existing methods', () => {
    const obj = {
      method: (x) => x * 2
    };
    
    sinon.spy(obj, 'method');
    
    const result = obj.method(5);
    
    expect(result).toBe(10); // Original behavior preserved
    expect(obj.method.calledOnce).toBe(true);
    expect(obj.method.calledWith(5)).toBe(true);
    
    obj.method.restore();
  });
});

// STUB - Replaces function with predefined behavior
describe('Stubs', () => {
  it('should replace function behavior', () => {
    const obj = {
      fetchData: () => 'real data'
    };
    
    const stub = sinon.stub(obj, 'fetchData').returns('fake data');
    
    expect(obj.fetchData()).toBe('fake data');
    
    stub.restore();
  });
  
  it('should stub with different behaviors', () => {
    const stub = sinon.stub();
    
    stub.onFirstCall().returns(1);
    stub.onSecondCall().returns(2);
    stub.returns(99);
    
    expect(stub()).toBe(1);
    expect(stub()).toBe(2);
    expect(stub()).toBe(99);
  });
  
  it('should stub async functions', async () => {
    const api = {
      fetchUser: async (id) => { /* real implementation */ }
    };
    
    sinon.stub(api, 'fetchUser').resolves({ id: 1, name: 'Test' });
    
    const user = await api.fetchUser(1);
    expect(user.name).toBe('Test');
  });
  
  it('should stub to throw errors', () => {
    const stub = sinon.stub().throws(new Error('Test error'));
    
    expect(() => stub()).toThrow('Test error');
  });
});

// MOCK - Pre-programmed with expectations
describe('Mocks', () => {
  it('should verify expected calls', () => {
    const obj = { method: () => {} };
    const mock = sinon.mock(obj);
    
    mock.expects('method')
      .once()
      .withArgs(42)
      .returns(100);
    
    const result = obj.method(42);
    
    expect(result).toBe(100);
    mock.verify(); // Throws if expectations not met
    mock.restore();
  });
});

// Jest equivalents
describe('Jest mocking', () => {
  it('should use jest.fn() for spies/stubs', () => {
    const callback = jest.fn();
    callback.mockReturnValue(42);
    
    expect(callback()).toBe(42);
    expect(callback).toHaveBeenCalled();
  });
  
  it('should mock modules', () => {
    jest.mock('axios');
    const axios = require('axios');
    
    axios.get.mockResolvedValue({ data: { users: [] } });
  });
  
  it('should spy on object methods', () => {
    const obj = { method: () => 42 };
    const spy = jest.spyOn(obj, 'method');
    
    obj.method();
    
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

---

### Q42: How do you test error handling?

**Answer:**

```javascript
// Testing synchronous errors
describe('Synchronous error handling', () => {
  it('should throw error for invalid input', () => {
    expect(() => {
      validateEmail('invalid');
    }).toThrow('Invalid email format');
  });
  
  it('should throw specific error type', () => {
    expect(() => {
      validateEmail('invalid');
    }).toThrow(ValidationError);
  });
  
  it('should match error message pattern', () => {
    expect(() => {
      validateEmail('invalid');
    }).toThrow(/email/i);
  });
});

// Testing async errors
describe('Async error handling', () => {
  it('should reject with error', async () => {
    await expect(fetchUser(-1)).rejects.toThrow('Invalid user ID');
  });
  
  it('should catch and handle error', async () => {
    const result = await fetchUserSafe(-1);
    expect(result.error).toBe('Invalid user ID');
  });
  
  it('should test error properties', async () => {
    try {
      await fetchUser(-1);
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('user');
    }
  });
});

// Testing Express error middleware
describe('Express error handling', () => {
  it('should return 500 for server errors', async () => {
    // Stub to throw error
    jest.spyOn(UserService, 'getUser').mockRejectedValue(new Error('DB error'));
    
    const response = await request(app)
      .get('/users/1')
      .expect(500);
    
    expect(response.body.error).toBe('Internal server error');
  });
  
  it('should return 400 for validation errors', async () => {
    const response = await request(app)
      .post('/users')
      .send({ email: 'invalid' })
      .expect(400);
    
    expect(response.body.errors).toBeDefined();
  });
  
  it('should include request ID in error response', async () => {
    const response = await request(app)
      .get('/error')
      .expect(500);
    
    expect(response.body.requestId).toBeDefined();
  });
});

// Testing event emitter errors
describe('EventEmitter error handling', () => {
  it('should emit error event', (done) => {
    const emitter = new MyEmitter();
    
    emitter.on('error', (error) => {
      expect(error.message).toBe('Something went wrong');
      done();
    });
    
    emitter.doSomethingRisky();
  });
});

// Testing unhandled rejections (for coverage)
describe('Global error handlers', () => {
  let originalHandler;
  
  beforeEach(() => {
    originalHandler = process.listeners('unhandledRejection')[0];
    process.removeAllListeners('unhandledRejection');
  });
  
  afterEach(() => {
    process.on('unhandledRejection', originalHandler);
  });
  
  it('should log unhandled rejections', (done) => {
    const logSpy = jest.spyOn(console, 'error');
    
    process.on('unhandledRejection', (reason) => {
      expect(logSpy).toHaveBeenCalled();
      done();
    });
    
    Promise.reject(new Error('Unhandled'));
  });
});
```

---

### Q43: What is code coverage and how do you measure it?

**Answer:**
Code coverage measures how much of your source code is executed during tests.

```bash
# Using Jest (built-in coverage)
npx jest --coverage

# Using NYC (Istanbul) with Mocha
npx nyc mocha tests/**/*.test.js
```

**Coverage metrics:**
- **Line coverage**: Percentage of lines executed
- **Branch coverage**: Percentage of branches (if/else) taken
- **Function coverage**: Percentage of functions called
- **Statement coverage**: Percentage of statements executed

```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/critical/': {
      branches: 100,
      functions: 100,
      lines: 100
    }
  }
};

// .nycrc.json for NYC/Istanbul
{
  "all": true,
  "include": ["src/**/*.js"],
  "exclude": ["**/*.test.js"],
  "reporter": ["text", "html", "lcov"],
  "branches": 80,
  "lines": 80,
  "functions": 80,
  "statements": 80
}
```

**Improving coverage:**
```javascript
// Testing all branches
function getDiscount(user) {
  if (user.isPremium) {
    return user.orders > 100 ? 0.3 : 0.2;
  }
  return user.orders > 50 ? 0.1 : 0;
}

describe('getDiscount', () => {
  it('should return 0.3 for premium users with 100+ orders', () => {
    expect(getDiscount({ isPremium: true, orders: 150 })).toBe(0.3);
  });
  
  it('should return 0.2 for premium users with <100 orders', () => {
    expect(getDiscount({ isPremium: true, orders: 50 })).toBe(0.2);
  });
  
  it('should return 0.1 for regular users with 50+ orders', () => {
    expect(getDiscount({ isPremium: false, orders: 75 })).toBe(0.1);
  });
  
  it('should return 0 for regular users with <50 orders', () => {
    expect(getDiscount({ isPremium: false, orders: 25 })).toBe(0);
  });
});
```

---

### Q44: What are some Node.js security best practices?

**Answer:**

```javascript
// 1. Input validation and sanitization
const { body, validationResult } = require('express-validator');
const xss = require('xss');

app.post('/comment', [
  body('content').trim().escape().isLength({ max: 1000 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process sanitized input
});

// 2. Use security headers with Helmet
const helmet = require('helmet');
app.use(helmet());

// 3. Prevent NoSQL injection
const sanitize = require('mongo-sanitize');

app.post('/search', (req, res) => {
  const cleanQuery = sanitize(req.body);
  User.find(cleanQuery);
});

// 4. Rate limiting
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// 5. Secure password hashing
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// 6. Secure session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'sessionId', // Don't use default 'connect.sid'
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 3600000
  },
  resave: false,
  saveUninitialized: false
}));

// 7. Prevent parameter pollution
const hpp = require('hpp');
app.use(hpp());

// 8. Validate Content-Type
app.use(express.json({ type: 'application/json' }));

// 9. Implement CORS properly
app.use(cors({
  origin: 'https://trusted-domain.com',
  credentials: true
}));

// 10. Use environment variables for secrets
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not configured');
}

// 11. Audit dependencies regularly
// npm audit
// npm audit fix

// 12. Limit request body size
app.use(express.json({ limit: '10kb' }));

// 13. Disable X-Powered-By
app.disable('x-powered-by');

// 14. Use prepared statements with SQL
const { query } = require('pg');

// Bad - SQL injection vulnerable
const badQuery = `SELECT * FROM users WHERE id = ${userId}`;

// Good - Parameterized query
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// 15. Log security events
logger.warn('Failed login attempt', {
  ip: req.ip,
  email: req.body.email,
  timestamp: new Date()
});
```

---

### Q45: How do you handle environment configuration?

**Answer:**

```javascript
// 1. Using dotenv
require('dotenv').config();

// .env file
// NODE_ENV=development
// PORT=3000
// DATABASE_URL=mongodb://localhost:27017/mydb
// JWT_SECRET=super-secret-key

// 2. Config module with validation
// config.js
const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRY: Joi.string().default('1h'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  database: {
    url: envVars.DATABASE_URL
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiry: envVars.JWT_EXPIRY
  },
  logging: {
    level: envVars.LOG_LEVEL
  }
};

// 3. Environment-specific config files
// config/default.js
module.exports = {
  port: 3000,
  database: {
    poolSize: 5
  }
};

// config/production.js
module.exports = {
  database: {
    poolSize: 20
  },
  cache: {
    ttl: 3600
  }
};

// 4. Using node-config package
const config = require('config');

const dbConfig = config.get('database');
console.log(dbConfig.host);

// 5. Secret management (don't commit secrets!)
// Use environment variables in CI/CD
// Use AWS Secrets Manager, HashiCorp Vault, etc.

const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
  const data = await secretsManager.getSecretValue({
    SecretId: secretName
  }).promise();
  
  return JSON.parse(data.SecretString);
}

// 6. Configuration for different environments
// .env.development
// .env.production
// .env.test

const dotenv = require('dotenv');
const path = require('path');

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: path.join(__dirname, envFile) });
```

---

### Q46: How do you structure a Node.js project?

**Answer:**

```
project/
├── src/
│   ├── config/          # Configuration files
│   │   ├── index.js
│   │   ├── database.js
│   │   └── logger.js
│   │
│   ├── api/             # API layer
│   │   ├── controllers/ # Request handlers
│   │   ├── routes/      # Route definitions
│   │   ├── middlewares/ # Express middlewares
│   │   └── validators/  # Request validation
│   │
│   ├── services/        # Business logic
│   │   ├── userService.js
│   │   └── orderService.js
│   │
│   ├── models/          # Data models
│   │   ├── User.js
│   │   └── Order.js
│   │
│   ├── repositories/    # Data access layer
│   │   ├── userRepository.js
│   │   └── orderRepository.js
│   │
│   ├── utils/           # Helper functions
│   │   ├── errors.js
│   │   └── helpers.js
│   │
│   ├── jobs/            # Background jobs
│   │   └── emailJob.js
│   │
│   └── app.js           # Express app setup
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/             # Build/deploy scripts
│
├── docs/                # Documentation
│
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── docker-compose.yml
```

**Example implementation:**
```javascript
// src/api/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middlewares/auth');
const { validateUser } = require('../validators/userValidator');

router.get('/', authenticate, userController.getAll);
router.get('/:id', authenticate, userController.getById);
router.post('/', validateUser, userController.create);
router.put('/:id', authenticate, validateUser, userController.update);
router.delete('/:id', authenticate, userController.delete);

module.exports = router;

// src/api/controllers/userController.js
const userService = require('../../services/userService');

exports.getAll = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers(req.query);
    res.json(users);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

// src/services/userService.js
const userRepository = require('../repositories/userRepository');
const { NotFoundError } = require('../utils/errors');

exports.getAllUsers = async (filters) => {
  return userRepository.findAll(filters);
};

exports.createUser = async (userData) => {
  // Business logic here
  return userRepository.create(userData);
};
```

---

### Q47: What is dependency injection and how do you implement it?

**Answer:**
Dependency Injection (DI) is a design pattern where dependencies are passed to a class rather than created inside it, enabling better testability and loose coupling.

```javascript
// Without DI - tightly coupled
class UserService {
  constructor() {
    this.database = new PostgresDatabase(); // Hard dependency
    this.emailer = new SendGridEmailer();   // Hard dependency
  }
}

// With DI - loosely coupled
class UserService {
  constructor(database, emailer) {
    this.database = database;
    this.emailer = emailer;
  }
  
  async createUser(userData) {
    const user = await this.database.create('users', userData);
    await this.emailer.sendWelcome(user.email);
    return user;
  }
}

// Usage - inject dependencies
const db = new PostgresDatabase();
const emailer = new SendGridEmailer();
const userService = new UserService(db, emailer);

// Testing - inject mocks
const mockDb = { create: jest.fn() };
const mockEmailer = { sendWelcome: jest.fn() };
const testService = new UserService(mockDb, mockEmailer);

// DI Container implementation
class Container {
  constructor() {
    this.services = new Map();
  }
  
  register(name, factory) {
    this.services.set(name, { factory, instance: null });
  }
  
  registerSingleton(name, factory) {
    this.services.set(name, { factory, singleton: true, instance: null });
  }
  
  resolve(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service ${name} not registered`);
    
    if (service.singleton) {
      if (!service.instance) {
        service.instance = service.factory(this);
      }
      return service.instance;
    }
    
    return service.factory(this);
  }
}

// Usage
const container = new Container();

container.registerSingleton('database', () => new PostgresDatabase());
container.registerSingleton('emailer', () => new SendGridEmailer());
container.register('userService', (c) => new UserService(
  c.resolve('database'),
  c.resolve('emailer')
));

const userService = container.resolve('userService');

// Using awilix (popular DI container)
const { createContainer, asClass, asValue } = require('awilix');

const container = createContainer();

container.register({
  database: asClass(PostgresDatabase).singleton(),
  emailer: asClass(SendGridEmailer).singleton(),
  userService: asClass(UserService),
  config: asValue(require('./config'))
});

const userService = container.resolve('userService');

// With Express
const { scopePerRequest } = require('awilix-express');

app.use(scopePerRequest(container));

app.get('/users', (req, res) => {
  const userService = req.container.resolve('userService');
  // ...
});
```

---

### Q48: What is the difference between CommonJS and ES Modules?

**Answer:**

| Feature | CommonJS | ES Modules |
|---------|----------|------------|
| **Syntax** | `require()` / `module.exports` | `import` / `export` |
| **Loading** | Synchronous | Asynchronous |
| **Parsing** | Runtime | Static (compile time) |
| **Tree-shaking** | Limited | Full support |
| **Top-level await** | No | Yes |
| **Default in Node** | Yes | Requires config |

```javascript
// CommonJS
// exporting
module.exports = { add, subtract };
module.exports.multiply = multiply;
exports.divide = divide;

// importing
const math = require('./math');
const { add, subtract } = require('./math');

// ES Modules
// exporting
export const add = (a, b) => a + b;
export default function multiply(a, b) { return a * b; }

// importing
import multiply, { add } from './math.js';
import * as math from './math.js';

// Enabling ES Modules in Node.js
// Option 1: Use .mjs extension
// file.mjs

// Option 2: package.json
{
  "type": "module"
}

// Option 3: Use .cjs for CommonJS in ESM project
// file.cjs

// Dynamic import (works in both)
const module = await import('./module.js');

// __dirname and __filename in ES Modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Importing CommonJS from ES Modules
import pkg from 'commonjs-package';
const { named } = pkg;

// Importing ES Modules from CommonJS
// Must use dynamic import
async function loadESM() {
  const { default: esmModule } = await import('./esm-module.mjs');
  return esmModule;
}

// Dual package (works with both)
// package.json
{
  "exports": {
    "import": "./dist/esm/index.js",
    "require": "./dist/cjs/index.js"
  }
}
```

---

### Q49: How do you optimize Node.js application performance?

**Answer:**

```javascript
// 1. Use clustering to utilize all CPU cores
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  for (let i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }
}

// 2. Implement caching
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 });

async function getCachedData(key, fetchFn) {
  let data = cache.get(key);
  if (!data) {
    data = await fetchFn();
    cache.set(key, data);
  }
  return data;
}

// 3. Use streams for large data
const fs = require('fs');
const { pipeline } = require('stream/promises');

await pipeline(
  fs.createReadStream('large-file.json'),
  transformStream,
  fs.createWriteStream('output.json')
);

// 4. Connection pooling
const { Pool } = require('pg');
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000
});

// 5. Compress responses
const compression = require('compression');
app.use(compression());

// 6. Optimize database queries
// Add indexes, use pagination, select only needed fields
const users = await User.find({}, 'name email')
  .limit(20)
  .skip(page * 20)
  .lean();

// 7. Use PM2 for production
// pm2 start app.js -i max

// 8. Implement request timeouts
const timeout = require('connect-timeout');
app.use(timeout('5s'));

// 9. Profile and monitor
const { performance } = require('perf_hooks');

const start = performance.now();
await heavyOperation();
console.log(`Operation took ${performance.now() - start}ms`);

// 10. Memory optimization
// Avoid memory leaks, use WeakMap for caches
const cache = new WeakMap();

// 11. Use async/await properly
// Parallel execution when possible
const [users, products] = await Promise.all([
  fetchUsers(),
  fetchProducts()
]);

// 12. HTTP/2 for better performance
const http2 = require('http2');
const server = http2.createSecureServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}, app);

// 13. Lazy loading
let heavyModule;
function getHeavyModule() {
  if (!heavyModule) {
    heavyModule = require('heavy-module');
  }
  return heavyModule;
}

// 14. Use native async methods
const fs = require('fs').promises;
const data = await fs.readFile('file.txt');
```

---

### Q50: How do you handle logging in production applications?

**Answer:**

```javascript
// Using Winston
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'my-service',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    // All logs
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// Console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Structured logging
logger.info('User created', {
  userId: user.id,
  email: user.email,
  action: 'CREATE_USER'
});

logger.error('Failed to process payment', {
  error: error.message,
  stack: error.stack,
  orderId: order.id,
  userId: user.id
});

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id
    });
  });
  
  next();
};

// Child loggers for components
const dbLogger = logger.child({ component: 'database' });
const authLogger = logger.child({ component: 'auth' });

dbLogger.info('Database connected');
authLogger.warn('Invalid login attempt', { email: 'user@example.com' });

// Log aggregation (ELK Stack, Datadog, etc.)
const { ElasticsearchTransport } = require('winston-elasticsearch');

logger.add(new ElasticsearchTransport({
  level: 'info',
  clientOpts: { node: 'http://localhost:9200' },
  indexPrefix: 'logs-myapp'
}));

// Redacting sensitive data
const { format } = winston;

const redactFormat = format((info) => {
  if (info.password) info.password = '[REDACTED]';
  if (info.token) info.token = '[REDACTED]';
  if (info.creditCard) info.creditCard = '[REDACTED]';
  return info;
});

// Performance logging
logger.profile('database-query');
await db.query(sql);
logger.profile('database-query'); // Logs duration

// Audit logging for compliance
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
      maxFiles: 365 // Keep for a year
    })
  ]
});

auditLogger.info('Data access', {
  userId: req.user.id,
  action: 'READ',
  resource: 'customer_data',
  resourceId: customerId,
  timestamp: new Date().toISOString()
});
```

---

## Summary

This guide covers intermediate to advanced Node.js concepts for mid-level developers:

1. **Event Loop Deep Dive**: Understanding phases, microtasks, and macrotasks
2. **Advanced Async Patterns**: Retry mechanisms, debouncing, throttling, async iterators
3. **Streams & Buffers**: Custom streams, backpressure, binary data handling
4. **Express.js**: Middleware, authentication, security, file uploads
5. **Testing & Best Practices**: Unit/integration testing, code coverage, security

**Next Steps:**
- Study system design patterns
- Learn about microservices architecture
- Explore container orchestration (Kubernetes)
- Dive into performance optimization
- Practice building scalable applications
