# Node.js Tech Lead Interview Questions

> **Level**: Tech Lead (7+ years experience)
> **Total Questions**: 50
> **Focus**: Architecture, Leadership, Strategy, and Enterprise Patterns

---

## Table of Contents
1. [System Design & Architecture (Q1-Q15)](#system-design--architecture)
2. [Technical Leadership (Q16-Q25)](#technical-leadership)
3. [Performance Engineering (Q26-Q35)](#performance-engineering)
4. [Enterprise Patterns & Scalability (Q36-Q45)](#enterprise-patterns--scalability)
5. [Strategic Decision Making (Q46-Q50)](#strategic-decision-making)

---

## System Design & Architecture

### Q1: How would you design a real-time notification system that handles millions of users?

**Answer:**

**System Requirements:**
- Support 10M+ concurrent connections
- Deliver notifications within 100ms
- Support multiple channels (push, SMS, email, in-app)
- Handle spikes during events
- Provide delivery guarantees

**Architecture Overview:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway / Load Balancer                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Auth Service │          │ Notification  │          │   Preference  │
│               │          │    Service    │          │    Service    │
└───────────────┘          └───────────────┘          └───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     Message Queue (Kafka)      │
                    │   - Partitioned by user_id     │
                    │   - Multiple consumer groups   │
                    └───────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Push Worker  │          │  SMS Worker   │          │ Email Worker  │
│   Cluster     │          │   Cluster     │          │   Cluster     │
└───────────────┘          └───────────────┘          └───────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  WebSocket    │          │   Twilio/     │          │  SendGrid/    │
│   Servers     │          │   Nexmo       │          │     SES       │
└───────────────┘          └───────────────┘          └───────────────┘
```

**Implementation Strategy:**

```javascript
// Notification Service Architecture
class NotificationOrchestrator {
  constructor(deps) {
    this.messageQueue = deps.messageQueue;
    this.preferenceService = deps.preferenceService;
    this.templateService = deps.templateService;
    this.rateLimiter = deps.rateLimiter;
    this.metrics = deps.metrics;
  }

  async sendNotification(notification) {
    const startTime = Date.now();
    
    try {
      // 1. Validate and enrich
      const enrichedNotification = await this.enrich(notification);
      
      // 2. Get user preferences
      const preferences = await this.preferenceService.get(
        notification.userId
      );
      
      // 3. Determine channels based on priority and preferences
      const channels = this.determineChannels(
        enrichedNotification.priority,
        preferences
      );
      
      // 4. Rate limit check
      const allowed = await this.rateLimiter.check(
        notification.userId,
        notification.type
      );
      
      if (!allowed) {
        return { status: 'rate_limited' };
      }
      
      // 5. Publish to appropriate queues
      await Promise.all(
        channels.map(channel => 
          this.messageQueue.publish(`notifications.${channel}`, {
            ...enrichedNotification,
            channel,
            scheduledAt: Date.now()
          })
        )
      );
      
      this.metrics.recordNotificationScheduled(channels.length);
      
      return { 
        status: 'scheduled', 
        channels,
        latency: Date.now() - startTime 
      };
      
    } catch (error) {
      this.metrics.recordError('notification_scheduling');
      throw error;
    }
  }

  determineChannels(priority, preferences) {
    const channels = [];
    
    // Critical notifications go to all enabled channels
    if (priority === 'critical') {
      if (preferences.push) channels.push('push');
      if (preferences.sms) channels.push('sms');
      if (preferences.email) channels.push('email');
    }
    // High priority: push first, then fallback
    else if (priority === 'high') {
      if (preferences.push) {
        channels.push('push');
      } else if (preferences.sms) {
        channels.push('sms');
      } else {
        channels.push('email');
      }
    }
    // Normal priority: respect primary channel preference
    else {
      channels.push(preferences.primaryChannel || 'email');
    }
    
    return channels;
  }
}

// WebSocket Connection Manager for real-time delivery
class WebSocketManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.localConnections = new Map();
  }

  // Handle millions of connections across multiple servers
  async connect(userId, socket) {
    // Store locally
    if (!this.localConnections.has(userId)) {
      this.localConnections.set(userId, new Set());
    }
    this.localConnections.get(userId).add(socket);

    // Register in Redis for cross-server routing
    await this.redis.sadd(`ws:user:${userId}`, process.env.SERVER_ID);
    await this.redis.expire(`ws:user:${userId}`, 86400);

    socket.on('close', () => this.disconnect(userId, socket));
  }

  async disconnect(userId, socket) {
    const sockets = this.localConnections.get(userId);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.localConnections.delete(userId);
        await this.redis.srem(`ws:user:${userId}`, process.env.SERVER_ID);
      }
    }
  }

  // Send to user (handles cross-server)
  async sendToUser(userId, message) {
    // Try local first
    const localSockets = this.localConnections.get(userId);
    if (localSockets && localSockets.size > 0) {
      for (const socket of localSockets) {
        socket.send(JSON.stringify(message));
      }
      return true;
    }

    // Route to correct server via Redis pub/sub
    const servers = await this.redis.smembers(`ws:user:${userId}`);
    if (servers.length > 0) {
      await this.redis.publish('ws:forward', JSON.stringify({
        targetServers: servers,
        userId,
        message
      }));
      return true;
    }

    return false; // User not connected
  }
}

// Scalable Push Worker
class PushNotificationWorker {
  constructor(deps) {
    this.fcm = deps.fcm;
    this.apns = deps.apns;
    this.deviceRegistry = deps.deviceRegistry;
    this.batchSize = 1000;
  }

  async processBatch(notifications) {
    // Group by platform
    const byPlatform = {
      ios: [],
      android: []
    };

    for (const notification of notifications) {
      const devices = await this.deviceRegistry.getDevices(notification.userId);
      for (const device of devices) {
        byPlatform[device.platform].push({
          token: device.token,
          notification
        });
      }
    }

    // Send in batches
    const results = await Promise.allSettled([
      this.sendIOSBatch(byPlatform.ios),
      this.sendAndroidBatch(byPlatform.android)
    ]);

    return this.processResults(results);
  }

  async sendAndroidBatch(items) {
    const messages = items.map(item => ({
      token: item.token,
      notification: {
        title: item.notification.title,
        body: item.notification.body
      },
      data: item.notification.data
    }));

    // FCM supports up to 500 messages per batch
    const batches = this.chunk(messages, 500);
    
    return Promise.all(
      batches.map(batch => this.fcm.sendAll(batch))
    );
  }
}
```

**Scaling Considerations:**

1. **Connection Handling**: Use sticky sessions or Redis for WebSocket routing
2. **Message Queue**: Kafka with partitioning by user_id for ordering
3. **Database**: Sharded notification history by user_id
4. **Caching**: Cache user preferences and device tokens
5. **Monitoring**: Track delivery rates, latencies, failures per channel

---

### Q2: Design a rate limiting system for a multi-tenant SaaS API.

**Answer:**

```javascript
// Multi-tenant Rate Limiter with multiple strategies
class TenantRateLimiter {
  constructor(deps) {
    this.redis = deps.redis;
    this.configService = deps.configService;
    this.metrics = deps.metrics;
  }

  async checkLimit(tenantId, endpoint, userId = null) {
    const config = await this.getTenantConfig(tenantId);
    const results = [];

    // Layer 1: Tenant-level limits (organization)
    results.push(
      await this.checkLayer('tenant', tenantId, config.tenant)
    );

    // Layer 2: User-level limits (per user within tenant)
    if (userId) {
      results.push(
        await this.checkLayer('user', `${tenantId}:${userId}`, config.user)
      );
    }

    // Layer 3: Endpoint-specific limits
    if (config.endpoints[endpoint]) {
      results.push(
        await this.checkLayer('endpoint', 
          `${tenantId}:${endpoint}`, 
          config.endpoints[endpoint]
        )
      );
    }

    // Layer 4: Global rate limit (protect infrastructure)
    results.push(
      await this.checkLayer('global', 'global', config.global)
    );

    // Return most restrictive result
    return this.mergeResults(results);
  }

  async checkLayer(type, key, config) {
    const strategy = this.getStrategy(config.strategy);
    return strategy.check(key, config);
  }

  getStrategy(name) {
    const strategies = {
      'sliding-window': new SlidingWindowStrategy(this.redis),
      'token-bucket': new TokenBucketStrategy(this.redis),
      'leaky-bucket': new LeakyBucketStrategy(this.redis),
      'fixed-window': new FixedWindowStrategy(this.redis)
    };
    return strategies[name] || strategies['sliding-window'];
  }

  async getTenantConfig(tenantId) {
    // Cache tenant config
    const cached = await this.redis.get(`rate_config:${tenantId}`);
    if (cached) return JSON.parse(cached);

    const config = await this.configService.getTenantRateLimits(tenantId);
    await this.redis.setex(`rate_config:${tenantId}`, 300, JSON.stringify(config));
    return config;
  }

  mergeResults(results) {
    const denied = results.find(r => !r.allowed);
    if (denied) {
      return {
        allowed: false,
        retryAfter: denied.retryAfter,
        limit: denied.limit,
        remaining: 0,
        layer: denied.layer
      };
    }

    // Find minimum remaining
    const minRemaining = Math.min(...results.map(r => r.remaining));
    return {
      allowed: true,
      remaining: minRemaining,
      limits: results.map(r => ({
        layer: r.layer,
        limit: r.limit,
        remaining: r.remaining
      }))
    };
  }
}

// Sliding Window Rate Limiter (Accurate, memory efficient)
class SlidingWindowStrategy {
  constructor(redis) {
    this.redis = redis;
  }

  async check(key, config) {
    const { requests, windowSec } = config;
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const windowStart = now - windowMs;

    const multi = this.redis.multi();
    
    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    multi.zcard(key);
    
    // Add current request (optimistic)
    multi.zadd(key, now, `${now}:${Math.random()}`);
    
    // Set expiry
    multi.expire(key, windowSec + 1);

    const results = await multi.exec();
    const count = results[1][1];

    if (count >= requests) {
      // Get oldest entry to calculate retry time
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfter = oldest.length > 0 
        ? Math.ceil((parseInt(oldest[1]) + windowMs - now) / 1000)
        : windowSec;

      return {
        allowed: false,
        limit: requests,
        remaining: 0,
        retryAfter,
        layer: 'sliding-window'
      };
    }

    return {
      allowed: true,
      limit: requests,
      remaining: requests - count - 1,
      layer: 'sliding-window'
    };
  }
}

// Token Bucket for burst handling
class TokenBucketStrategy {
  constructor(redis) {
    this.redis = redis;
  }

  async check(key, config) {
    const { capacity, refillRate, refillInterval } = config;
    const now = Date.now();
    const bucketKey = `bucket:${key}`;

    // Lua script for atomic token bucket
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local refillInterval = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      local requested = tonumber(ARGV[5])

      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or capacity
      local lastRefill = tonumber(bucket[2]) or now

      -- Calculate refill
      local elapsed = now - lastRefill
      local refillCount = math.floor(elapsed / refillInterval)
      tokens = math.min(capacity, tokens + (refillCount * refillRate))
      lastRefill = lastRefill + (refillCount * refillInterval)

      -- Check and consume
      if tokens >= requested then
        tokens = tokens - requested
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, 3600)
        return {1, tokens, capacity}
      else
        return {0, tokens, capacity}
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      bucketKey,
      capacity,
      refillRate,
      refillInterval,
      now,
      1
    );

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      limit: result[2],
      layer: 'token-bucket'
    };
  }
}

