# Node.js Tech Lead — Client Interview Preparation

> **Role**: Node.js Tech Lead
> **Context**: Technical client interview — questions below are from previous rounds with other developers
> **Strategy**: Each section covers the topic end-to-end with explanations you can speak to confidently

---

## Table of Contents

1. [How Google Search Works — System Design Walkthrough](#1-how-google-search-works--system-design-walkthrough)
2. [URL Routing at the Network Level — DNS, IP, Servers](#2-url-routing-at-the-network-level--dns-ip-servers)
3. [Server Fundamentals](#3-server-fundamentals)
4. [SSL — What It Is and Why It Matters](#4-ssl--what-it-is-and-why-it-matters)
5. [HTTP vs HTTPS — What Happens Behind the Scenes](#5-http-vs-https--what-happens-behind-the-scenes)
6. [Node.js — How to Achieve Multi-Threading](#6-nodejs--how-to-achieve-multi-threading)
7. [ETL, CRON Jobs, Database Design & Processing 1M Records Fast](#7-etl-cron-jobs-database-design--processing-1m-records-fast)
8. [Banking Application — Handling High Traffic Spikes (2–3 Days)](#8-banking-application--handling-high-traffic-spikes-23-days)
9. [Deployment Strategies](#9-deployment-strategies)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Security Aspects for Node.js Backend](#11-security-aspects-for-nodejs-backend)

---

## 1. How Google Search Works — System Design Walkthrough

> **What the client wants to hear**: You understand distributed systems, indexing, ranking, and can break down a massively complex system into understandable components.

### The Three Phases of Google Search

```
Phase 1: CRAWLING          Phase 2: INDEXING           Phase 3: SERVING
─────────────────          ─────────────────           ────────────────
Googlebot discovers        Parse, analyze, store       Receive query, rank,
new/updated pages          in searchable format        return results
```

### Phase 1 — Crawling

- **Googlebot** (a distributed web crawler) starts from a seed list of known URLs.
- It follows hyperlinks on each page to discover new URLs — this is called **link discovery**.
- `robots.txt` on each domain tells Googlebot what it can/cannot crawl.
- **Crawl budget**: Google allocates crawl resources based on site importance and server capacity.
- Uses a **URL frontier** (priority queue) to decide what to crawl next — freshness, importance, and change frequency matter.
- Crawlers are distributed across thousands of machines worldwide, running in parallel.

### Phase 2 — Indexing

- Pages are parsed: HTML is rendered (Google runs JavaScript too — important for SPAs).
- Content is tokenized, stemmed, and stored in an **inverted index**:
  ```
  Inverted Index Example:
  ─────────────────────
  "nodejs"     → [page_42, page_107, page_998, ...]
  "interview"  → [page_42, page_203, page_567, ...]
  "tech lead"  → [page_42, page_310, ...]

  Searching "nodejs interview" → intersection → [page_42, ...]
  ```
- **PageRank** and other signals are computed — link authority, content quality, freshness.
- Duplicate content is detected and canonicalized.
- Structured data (schema.org) is extracted for rich snippets.

### Phase 3 — Serving a Search Query

```
User types "best nodejs frameworks 2026"
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  1. Query Processing                                  │
│     - Spell correction ("noodejs" → "nodejs")        │
│     - Synonym expansion ("best" → "top", "popular")  │
│     - Intent classification (informational query)     │
│     - Language detection                              │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  2. Index Lookup                                      │
│     - Query inverted index across distributed shards  │
│     - Retrieve candidate documents (thousands)        │
│     - Apply initial filtering                         │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  3. Ranking (200+ signals)                            │
│     - Content relevance (TF-IDF, BERT embeddings)    │
│     - PageRank (backlink authority)                   │
│     - Freshness (when was content last updated)       │
│     - User engagement signals (CTR, dwell time)       │
│     - Mobile-friendliness, page speed (Core Web V.)  │
│     - E-E-A-T (Experience, Expertise, Authority,     │
│       Trustworthiness)                                │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  4. Result Assembly                                   │
│     - Top 10 organic results                          │
│     - Knowledge panel (if entity match)               │
│     - Featured snippets, "People also ask"            │
│     - Ads (separate auction system)                   │
│     - Response served in < 200ms                      │
└──────────────────────────────────────────────────────┘
```

### Key Infrastructure Concepts to Mention

| Concept | What It Does |
|---------|-------------|
| **MapReduce / Bigtable** | Process and store massive crawl data |
| **Inverted Index** | Core data structure — maps words to documents |
| **PageRank** | Ranks pages by quality/quantity of inbound links |
| **Sharding** | Index split across thousands of machines |
| **Replication** | Multiple copies for fault tolerance and geographic proximity |
| **Caching** | Popular queries served from cache (CDN + in-memory) |
| **Load Balancing** | Distribute queries across serving clusters globally |

### How to Answer This

> "When you type a search term, three things have already happened: crawling discovered the page, indexing parsed and stored it in an inverted index, and ranking signals were precomputed. At query time, Google processes your query (spell check, intent), looks up the inverted index across distributed shards, ranks candidates using 200+ signals including content relevance, PageRank, and freshness, then assembles the result page — all in under 200ms. The scale is handled through sharding, replication, caching, and global load balancing."

---

## 2. URL Routing at the Network Level — DNS, IP, Servers

> **What the client wants to hear**: You understand every hop from browser to server — DNS resolution, TCP, routing, load balancing.

### What Happens When You Type `https://example.com/api/users`

```
Step 1: DNS Resolution
──────────────────────
Browser → "What is the IP of example.com?"

  Browser DNS Cache → miss
      ↓
  OS DNS Cache → miss
      ↓
  Router DNS Cache → miss
      ↓
  ISP Recursive Resolver
      ↓
  Root Name Server (.)           → "Ask .com TLD server"
      ↓
  TLD Name Server (.com)        → "Ask ns1.example.com"
      ↓
  Authoritative Name Server     → "IP is 93.184.216.34"
      ↓
  Response cached at every level (TTL-based)
```

### DNS Components Explained

| Component | Role | Example |
|-----------|------|---------|
| **Browser Cache** | First lookup — avoids network entirely | Chrome stores recent lookups |
| **OS Resolver** | System-level cache, checks `/etc/hosts` | `127.0.0.1 localhost` |
| **Recursive Resolver** | ISP's DNS server — does the heavy lifting | `8.8.8.8` (Google DNS) |
| **Root Name Server** | 13 root server clusters worldwide, knows TLD locations | Managed by ICANN |
| **TLD Name Server** | Knows authoritative servers for `.com`, `.org`, `.io`, etc. | Verisign manages `.com` |
| **Authoritative Name Server** | The domain owner's DNS — has the actual IP | `ns1.example.com` |

### DNS Record Types

| Record | Purpose | Example |
|--------|---------|---------|
| **A** | Maps domain to IPv4 address | `example.com → 93.184.216.34` |
| **AAAA** | Maps domain to IPv6 address | `example.com → 2606:2800:220:1:...` |
| **CNAME** | Alias to another domain | `www.example.com → example.com` |
| **MX** | Mail server routing | `example.com → mail.example.com` |
| **NS** | Delegates to name servers | `example.com → ns1.cloudflare.com` |
| **TXT** | Verification, SPF, DKIM | SPF records for email auth |
| **SRV** | Service discovery | Used by some microservice setups |

### After DNS — Network Level Routing

```
Step 2: TCP Connection
──────────────────────
Client IP: 192.168.1.50 → NAT → Public IP: 103.x.x.x
Server IP: 93.184.216.34

  Client                           Server
    │                                │
    │──── SYN ─────────────────────→│   (3-way handshake)
    │←─── SYN-ACK ─────────────────│
    │──── ACK ─────────────────────→│
    │                                │
    │    TCP connection established   │


Step 3: TLS Handshake (for HTTPS — see Section 5)
──────────────────────────────────────────────────


Step 4: HTTP Request
────────────────────
GET /api/users HTTP/1.1
Host: example.com
Accept: application/json
Authorization: Bearer eyJhbG...


Step 5: Server-Side Routing
───────────────────────────
Internet → CDN/WAF (Cloudflare) → Load Balancer (Nginx/ALB)
    → Application Server (Node.js) → Route Handler → Database → Response
```

### Role of Each Network Element

| Element | What It Does |
|---------|-------------|
| **Client (Browser)** | Initiates request, renders response |
| **ISP** | Provides internet access, runs recursive DNS resolver |
| **DNS** | Translates domain names to IP addresses |
| **Router/Gateway** | Forwards packets between networks using routing tables |
| **CDN (Cloudflare, CloudFront)** | Caches static content at edge locations near users |
| **WAF (Web Application Firewall)** | Filters malicious traffic before it reaches your server |
| **Load Balancer** | Distributes incoming traffic across multiple server instances |
| **Reverse Proxy (Nginx)** | Sits in front of app servers — SSL termination, caching, compression |
| **Application Server (Node.js)** | Runs business logic, handles API routes |
| **Database Server** | Stores and retrieves data |

### IP Addressing Basics

```
IPv4: 192.168.1.50  (32-bit, ~4.3 billion addresses)
IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334  (128-bit)

Private IP Ranges (not routable on internet):
  10.0.0.0/8        → 10.0.0.0 – 10.255.255.255
  172.16.0.0/12     → 172.16.0.0 – 172.31.255.255
  192.168.0.0/16    → 192.168.0.0 – 192.168.255.255

NAT (Network Address Translation):
  Converts private IPs to public IPs at the router level
  Many devices share one public IP — router tracks via port numbers

Ports:
  HTTP  → 80
  HTTPS → 443
  SSH   → 22
  Your Node.js app → typically 3000, 8080, etc.
```

---

## 3. Server Fundamentals

> **What the client wants to hear**: You understand what a server actually is, how it processes requests, and how Node.js fits into the picture.

### What Is a Server?

A server is a computer (physical or virtual) that listens on a network port for incoming requests and sends back responses. It runs **server software** that defines how to handle those requests.

### Types of Servers

| Type | Purpose | Examples |
|------|---------|---------|
| **Web Server** | Serves static files (HTML, CSS, JS, images) | Nginx, Apache |
| **Application Server** | Runs business logic, APIs | Node.js, Django, Spring Boot |
| **Database Server** | Stores and queries data | PostgreSQL, MongoDB, MySQL |
| **Proxy Server** | Intermediary — caching, filtering, load balancing | Nginx (reverse proxy), HAProxy |
| **Mail Server** | Handles email (SMTP, IMAP, POP3) | Postfix, Exchange |
| **File Server** | Stores and serves files | S3, NFS |

### How Node.js Works as a Server

```
                    ┌─────────────────────────────────────┐
 Incoming Request → │         NODE.JS RUNTIME              │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │    V8 JavaScript Engine         │  │
                    │  │    (Compiles JS to machine code)│  │
                    │  └────────────────────────────────┘  │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │    Event Loop (single thread)   │  │
                    │  │    Handles all incoming I/O     │  │
                    │  │    Non-blocking, event-driven   │  │
                    │  └────────────────────────────────┘  │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │    libuv (C library)            │  │
                    │  │    Thread pool (4 default)      │  │
                    │  │    Handles: file I/O, DNS,      │  │
                    │  │    crypto, compression          │  │
                    │  └────────────────────────────────┘  │
                    │                                      │
                    │  ┌────────────────────────────────┐  │
                    │  │    C++ Bindings                 │  │
                    │  │    OS-level networking (TCP/UDP)│  │
                    │  │    via epoll/kqueue/IOCP        │  │
                    │  └────────────────────────────────┘  │
                    └─────────────────────────────────────┘
```

### Event Loop Phases (Critical to Explain)

```
   ┌───────────────────────────┐
┌─>│        timers              │  ← setTimeout, setInterval callbacks
│  └────────────┬──────────────┘
│  ┌────────────▼──────────────┐
│  │     pending callbacks      │  ← I/O callbacks deferred from previous cycle
│  └────────────┬──────────────┘
│  ┌────────────▼──────────────┐
│  │     idle, prepare          │  ← internal use only
│  └────────────┬──────────────┘
│  ┌────────────▼──────────────┐
│  │         poll               │  ← retrieve new I/O events, execute callbacks
│  └────────────┬──────────────┘     (most time spent here)
│  ┌────────────▼──────────────┐
│  │         check              │  ← setImmediate callbacks
│  └────────────┬──────────────┘
│  ┌────────────▼──────────────┐
│  │    close callbacks         │  ← socket.on('close'), etc.
│  └────────────┴──────────────┘
│              │
└──────────────┘  (next tick queue + microtask queue run between each phase)
```

### Process vs Thread vs Cluster

| Concept | What It Is | Node.js Context |
|---------|-----------|----------------|
| **Process** | Independent execution unit with its own memory | Each `node app.js` is one process |
| **Thread** | Lightweight unit within a process, shares memory | Event loop is single-threaded; libuv has a thread pool |
| **Cluster** | Multiple processes of the same app sharing a port | `cluster` module forks worker processes |

---

## 4. SSL — What It Is and Why It Matters

> **What the client wants to hear**: You understand SSL/TLS, certificate chain, and can articulate the security benefits beyond just "encryption".

### What Is SSL/TLS?

- **SSL** (Secure Sockets Layer) is the predecessor — deprecated, but the name stuck.
- **TLS** (Transport Layer Security) is the current standard (TLS 1.2 and TLS 1.3 in use today).
- It provides a **secure channel** between two machines communicating over the internet.

### Three Guarantees of SSL/TLS

| Guarantee | What It Means | Without It |
|-----------|--------------|-----------|
| **Encryption** | Data is unreadable to eavesdroppers | Anyone on the network can read passwords, tokens, data |
| **Authentication** | You're talking to the real server, not an impersonator | Man-in-the-middle attacks — attacker pretends to be the server |
| **Integrity** | Data hasn't been tampered with in transit | Attacker could modify API responses or inject malicious content |

### How SSL Certificates Work

```
Certificate Chain of Trust:
───────────────────────────

Root CA (Certificate Authority)
  │  Pre-installed in browsers/OS (e.g., DigiCert, Let's Encrypt)
  │  Self-signed — the ultimate trust anchor
  │
  ├── Intermediate CA
  │     Signed by Root CA
  │     Issues end-entity certificates
  │
  └──── Your Server Certificate (example.com)
          Signed by Intermediate CA
          Contains: domain name, public key, validity dates, issuer
```

### Types of SSL Certificates

| Type | Validation Level | Use Case |
|------|-----------------|---------|
| **DV (Domain Validated)** | Proves you own the domain | Blogs, small sites — Let's Encrypt provides free |
| **OV (Organization Validated)** | Verifies organization identity | Business websites |
| **EV (Extended Validation)** | Rigorous business verification | Banks, financial institutions |
| **Wildcard** | Covers `*.example.com` | Multiple subdomains |
| **SAN/Multi-Domain** | Covers multiple specific domains | `example.com` + `api.example.com` + `app.example.com` |

### Adding SSL to a Node.js Application

**Option 1: SSL Termination at Reverse Proxy (Recommended)**

```
Client ──HTTPS──→ Nginx/ALB (terminates SSL) ──HTTP──→ Node.js (port 3000)
```

Nginx handles certificate management, and Node.js doesn't need to deal with it. This is the production standard.

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/ssl/certs/example.com.pem;
    ssl_certificate_key /etc/ssl/private/example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

**Option 2: SSL Directly in Node.js (Dev/Small Scale)**

```javascript
const https = require('https');
const fs = require('fs');
const express = require('express');

const app = express();

const server = https.createServer({
  key: fs.readFileSync('/path/to/private.key'),
  cert: fs.readFileSync('/path/to/certificate.crt'),
  ca: fs.readFileSync('/path/to/ca-bundle.crt')
}, app);

server.listen(443);
```

### Advantages of Adding SSL

1. **Data Protection** — Passwords, tokens, PII are encrypted in transit
2. **SEO Ranking** — Google ranks HTTPS sites higher
3. **Browser Trust** — No "Not Secure" warning in the address bar
4. **HTTP/2 Support** — Modern protocol features require HTTPS
5. **Compliance** — PCI-DSS, HIPAA, GDPR all require encryption in transit
6. **API Security** — Prevents token interception for REST/GraphQL APIs
7. **Integrity** — Prevents ISPs or middlemen from injecting ads or modifying content

---

## 5. HTTP vs HTTPS — What Happens Behind the Scenes

> **What the client wants to hear**: You understand the protocol-level differences, the TLS handshake, and performance implications.

### HTTP (Hypertext Transfer Protocol)

```
Client                          Server
  │                               │
  │── TCP 3-way handshake ──────→│
  │                               │
  │── GET /api/users ───────────→│   ← PLAINTEXT — anyone can read this
  │←── 200 OK {users:[...]} ────│   ← PLAINTEXT response
  │                               │
```

- **Port 80** by default
- Data transmitted in **plaintext** — visible to anyone on the network
- No server identity verification
- Vulnerable to: eavesdropping, MITM attacks, data tampering

### HTTPS (HTTP over TLS)

```
Client                          Server
  │                               │
  │── TCP 3-way handshake ──────→│
  │                               │
  │── TLS Handshake (see below) ─│   ← establishes encrypted channel
  │                               │
  │── GET /api/users ───────────→│   ← ENCRYPTED — looks like random bytes
  │←── 200 OK {users:[...]} ────│   ← ENCRYPTED response
  │                               │
```

### TLS 1.3 Handshake (Current Standard)

```
Client                                         Server
  │                                               │
  │── ClientHello ──────────────────────────────→│
  │   - Supported TLS versions                    │
  │   - Supported cipher suites                   │
  │   - Client random number                      │
  │   - Key share (Diffie-Hellman public key)     │
  │                                               │
  │←─ ServerHello + Certificate + Finished ──────│
  │   - Chosen cipher suite                       │
  │   - Server random number                      │
  │   - Server's key share                        │
  │   - Server certificate (proves identity)      │
  │   - Server finished (encrypted)               │
  │                                               │
  │── Client Finished ─────────────────────────→│
  │   (encrypted with derived session key)        │
  │                                               │
  │   ═══ Encrypted Application Data ═══         │
  │                                               │

TLS 1.3: 1-RTT handshake (1 round trip)
TLS 1.2: 2-RTT handshake (2 round trips) — slower
```

### Key Cryptographic Concepts

| Concept | Role in HTTPS |
|---------|--------------|
| **Asymmetric Encryption (RSA/ECDSA)** | Used during handshake — server proves identity with private key |
| **Diffie-Hellman Key Exchange** | Client and server agree on a shared secret without transmitting it |
| **Symmetric Encryption (AES-256-GCM)** | Used for actual data transfer — fast, uses the shared session key |
| **HMAC** | Ensures data integrity — detects any tampering |
| **Certificate** | Server's public key + identity, signed by a trusted CA |

### HTTP/1.1 vs HTTP/2 vs HTTP/3

| Feature | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---------|----------|--------|--------|
| **Multiplexing** | No (one request per connection) | Yes (multiple streams) | Yes |
| **Header Compression** | No | HPACK | QPACK |
| **Server Push** | No | Yes | Yes |
| **Transport** | TCP | TCP | **QUIC (UDP-based)** |
| **TLS Required** | No | Practically yes | Built-in (TLS 1.3) |
| **Head-of-line blocking** | Yes (TCP + HTTP level) | TCP level only | None |

### Performance Impact

```
HTTP/1.1: Browser opens 6 parallel TCP connections per domain
HTTP/2:   Single TCP connection, multiplexed streams — fewer handshakes
HTTP/3:   QUIC eliminates TCP head-of-line blocking — better on lossy networks

In Node.js:
  const http2 = require('http2');
  const server = http2.createSecureServer({ key, cert });
```

---

## 6. Node.js — How to Achieve Multi-Threading

> **What the client wants to hear**: You understand that Node.js is single-threaded by design but know exactly how to leverage multiple cores and true parallelism.

### Why Node.js Is "Single-Threaded" (and Why That's Usually Fine)

- The **event loop** runs on a single thread — this handles all JavaScript execution.
- **I/O operations** (network, file system, database) are non-blocking — delegated to the OS or libuv thread pool.
- For **I/O-bound** workloads (typical web APIs), single-threaded is efficient because the CPU isn't the bottleneck — waiting for I/O is.

### When You Need Multi-Threading

- **CPU-bound tasks**: Image processing, encryption, data transformation, PDF generation, complex calculations
- **Utilizing all CPU cores**: A single Node.js process uses only 1 core on a 16-core machine

### Four Approaches to Multi-Threading in Node.js

#### Approach 1: Cluster Module (Multi-Process)

Best for: **Scaling HTTP servers across all CPU cores**

```javascript
const cluster = require('cluster');
const os = require('os');
const express = require('express');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Primary process ${process.pid} forking ${numCPUs} workers`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const app = express();
  app.get('/api/data', (req, res) => {
    res.json({ pid: process.pid, data: 'response' });
  });
  app.listen(3000);
}
```

- Each worker is a **separate process** with its own memory and event loop.
- The OS load-balances incoming connections across workers.
- No shared memory — communicate via IPC (inter-process communication).

#### Approach 2: Worker Threads (True Multi-Threading)

Best for: **CPU-intensive tasks without blocking the event loop**

```javascript
// main.js
const { Worker } = require('worker_threads');

function runHeavyTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./heavy-task.js', {
      workerData: data
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

// API endpoint that offloads CPU work
app.post('/api/process-report', async (req, res) => {
  const result = await runHeavyTask(req.body);
  res.json(result);
});
```

```javascript
// heavy-task.js
const { workerData, parentPort } = require('worker_threads');

function processData(data) {
  // CPU-intensive work: parsing, transforming, computing
  let result = 0;
  for (let i = 0; i < data.iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i);
  }
  return result;
}

const result = processData(workerData);
parentPort.postMessage({ result });
```

- Threads share the same process memory (can use `SharedArrayBuffer`).
- Much lighter than spawning processes.
- Ideal for: image resizing, CSV parsing, encryption, data aggregation.

#### Approach 3: Worker Thread Pool (Production Pattern)

Best for: **Reusing threads across multiple requests**

```javascript
const { Worker } = require('worker_threads');
const os = require('os');

class WorkerPool {
  constructor(workerScript, poolSize = os.cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.taskQueue = [];
    this.init();
  }

  init() {
    for (let i = 0; i < this.poolSize; i++) {
      this.addWorker();
    }
  }

  addWorker() {
    const worker = new Worker(this.workerScript);
    worker.busy = false;

    worker.on('message', (result) => {
      worker.busy = false;
      worker.currentResolve(result);
      this.processQueue();
    });

    worker.on('error', (err) => {
      worker.busy = false;
      worker.currentReject(err);
      this.processQueue();
    });

    this.workers.push(worker);
  }

  execute(data) {
    return new Promise((resolve, reject) => {
      const task = { data, resolve, reject };
      const freeWorker = this.workers.find(w => !w.busy);

      if (freeWorker) {
        this.runTask(freeWorker, task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  runTask(worker, task) {
    worker.busy = true;
    worker.currentResolve = task.resolve;
    worker.currentReject = task.reject;
    worker.postMessage(task.data);
  }

  processQueue() {
    if (this.taskQueue.length === 0) return;
    const freeWorker = this.workers.find(w => !w.busy);
    if (freeWorker) {
      this.runTask(freeWorker, this.taskQueue.shift());
    }
  }

  destroy() {
    this.workers.forEach(w => w.terminate());
  }
}

// Usage
const pool = new WorkerPool('./heavy-task.js', 4);

app.post('/api/transform', async (req, res) => {
  const result = await pool.execute(req.body);
  res.json(result);
});
```

#### Approach 4: Child Processes

Best for: **Running external programs or scripts**

```javascript
const { execFile, fork } = require('child_process');

// Run an external command
execFile('ffmpeg', ['-i', 'input.mp4', '-s', '720x480', 'output.mp4'],
  (error, stdout) => {
    console.log('Video processed');
  }
);

// Fork another Node.js script (IPC enabled)
const child = fork('./etl-processor.js');
child.send({ task: 'processCSV', file: '/data/large.csv' });
child.on('message', (result) => {
  console.log('ETL complete:', result);
});
```

#### Approach 5: PM2 (Production Process Manager)

```bash
# Run app with cluster mode across all CPUs
pm2 start app.js -i max

# PM2 handles:
# - Process forking across all cores
# - Automatic restart on crash
# - Zero-downtime reload
# - Memory limit monitoring
# - Log management
```

### When to Use What

| Scenario | Best Approach |
|----------|--------------|
| Scale HTTP API across cores | `cluster` module or PM2 |
| CPU-heavy computation (crypto, parsing) | Worker Threads |
| Many repeated CPU tasks | Worker Thread Pool |
| Run external programs (ffmpeg, Python) | Child Processes |
| Simple scaling in production | PM2 cluster mode |

---

## 7. ETL, CRON Jobs, Database Design & Processing 1M Records Fast

> **What the client wants to hear**: You can design data pipelines, schedule jobs, structure databases properly, and optimize for high-volume processing.

### What Is ETL?

```
ETL = Extract → Transform → Load

  ┌──────────┐      ┌──────────────┐      ┌──────────┐
  │  EXTRACT  │ ──→  │  TRANSFORM   │ ──→  │   LOAD    │
  │           │      │              │      │           │
  │ - APIs    │      │ - Clean      │      │ - Database│
  │ - DBs     │      │ - Validate   │      │ - Data    │
  │ - Files   │      │ - Enrich     │      │   Warehouse│
  │ - Queues  │      │ - Aggregate  │      │ - Search  │
  │ - Streams │      │ - Format     │      │   Index   │
  └──────────┘      └──────────────┘      └──────────┘
```

### ETL Pipeline in Node.js

```javascript
const { Transform, pipeline } = require('stream');
const csv = require('csv-parser');
const fs = require('fs');

class ETLPipeline {
  async run(sourceConfig, transformRules, targetConfig) {
    const startTime = Date.now();
    let processed = 0, errors = 0;

    // EXTRACT: Create readable stream from source
    const source = this.createSource(sourceConfig);

    // TRANSFORM: Apply business rules
    const transformer = new Transform({
      objectMode: true,
      transform(record, encoding, callback) {
        try {
          const cleaned = cleanRecord(record);
          const validated = validateRecord(cleaned);
          const enriched = enrichRecord(validated);

          if (enriched) {
            processed++;
            callback(null, enriched);
          } else {
            errors++;
            callback(); // skip invalid records
          }
        } catch (err) {
          errors++;
          callback(); // don't stop pipeline for one bad record
        }
      }
    });

    // LOAD: Batch insert into target
    const loader = new BatchLoader(targetConfig, { batchSize: 1000 });

    return new Promise((resolve, reject) => {
      pipeline(source, transformer, loader, (err) => {
        if (err) reject(err);
        else resolve({
          processed,
          errors,
          duration: Date.now() - startTime
        });
      });
    });
  }

  createSource(config) {
    switch (config.type) {
      case 'csv':
        return fs.createReadStream(config.path).pipe(csv());
      case 'database':
        return config.model.findAllStream({ batchSize: 5000 });
      case 'api':
        return new APIPaginatedStream(config.url, config.pageSize);
    }
  }
}

class BatchLoader extends require('stream').Writable {
  constructor(config, options) {
    super({ objectMode: true });
    this.config = config;
    this.batchSize = options.batchSize;
    this.batch = [];
  }

  async _write(record, encoding, callback) {
    this.batch.push(record);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
    callback();
  }

  async _final(callback) {
    if (this.batch.length > 0) {
      await this.flush();
    }
    callback();
  }

  async flush() {
    const toInsert = this.batch;
    this.batch = [];

    await this.config.model.bulkCreate(toInsert, {
      ignoreDuplicates: true,
      updateOnDuplicate: this.config.upsertFields
    });
  }
}
```

### CRON Jobs in Node.js

```javascript
const cron = require('node-cron');

// ┌────────────── second (0 - 59) [optional]
// │ ┌──────────── minute (0 - 59)
// │ │ ┌────────── hour (0 - 23)
// │ │ │ ┌──────── day of month (1 - 31)
// │ │ │ │ ┌────── month (1 - 12)
// │ │ │ │ │ ┌──── day of week (0 - 7, 0 and 7 = Sunday)
// │ │ │ │ │ │
// * * * * * *

// Every day at 2 AM — run ETL
cron.schedule('0 2 * * *', () => etlPipeline.run());

// Every 30 minutes — sync data
cron.schedule('*/30 * * * *', () => dataSyncService.sync());

// Every Monday at 9 AM — generate weekly report
cron.schedule('0 9 * * 1', () => reportService.generateWeekly());

// First day of month at midnight — billing
cron.schedule('0 0 1 * *', () => billingService.processMonthly());
```

**Manual Trigger Pattern (CRON + On-Demand)**

```javascript
class JobRunner {
  constructor() {
    this.jobs = new Map();
  }

  register(name, handler, cronExpression) {
    this.jobs.set(name, { handler, cronExpression });

    if (cronExpression) {
      cron.schedule(cronExpression, () => this.execute(name));
    }
  }

  async execute(name, params = {}) {
    const job = this.jobs.get(name);
    const runId = crypto.randomUUID();

    await JobLog.create({ runId, name, status: 'running', startedAt: new Date() });

    try {
      const result = await job.handler(params);
      await JobLog.update(
        { status: 'completed', result, completedAt: new Date() },
        { where: { runId } }
      );
      return result;
    } catch (error) {
      await JobLog.update(
        { status: 'failed', error: error.message, completedAt: new Date() },
        { where: { runId } }
      );
      throw error;
    }
  }
}

// Register jobs — scheduled + manually triggerable
const runner = new JobRunner();
runner.register('daily-etl', etlHandler, '0 2 * * *');
runner.register('manual-export', exportHandler, null); // manual only

// API endpoint to trigger manually
app.post('/api/admin/jobs/:name/run', async (req, res) => {
  const result = await runner.execute(req.params.name, req.body);
  res.json(result);
});
```

### Common Database Structures

**Normalized vs Denormalized**

```
NORMALIZED (3NF) — Avoid redundancy, enforce consistency
──────────────────────────────────────────────────────
users:          orders:              order_items:
  id              id                   id
  name            user_id (FK)         order_id (FK)
  email           total                product_id (FK)
                  status               quantity, price

DENORMALIZED — Optimize for read speed
──────────────────────────────────────
orders:
  id, user_name, user_email, total, status,
  items: [{ product_name, quantity, price }]
```

**Common Schema Patterns**

| Pattern | When to Use |
|---------|------------|
| **Star Schema** | Data warehousing — central fact table + dimension tables |
| **Adjacency List** | Tree structures (categories, org charts) — `parent_id` column |
| **Polymorphic Associations** | Comments on posts, photos, videos — `commentable_type` + `commentable_id` |
| **Soft Deletes** | Audit requirements — `deleted_at` column instead of DELETE |
| **Temporal Tables** | Track changes over time — `valid_from`, `valid_to` columns |
| **Event Sourcing** | Store events, derive state — banking ledger pattern |

### Processing 1M Records in 30 Minutes — Speed Optimization

> **Client's question**: "I have 1M data, need to process in 30 minutes — how to increase speed?"

**The answer depends on the bottleneck. Here's a systematic approach:**

#### Strategy 1: Stream Processing (Don't Load Everything Into Memory)

```javascript
// BAD: Loads all 1M records into memory
const allRecords = await Model.findAll(); // 💥 Out of memory

// GOOD: Stream records in batches
async function* streamRecords(model, batchSize = 5000) {
  let offset = 0;
  while (true) {
    const batch = await model.findAll({ limit: batchSize, offset });
    if (batch.length === 0) break;
    yield batch;
    offset += batchSize;
  }
}

for await (const batch of streamRecords(Product, 5000)) {
  await processBatch(batch);
}
```

#### Strategy 2: Parallel Batch Processing with Worker Threads

```javascript
const { Worker } = require('worker_threads');
const os = require('os');

async function processMillionRecords() {
  const TOTAL_RECORDS = 1_000_000;
  const NUM_WORKERS = os.cpus().length; // e.g., 8 cores
  const CHUNK_SIZE = Math.ceil(TOTAL_RECORDS / NUM_WORKERS);

  const workers = [];

  for (let i = 0; i < NUM_WORKERS; i++) {
    const offset = i * CHUNK_SIZE;
    const limit = Math.min(CHUNK_SIZE, TOTAL_RECORDS - offset);

    workers.push(new Promise((resolve, reject) => {
      const worker = new Worker('./process-chunk.js', {
        workerData: { offset, limit }
      });
      worker.on('message', resolve);
      worker.on('error', reject);
    }));
  }

  // All chunks processed in parallel
  const results = await Promise.all(workers);
  console.log(`Processed ${results.reduce((s, r) => s + r.count, 0)} records`);
}
// 8 cores processing 125K each in parallel → ~4x faster than sequential
```

#### Strategy 3: Bulk Database Operations

```javascript
// BAD: Individual inserts (1M INSERT queries)
for (const record of records) {
  await Model.create(record); // 1 query per record = hours
}

// GOOD: Bulk insert (1000 records per query = 1000 queries total)
const BATCH_SIZE = 1000;
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  await Model.bulkCreate(batch, {
    ignoreDuplicates: true,
    logging: false
  });
}

// BEST: Use COPY command (PostgreSQL) or LOAD DATA (MySQL)
// 10-100x faster than INSERT for bulk loads
await sequelize.query(
  `COPY target_table FROM '/tmp/data.csv' WITH (FORMAT csv, HEADER true)`
);
```

#### Strategy 4: Database-Level Optimizations

```sql
-- Disable indexes during bulk load, rebuild after
ALTER TABLE target_table DISABLE TRIGGER ALL;
-- ... bulk insert ...
ALTER TABLE target_table ENABLE TRIGGER ALL;
REINDEX TABLE target_table;

-- Use unlogged tables for temporary processing (PostgreSQL)
CREATE UNLOGGED TABLE temp_processing AS SELECT * FROM source WHERE ...;

-- Partition large tables by date for parallel processing
CREATE TABLE events (
    id SERIAL,
    created_at TIMESTAMP,
    data JSONB
) PARTITION BY RANGE (created_at);
```

#### Strategy 5: Use Message Queues for Distribution

```javascript
// Producer: Split 1M records into 1000-record chunks → queue
for (let offset = 0; offset < 1_000_000; offset += 1000) {
  await queue.add('process-chunk', { offset, limit: 1000 });
}

// Consumers: Multiple workers pulling from queue
// 10 consumers × 1000 records × 100 batches each = 1M processed
// Can scale consumers horizontally
```

#### Performance Comparison

```
Approach                              1M Records Time
───────────────────────────────────────────────────────
Sequential single inserts             ~4-6 hours
Bulk insert (1000/batch)              ~15-30 minutes
Streaming + bulk insert               ~10-20 minutes
Parallel workers + bulk insert        ~3-8 minutes
Database COPY/LOAD DATA               ~1-3 minutes
```

---

## 8. Banking Application — Handling High Traffic Spikes (2–3 Days)

> **What the client wants to hear**: You can architect for temporary traffic spikes (salary day, festive season, tax deadline) with auto-scaling and graceful degradation.

### Typical Banking Traffic Spike Scenarios

- Salary credit day (1st, 5th of month) — 10-50x normal traffic
- Tax payment deadline — concentrated burst over 2-3 days
- Festive season offers — sustained high traffic
- Policy changes / demonetization — unpredictable surge

### Architecture for Handling Spikes

```
                     ┌─── CDN (Static Assets) ─────────────────────┐
                     │                                              │
User ──→ CloudFlare WAF ──→ AWS ALB (Auto-scaling)                │
                               │                                    │
                     ┌─────────┼──────────┐                        │
                     ▼         ▼          ▼                        │
                 ┌──────┐ ┌──────┐ ┌──────┐  ← Auto-scale group   │
                 │Node 1│ │Node 2│ │Node N│    (min: 4, max: 20)  │
                 └──┬───┘ └──┬───┘ └──┬───┘                        │
                    │        │        │                             │
                    ▼        ▼        ▼                             │
              ┌─────────────────────────────┐                      │
              │   Redis Cluster (Cache +     │                      │
              │   Rate Limiting + Sessions)  │                      │
              └─────────────────────────────┘                      │
                    │                                               │
              ┌─────┴──────────────────────┐                       │
              ▼                            ▼                        │
     ┌────────────────┐          ┌─────────────────┐               │
     │ PostgreSQL     │          │ Message Queue    │               │
     │ (Primary +     │          │ (RabbitMQ/SQS)   │               │
     │  Read Replicas)│          │ Async Processing  │               │
     └────────────────┘          └─────────────────┘               │
```

### Key Strategies

#### 1. Auto-Scaling (Horizontal)

```javascript
// AWS Auto Scaling Configuration (conceptual)
const scalingPolicy = {
  minInstances: 4,          // Normal traffic
  maxInstances: 20,         // Peak traffic
  targetCPUUtilization: 60, // Scale up when CPU > 60%

  // Scheduled scaling for known events
  scheduledActions: [
    {
      name: 'salary-day-scale-up',
      schedule: 'cron(0 6 1 * *)',  // 1st of every month, 6 AM
      minInstances: 12,
      maxInstances: 20
    },
    {
      name: 'salary-day-scale-down',
      schedule: 'cron(0 22 2 * *)',  // 2nd of every month, 10 PM
      minInstances: 4,
      maxInstances: 20
    }
  ],

  // Predictive scaling based on historical patterns
  predictiveScaling: {
    mode: 'forecast_and_scale',
    metricPairType: 'ALBRequestCountPerTarget'
  }
};
```

#### 2. Caching Strategy (Reduce DB Load)

```javascript
class BankingCacheStrategy {
  constructor(redis) {
    this.redis = redis;
  }

  // Cache account balance (short TTL — balance changes frequently)
  async getBalance(accountId) {
    const cached = await this.redis.get(`balance:${accountId}`);
    if (cached) return JSON.parse(cached);

    const balance = await Account.findByPk(accountId);
    await this.redis.setex(`balance:${accountId}`, 30, JSON.stringify(balance));
    return balance;
  }

  // Cache static reference data (long TTL)
  async getBranchList() {
    const cached = await this.redis.get('branches');
    if (cached) return JSON.parse(cached);

    const branches = await Branch.findAll();
    await this.redis.setex('branches', 3600, JSON.stringify(branches));
    return branches;
  }

  // Invalidate on write
  async updateBalance(accountId, newBalance) {
    await Account.update({ balance: newBalance }, { where: { id: accountId } });
    await this.redis.del(`balance:${accountId}`);
  }
}
```

#### 3. Queue-Based Processing (Decouple Heavy Operations)

```javascript
// During peak: non-critical operations go to queue
class TransactionService {
  async processTransaction(txn) {
    // CRITICAL PATH (synchronous, must be fast):
    // 1. Validate
    // 2. Debit/Credit
    // 3. Return confirmation

    const result = await this.executeTransaction(txn);

    // NON-CRITICAL (queue for async processing):
    await queue.add('post-transaction', {
      txnId: result.id,
      tasks: [
        'send-sms-notification',
        'send-email-receipt',
        'update-analytics',
        'fraud-scoring',
        'update-monthly-statement'
      ]
    });

    return result; // User gets fast response
  }
}
```

#### 4. Read Replicas (Distribute DB Load)

```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  replication: {
    read: [
      { host: 'replica-1.db.internal', username: 'reader', password: '...' },
      { host: 'replica-2.db.internal', username: 'reader', password: '...' },
      { host: 'replica-3.db.internal', username: 'reader', password: '...' }
    ],
    write: {
      host: 'primary.db.internal', username: 'writer', password: '...'
    }
  },
  pool: {
    max: 30,      // Increase pool for spike
    min: 5,
    acquire: 30000,
    idle: 10000
  }
});

// Reads automatically go to replicas, writes go to primary
const balance = await Account.findByPk(id);              // → replica
await Account.update({ balance: newBal }, { where: { id } }); // → primary
```

#### 5. Rate Limiting & Graceful Degradation

```javascript
// Tiered rate limiting during peak
const rateLimitConfig = {
  normal: { windowMs: 60000, max: 100 },
  peak: {
    critical: { windowMs: 60000, max: 200 },   // Payments, transfers
    standard: { windowMs: 60000, max: 50 },     // Balance checks
    low: { windowMs: 60000, max: 10 }           // Statement downloads
  }
};

// Graceful degradation: disable non-critical features during peak
class FeatureDegrader {
  constructor(redis) {
    this.redis = redis;
  }

  async isFeatureEnabled(feature) {
    const trafficLevel = await this.redis.get('traffic:level');

    const degradationRules = {
      extreme: ['transfers', 'balance'],           // Only critical
      high: ['transfers', 'balance', 'payments'],  // Core banking
      normal: ['transfers', 'balance', 'payments', // Everything
               'statements', 'offers', 'analytics']
    };

    return degradationRules[trafficLevel]?.includes(feature) ?? true;
  }
}
```

#### 6. Database Connection Pooling & Circuit Breaker

```javascript
const CircuitBreaker = require('opossum');

const dbCallBreaker = new CircuitBreaker(queryDatabase, {
  timeout: 5000,          // Fail fast if DB takes > 5s
  errorThresholdPercentage: 50,  // Open circuit if 50% fail
  resetTimeout: 10000,    // Try again after 10s
  volumeThreshold: 10     // Need at least 10 requests to trip
});

dbCallBreaker.fallback(() => {
  return { source: 'cache', data: getCachedData() };
});

dbCallBreaker.on('open', () => {
  alertService.send('DB circuit breaker OPEN — using fallback');
});
```

---

## 9. Deployment Strategies

> **What the client wants to hear**: You know multiple deployment strategies, their trade-offs, and when to use each.

### Deployment Strategies Compared

```
1. ROLLING DEPLOYMENT
─────────────────────
  [v1] [v1] [v1] [v1]     Start: all running v1
  [v2] [v1] [v1] [v1]     Update one at a time
  [v2] [v2] [v1] [v1]     ...
  [v2] [v2] [v2] [v1]     ...
  [v2] [v2] [v2] [v2]     Done: all running v2

  ✓ Zero downtime
  ✓ Gradual rollout
  ✗ Temporarily running mixed versions
  ✗ Slow rollback (must roll forward or redeploy)


2. BLUE-GREEN DEPLOYMENT
────────────────────────
  BLUE (v1) ← Load Balancer ← Users
  GREEN (v2) [idle, being tested]

  After testing:
  BLUE (v1) [idle, standby]
  GREEN (v2) ← Load Balancer ← Users

  ✓ Instant switch
  ✓ Instant rollback (switch back to blue)
  ✓ Full testing before go-live
  ✗ Double infrastructure cost
  ✗ Database migrations need careful handling


3. CANARY DEPLOYMENT
────────────────────
  [v1] [v1] [v1] [v1] [v1]  ← 95% traffic
  [v2]                       ← 5% traffic (canary)

  Monitor canary metrics. If healthy:
  [v1] [v1] [v1] [v2] [v2]  ← 50/50
  [v2] [v2] [v2] [v2] [v2]  ← 100% on v2

  ✓ Minimal blast radius
  ✓ Real production testing
  ✓ Data-driven rollout decisions
  ✗ Complex routing setup
  ✗ Need good monitoring


4. RECREATE (BIG BANG)
──────────────────────
  [v1] [v1] [v1] → STOP ALL → [v2] [v2] [v2]

  ✓ Simple
  ✓ Clean cutover
  ✗ Downtime during deployment
  ✗ Risky — all or nothing
```

### Deployment Infrastructure for Node.js

```
Code Repository (GitHub)
    │
    ▼
CI Pipeline (GitHub Actions / Jenkins)
    │── Run tests
    │── Build Docker image
    │── Push to Container Registry (ECR/Docker Hub)
    │
    ▼
Container Orchestration (ECS / Kubernetes / Docker Swarm)
    │── Pull new image
    │── Rolling update across instances
    │── Health checks before routing traffic
    │
    ▼
Load Balancer (ALB / Nginx)
    │── Route traffic to healthy instances
    │── Drain connections from old instances
```

### Docker + Node.js Production Setup

```dockerfile
# Multi-stage build for small image
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app .
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
```

### Zero-Downtime Deployment with PM2

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    wait_ready: true,          # Wait for process.send('ready')
    listen_timeout: 10000,
    kill_timeout: 5000,
    max_memory_restart: '500M'
  }]
};

# Zero-downtime reload
pm2 reload api
```

```javascript
// In server.js — signal PM2 when ready
const app = express();
const server = app.listen(3000, () => {
  if (process.send) process.send('ready');
});

process.on('SIGINT', () => {
  server.close(() => {
    // Close DB connections, flush logs
    sequelize.close();
    process.exit(0);
  });
});
```

---

## 10. CI/CD Pipeline

> **What the client wants to hear**: You can design and implement a complete CI/CD pipeline — from commit to production.

### CI/CD Pipeline Stages

```
DEVELOPER                    CI (Continuous Integration)                     CD (Continuous Deployment)
─────────                    ───────────────────────────                     ──────────────────────────

git push ──→ ┌──────────────────────────────────────────┐  ──→ ┌──────────────────────────────────┐
             │ 1. CODE QUALITY                          │      │ 6. DEPLOY TO STAGING              │
             │    - ESLint / Prettier check              │      │    - Deploy to staging environment │
             │    - TypeScript compilation               │      │    - Run smoke tests              │
             │                                          │      │                                    │
             │ 2. UNIT TESTS                            │      │ 7. INTEGRATION TESTS              │
             │    - Jest / Mocha tests                   │      │    - API contract tests            │
             │    - Code coverage check (>80%)           │      │    - E2E tests (Playwright)        │
             │                                          │      │    - Performance benchmarks         │
             │ 3. SECURITY SCAN                         │      │                                    │
             │    - npm audit                            │      │ 8. APPROVAL GATE                  │
             │    - Snyk / Dependabot                    │      │    - Manual approval for prod      │
             │    - SAST (static analysis)               │      │    - Or auto-deploy if all green   │
             │                                          │      │                                    │
             │ 4. BUILD                                 │      │ 9. DEPLOY TO PRODUCTION           │
             │    - Docker image build                   │      │    - Canary / Rolling deployment   │
             │    - Tag with commit SHA + version        │      │    - Health check verification     │
             │                                          │      │    - Automatic rollback on failure  │
             │ 5. PUSH ARTIFACT                         │      │                                    │
             │    - Push Docker image to registry        │      │ 10. POST-DEPLOY                   │
             │    - Store build metadata                 │      │    - Smoke tests on production     │
             └──────────────────────────────────────────┘      │    - Monitor error rates            │
                                                               │    - Notify team (Slack/Teams)      │
                                                               └──────────────────────────────────┘
```

### GitHub Actions CI/CD for Node.js

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  DOCKER_REGISTRY: 'xxxx.dkr.ecr.us-east-1.amazonaws.com'
  APP_NAME: 'my-api'

jobs:
  # ─── STAGE 1: Code Quality + Tests ───
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
      - run: npm audit --audit-level=high

      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  # ─── STAGE 2: Build Docker Image ───
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          docker build -t $DOCKER_REGISTRY/$APP_NAME:$GITHUB_SHA .
          docker tag $DOCKER_REGISTRY/$APP_NAME:$GITHUB_SHA \
                     $DOCKER_REGISTRY/$APP_NAME:latest
          docker push $DOCKER_REGISTRY/$APP_NAME:$GITHUB_SHA
          docker push $DOCKER_REGISTRY/$APP_NAME:latest

  # ─── STAGE 3: Deploy to Staging ───
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Deploy to staging
        run: |
          aws ecs update-service \
            --cluster staging \
            --service $APP_NAME \
            --force-new-deployment

      - name: Run smoke tests
        run: |
          sleep 30
          curl -f https://staging-api.example.com/health

  # ─── STAGE 4: Deploy to Production ───
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval

    steps:
      - name: Deploy to production (canary)
        run: |
          aws ecs update-service \
            --cluster production \
            --service $APP_NAME \
            --force-new-deployment

      - name: Verify deployment
        run: |
          sleep 60
          curl -f https://api.example.com/health

      - name: Notify team
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "✅ Deployed ${{ env.APP_NAME }}:${{ github.sha }} to production"}
```

### Key CI/CD Practices

| Practice | Why |
|----------|-----|
| **Run tests on every PR** | Catch bugs before they merge |
| **Docker multi-stage builds** | Small, secure production images |
| **Environment-specific configs** | Use env vars, never hardcode |
| **Database migrations in CI** | Run `sequelize db:migrate` as pipeline step |
| **Rollback plan** | Previous Docker image is always available |
| **Feature flags** | Deploy code without enabling features |
| **Immutable artifacts** | Same Docker image in staging and production |
| **Branch protection** | Require passing CI + code review before merge |

---

## 11. Security Aspects for Node.js Backend

> **What the client wants to hear**: You have comprehensive security knowledge — from OWASP top 10 to Node.js-specific vulnerabilities.

### Security Layers Overview

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1: Network Security                                    │
│  WAF, DDoS protection, firewall rules, VPN for internal       │
├──────────────────────────────────────────────────────────────┤
│  LAYER 2: Transport Security                                  │
│  HTTPS/TLS, certificate pinning, HSTS                         │
├──────────────────────────────────────────────────────────────┤
│  LAYER 3: Application Security                                │
│  Input validation, auth, CORS, rate limiting, CSP              │
├──────────────────────────────────────────────────────────────┤
│  LAYER 4: Data Security                                       │
│  Encryption at rest, hashing, data masking, backup             │
├──────────────────────────────────────────────────────────────┤
│  LAYER 5: Infrastructure Security                             │
│  Container hardening, secrets management, least privilege      │
└──────────────────────────────────────────────────────────────┘
```

### OWASP Top 10 — Node.js Context

#### 1. Injection (SQL, NoSQL, Command)

```javascript
// ❌ SQL Injection vulnerable
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`;
// Attack: email = "'; DROP TABLE users; --"

// ✅ Parameterized queries (Sequelize)
const user = await User.findOne({
  where: { email: req.body.email }  // Sequelize auto-escapes
});

// ✅ Parameterized raw query
const [results] = await sequelize.query(
  'SELECT * FROM users WHERE email = ?',
  { replacements: [req.body.email] }
);

// ❌ NoSQL Injection (MongoDB)
db.users.find({ username: req.body.username, password: req.body.password });
// Attack: password = { "$gt": "" }  → always true

// ✅ Input type validation
const schema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required()
});
const { error, value } = schema.validate(req.body);

// ❌ Command Injection
exec(`convert ${req.body.filename} output.png`);
// Attack: filename = "input.png; rm -rf /"

// ✅ Use execFile with argument array
execFile('convert', [req.body.filename, 'output.png']);
```

#### 2. Broken Authentication

```javascript
// Password hashing with bcrypt
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// JWT with proper configuration
const jwt = require('jsonwebtoken');

function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',         // Short-lived
      algorithm: 'RS256',       // Use RSA, not HS256
      issuer: 'my-api',
      audience: 'my-client'
    }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, tokenFamily: crypto.randomUUID() },
    process.env.REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Brute force protection
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts per window
  message: 'Too many login attempts. Try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/auth/login', loginLimiter, loginHandler);
```

#### 3. Sensitive Data Exposure

```javascript
// Encrypt sensitive data at rest
const crypto = require('crypto');

class EncryptionService {
  constructor(key) {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(key, 'hex'); // 32 bytes
  }

  encrypt(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(ciphertext) {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Never log sensitive data
app.use((req, res, next) => {
  const sanitized = { ...req.body };
  delete sanitized.password;
  delete sanitized.creditCard;
  delete sanitized.ssn;
  req.sanitizedBody = sanitized;
  next();
});
```

#### 4. Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet());
// Sets: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
// Strict-Transport-Security, Content-Security-Policy, etc.

// CORS configuration
const cors = require('cors');
app.use(cors({
  origin: ['https://app.example.com'],   // Specific origins, not '*'
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));
```

#### 5. Dependency Security

```bash
# Audit dependencies for known vulnerabilities
npm audit

# Auto-fix where possible
npm audit fix

# Use Snyk for continuous monitoring
npx snyk test
npx snyk monitor  # Alerts you when new CVEs affect your deps

# Lock dependencies to exact versions
npm ci  # Uses package-lock.json exactly (not npm install)
```

#### 6. Request Validation & Sanitization

```javascript
const Joi = require('joi');
const xss = require('xss');

// Comprehensive input validation middleware
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true     // Remove unexpected fields
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    // Sanitize string fields against XSS
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === 'string') {
        value[key] = xss(val);
      }
    }

    req.validatedBody = value;
    next();
  };
}

// Usage
const createUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must include uppercase, lowercase, number, and special character'
    }),
  role: Joi.string().valid('user', 'admin').default('user')
});

app.post('/api/users', validate(createUserSchema), createUser);
```

#### 7. Secrets Management

```javascript
// ❌ Hardcoded secrets
const DB_PASSWORD = 'mysecretpassword';

// ❌ Committed .env file
// .env in git = exposed secrets

// ✅ Environment variables (set in deployment platform)
const DB_PASSWORD = process.env.DB_PASSWORD;

// ✅ Secrets manager (AWS Secrets Manager, HashiCorp Vault)
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
  const result = await secretsManager.getSecretValue({
    SecretId: secretName
  }).promise();
  return JSON.parse(result.SecretString);
}

// Load at startup
const dbCreds = await getSecret('prod/db-credentials');
```

#### 8. API Security Checklist

| Area | Implementation |
|------|---------------|
| **Authentication** | JWT with short expiry + refresh tokens |
| **Authorization** | RBAC or ABAC middleware on every route |
| **Rate Limiting** | Per-user and per-IP limits |
| **Input Validation** | Joi/Zod schema on every endpoint |
| **Output Encoding** | Sanitize data before sending to clients |
| **CORS** | Whitelist specific origins |
| **Security Headers** | Helmet middleware |
| **HTTPS** | TLS 1.2+ mandatory, HSTS header |
| **Logging** | Log security events, never log secrets |
| **Dependency Audit** | npm audit + Snyk in CI pipeline |
| **Error Handling** | Never expose stack traces in production |
| **File Uploads** | Validate type, size, scan for malware |
| **SQL/NoSQL Injection** | Parameterized queries, ORM |
| **CSRF** | CSRF tokens for cookie-based auth |
| **Session Management** | Secure, HttpOnly, SameSite cookies |

---

## Quick Reference — How to Structure Your Answers

When the client asks a broad question, use this framework:

```
1. WHAT it is (1-2 sentences — show you understand the concept)
2. WHY it matters (business impact, risk if ignored)
3. HOW it works (technical detail — diagrams, flow, code)
4. HOW you've used it (real project experience)
5. TRADE-OFFS (shows senior thinking — nothing is free)
```

**Example**: "How does DNS work?"

> "DNS translates human-readable domain names to IP addresses. Without it, users would need to remember IP addresses for every website. It works through a hierarchical resolution process — browser cache, OS cache, recursive resolver, root servers, TLD servers, and authoritative name servers. In our production setup, we use Cloudflare DNS with low TTLs for our API domains so we can failover quickly, and Route 53 for internal service discovery. The trade-off with low TTLs is more DNS queries, but the benefit of fast failover outweighs that for critical services."

---

## Bonus: Questions They Might Follow Up With

Based on the 11 topics, expect deeper follow-ups like:

| After Topic | Likely Follow-Up |
|-------------|-----------------|
| Google Search | "How would you design a search feature for your app?" |
| DNS/Network | "What happens when DNS fails? How do you handle it?" |
| Server | "Explain the Node.js event loop in detail" |
| SSL | "How do you handle certificate rotation in production?" |
| HTTP/HTTPS | "What's HTTP/2 server push? Have you used it?" |
| Multi-threading | "When would you NOT use worker threads?" |
| ETL/1M records | "How would you handle real-time ETL vs batch?" |
| Banking/High traffic | "How do you do zero-downtime database migrations?" |
| Deployment | "What's your rollback strategy if a deployment fails?" |
| CI/CD | "How do you handle database migrations in CI/CD?" |
| Security | "How would you handle a security breach?" |

---

## Additional Node.js Tech Lead Topics to Review

These are from the companion interview prep files in this repo:

| File | Key Topics |
|------|-----------|
| `nodejs-tech-lead.md` | System design (notifications, rate limiting, global distribution), leadership, performance engineering, build vs buy |
| `nodejs-senior.md` | Advanced patterns, microservices, event loop internals, memory management, streams |
| `nodejs-problem-solving.md` | Real-world scenarios: e-commerce carts, fraud detection, reconciliation, scheduling, ETL pipelines |
| `nodejs-mid-level.md` | Core concepts, middleware, error handling, testing, database patterns |

---

*Good luck with the interview!*