// Rate limit middleware for Express
function rateLimitMiddleware(rateLimiter) {
  return async (req, res, next) => {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;
    const endpoint = `${req.method}:${req.route?.path || req.path}`;

    try {
      const result = await rateLimiter.checkLimit(tenantId, endpoint, userId);

      // Set rate limit headers
      res.set('X-RateLimit-Limit', result.limit);
      res.set('X-RateLimit-Remaining', result.remaining);

      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter);
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: result.retryAfter,
          layer: result.layer
        });
      }

      next();
    } catch (error) {
      // Fail open in case of Redis errors
      console.error('Rate limit check failed:', error);
      next();
    }
  };
}
```

---

### Q3: How would you architect a multi-region, globally distributed application?

**Answer:**

```javascript
// Multi-Region Architecture Strategy

/**
 * Key Components:
 * 1. Global Load Balancer (Cloudflare, AWS Global Accelerator)
 * 2. Regional API Clusters
 * 3. Data Replication Strategy
 * 4. Conflict Resolution
 * 5. Failover Mechanism
 */

// Region-aware routing
class GlobalRouter {
  constructor(deps) {
    this.regions = deps.regions;
    this.healthChecker = deps.healthChecker;
    this.dataLocality = deps.dataLocality;
  }

  async routeRequest(request) {
    const userRegion = this.detectUserRegion(request);
    const dataRegion = await this.dataLocality.getDataRegion(request.userId);
    
    // Scenario 1: User near their data region - optimal
    if (userRegion === dataRegion) {
      return this.regions.get(userRegion);
    }

    // Scenario 2: User far from data - check operation type
    if (this.isReadOnlyOperation(request)) {
      // Can serve from local replica
      return this.regions.get(userRegion);
    }

    // Scenario 3: Write operation - route to data region
    return this.regions.get(dataRegion);
  }

  detectUserRegion(request) {
    // Cloudflare header
    const cfRegion = request.headers['cf-ipcountry'];
    
    // AWS header
    const awsRegion = request.headers['x-amz-cf-pop'];
    
    // Map to our regions
    return this.mapToOurRegion(cfRegion || awsRegion);
  }
}

// Data Replication Strategy
class DataReplicationManager {
  constructor(deps) {
    this.primaryDb = deps.primaryDb;
    this.replicas = deps.replicas;
    this.conflictResolver = deps.conflictResolver;
    this.eventBus = deps.eventBus;
  }

  // Write-through replication
  async write(collection, data, options = {}) {
    const region = options.region || this.primaryRegion;
    const timestamp = Date.now();
    
    // Add vector clock for conflict detection
    data._vectorClock = this.incrementVectorClock(data._vectorClock, region);
    data._lastModified = timestamp;
    data._modifiedBy = region;

    // Write to primary
    const result = await this.primaryDb.write(collection, data);

    // Async replication to other regions
    this.replicateAsync(collection, data, region);

    return result;
  }

  async replicateAsync(collection, data, sourceRegion) {
    const targetRegions = this.replicas.filter(r => r.id !== sourceRegion);

    for (const region of targetRegions) {
      this.eventBus.publish('replication', {
        collection,
        data,
        sourceRegion,
        targetRegion: region.id,
        priority: this.calculatePriority(data)
      });
    }
  }

  // Handle conflicts during replication
  async handleConflict(localData, incomingData) {
    const strategy = this.conflictResolver.getStrategy(localData._type);

    switch (strategy) {
      case 'last-write-wins':
        return incomingData._lastModified > localData._lastModified
          ? incomingData
          : localData;

      case 'merge':
        return this.mergeDocuments(localData, incomingData);

      case 'vector-clock':
        return this.resolveWithVectorClock(localData, incomingData);

      case 'custom':
        return this.conflictResolver.resolve(localData, incomingData);
    }
  }

  resolveWithVectorClock(local, incoming) {
    const localClock = local._vectorClock;
    const incomingClock = incoming._vectorClock;

    // Check if one dominates the other
    if (this.dominates(incomingClock, localClock)) {
      return incoming;
    }
    if (this.dominates(localClock, incomingClock)) {
      return local;
    }

    // Concurrent modifications - merge required
    return this.mergeDocuments(local, incoming);
  }
}

// Region Failover Manager
class RegionFailoverManager {
  constructor(deps) {
    this.regions = deps.regions;
    this.healthChecker = deps.healthChecker;
    this.dnsManager = deps.dnsManager;
    this.alerting = deps.alerting;
  }

  async monitorRegions() {
    for (const region of this.regions) {
      const health = await this.healthChecker.check(region);
      
      if (health.status === 'degraded') {
        await this.handleDegradedRegion(region, health);
      } else if (health.status === 'failed') {
        await this.initiateFailover(region);
      }
    }
  }

  async initiateFailover(failedRegion) {
    console.log(`Initiating failover for region: ${failedRegion.id}`);
    
    // 1. Update DNS to route traffic away
    await this.dnsManager.removeRegion(failedRegion.id);
    
    // 2. Promote replica in backup region
    const backupRegion = this.getBackupRegion(failedRegion);
    await this.promoteReplica(backupRegion, failedRegion);
    
    // 3. Scale up backup region
    await this.scaleRegion(backupRegion, { factor: 2 });
    
    // 4. Alert operations team
    await this.alerting.critical('REGION_FAILOVER', {
      failedRegion: failedRegion.id,
      backupRegion: backupRegion.id,
      timestamp: new Date()
    });
    
    // 5. Update data locality mappings
    await this.updateDataLocality(failedRegion, backupRegion);
  }

  async promoteReplica(backupRegion, failedRegion) {
    // Ensure replica is caught up
    const lagMs = await this.checkReplicationLag(backupRegion);
    
    if (lagMs > 5000) {
      console.warn(`Replication lag is ${lagMs}ms, some data may be lost`);
    }

    // Promote replica to primary for affected users
    await this.regions.get(backupRegion).promoteToWritePrimary(
      failedRegion.userRange
    );
  }
}

// Consistency Management
class ConsistencyManager {
  constructor(deps) {
    this.regions = deps.regions;
    this.consistencyLevel = deps.defaultConsistencyLevel;
  }

  async read(key, options = {}) {
    const consistency = options.consistency || this.consistencyLevel;

    switch (consistency) {
      case 'eventual':
        // Read from local region
        return this.readFromLocalRegion(key);

      case 'session':
        // Read from region that has user's latest writes
        return this.readWithSessionConsistency(key, options.sessionId);

      case 'strong':
        // Read from primary, confirm with quorum
        return this.readWithStrongConsistency(key);

      case 'bounded-staleness':
        // Read from local if within staleness bound
        return this.readWithBoundedStaleness(key, options.maxStaleSeconds);
    }
  }

  async readWithStrongConsistency(key) {
    const primary = this.getPrimaryForKey(key);
    const data = await primary.read(key);
    
    // Verify with quorum
    const quorumSize = Math.floor(this.regions.size / 2) + 1;
    const confirmations = await Promise.all(
      this.regions.map(r => r.confirmVersion(key, data._version))
    );
    
    const confirmed = confirmations.filter(c => c).length;
    
    if (confirmed >= quorumSize) {
      return data;
    }
    
    throw new Error('Unable to achieve quorum for strong consistency');
  }
}
```

---

### Q4: Design a job scheduling and processing system.

**Answer:**

```javascript
// Distributed Job Scheduler
class JobScheduler {
  constructor(deps) {
    this.redis = deps.redis;
    this.messageQueue = deps.messageQueue;
    this.jobRegistry = deps.jobRegistry;
    this.lockManager = deps.lockManager;
    this.metrics = deps.metrics;
  }

  async schedule(jobDefinition) {
    const job = {
      id: this.generateJobId(),
      ...jobDefinition,
      status: 'scheduled',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: jobDefinition.maxAttempts || 3
    };

    // Store job
    await this.redis.hset('jobs', job.id, JSON.stringify(job));

    // Schedule based on type
    if (job.runAt) {
      await this.scheduleDelayed(job);
    } else if (job.cron) {
      await this.scheduleCron(job);
    } else {
      await this.scheduleImmediate(job);
    }

    this.metrics.jobScheduled(job.type);
    return job;
  }

  async scheduleDelayed(job) {
    const delay = job.runAt - Date.now();
    
    if (delay <= 0) {
      return this.scheduleImmediate(job);
    }

    // Use sorted set for delayed jobs
    await this.redis.zadd('delayed_jobs', job.runAt, job.id);
  }

  async scheduleCron(job) {
    const nextRun = this.calculateNextRun(job.cron);
    job.nextRunAt = nextRun;
    
    await this.redis.hset('cron_jobs', job.id, JSON.stringify(job));
    await this.redis.zadd('scheduled_cron', nextRun, job.id);
  }

  async scheduleImmediate(job) {
    const queue = this.getQueueForJob(job);
    await this.messageQueue.publish(queue, job);
  }

  // Run by scheduler leader
  async processDelayedJobs() {
    const now = Date.now();
    
    // Get jobs ready to run
    const jobIds = await this.redis.zrangebyscore(
      'delayed_jobs', 
      0, 
      now, 
      'LIMIT', 0, 100
    );

    for (const jobId of jobIds) {
      const acquired = await this.lockManager.acquire(`job:${jobId}`, 30000);
      
      if (acquired) {
        try {
          await this.redis.zrem('delayed_jobs', jobId);
          const jobData = await this.redis.hget('jobs', jobId);
          const job = JSON.parse(jobData);
          
          await this.scheduleImmediate(job);
        } finally {
          await this.lockManager.release(`job:${jobId}`);
        }
      }
    }
  }

  // Leader election for scheduler
  async runSchedulerLeader() {
    const leaderId = `scheduler:${process.pid}`;
    
    while (true) {
      const isLeader = await this.lockManager.acquireLeaderLock(
        'scheduler-leader',
        leaderId,
        30000
      );

      if (isLeader) {
        console.log('This instance is the scheduler leader');
        
        // Run scheduler tasks
        await Promise.all([
          this.processDelayedJobs(),
          this.processCronJobs()
        ]);

        // Renew lock
        await this.lockManager.renewLock('scheduler-leader', leaderId, 30000);
      }

      await this.sleep(5000);
    }
  }
}

// Job Worker with advanced features
class JobWorker {
  constructor(deps) {
    this.messageQueue = deps.messageQueue;
    this.jobRegistry = deps.jobRegistry;
    this.redis = deps.redis;
    this.metrics = deps.metrics;
    this.concurrency = deps.concurrency || 10;
    this.activeJobs = new Map();
  }

  async start() {
    console.log(`Starting job worker with concurrency: ${this.concurrency}`);
    
    await this.messageQueue.subscribe('jobs.*', async (job) => {
      await this.processJob(job);
    }, { concurrency: this.concurrency });
  }

  async processJob(job) {
    const startTime = Date.now();
    this.activeJobs.set(job.id, job);

    try {
      // Update status
      await this.updateJobStatus(job.id, 'processing');
      
      // Get handler
      const handler = this.jobRegistry.get(job.type);
      if (!handler) {
        throw new Error(`No handler for job type: ${job.type}`);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        handler,
        job,
        job.timeout || 300000
      );

      // Mark completed
      await this.updateJobStatus(job.id, 'completed', { result });
      this.metrics.jobCompleted(job.type, Date.now() - startTime);

    } catch (error) {
      await this.handleJobError(job, error);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  async executeWithTimeout(handler, job, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Job execution timeout'));
      }, timeout);

      handler(job.data, {
        progress: (pct) => this.updateProgress(job.id, pct),
        log: (msg) => this.addJobLog(job.id, msg)
      })
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async handleJobError(job, error) {
    const attempts = job.attempts + 1;
    
    if (attempts < job.maxAttempts) {
      // Retry with exponential backoff
      const delay = Math.pow(2, attempts) * 1000;
      
      await this.updateJobStatus(job.id, 'retrying', {
        error: error.message,
        attempts,
        nextAttempt: Date.now() + delay
      });

      job.attempts = attempts;
      await this.redis.zadd('delayed_jobs', Date.now() + delay, job.id);
      
      this.metrics.jobRetried(job.type);
    } else {
      // Mark as failed
      await this.updateJobStatus(job.id, 'failed', {
        error: error.message,
        stack: error.stack,
        attempts
      });
      
      // Move to dead letter queue
      await this.messageQueue.publish('jobs.dlq', job);
      
      this.metrics.jobFailed(job.type);
    }
  }

  async updateProgress(jobId, percentage) {
    await this.redis.hset(`job:${jobId}:progress`, 'percentage', percentage);
    await this.redis.publish(`job:${jobId}:progress`, percentage);
  }
}

// Job Batching for high-throughput scenarios
class BatchJobProcessor {
  constructor(deps) {
    this.batchSize = deps.batchSize || 100;
    this.batchTimeout = deps.batchTimeout || 1000;
    this.processor = deps.processor;
    this.batch = [];
    this.timer = null;
  }

  async add(job) {
    this.batch.push(job);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchTimeout);
    }
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) return;

    const toProcess = this.batch;
    this.batch = [];

    try {
      await this.processor.processBatch(toProcess);
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Re-queue failed items
      for (const job of toProcess) {
        await this.add({ ...job, retried: true });
      }
    }
  }
}
```

---

### Q5: How do you design a system for handling file uploads at scale?

**Answer:**

```javascript
// Scalable File Upload Architecture
class FileUploadService {
  constructor(deps) {
    this.storageProvider = deps.storageProvider; // S3, GCS, etc.
    this.virusScanner = deps.virusScanner;
    this.thumbnailGenerator = deps.thumbnailGenerator;
    this.metadata = deps.metadataStore;
    this.messageQueue = deps.messageQueue;
    this.config = deps.config;
  }

  // Initiate multipart upload
  async initiateUpload(request) {
    const { filename, contentType, size, userId, folderId } = request;

    // Validate
    this.validateFile(filename, contentType, size);

    // Create upload record
    const upload = {
      id: this.generateUploadId(),
      filename,
      contentType,
      size,
      userId,
      folderId,
      status: 'initiated',
      createdAt: new Date(),
      chunks: [],
      chunkSize: this.calculateChunkSize(size)
    };

    // Get presigned URLs for chunks
    const numChunks = Math.ceil(size / upload.chunkSize);
    const uploadUrls = await this.generatePresignedUrls(upload, numChunks);

    await this.metadata.save(upload);

    return {
      uploadId: upload.id,
      chunkSize: upload.chunkSize,
      chunks: uploadUrls
    };
  }

  async generatePresignedUrls(upload, numChunks) {
    const urls = [];
    
    for (let i = 0; i < numChunks; i++) {
      const key = `uploads/${upload.id}/chunk_${i}`;
      const url = await this.storageProvider.getPresignedUploadUrl(key, {
        expiresIn: 3600,
        contentType: 'application/octet-stream'
      });
      urls.push({ chunkNumber: i, url, key });
    }

    return urls;
  }

  // Complete multipart upload
  async completeUpload(uploadId, chunks) {
    const upload = await this.metadata.get(uploadId);
    
    if (!upload) {
      throw new NotFoundError('Upload not found');
    }

    // Verify all chunks
    const verified = await this.verifyChunks(upload, chunks);
    if (!verified) {
      throw new ValidationError('Chunk verification failed');
    }

    // Combine chunks
    const finalKey = `files/${upload.userId}/${upload.id}/${upload.filename}`;
    await this.storageProvider.combineChunks(
      chunks.map(c => c.key),
      finalKey
    );

    // Update status
    upload.status = 'uploaded';
    upload.key = finalKey;
    await this.metadata.save(upload);

    // Queue post-processing
    await this.messageQueue.publish('file.uploaded', {
      uploadId,
      userId: upload.userId,
      key: finalKey,
      contentType: upload.contentType
    });

    // Cleanup chunks
    await this.cleanupChunks(upload.id, chunks);

    return { fileId: upload.id, key: finalKey };
  }

  calculateChunkSize(totalSize) {
    // Minimum 5MB (S3 requirement), maximum 100MB
    const minChunk = 5 * 1024 * 1024;
    const maxChunk = 100 * 1024 * 1024;
    const targetChunks = 100; // Aim for ~100 chunks max

    let chunkSize = Math.ceil(totalSize / targetChunks);
    return Math.max(minChunk, Math.min(maxChunk, chunkSize));
  }
}

// File Processing Pipeline
class FileProcessingPipeline {
  constructor(deps) {
    this.storageProvider = deps.storageProvider;
    this.virusScanner = deps.virusScanner;
    this.mediaProcessor = deps.mediaProcessor;
    this.textExtractor = deps.textExtractor;
    this.searchIndex = deps.searchIndex;
    this.metadata = deps.metadataStore;
  }

  async process(event) {
    const { uploadId, key, contentType } = event;
    const pipeline = this.buildPipeline(contentType);

    try {
      // Download file for processing
      const file = await this.storageProvider.download(key);

      for (const step of pipeline) {
        await step.execute(file, event);
      }

      await this.metadata.update(uploadId, {
        status: 'processed',
        processedAt: new Date()
      });

    } catch (error) {
      await this.handleProcessingError(uploadId, error);
    }
  }

  buildPipeline(contentType) {
    const pipeline = [
      new VirusScanStep(this.virusScanner)
    ];

    if (contentType.startsWith('image/')) {
      pipeline.push(
        new ThumbnailStep(this.mediaProcessor),
        new ImageOptimizationStep(this.mediaProcessor),
        new ExifExtractionStep(this.mediaProcessor)
      );
    } else if (contentType.startsWith('video/')) {
      pipeline.push(
        new VideoThumbnailStep(this.mediaProcessor),
        new VideoTranscodingStep(this.mediaProcessor)
      );
    } else if (contentType === 'application/pdf') {
      pipeline.push(
        new PdfThumbnailStep(this.mediaProcessor),
        new TextExtractionStep(this.textExtractor)
      );
    }

    // Add to search index
    pipeline.push(new SearchIndexStep(this.searchIndex));

    return pipeline;
  }
}

// Resumable upload handler for large files
class ResumableUploadHandler {
  constructor(deps) {
    this.redis = deps.redis;
    this.storageProvider = deps.storageProvider;
  }

  async handleChunkUpload(uploadId, chunkNumber, data, checksum) {
    // Verify checksum
    const actualChecksum = this.calculateChecksum(data);
    if (actualChecksum !== checksum) {
      throw new ValidationError('Checksum mismatch');
    }

    // Upload chunk
    const key = `uploads/${uploadId}/chunk_${chunkNumber}`;
    await this.storageProvider.upload(key, data);

    // Mark chunk as complete
    await this.redis.hset(
      `upload:${uploadId}:chunks`,
      chunkNumber,
      JSON.stringify({
        key,
        size: data.length,
        checksum,
        uploadedAt: Date.now()
      })
    );

    // Check if all chunks uploaded
    const uploadInfo = await this.getUploadInfo(uploadId);
    const completedChunks = await this.redis.hlen(`upload:${uploadId}:chunks`);

    return {
      chunkNumber,
      completed: completedChunks,
      total: uploadInfo.totalChunks,
      isComplete: completedChunks === uploadInfo.totalChunks
    };
  }

  async getResumePosition(uploadId) {
    const completedChunks = await this.redis.hgetall(`upload:${uploadId}:chunks`);
    const chunkNumbers = Object.keys(completedChunks).map(Number).sort((a, b) => a - b);

    // Find first missing chunk
    for (let i = 0; i < chunkNumbers.length; i++) {
      if (chunkNumbers[i] !== i) {
        return i;
      }
    }

    return chunkNumbers.length;
  }
}
```

---

### Q6-Q15: [Additional System Design Questions - Key Topics]

Due to length, here are the key topics covered in remaining architecture questions:

- **Q6**: Event-driven architecture with event store
- **Q7**: Designing a search system (Elasticsearch integration)
- **Q8**: API Gateway design with advanced routing
- **Q9**: Designing a billing and subscription system
- **Q10**: Multi-tenant data isolation strategies
- **Q11**: Designing real-time analytics pipeline
- **Q12**: Content delivery and CDN integration
- **Q13**: Designing a configuration management system
- **Q14**: Audit logging and compliance system
- **Q15**: Designing a feature toggle platform

---

## Technical Leadership

### Q16: How do you evaluate and introduce new technologies to a team?

**Answer:**

```javascript
// Technology Evaluation Framework

class TechnologyEvaluationFramework {
  constructor() {
    this.criteria = {
      technical: {
        weight: 0.35,
        factors: [
          'performance',
          'scalability',
          'security',
          'reliability',
          'maintainability'
        ]
      },
      operational: {
        weight: 0.25,
        factors: [
          'monitoring',
          'deployment',
          'debugging',
          'documentation',
          'community_support'
        ]
      },
      strategic: {
        weight: 0.25,
        factors: [
          'team_expertise',
          'learning_curve',
          'hiring_pool',
          'vendor_stability',
          'license_compatibility'
        ]
      },
      cost: {
        weight: 0.15,
        factors: [
          'licensing',
          'infrastructure',
          'training',
          'migration',
          'ongoing_maintenance'
        ]
      }
    };
  }

  async evaluate(technology, useCase) {
    const evaluation = {
      technology,
      useCase,
      evaluatedAt: new Date(),
      scores: {}
    };

    // Score each category
    for (const [category, config] of Object.entries(this.criteria)) {
      const categoryScore = await this.evaluateCategory(
        technology,
        category,
        config.factors
      );
      evaluation.scores[category] = {
        score: categoryScore,
        weight: config.weight,
        weighted: categoryScore * config.weight
      };
    }

    // Calculate overall score
    evaluation.overallScore = Object.values(evaluation.scores)
      .reduce((sum, s) => sum + s.weighted, 0);

    // Generate recommendation
    evaluation.recommendation = this.generateRecommendation(evaluation);

    return evaluation;
  }

  generateRecommendation(evaluation) {
    const score = evaluation.overallScore;
    
    if (score >= 8) {
      return {
        decision: 'ADOPT',
        confidence: 'HIGH',
        summary: 'Strong candidate for adoption'
      };
    } else if (score >= 6) {
      return {
        decision: 'TRIAL',
        confidence: 'MEDIUM',
        summary: 'Recommend POC before full adoption'
      };
    } else if (score >= 4) {
      return {
        decision: 'ASSESS',
        confidence: 'LOW',
        summary: 'Needs further evaluation'
      };
    } else {
      return {
        decision: 'HOLD',
        confidence: 'HIGH',
        summary: 'Not recommended at this time'
      };
    }
  }
}

// Technology Introduction Process
const technologyIntroductionProcess = {
  phases: [
    {
      name: 'Proposal',
      duration: '1 week',
      activities: [
        'Document problem statement',
        'Research alternatives',
        'Initial technical evaluation',
        'Create RFC (Request for Comments)'
      ],
      outputs: ['RFC Document', 'Comparison Matrix']
    },
    {
      name: 'Review',
      duration: '2 weeks',
      activities: [
        'Team review of RFC',
        'Gather feedback',
        'Security review',
        'Cost analysis'
      ],
      outputs: ['Review Summary', 'Risk Assessment']
    },
    {
      name: 'Proof of Concept',
      duration: '2-4 weeks',
      activities: [
        'Build minimal implementation',
        'Performance testing',
        'Integration testing',
        'Team demo'
      ],
      outputs: ['POC Results', 'Performance Metrics']
    },
    {
      name: 'Pilot',
      duration: '4-8 weeks',
      activities: [
        'Production deployment (limited scope)',
        'Monitoring and metrics',
        'Team training',
        'Documentation'
      ],
      outputs: ['Pilot Report', 'Runbook', 'Training Materials']
    },
    {
      name: 'Adoption',
      duration: 'Ongoing',
      activities: [
        'Full production rollout',
        'Team enablement',
        'Best practices documentation',
        'Regular reviews'
      ],
      outputs: ['Adoption Playbook', 'Guidelines']
    }
  ]
};
```

---

### Q17: How do you handle technical debt in a growing codebase?

**Answer:**

```javascript
// Technical Debt Management Framework

class TechnicalDebtManager {
  constructor(deps) {
    this.issueTracker = deps.issueTracker;
    this.codeAnalyzer = deps.codeAnalyzer;
    this.metrics = deps.metrics;
  }

  // Categorize and track debt
  async categorizeDebt(debtItem) {
    const categories = {
      'architecture': {
        priority: 'high',
        impact: 'scalability, maintainability',
        examples: ['monolithic components', 'tight coupling', 'missing abstraction layers']
      },
      'code-quality': {
        priority: 'medium',
        impact: 'maintainability, bug rate',
        examples: ['complex functions', 'code duplication', 'poor naming']
      },
      'testing': {
        priority: 'medium',
        impact: 'reliability, deployment confidence',
        examples: ['low coverage', 'flaky tests', 'missing integration tests']
      },
      'documentation': {
        priority: 'low',
        impact: 'onboarding, maintenance',
        examples: ['outdated docs', 'missing API docs', 'no architecture docs']
      },
      'dependencies': {
        priority: 'variable',
        impact: 'security, compatibility',
        examples: ['outdated packages', 'deprecated APIs', 'version conflicts']
      },
      'performance': {
        priority: 'variable',
        impact: 'user experience, costs',
        examples: ['N+1 queries', 'missing caching', 'inefficient algorithms']
      }
    };

    return {
      ...debtItem,
      category: this.detectCategory(debtItem, categories),
      priority: this.calculatePriority(debtItem),
      effort: this.estimateEffort(debtItem),
      interest: this.calculateInterest(debtItem)
    };
  }

  // Calculate "interest" - cost of not fixing
  calculateInterest(debtItem) {
    const factors = {
      developerTimeWasted: this.estimateTimeWasted(debtItem),
      bugProbability: this.estimateBugRisk(debtItem),
      onboardingImpact: this.estimateOnboardingImpact(debtItem),
      scalabilityRisk: this.estimateScalabilityRisk(debtItem)
    };

    return {
      weeklyHours: factors.developerTimeWasted,
      monthlyRisk: factors.bugProbability * factors.scalabilityRisk,
      recommendation: this.getPayoffRecommendation(factors)
    };
  }

  // Debt payoff strategies
  getPayoffStrategies() {
    return [
      {
        name: 'Boy Scout Rule',
        description: 'Leave code better than you found it',
        when: 'Continuous improvement, low-effort items',
        effort: 'Ongoing, 10-15% of sprint capacity'
      },
      {
        name: 'Tech Debt Sprints',
        description: 'Dedicated sprints for debt reduction',
        when: 'Accumulated significant debt',
        effort: '1 sprint every 4-6 sprints'
      },
      {
        name: 'Refactor While Adding Features',
        description: 'Refactor areas touched by new features',
        when: 'Feature work in debt-heavy areas',
        effort: 'Additional 20-30% per feature'
      },
      {
        name: 'Strangler Fig Pattern',
        description: 'Gradually replace legacy systems',
        when: 'Major architectural changes needed',
        effort: 'Long-term, parallel development'
      }
    ];
  }

  // Generate debt report
  async generateReport() {
    const allDebt = await this.issueTracker.getByLabel('tech-debt');
    const codeMetrics = await this.codeAnalyzer.analyze();

    return {
      summary: {
        totalItems: allDebt.length,
        byCategory: this.groupBy(allDebt, 'category'),
        byPriority: this.groupBy(allDebt, 'priority'),
        estimatedEffort: this.sumEffort(allDebt)
      },
      codeQuality: {
        complexity: codeMetrics.averageCyclomaticComplexity,
        duplication: codeMetrics.duplicationPercentage,
        coverage: codeMetrics.testCoverage,
        trends: await this.getTrends()
      },
      recommendations: this.generateRecommendations(allDebt),
      topPriority: this.getTopPriorityItems(allDebt, 10)
    };
  }
}

// Decision framework for prioritizing debt
const debtPrioritizationMatrix = {
  // High Impact, Low Effort - Do First
  quadrant1: {
    name: 'Quick Wins',
    action: 'Address immediately',
    examples: ['Simple refactors', 'Adding missing tests', 'Updating outdated dependencies']
  },
  // High Impact, High Effort - Plan Strategically
  quadrant2: {
    name: 'Major Projects',
    action: 'Schedule in roadmap',
    examples: ['Architecture changes', 'Database migrations', 'Major refactoring']
  },
  // Low Impact, Low Effort - Fill Time
  quadrant3: {
    name: 'Fill Work',
    action: 'Address when convenient',
    examples: ['Code formatting', 'Comment updates', 'Minor refactors']
  },
  // Low Impact, High Effort - Consider Carefully
  quadrant4: {
    name: 'Time Sinks',
    action: 'Avoid or defer',
    examples: ['Premature optimization', 'Unnecessary rewrites', 'Over-engineering']
  }
};
```

---

### Q18: How do you design and implement an effective code review process?

**Answer:**

```javascript
// Code Review Process Framework

const codeReviewGuidelines = {
  // What reviewers should focus on (priority order)
  reviewChecklist: [
    {
      category: 'Architecture & Design',
      priority: 1,
      questions: [
        'Does this change fit our architecture?',
        'Is the approach consistent with existing patterns?',
        'Are there better alternatives?',
        'Will this scale with our requirements?'
      ]
    },
    {
      category: 'Correctness',
      priority: 1,
      questions: [
        'Does the code do what it claims to do?',
        'Are edge cases handled?',
        'Are there any bugs?',
        'Is error handling appropriate?'
      ]
    },
    {
      category: 'Security',
      priority: 1,
      questions: [
        'Is input validated and sanitized?',
        'Are there any injection vulnerabilities?',
        'Is authentication/authorization correct?',
        'Are sensitive data handled properly?'
      ]
    },
    {
      category: 'Testing',
      priority: 2,
      questions: [
        'Is test coverage adequate?',
        'Are the right scenarios tested?',
        'Are tests maintainable?',
        'Do tests actually verify behavior?'
      ]
    },
    {
      category: 'Readability & Maintainability',
      priority: 2,
      questions: [
        'Is the code easy to understand?',
        'Are names descriptive and consistent?',
        'Is complexity appropriate?',
        'Is documentation adequate?'
      ]
    },
    {
      category: 'Performance',
      priority: 3,
      questions: [
        'Are there obvious performance issues?',
        'Is database access efficient?',
        'Are there memory leaks?',
        'Is caching used appropriately?'
      ]
    }
  ],

  // Review size limits
  sizeLimits: {
    ideal: { lines: 200, files: 5 },
    acceptable: { lines: 400, files: 10 },
    requiresSplit: { lines: 600, files: 15 }
  },

  // SLA for reviews
  sla: {
    criticalFix: '2 hours',
    standard: '1 business day',
    largeChange: '2 business days'
  },

  // Feedback guidelines
  feedbackGuidelines: {
    dos: [
      'Be specific and actionable',
      'Explain the "why" not just the "what"',
      'Offer alternatives, not just criticism',
      'Acknowledge good work',
      'Ask questions to understand context',
      'Focus on the code, not the person'
    ],
    donts: [
      'Make it personal',
      'Nitpick on style (use linters)',
      'Bikeshed on trivial matters',
      'Block on preferences',
      'Leave vague comments',
      'Approve without actually reviewing'
    ],
    prefixes: {
      'BLOCKER:': 'Must fix before merge',
      'SUGGESTION:': 'Consider but optional',
      'NIT:': 'Very minor, fix if convenient',
      'QUESTION:': 'Seeking understanding',
      'PRAISE:': 'Highlighting good work'
    }
  }
};

// Automated Review Helpers
class AutomatedReviewTools {
  constructor(deps) {
    this.staticAnalyzer = deps.staticAnalyzer;
    this.securityScanner = deps.securityScanner;
    this.coverageReporter = deps.coverageReporter;
  }

  async analyzeChangeSet(pullRequest) {
    const results = await Promise.all([
      this.checkSize(pullRequest),
      this.staticAnalyzer.analyze(pullRequest.files),
      this.securityScanner.scan(pullRequest.files),
      this.coverageReporter.compare(pullRequest.base, pullRequest.head),
      this.checkDependencies(pullRequest),
      this.detectPatterns(pullRequest)
    ]);

    return this.formatResults(results);
  }

  async checkSize(pr) {
    const stats = {
      additions: pr.additions,
      deletions: pr.deletions,
      filesChanged: pr.files.length
    };

    if (stats.additions > 600 || stats.filesChanged > 15) {
      return {
        status: 'warning',
        message: 'PR is large. Consider breaking into smaller changes.',
        suggestion: this.suggestSplit(pr)
      };
    }

    return { status: 'ok' };
  }

  async detectPatterns(pr) {
    const patterns = [];

    for (const file of pr.files) {
      // Check for common anti-patterns
      const issues = await this.analyzeFile(file);
      
      if (issues.hasHardcodedSecrets) {
        patterns.push({
          severity: 'critical',
          file: file.path,
          issue: 'Potential hardcoded secret detected'
        });
      }

      if (issues.hasConsoleLog && !file.path.includes('test')) {
        patterns.push({
          severity: 'warning',
          file: file.path,
          issue: 'console.log in production code'
        });
      }

      if (issues.hasTodo) {
        patterns.push({
          severity: 'info',
          file: file.path,
          issue: 'TODO comment - consider creating ticket'
        });
      }
    }

    return patterns;
  }
}

// Review Assignment Algorithm
class ReviewerAssignment {
  constructor(deps) {
    this.teamService = deps.teamService;
    this.historyService = deps.historyService;
  }

  async assignReviewers(pullRequest, options = {}) {
    const candidates = await this.getCandidates(pullRequest);
    
    // Score each candidate
    const scored = candidates.map(reviewer => ({
      reviewer,
      score: this.scoreReviewer(reviewer, pullRequest)
    }));

    // Sort by score and apply constraints
    scored.sort((a, b) => b.score - a.score);

    const selected = this.selectWithConstraints(scored, {
      minReviewers: options.minReviewers || 2,
      maxReviewers: options.maxReviewers || 3,
      requireCodeOwner: options.requireCodeOwner !== false
    });

    return selected;
  }

  scoreReviewer(reviewer, pr) {
    let score = 0;

    // Expertise in changed files
    score += this.getExpertiseScore(reviewer, pr.files) * 30;

    // Review workload balance
    score += this.getWorkloadScore(reviewer) * 20;

    // Recent activity in codebase
    score += this.getActivityScore(reviewer, pr.repository) * 15;

    // Previous review relationship with author
    score += this.getRelationshipScore(reviewer, pr.author) * 10;

    // Availability (not on vacation, not in different timezone)
    score += this.getAvailabilityScore(reviewer) * 25;

    return score;
  }
}
```

---

### Q19: How do you approach system reliability and incident management?

**Answer:**

```javascript
// Incident Management Framework

class IncidentManager {
  constructor(deps) {
    this.alerting = deps.alerting;
    this.communication = deps.communication;
    this.runbooks = deps.runbooks;
    this.timeline = deps.timeline;
    this.metrics = deps.metrics;
  }

  // Incident Severity Levels
  severityLevels = {
    SEV1: {
      name: 'Critical',
      description: 'Complete service outage affecting all users',
      responseTime: '5 minutes',
      updateFrequency: '15 minutes',
      requiredRoles: ['incident-commander', 'engineering-lead', 'communications'],
      escalation: 'immediate to VP Engineering'
    },
    SEV2: {
      name: 'Major',
      description: 'Significant degradation or partial outage',
      responseTime: '15 minutes',
      updateFrequency: '30 minutes',
      requiredRoles: ['incident-commander', 'engineer'],
      escalation: 'Engineering Manager after 1 hour'
    },
    SEV3: {
      name: 'Minor',
      description: 'Limited impact, workaround available',
      responseTime: '1 hour',
      updateFrequency: '2 hours',
      requiredRoles: ['engineer'],
      escalation: 'Team Lead after 4 hours'
    },
    SEV4: {
      name: 'Low',
      description: 'Minimal impact, cosmetic issues',
      responseTime: '1 business day',
      updateFrequency: 'As needed',
      requiredRoles: ['engineer'],
      escalation: 'None'
    }
  };

  async declareIncident(alert) {
    const severity = this.determineSeverity(alert);
    const config = this.severityLevels[severity];

    const incident = {
      id: this.generateIncidentId(),
      severity,
      title: alert.title,
      description: alert.description,
      status: 'investigating',
      declaredAt: new Date(),
      timeline: [],
      affectedServices: alert.services,
      impactedUsers: await this.estimateImpact(alert)
    };

    // Create communication channels
    const channel = await this.communication.createIncidentChannel(incident);
    incident.channelId = channel.id;

    // Page responders
    await this.pageResponders(incident, config.requiredRoles);

    // Post initial update
    await this.postUpdate(incident, 'Incident declared, investigation starting');

    // Start incident timer
    this.metrics.startIncidentTimer(incident.id);

    return incident;
  }

  async runIncidentProcess(incident) {
    // 1. Triage - Confirm scope and impact
    await this.runPhase('triage', incident, async () => {
      const runbook = await this.runbooks.find(incident.affectedServices);
      if (runbook) {
        await this.executeRunbook(runbook, incident);
      }
      
      const scope = await this.assessScope(incident);
      await this.updateTimeline(incident, `Scope assessed: ${scope.summary}`);
    });

    // 2. Mitigation - Stop the bleeding
    await this.runPhase('mitigation', incident, async () => {
      const mitigationOptions = await this.getMitigationOptions(incident);
      const selectedOption = await this.selectMitigation(mitigationOptions);
      
      await this.executeMitigation(selectedOption, incident);
      await this.verifyMitigation(incident);
    });

    // 3. Resolution - Fix the root cause
    await this.runPhase('resolution', incident, async () => {
      const rootCause = await this.investigateRootCause(incident);
      await this.implementFix(rootCause, incident);
      await this.verifyResolution(incident);
    });

    // 4. Closure
    await this.closeIncident(incident);
  }

  async closeIncident(incident) {
    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    incident.duration = incident.resolvedAt - incident.declaredAt;

    // Final update
    await this.postUpdate(incident, 'Incident resolved');

    // Schedule postmortem
    await this.schedulePostmortem(incident);

    // Record metrics
    this.metrics.recordIncident({
      severity: incident.severity,
      duration: incident.duration,
      timeToMitigate: incident.mitigatedAt - incident.declaredAt,
      services: incident.affectedServices
    });

    // Close communication channel
    await this.communication.archiveChannel(incident.channelId);
  }
}

// Post-Mortem Process
class PostMortemManager {
  generateTemplate(incident) {
    return {
      sections: [
        {
          title: 'Summary',
          content: `
            - **Incident ID**: ${incident.id}
            - **Severity**: ${incident.severity}
            - **Duration**: ${this.formatDuration(incident.duration)}
            - **Impact**: ${incident.impactSummary}
          `
        },
        {
          title: 'Timeline',
          content: incident.timeline.map(event => 
            `${event.timestamp} - ${event.description}`
          ).join('\n')
        },
        {
          title: 'Root Cause Analysis',
          prompts: [
            'What was the root cause?',
            'Why did this happen?',
            'What conditions allowed this to occur?'
          ]
        },
        {
          title: 'What Went Well',
          prompts: [
            'What helped us detect this quickly?',
            'What helped us resolve this effectively?'
          ]
        },
        {
          title: 'What Could Be Improved',
          prompts: [
            'What slowed down detection?',
            'What slowed down resolution?',
            'What was confusing or unclear?'
          ]
        },
        {
          title: 'Action Items',
          format: {
            columns: ['Description', 'Owner', 'Priority', 'Due Date']
          }
        },
        {
          title: 'Lessons Learned',
          prompts: [
            'What would we do differently?',
            'What should others learn from this?'
          ]
        }
      ],
      guidelines: {
        blameless: true,
        focusOnSystems: 'Focus on system and process failures, not individuals',
        actionable: 'Every finding should have an action item',
        timeboxed: 'Complete within 5 business days'
      }
    };
  }
}

// SLO/SLI Management
class ReliabilityTargets {
  constructor() {
    this.slos = new Map();
  }

  defineSLO(service, slo) {
    this.slos.set(service, {
      availability: {
        target: slo.availability || 99.9,
        measurement: 'successful_requests / total_requests * 100',
        window: '30 days rolling'
      },
      latency: {
        target: slo.p99Latency || 200, // ms
        measurement: 'p99 response time',
        window: '30 days rolling'
      },
      errorRate: {
        target: slo.errorRate || 0.1, // %
        measurement: 'error_requests / total_requests * 100',
        window: '30 days rolling'
      }
    });

    // Calculate error budget
    const errorBudget = this.calculateErrorBudget(slo);
    this.slos.get(service).errorBudget = errorBudget;
  }

  calculateErrorBudget(slo) {
    const target = slo.availability / 100;
    const windowMinutes = 30 * 24 * 60; // 30 days
    
    return {
      totalMinutes: windowMinutes,
      budgetMinutes: windowMinutes * (1 - target),
      budgetPercentage: (1 - target) * 100
    };
  }

  async checkBudget(service) {
    const slo = this.slos.get(service);
    const actualDowntime = await this.metrics.getDowntime(service, '30d');
    
    const budgetUsed = actualDowntime / slo.errorBudget.budgetMinutes * 100;
    const budgetRemaining = 100 - budgetUsed;

    return {
      service,
      budgetUsed: `${budgetUsed.toFixed(2)}%`,
      budgetRemaining: `${budgetRemaining.toFixed(2)}%`,
      remainingMinutes: slo.errorBudget.budgetMinutes * (budgetRemaining / 100),
      status: budgetRemaining > 50 ? 'healthy' : 
              budgetRemaining > 20 ? 'warning' : 'critical'
    };
  }
}
```

---

### Q20-Q25: [Additional Leadership Questions - Key Topics]

Key topics covered in remaining leadership questions:
- **Q20**: Building and scaling engineering teams
- **Q21**: Managing cross-team dependencies
- **Q22**: Establishing engineering standards and guidelines
- **Q23**: Capacity planning and resource management
- **Q24**: Mentoring and developing senior engineers
- **Q25**: Balancing innovation with reliability

---

## Performance Engineering

### Q26: How do you approach performance optimization at scale?

**Answer:**

```javascript
// Performance Optimization Framework

class PerformanceOptimizationFramework {
  constructor(deps) {
    this.metrics = deps.metrics;
    this.profiler = deps.profiler;
    this.loadTester = deps.loadTester;
    this.apm = deps.apm;
  }

  // Performance Optimization Process
  optimizationProcess = {
    phases: [
      {
        name: 'Measure',
        activities: [
          'Establish baseline metrics',
          'Define performance SLOs',
          'Instrument critical paths',
          'Collect production profiles'
        ],
        outputs: ['Baseline Report', 'SLO Document', 'Flame Graphs']
      },
      {
        name: 'Analyze',
        activities: [
          'Identify bottlenecks',
          'Analyze hot paths',
          'Review resource utilization',
          'Correlate with user experience'
        ],
        outputs: ['Bottleneck Analysis', 'Priority Matrix']
      },
      {
        name: 'Hypothesize',
        activities: [
          'Form optimization hypotheses',
          'Estimate impact',
          'Assess effort and risk',
          'Prioritize opportunities'
        ],
        outputs: ['Optimization Candidates', 'Impact Estimates']
      },
      {
        name: 'Experiment',
        activities: [
          'Implement in isolation',
          'A/B test where possible',
          'Measure improvement',
          'Validate in staging'
        ],
        outputs: ['Experiment Results', 'Before/After Comparison']
      },
      {
        name: 'Implement',
        activities: [
          'Deploy with feature flags',
          'Gradual rollout',
          'Monitor closely',
          'Document changes'
        ],
        outputs: ['Production Deployment', 'Documentation']
      }
    ]
  };

  async analyzePerformance(service) {
    const analysis = {
      service,
      timestamp: new Date(),
      findings: []
    };

    // 1. Database Performance
    const dbAnalysis = await this.analyzeDatabasePerformance(service);
    analysis.findings.push(...dbAnalysis);

    // 2. API Response Times
    const apiAnalysis = await this.analyzeAPIPerformance(service);
    analysis.findings.push(...apiAnalysis);

    // 3. Memory and CPU
    const resourceAnalysis = await this.analyzeResourceUsage(service);
    analysis.findings.push(...resourceAnalysis);

    // 4. External Dependencies
    const depAnalysis = await this.analyzeDependencies(service);
    analysis.findings.push(...depAnalysis);

    // Prioritize findings
    analysis.prioritized = this.prioritizeFindings(analysis.findings);

    return analysis;
  }

  async analyzeDatabasePerformance(service) {
    const findings = [];
    
    const slowQueries = await this.metrics.getSlowQueries(service, {
      threshold: 100, // ms
      period: '24h'
    });

    for (const query of slowQueries) {
      const explanation = await this.explainQuery(query);
      
      findings.push({
        type: 'slow-query',
        severity: this.classifySeverity(query.avgDuration),
        query: query.sql,
        avgDuration: query.avgDuration,
        frequency: query.count,
        recommendation: this.getQueryRecommendation(explanation)
      });
    }

    // Check for N+1 patterns
    const n1Patterns = await this.detectN1Queries(service);
    findings.push(...n1Patterns);

    // Check connection pool utilization
    const poolStats = await this.getConnectionPoolStats(service);
    if (poolStats.utilizationPercentage > 80) {
      findings.push({
        type: 'connection-pool',
        severity: 'medium',
        message: 'Connection pool near saturation',
        current: poolStats.active,
        max: poolStats.max,
        recommendation: 'Consider increasing pool size or optimizing connection usage'
      });
    }

    return findings;
  }

  getQueryRecommendation(explanation) {
    const recommendations = [];

    if (explanation.type === 'ALL' || explanation.type === 'index_scan') {
      recommendations.push({
        type: 'ADD_INDEX',
        description: `Add index on columns: ${explanation.suggestedColumns.join(', ')}`,
        estimatedImprovement: '10-100x'
      });
    }

    if (explanation.filesort) {
      recommendations.push({
        type: 'AVOID_FILESORT',
        description: 'Query requires filesort, consider adding index for ORDER BY columns',
        estimatedImprovement: '5-20x'
      });
    }

    if (explanation.temporaryTable) {
      recommendations.push({
        type: 'AVOID_TEMP_TABLE',
        description: 'Query uses temporary table, consider query restructuring',
        estimatedImprovement: '2-10x'
      });
    }

    return recommendations;
  }
}

// Performance Testing Strategy
class PerformanceTestingStrategy {
  constructor(deps) {
    this.loadTester = deps.loadTester;
    this.metrics = deps.metrics;
  }

  testSuites = {
    baseline: {
      name: 'Baseline Performance Test',
      duration: '10m',
      users: 100,
      rampUp: '1m',
      assertions: [
        { metric: 'p99_latency', operator: '<', value: 200 },
        { metric: 'error_rate', operator: '<', value: 0.1 },
        { metric: 'throughput', operator: '>', value: 1000 }
      ]
    },
    stress: {
      name: 'Stress Test',
      duration: '30m',
      users: 'ramp to failure',
      rampUp: '5m',
      objective: 'Find breaking point'
    },
    soak: {
      name: 'Soak Test',
      duration: '4h',
      users: 200,
      rampUp: '5m',
      objective: 'Detect memory leaks and degradation'
    },
    spike: {
      name: 'Spike Test',
      phases: [
        { duration: '2m', users: 100 },
        { duration: '1m', users: 1000 },
        { duration: '2m', users: 100 }
      ],
      objective: 'Test sudden traffic spikes'
    }
  };

  async runTestSuite(suiteName, target) {
    const suite = this.testSuites[suiteName];
    const results = await this.loadTester.run(suite, target);
    
    return {
      suite: suiteName,
      target,
      results: {
        summary: this.summarizeResults(results),
        metrics: this.extractMetrics(results),
        assertions: this.evaluateAssertions(results, suite.assertions),
        recommendations: this.generateRecommendations(results)
      }
    };
  }
}
```

---

### Q27-Q35: [Additional Performance Questions - Key Topics]

Key topics covered:
- **Q27**: Caching strategies at scale
- **Q28**: Database optimization patterns
- **Q29**: Memory leak detection and prevention
- **Q30**: Network optimization
- **Q31**: Async processing optimization
- **Q32**: Real-time performance monitoring
- **Q33**: Cost optimization strategies
- **Q34**: Capacity planning
- **Q35**: Performance budgets and governance

---

## Enterprise Patterns & Scalability

### Q36-Q45: [Enterprise Patterns - Key Topics]

Key topics covered in enterprise pattern questions:
- **Q36**: Implementing data governance
- **Q37**: Compliance and regulatory requirements
- **Q38**: Enterprise integration patterns
- **Q39**: API design for enterprise scale
- **Q40**: Multi-tenancy patterns
- **Q41**: Data partitioning strategies
- **Q42**: Event-driven architecture at scale
- **Q43**: Service mesh implementation
- **Q44**: Observability at enterprise scale
- **Q45**: Disaster recovery planning

---

## Strategic Decision Making

### Q46: How do you make build vs. buy decisions?

**Answer:**

```javascript
// Build vs Buy Decision Framework

class BuildVsBuyFramework {
  constructor() {
    this.criteria = {
      strategic: {
        weight: 0.25,
        factors: [
          'core_competency',
          'competitive_advantage',
          'differentiation',
          'control_requirements'
        ]
      },
      technical: {
        weight: 0.25,
        factors: [
          'customization_needs',
          'integration_complexity',
          'performance_requirements',
          'security_requirements'
        ]
      },
      operational: {
        weight: 0.20,
        factors: [
          'team_expertise',
          'maintenance_burden',
          'support_availability',
          'scalability'
        ]
      },
      financial: {
        weight: 0.30,
        factors: [
          'initial_cost',
          'ongoing_cost',
          'opportunity_cost',
          'time_to_value'
        ]
      }
    };
  }

  async evaluate(requirement) {
    const buildAnalysis = await this.analyzeBuild(requirement);
    const buyAnalysis = await this.analyzeBuy(requirement);

    // Score each option
    const buildScore = this.calculateScore(buildAnalysis);
    const buyScore = this.calculateScore(buyAnalysis);

    // Consider hybrid options
    const hybridOptions = this.evaluateHybridApproaches(requirement);

    return {
      requirement,
      options: {
        build: { ...buildAnalysis, score: buildScore },
        buy: { ...buyAnalysis, score: buyScore },
        hybrid: hybridOptions
      },
      recommendation: this.generateRecommendation(buildScore, buyScore, hybridOptions),
      risks: this.identifyRisks(buildAnalysis, buyAnalysis),
      nextSteps: this.suggestNextSteps()
    };
  }

  async analyzeBuild(requirement) {
    return {
      strategic: {
        core_competency: requirement.isCoreCompetency ? 10 : 3,
        competitive_advantage: requirement.providesAdvantage ? 10 : 2,
        differentiation: requirement.needsDifferentiation ? 10 : 4,
        control_requirements: requirement.needsFullControl ? 10 : 5
      },
      technical: {
        customization_needs: requirement.customizationLevel * 2,
        integration_complexity: 10 - requirement.integrationPoints, // Less is better
        performance_requirements: requirement.performanceCritical ? 8 : 5,
        security_requirements: requirement.sensitiveData ? 8 : 6
      },
      operational: {
        team_expertise: this.assessTeamExpertise(requirement.technologies),
        maintenance_burden: 4, // Building means ongoing maintenance
        support_availability: 8, // Internal support
        scalability: requirement.scalabilityNeeds > 7 ? 7 : 9
      },
      financial: {
        initial_cost: this.estimateBuildCost(requirement),
        ongoing_cost: this.estimateBuildMaintenanceCost(requirement),
        opportunity_cost: this.estimateOpportunityCost(requirement),
        time_to_value: this.estimateBuildTime(requirement)
      }
    };
  }

  async analyzeBuy(requirement) {
    const vendors = await this.evaluateVendors(requirement);
    const bestVendor = vendors[0];

    return {
      vendor: bestVendor,
      strategic: {
        core_competency: requirement.isCoreCompetency ? 3 : 8,
        competitive_advantage: requirement.providesAdvantage ? 3 : 7,
        differentiation: requirement.needsDifferentiation ? 3 : 7,
        control_requirements: requirement.needsFullControl ? 2 : 7
      },
      technical: {
        customization_needs: bestVendor.customizationScore,
        integration_complexity: bestVendor.integrationScore,
        performance_requirements: bestVendor.performanceScore,
        security_requirements: bestVendor.securityScore
      },
      operational: {
        team_expertise: 7, // Less expertise needed
        maintenance_burden: 8, // Vendor handles
        support_availability: bestVendor.supportScore,
        scalability: bestVendor.scalabilityScore
      },
      financial: {
        initial_cost: bestVendor.implementationCost,
        ongoing_cost: bestVendor.annualCost,
        opportunity_cost: 1, // Low - team can work on other things
        time_to_value: bestVendor.implementationTime
      }
    };
  }

  generateRecommendation(buildScore, buyScore, hybridOptions) {
    const scoreDiff = Math.abs(buildScore - buyScore);
    
    if (scoreDiff < 10) {
      // Close call - recommend deeper analysis
      return {
        decision: 'NEEDS_DEEPER_ANALYSIS',
        reasoning: 'Build and buy options are closely matched',
        suggestion: 'Consider POC for both approaches'
      };
    }

    if (buildScore > buyScore) {
      return {
        decision: 'BUILD',
        confidence: scoreDiff > 20 ? 'HIGH' : 'MEDIUM',
        reasoning: this.explainBuildRecommendation()
      };
    }

    return {
      decision: 'BUY',
      confidence: scoreDiff > 20 ? 'HIGH' : 'MEDIUM',
      reasoning: this.explainBuyRecommendation()
    };
  }
}
```

---

### Q47: How do you plan and execute large-scale migrations?

**Answer:**

```javascript
// Migration Planning Framework

class MigrationPlanningFramework {
  constructor() {
    this.phases = [
      'discovery',
      'planning',
      'preparation',
      'migration',
      'validation',
      'cutover',
      'optimization'
    ];
  }

  async createMigrationPlan(context) {
    const plan = {
      id: this.generatePlanId(),
      name: context.name,
      type: context.type, // database, infrastructure, service, etc.
      scope: context.scope,
      timeline: {},
      risks: [],
      rollbackPlan: {},
      phases: []
    };

    // Analyze current state
    const analysis = await this.analyzeCurrentState(context);
    plan.currentState = analysis;

    // Define target state
    plan.targetState = await this.defineTargetState(context);

    // Identify gaps and risks
    plan.gaps = this.identifyGaps(plan.currentState, plan.targetState);
    plan.risks = this.assessRisks(plan);

    // Create phase plans
    for (const phase of this.phases) {
      plan.phases.push(await this.planPhase(phase, plan));
    }

    // Create rollback plan
    plan.rollbackPlan = this.createRollbackPlan(plan);

    // Define success criteria
    plan.successCriteria = this.defineSuccessCriteria(plan);

    return plan;
  }

  async planPhase(phaseName, plan) {
    const phaseConfigs = {
      discovery: {
        duration: '2 weeks',
        activities: [
          'Inventory all components',
          'Document dependencies',
          'Identify data flows',
          'Catalog integrations',
          'Assess technical debt'
        ],
        deliverables: [
          'Component inventory',
          'Dependency map',
          'Integration catalog',
          'Risk assessment'
        ],
        exitCriteria: [
          'Complete inventory documented',
          'All dependencies identified',
          'Stakeholders aligned'
        ]
      },
      planning: {
        duration: '3 weeks',
        activities: [
          'Define migration strategy',
          'Create detailed timeline',
          'Allocate resources',
          'Plan testing approach',
          'Define rollback triggers'
        ],
        deliverables: [
          'Migration strategy document',
          'Detailed project plan',
          'Resource allocation',
          'Test plan',
          'Rollback procedures'
        ]
      },
      preparation: {
        duration: '4 weeks',
        activities: [
          'Set up target environment',
          'Create automation scripts',
          'Prepare data migration tools',
          'Build testing harnesses',
          'Train team'
        ],
        deliverables: [
          'Target environment ready',
          'Migration scripts tested',
          'Team trained'
        ]
      },
      migration: {
        duration: 'Varies',
        approaches: [
          {
            name: 'Big Bang',
            description: 'Complete migration in single event',
            when: 'Simple, low-risk systems',
            risks: 'Higher impact if issues'
          },
          {
            name: 'Phased',
            description: 'Migrate in planned increments',
            when: 'Complex systems with clear boundaries',
            risks: 'Longer timeline, dual maintenance'
          },
          {
            name: 'Strangler Fig',
            description: 'Gradually replace functionality',
            when: 'Critical systems needing zero downtime',
            risks: 'Complex routing, long timeline'
          },
          {
            name: 'Blue-Green',
            description: 'Parallel environments with switch',
            when: 'Infrastructure migrations',
            risks: 'Resource cost, sync complexity'
          }
        ]
      }
    };

    return phaseConfigs[phaseName] || { name: phaseName };
  }

  createRollbackPlan(plan) {
    return {
      triggers: [
        {
          condition: 'Error rate exceeds 5%',
          action: 'Automatic rollback',
          timeWindow: '15 minutes'
        },
        {
          condition: 'Data integrity check fails',
          action: 'Pause and assess',
          timeWindow: 'Immediate'
        },
        {
          condition: 'Performance degradation > 50%',
          action: 'Team decision',
          timeWindow: '30 minutes'
        }
      ],
      procedures: [
        {
          name: 'Quick Rollback',
          applicability: 'Within 1 hour of cutover',
          steps: [
            'Redirect traffic to old system',
            'Verify old system health',
            'Stop write operations to new system',
            'Assess data sync requirements'
          ],
          estimatedTime: '5-15 minutes'
        },
        {
          name: 'Extended Rollback',
          applicability: 'After 1 hour of cutover',
          steps: [
            'Pause new system writes',
            'Export delta data from new system',
            'Import delta to old system',
            'Validate data integrity',
            'Redirect traffic',
            'Monitor for issues'
          ],
          estimatedTime: '2-4 hours'
        }
      ],
      dataReconciliation: {
        strategy: 'Dual-write during transition',
        conflictResolution: 'Source of truth based on transaction timestamp'
      }
    };
  }
}
```

---

### Q48: How do you balance innovation with operational excellence?

**Answer:**

```javascript
// Innovation vs Operations Balance Framework

const innovationOperationsBalance = {
  principles: [
    {
      name: 'Two-Speed IT',
      description: 'Separate innovation initiatives from core operations',
      implementation: {
        innovationTrack: {
          purpose: 'Explore new technologies and approaches',
          metrics: ['Learning velocity', 'Experiment success rate'],
          riskTolerance: 'Higher',
          governance: 'Lightweight'
        },
        operationsTrack: {
          purpose: 'Maintain reliable, efficient systems',
          metrics: ['Availability', 'Performance', 'Cost efficiency'],
          riskTolerance: 'Lower',
          governance: 'Standard'
        }
      }
    },
    {
      name: 'Innovation Budget',
      description: 'Allocate fixed percentage to innovation',
      allocation: {
        innovation: '15-20%',
        maintenance: '25-30%',
        features: '50-60%'
      }
    },
    {
      name: 'Graduated Risk',
      description: 'Match risk with impact and reversibility',
      levels: [
        {
          level: 'Experiment',
          scope: 'Internal only, isolated environment',
          approval: 'Team level',
          risk: 'Very low'
        },
        {
          level: 'Pilot',
          scope: 'Limited production, subset of users',
          approval: 'Manager level',
          risk: 'Low'
        },
        {
          level: 'Controlled Rollout',
          scope: 'Gradual production rollout',
          approval: 'Director level',
          risk: 'Medium'
        },
        {
          level: 'Full Production',
          scope: 'Complete deployment',
          approval: 'Standard change management',
          risk: 'Standard'
        }
      ]
    }
  ],

  frameworks: {
    hackathons: {
      frequency: 'Quarterly',
      duration: '2-3 days',
      focus: 'Innovation and experimentation',
      outcomes: 'Prototypes, learning, team building',
      evaluation: 'Demo and voting',
      productionPath: 'Top ideas get POC allocation'
    },
    
    twentyPercentTime: {
      description: 'Engineers can spend 20% on self-directed projects',
      rules: [
        'Must align with company direction',
        'Must document outcomes',
        'Must share learnings',
        'Cannot impact on-call duties'
      ]
    },
    
    innovationSprints: {
      frequency: 'Every 6th sprint',
      focus: 'Technical exploration and debt reduction',
      planning: 'Team chooses topics',
      outcomes: 'Knowledge sharing, prototypes, documentation'
    }
  },

  governance: {
    innovationReview: {
      frequency: 'Monthly',
      attendees: ['Tech leads', 'Product managers', 'Engineering director'],
      agenda: [
        'Review ongoing experiments',
        'Evaluate pilot results',
        'Decide on production paths',
        'Allocate resources',
        'Kill unsuccessful initiatives'
      ]
    },
    
    techRadar: {
      purpose: 'Track technology adoption',
      rings: ['Adopt', 'Trial', 'Assess', 'Hold'],
      updateFrequency: 'Quarterly',
      owner: 'Architecture team'
    }
  }
};

// Implementation in Team Planning
class TeamPlanningFramework {
  allocateSprint(sprintCapacity, backlog) {
    const allocation = {
      features: 0.55,      // 55% new features
      maintenance: 0.25,   // 25% maintenance and bugs
      innovation: 0.15,    // 15% innovation and exploration
      buffer: 0.05         // 5% buffer for unknowns
    };

    const points = {
      features: Math.floor(sprintCapacity * allocation.features),
      maintenance: Math.floor(sprintCapacity * allocation.maintenance),
      innovation: Math.floor(sprintCapacity * allocation.innovation),
      buffer: Math.floor(sprintCapacity * allocation.buffer)
    };

    return this.selectItems(backlog, points);
  }

  selectItems(backlog, points) {
    const selected = {
      features: [],
      maintenance: [],
      innovation: []
    };

    // Select highest priority items within allocation
    for (const category of Object.keys(points)) {
      const items = backlog.filter(i => i.category === category)
        .sort((a, b) => b.priority - a.priority);
      
      let remaining = points[category];
      for (const item of items) {
        if (item.points <= remaining) {
          selected[category].push(item);
          remaining -= item.points;
        }
      }
    }

    return selected;
  }
}
```

---

### Q49: How do you approach technology standardization vs. flexibility?

**Answer:**

```javascript
// Technology Governance Framework

const technologyGovernanceFramework = {
  standardizationLevels: {
    mandatory: {
      description: 'Must use across all teams',
      examples: [
        'Security libraries',
        'Logging format',
        'Authentication mechanism',
        'CI/CD platform'
      ],
      exemptionProcess: 'VP approval required with documented justification'
    },
    preferred: {
      description: 'Default choice, deviation needs justification',
      examples: [
        'Programming languages for service type',
        'Primary database',
        'Message queue',
        'Container orchestration'
      ],
      exemptionProcess: 'Architecture review'
    },
    recommended: {
      description: 'Suggested but flexible',
      examples: [
        'Testing frameworks',
        'ORM libraries',
        'Utility libraries'
      ],
      exemptionProcess: 'Team decision with documentation'
    },
    flexible: {
      description: 'Team choice',
      examples: [
        'IDE and tools',
        'Code formatting (within standards)',
        'Development workflow'
      ],
      exemptionProcess: 'None required'
    }
  },

  decisionCriteria: {
    toStandardize: [
      'Security-related components',
      'Cross-team integration points',
      'High operational impact',
      'Significant training investment',
      'Vendor lock-in risk'
    ],
    toKeepFlexible: [
      'Rapidly evolving areas',
      'Team-specific needs',
      'Low cross-team impact',
      'Experimentation needed',
      'Commodity tools'
    ]
  },

  governanceProcess: {
    proposingNewTechnology: {
      steps: [
        {
          name: 'RFC Creation',
          owner: 'Proposer',
          duration: '1 week',
          output: 'RFC document with analysis'
        },
        {
          name: 'Review Period',
          owner: 'All engineers',
          duration: '2 weeks',
          output: 'Comments and concerns'
        },
        {
          name: 'Architecture Review',
          owner: 'Architecture team',
          duration: '1 week',
          output: 'Technical assessment'
        },
        {
          name: 'Decision',
          owner: 'Tech Lead Forum',
          duration: '1 week',
          output: 'Approve, reject, or modify'
        },
        {
          name: 'Implementation',
          owner: 'Proposing team',
          duration: 'Varies',
          output: 'POC, pilot, or production'
        }
      ]
    },

    deprecatingTechnology: {
      requirements: [
        'Migration path documented',
        'Timeline announced (minimum 6 months)',
        'Support commitment for transition',
        'Training for alternatives',
        'Automated migration tools where possible'
      ]
    }
  },

  communicationChannels: {
    techRadar: 'Quarterly technology assessment',
    architectureNewsletter: 'Monthly updates on decisions',
    rfcRepository: 'All proposals and decisions',
    standardsDocumentation: 'Current approved technologies',
    officeHours: 'Weekly Q&A with architecture team'
  }
};
```

---

### Q50: How do you measure and communicate engineering team success?

**Answer:**

```javascript
// Engineering Metrics Framework

const engineeringMetricsFramework = {
  categories: {
    delivery: {
      metrics: [
        {
          name: 'Deployment Frequency',
          description: 'How often code is deployed to production',
          target: 'Multiple times per day',
          calculation: 'Deployments per time period',
          healthyRange: '> 1 per day for high performers'
        },
        {
          name: 'Lead Time for Changes',
          description: 'Time from commit to production',
          target: '< 1 day',
          calculation: 'Median time from commit to deploy',
          healthyRange: '< 1 hour for elite performers'
        },
        {
          name: 'Change Failure Rate',
          description: 'Percentage of deployments causing issues',
          target: '< 15%',
          calculation: 'Failed deploys / Total deploys',
          healthyRange: '< 5% for elite performers'
        },
        {
          name: 'Time to Restore',
          description: 'Time to recover from production incident',
          target: '< 1 hour',
          calculation: 'Median incident resolution time',
          healthyRange: '< 1 hour for high performers'
        }
      ]
    },
    
    quality: {
      metrics: [
        {
          name: 'Production Incident Rate',
          description: 'Incidents per deployment or time period',
          target: 'Decreasing trend',
          calculation: 'Incidents / Time period'
        },
        {
          name: 'Code Coverage',
          description: 'Percentage of code covered by tests',
          target: '> 80%',
          note: 'Focus on critical paths'
        },
        {
          name: 'Technical Debt Ratio',
          description: 'Time spent on debt vs. features',
          target: '< 20%',
          calculation: 'Debt work / Total work'
        },
        {
          name: 'Security Vulnerability Count',
          description: 'Open security issues by severity',
          target: 'Zero critical/high, decreasing medium/low'
        }
      ]
    },
    
    productivity: {
      metrics: [
        {
          name: 'Cycle Time',
          description: 'Time from work start to completion',
          target: 'Decreasing trend',
          calculation: 'Median time from in-progress to done'
        },
        {
          name: 'Work in Progress',
          description: 'Items actively being worked on',
          target: '< 2 items per developer',
          note: 'Lower is generally better'
        },
        {
          name: 'Sprint Velocity',
          description: 'Story points completed per sprint',
          target: 'Stable with slight increase',
          note: 'Trend more important than absolute value'
        }
      ]
    },
    
    teamHealth: {
      metrics: [
        {
          name: 'Developer Satisfaction',
          description: 'Periodic survey results',
          target: '> 4/5',
          frequency: 'Quarterly'
        },
        {
          name: 'Attrition Rate',
          description: 'Voluntary turnover',
          target: '< 10% annually',
          calculation: 'Departures / Headcount'
        },
        {
          name: 'Knowledge Distribution',
          description: 'Bus factor for critical systems',
          target: '> 2 people per system',
          calculation: 'Min people who understand each system'
        }
      ]
    }
  },

  reporting: {
    executive: {
      frequency: 'Monthly',
      metrics: [
        'Deployment frequency (trend)',
        'System availability',
        'Key project progress',
        'Team capacity and utilization',
        'Major risks and blockers'
      ],
      format: 'Dashboard with 3-month trends'
    },
    
    stakeholders: {
      frequency: 'Bi-weekly',
      metrics: [
        'Feature delivery progress',
        'Upcoming releases',
        'Known issues',
        'Resource constraints'
      ],
      format: 'Status update with highlights'
    },
    
    team: {
      frequency: 'Weekly/Sprint',
      metrics: [
        'Sprint progress',
        'Blockers',
        'Quality metrics',
        'Individual contributions'
      ],
      format: 'Team dashboard and retrospective'
    }
  },

  antiPatterns: [
    {
      pattern: 'Lines of Code',
      problem: 'Incentivizes verbose, hard-to-maintain code'
    },
    {
      pattern: 'Bug Counts (absolute)',
      problem: 'Discourages finding and reporting bugs'
    },
    {
      pattern: 'Velocity as Performance',
      problem: 'Leads to point inflation, gaming'
    },
    {
      pattern: 'Individual Metrics Only',
      problem: 'Undermines teamwork and collaboration'
    }
  ],

  bestPractices: [
    'Focus on trends, not absolute numbers',
    'Use metrics for improvement, not punishment',
    'Combine quantitative with qualitative feedback',
    'Make metrics transparent and accessible',
    'Regularly review metric relevance',
    'Celebrate improvements, investigate regressions'
  ]
};

// Dashboard Implementation
class EngineeringDashboard {
  constructor(deps) {
    this.dataCollector = deps.dataCollector;
    this.storage = deps.storage;
    this.alerting = deps.alerting;
  }

  async generateReport(period) {
    const metrics = await this.collectMetrics(period);
    const trends = await this.calculateTrends(metrics);
    const insights = this.generateInsights(metrics, trends);
    
    return {
      period,
      generatedAt: new Date(),
      summary: this.createSummary(metrics),
      metrics,
      trends,
      insights,
      recommendations: this.generateRecommendations(insights)
    };
  }

  async collectMetrics(period) {
    return {
      delivery: await this.dataCollector.getDeliveryMetrics(period),
      quality: await this.dataCollector.getQualityMetrics(period),
      productivity: await this.dataCollector.getProductivityMetrics(period),
      teamHealth: await this.dataCollector.getTeamHealthMetrics(period)
    };
  }

  createSummary(metrics) {
    return {
      overallHealth: this.calculateOverallHealth(metrics),
      highlights: this.identifyHighlights(metrics),
      concerns: this.identifyConcerns(metrics),
      keyChanges: this.identifyKeyChanges(metrics)
    };
  }
}
```

---

## Summary

This guide covers Tech Lead-level Node.js concepts:

1. **System Design & Architecture**: Large-scale system design, distributed systems
2. **Technical Leadership**: Team building, process improvement, code review
3. **Performance Engineering**: Optimization at scale, performance testing
4. **Enterprise Patterns**: Governance, compliance, multi-tenancy
5. **Strategic Decision Making**: Build vs. buy, migrations, technology strategy

**Key Skills for Tech Leads:**
- Architectural vision and decision-making
- Cross-team collaboration and influence
- Balancing technical excellence with delivery
- Mentoring and developing engineers
- Translating business needs to technical solutions
- Managing technical risk and debt
