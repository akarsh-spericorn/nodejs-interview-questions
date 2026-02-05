# Node.js Senior Developer Interview Questions

> **Level**: Senior (4-7 years experience)
> **Total Questions**: 50
> **Complexity**: Advanced concepts, architecture, and optimization

---

## Table of Contents
1. [Advanced Architecture Patterns (Q1-Q12)](#advanced-architecture-patterns)
2. [Performance & Optimization (Q13-Q24)](#performance--optimization)
3. [Security & Reliability (Q25-Q35)](#security--reliability)
4. [Microservices & Distributed Systems (Q36-Q45)](#microservices--distributed-systems)
5. [DevOps & Production (Q46-Q50)](#devops--production)

---

## Advanced Architecture Patterns

### Q1: Explain the Repository Pattern and its benefits in Node.js applications.

**Answer:**
The Repository Pattern abstracts data access logic from business logic, providing a clean separation of concerns.

```javascript
// interfaces/IUserRepository.js (conceptual interface)
/**
 * @interface IUserRepository
 * @method findById(id) - Find user by ID
 * @method findAll(filters) - Find all users matching filters
 * @method create(userData) - Create new user
 * @method update(id, userData) - Update user
 * @method delete(id) - Delete user
 */

// repositories/UserRepository.js
class UserRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id) {
    return this.model.findById(id).lean();
  }

  async findByEmail(email) {
    return this.model.findOne({ email }).lean();
  }

  async findAll(filters = {}, options = {}) {
    const { page = 1, limit = 10, sort = '-createdAt' } = options;
    
    const query = this.model.find(filters);
    
    return {
      data: await query
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      total: await this.model.countDocuments(filters),
      page,
      limit
    };
  }

  async create(userData) {
    const user = new this.model(userData);
    return user.save();
  }

  async update(id, userData) {
    return this.model.findByIdAndUpdate(
      id,
      { $set: userData },
      { new: true, runValidators: true }
    ).lean();
  }

  async delete(id) {
    return this.model.findByIdAndDelete(id);
  }

  async exists(id) {
    return this.model.exists({ _id: id });
  }

  async bulkCreate(usersData) {
    return this.model.insertMany(usersData);
  }
}

// repositories/BaseRepository.js - Generic implementation
class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, projection = {}) {
    return this.model.findById(id, projection).lean();
  }

  async findOne(conditions, projection = {}) {
    return this.model.findOne(conditions, projection).lean();
  }

  async find(conditions = {}, projection = {}, options = {}) {
    return this.model.find(conditions, projection, options).lean();
  }

  async create(data) {
    return this.model.create(data);
  }

  async updateById(id, data) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).lean();
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }

  async count(conditions = {}) {
    return this.model.countDocuments(conditions);
  }

  async aggregate(pipeline) {
    return this.model.aggregate(pipeline);
  }

  startTransaction() {
    return this.model.startSession();
  }
}

// Usage in Service Layer
class UserService {
  constructor(userRepository, emailService) {
    this.userRepository = userRepository;
    this.emailService = emailService;
  }

  async createUser(userData) {
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('User already exists');
    }

    const user = await this.userRepository.create(userData);
    await this.emailService.sendWelcomeEmail(user.email);
    
    return user;
  }
}

// Benefits:
// 1. Testability - Easy to mock repository in tests
// 2. Flexibility - Can switch databases without changing business logic
// 3. Consistency - Centralized data access logic
// 4. Maintainability - Clear separation of concerns
```

---

### Q2: Explain the Unit of Work pattern and when to use it.

**Answer:**
The Unit of Work pattern maintains a list of objects affected by a business transaction and coordinates writing out changes.

```javascript
class UnitOfWork {
  constructor(connection) {
    this.connection = connection;
    this.session = null;
    this.repositories = new Map();
  }

  async start() {
    this.session = await this.connection.startSession();
    this.session.startTransaction();
    return this;
  }

  getRepository(name, Model) {
    if (!this.repositories.has(name)) {
      this.repositories.set(name, new TransactionalRepository(Model, this.session));
    }
    return this.repositories.get(name);
  }

  async commit() {
    try {
      await this.session.commitTransaction();
    } finally {
      await this.session.endSession();
      this.repositories.clear();
    }
  }

  async rollback() {
    try {
      await this.session.abortTransaction();
    } finally {
      await this.session.endSession();
      this.repositories.clear();
    }
  }

  async execute(work) {
    await this.start();
    try {
      const result = await work(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

class TransactionalRepository {
  constructor(model, session) {
    this.model = model;
    this.session = session;
  }

  async create(data) {
    const [doc] = await this.model.create([data], { session: this.session });
    return doc;
  }

  async update(id, data) {
    return this.model.findByIdAndUpdate(id, data, {
      new: true,
      session: this.session
    });
  }

  async delete(id) {
    return this.model.findByIdAndDelete(id, { session: this.session });
  }
}

// Usage
class OrderService {
  constructor(unitOfWorkFactory) {
    this.createUnitOfWork = unitOfWorkFactory;
  }

  async createOrder(orderData) {
    const uow = this.createUnitOfWork();
    
    return uow.execute(async (unitOfWork) => {
      const orderRepo = unitOfWork.getRepository('orders', Order);
      const inventoryRepo = unitOfWork.getRepository('inventory', Inventory);
      const paymentRepo = unitOfWork.getRepository('payments', Payment);

      // All operations use the same transaction
      const order = await orderRepo.create(orderData);
      
      // Reduce inventory
      for (const item of orderData.items) {
        await inventoryRepo.update(item.productId, {
          $inc: { quantity: -item.quantity }
        });
      }

      // Create payment record
      await paymentRepo.create({
        orderId: order._id,
        amount: orderData.total,
        status: 'pending'
      });

      return order;
    });
  }
}
```

---

### Q3: Implement CQRS (Command Query Responsibility Segregation) pattern.

**Answer:**
CQRS separates read and write operations into different models, optimizing each for its specific purpose.

```javascript
// Commands - Write operations
class CreateUserCommand {
  constructor(data) {
    this.type = 'CREATE_USER';
    this.data = data;
    this.timestamp = new Date();
  }
}

class UpdateUserCommand {
  constructor(id, data) {
    this.type = 'UPDATE_USER';
    this.id = id;
    this.data = data;
    this.timestamp = new Date();
  }
}

// Command Handler
class UserCommandHandler {
  constructor(writeRepository, eventBus) {
    this.writeRepository = writeRepository;
    this.eventBus = eventBus;
  }

  async handle(command) {
    switch (command.type) {
      case 'CREATE_USER':
        return this.handleCreate(command);
      case 'UPDATE_USER':
        return this.handleUpdate(command);
      default:
        throw new Error(`Unknown command: ${command.type}`);
    }
  }

  async handleCreate(command) {
    const user = await this.writeRepository.create(command.data);
    
    // Publish event for read model synchronization
    await this.eventBus.publish('UserCreated', {
      userId: user.id,
      data: user
    });
    
    return user;
  }

  async handleUpdate(command) {
    const user = await this.writeRepository.update(command.id, command.data);
    
    await this.eventBus.publish('UserUpdated', {
      userId: command.id,
      changes: command.data
    });
    
    return user;
  }
}

// Queries - Read operations
class GetUserByIdQuery {
  constructor(id) {
    this.type = 'GET_USER_BY_ID';
    this.id = id;
  }
}

class SearchUsersQuery {
  constructor(criteria) {
    this.type = 'SEARCH_USERS';
    this.criteria = criteria;
  }
}

// Query Handler
class UserQueryHandler {
  constructor(readRepository) {
    this.readRepository = readRepository; // Optimized for reads
  }

  async handle(query) {
    switch (query.type) {
      case 'GET_USER_BY_ID':
        return this.readRepository.findById(query.id);
      case 'SEARCH_USERS':
        return this.readRepository.search(query.criteria);
      default:
        throw new Error(`Unknown query: ${query.type}`);
    }
  }
}

// Read Model Projector - Keeps read model in sync
class UserReadModelProjector {
  constructor(readRepository) {
    this.readRepository = readRepository;
  }

  async project(event) {
    switch (event.type) {
      case 'UserCreated':
        await this.readRepository.insert({
          _id: event.userId,
          ...event.data,
          // Denormalized fields for faster reads
          fullName: `${event.data.firstName} ${event.data.lastName}`,
          searchableText: this.buildSearchText(event.data)
        });
        break;
        
      case 'UserUpdated':
        await this.readRepository.update(event.userId, event.changes);
        break;
    }
  }

  buildSearchText(data) {
    return [data.firstName, data.lastName, data.email].join(' ').toLowerCase();
  }
}

// Usage in API
class UserController {
  constructor(commandHandler, queryHandler) {
    this.commandHandler = commandHandler;
    this.queryHandler = queryHandler;
  }

  async createUser(req, res) {
    const command = new CreateUserCommand(req.body);
    const user = await this.commandHandler.handle(command);
    res.status(201).json(user);
  }

  async getUser(req, res) {
    const query = new GetUserByIdQuery(req.params.id);
    const user = await this.queryHandler.handle(query);
    res.json(user);
  }

  async searchUsers(req, res) {
    const query = new SearchUsersQuery(req.query);
    const results = await this.queryHandler.handle(query);
    res.json(results);
  }
}
```

---

### Q4: Implement Event Sourcing pattern in Node.js.

**Answer:**
Event Sourcing stores the state of an entity as a sequence of events, allowing reconstruction of state at any point in time.

```javascript
// Event Store
class EventStore {
  constructor(db) {
    this.collection = db.collection('events');
  }

  async append(streamId, events, expectedVersion) {
    const session = await this.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Optimistic concurrency check
        const currentVersion = await this.getStreamVersion(streamId);
        if (currentVersion !== expectedVersion) {
          throw new ConcurrencyError(
            `Expected version ${expectedVersion}, but found ${currentVersion}`
          );
        }

        const eventsToStore = events.map((event, index) => ({
          streamId,
          version: expectedVersion + index + 1,
          type: event.constructor.name,
          data: event,
          metadata: {
            timestamp: new Date(),
            correlationId: event.correlationId
          }
        }));

        await this.collection.insertMany(eventsToStore, { session });
      });
    } finally {
      await session.endSession();
    }
  }

  async getEvents(streamId, fromVersion = 0) {
    return this.collection
      .find({
        streamId,
        version: { $gt: fromVersion }
      })
      .sort({ version: 1 })
      .toArray();
  }

  async getStreamVersion(streamId) {
    const result = await this.collection
      .find({ streamId })
      .sort({ version: -1 })
      .limit(1)
      .toArray();
    
    return result.length ? result[0].version : 0;
  }
}

// Domain Events
class OrderCreated {
  constructor(orderId, customerId, items) {
    this.orderId = orderId;
    this.customerId = customerId;
    this.items = items;
  }
}

class OrderItemAdded {
  constructor(orderId, item) {
    this.orderId = orderId;
    this.item = item;
  }
}

class OrderConfirmed {
  constructor(orderId, confirmedAt) {
    this.orderId = orderId;
    this.confirmedAt = confirmedAt;
  }
}

// Aggregate
class Order {
  constructor() {
    this.id = null;
    this.customerId = null;
    this.items = [];
    this.status = 'pending';
    this.version = 0;
    this.uncommittedEvents = [];
  }

  // Factory method for new orders
  static create(orderId, customerId, initialItems) {
    const order = new Order();
    order.apply(new OrderCreated(orderId, customerId, initialItems));
    return order;
  }

  // Load from events
  static fromEvents(events) {
    const order = new Order();
    for (const event of events) {
      order.apply(event.data, false);
      order.version = event.version;
    }
    return order;
  }

  addItem(item) {
    if (this.status !== 'pending') {
      throw new Error('Cannot add items to confirmed order');
    }
    this.apply(new OrderItemAdded(this.id, item));
  }

  confirm() {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    this.apply(new OrderConfirmed(this.id, new Date()));
  }

  apply(event, isNew = true) {
    // Apply event to update state
    this.when(event);
    
    // Track uncommitted events for persistence
    if (isNew) {
      this.uncommittedEvents.push(event);
    }
  }

  when(event) {
    if (event instanceof OrderCreated) {
      this.id = event.orderId;
      this.customerId = event.customerId;
      this.items = [...event.items];
    } else if (event instanceof OrderItemAdded) {
      this.items.push(event.item);
    } else if (event instanceof OrderConfirmed) {
      this.status = 'confirmed';
    }
  }

  getUncommittedEvents() {
    return this.uncommittedEvents;
  }

  clearUncommittedEvents() {
    this.uncommittedEvents = [];
  }
}

// Repository using Event Sourcing
class OrderRepository {
  constructor(eventStore) {
    this.eventStore = eventStore;
  }

  async getById(orderId) {
    const events = await this.eventStore.getEvents(`order-${orderId}`);
    if (events.length === 0) {
      return null;
    }
    return Order.fromEvents(events);
  }

  async save(order) {
    const events = order.getUncommittedEvents();
    if (events.length === 0) return;

    await this.eventStore.append(
      `order-${order.id}`,
      events,
      order.version
    );

    order.clearUncommittedEvents();
    order.version += events.length;
  }
}

// Usage
async function createOrder(customerId, items) {
  const orderId = generateId();
  const order = Order.create(orderId, customerId, items);
  await orderRepository.save(order);
  return order;
}

async function addItemToOrder(orderId, item) {
  const order = await orderRepository.getById(orderId);
  order.addItem(item);
  await orderRepository.save(order);
  return order;
}
```

---

### Q5: Explain and implement the Saga pattern for distributed transactions.

**Answer:**
The Saga pattern manages distributed transactions by breaking them into a sequence of local transactions, with compensating actions for rollback.

```javascript
// Saga Orchestrator
class OrderSaga {
  constructor(services) {
    this.orderService = services.orderService;
    this.inventoryService = services.inventoryService;
    this.paymentService = services.paymentService;
    this.shippingService = services.shippingService;
    this.notificationService = services.notificationService;
  }

  async execute(orderData) {
    const context = {
      orderId: null,
      inventoryReserved: false,
      paymentProcessed: false,
      shippingScheduled: false
    };

    const steps = [
      {
        execute: () => this.createOrder(orderData, context),
        compensate: () => this.cancelOrder(context)
      },
      {
        execute: () => this.reserveInventory(orderData, context),
        compensate: () => this.releaseInventory(context)
      },
      {
        execute: () => this.processPayment(orderData, context),
        compensate: () => this.refundPayment(context)
      },
      {
        execute: () => this.scheduleShipping(context),
        compensate: () => this.cancelShipping(context)
      }
    ];

    const completedSteps = [];

    try {
      for (const step of steps) {
        await step.execute();
        completedSteps.push(step);
      }

      // All steps successful
      await this.notificationService.sendOrderConfirmation(context.orderId);
      return { success: true, orderId: context.orderId };

    } catch (error) {
      console.error('Saga failed:', error);

      // Compensate in reverse order
      for (let i = completedSteps.length - 1; i >= 0; i--) {
        try {
          await completedSteps[i].compensate();
        } catch (compensateError) {
          console.error('Compensation failed:', compensateError);
          // Log for manual intervention
          await this.logCompensationFailure(context, compensateError);
        }
      }

      throw error;
    }
  }

  async createOrder(orderData, context) {
    const order = await this.orderService.create({
      ...orderData,
      status: 'pending'
    });
    context.orderId = order.id;
  }

  async cancelOrder(context) {
    if (context.orderId) {
      await this.orderService.updateStatus(context.orderId, 'cancelled');
    }
  }

  async reserveInventory(orderData, context) {
    await this.inventoryService.reserve(
      context.orderId,
      orderData.items
    );
    context.inventoryReserved = true;
  }

  async releaseInventory(context) {
    if (context.inventoryReserved) {
      await this.inventoryService.release(context.orderId);
    }
  }

  async processPayment(orderData, context) {
    const payment = await this.paymentService.charge(
      context.orderId,
      orderData.paymentMethod,
      orderData.total
    );
    context.paymentId = payment.id;
    context.paymentProcessed = true;
  }

  async refundPayment(context) {
    if (context.paymentProcessed) {
      await this.paymentService.refund(context.paymentId);
    }
  }

  async scheduleShipping(context) {
    await this.shippingService.schedule(context.orderId);
    context.shippingScheduled = true;
    await this.orderService.updateStatus(context.orderId, 'confirmed');
  }

  async cancelShipping(context) {
    if (context.shippingScheduled) {
      await this.shippingService.cancel(context.orderId);
    }
  }
}

// Choreography-based Saga (event-driven)
class OrderSagaChoreography {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.setupListeners();
  }

  setupListeners() {
    // Order Service
    this.eventBus.on('OrderCreated', async (event) => {
      await this.inventoryService.reserve(event.orderId, event.items);
    });

    // Inventory Service
    this.eventBus.on('InventoryReserved', async (event) => {
      await this.paymentService.charge(event.orderId, event.amount);
    });

    this.eventBus.on('InventoryReservationFailed', async (event) => {
      await this.orderService.reject(event.orderId, event.reason);
    });

    // Payment Service
    this.eventBus.on('PaymentProcessed', async (event) => {
      await this.shippingService.schedule(event.orderId);
    });

    this.eventBus.on('PaymentFailed', async (event) => {
      await this.inventoryService.release(event.orderId);
      await this.orderService.reject(event.orderId, event.reason);
    });

    // Shipping Service
    this.eventBus.on('ShippingScheduled', async (event) => {
      await this.orderService.confirm(event.orderId);
    });

    this.eventBus.on('ShippingFailed', async (event) => {
      await this.paymentService.refund(event.orderId);
      await this.inventoryService.release(event.orderId);
      await this.orderService.reject(event.orderId, event.reason);
    });
  }
}
```

---

### Q6: Implement the Circuit Breaker pattern.

**Answer:**
The Circuit Breaker pattern prevents cascading failures by stopping requests to a failing service.

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000; // 30 seconds
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
  }

  async execute(fn, fallback) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        if (fallback) {
          return fallback();
        }
        throw new CircuitBreakerOpenError('Circuit breaker is OPEN');
      }
      this.state = 'HALF-OPEN';
    }

    try {
      const result = await this.callWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  async callWithTimeout(fn) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, this.timeout);

      fn()
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

  onSuccess() {
    if (this.state === 'HALF-OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF-OPEN') {
      this.open();
    } else if (this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  open() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeout;
    console.log('Circuit breaker OPENED');
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    console.log('Circuit breaker CLOSED');
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    };
  }
}

// Advanced implementation with monitoring
class AdvancedCircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold || 50, // percentage
      volumeThreshold: options.volumeThreshold || 10, // minimum requests
      sleepWindow: options.sleepWindow || 5000,
      timeout: options.timeout || 3000,
      ...options
    };

    this.state = 'CLOSED';
    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      shortCircuits: 0
    };
    
    this.resetMetricsInterval = setInterval(
      () => this.resetMetrics(),
      options.metricsWindow || 10000
    );
  }

  async execute(fn, fallback) {
    if (this.isOpen()) {
      this.metrics.shortCircuits++;
      if (fallback) return fallback();
      throw new Error('Circuit is OPEN');
    }

    this.metrics.requests++;
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        this.createTimeout()
      ]);
      
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordFailure(error);
      
      if (fallback) return fallback();
      throw error;
    }
  }

  createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        this.metrics.timeouts++;
        reject(new Error('Timeout'));
      }, this.options.timeout);
    });
  }

  isOpen() {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.options.sleepWindow) {
        this.state = 'HALF-OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(latency) {
    this.metrics.successes++;
    
    if (this.state === 'HALF-OPEN') {
      this.state = 'CLOSED';
      console.log(`Circuit ${this.name} CLOSED`);
    }
  }

  recordFailure(error) {
    this.metrics.failures++;
    
    if (this.shouldTrip()) {
      this.trip();
    }
  }

  shouldTrip() {
    if (this.metrics.requests < this.options.volumeThreshold) {
      return false;
    }
    
    const failureRate = (this.metrics.failures / this.metrics.requests) * 100;
    return failureRate >= this.options.failureThreshold;
  }

  trip() {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    console.log(`Circuit ${this.name} OPENED`);
  }

  resetMetrics() {
    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      shortCircuits: this.metrics.shortCircuits
    };
  }

  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      ...this.metrics,
      failureRate: this.metrics.requests > 0 
        ? (this.metrics.failures / this.metrics.requests * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// Usage
const paymentCircuit = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
  timeout: 5000
});

async function processPayment(paymentData) {
  return paymentCircuit.execute(
    () => paymentService.charge(paymentData),
    () => ({ queued: true, message: 'Payment queued for processing' })
  );
}
```

---

### Q7: Implement a Plugin Architecture in Node.js.

**Answer:**

```javascript
// Plugin Manager
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.context = {};
  }

  // Register a hook point
  registerHook(hookName) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
  }

  // Plugin registration
  async register(plugin) {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} already registered`);
    }

    // Validate plugin
    if (!plugin.name || !plugin.version) {
      throw new Error('Plugin must have name and version');
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }
    }

    // Initialize plugin
    if (plugin.init) {
      await plugin.init(this.context);
    }

    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        this.addHookHandler(hookName, handler, plugin.name);
      }
    }

    this.plugins.set(plugin.name, plugin);
    console.log(`Plugin ${plugin.name}@${plugin.version} registered`);
  }

  addHookHandler(hookName, handler, pluginName) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push({
      handler,
      pluginName
    });
  }

  // Execute hook (waterfall - pass result to next handler)
  async executeHook(hookName, initialValue) {
    const handlers = this.hooks.get(hookName) || [];
    let result = initialValue;

    for (const { handler, pluginName } of handlers) {
      try {
        result = await handler(result, this.context);
      } catch (error) {
        console.error(`Error in plugin ${pluginName} hook ${hookName}:`, error);
        throw error;
      }
    }

    return result;
  }

  // Execute hook (parallel)
  async executeHookParallel(hookName, data) {
    const handlers = this.hooks.get(hookName) || [];
    
    return Promise.all(
      handlers.map(({ handler }) => handler(data, this.context))
    );
  }

  // Unregister plugin
  async unregister(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return;

    // Remove hooks
    for (const [hookName, handlers] of this.hooks) {
      this.hooks.set(
        hookName,
        handlers.filter(h => h.pluginName !== pluginName)
      );
    }

    // Cleanup
    if (plugin.destroy) {
      await plugin.destroy(this.context);
    }

    this.plugins.delete(pluginName);
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  listPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description
    }));
  }
}

// Example Plugins
const loggingPlugin = {
  name: 'logging',
  version: '1.0.0',
  description: 'Request/response logging',
  
  init(context) {
    context.logger = {
      log: (...args) => console.log('[LOG]', ...args),
      error: (...args) => console.error('[ERROR]', ...args)
    };
  },
  
  hooks: {
    'request:before': async (req, ctx) => {
      ctx.logger.log(`${req.method} ${req.url}`);
      req.startTime = Date.now();
      return req;
    },
    'request:after': async (res, ctx) => {
      const duration = Date.now() - res.req.startTime;
      ctx.logger.log(`Response: ${res.statusCode} (${duration}ms)`);
      return res;
    }
  }
};

const authenticationPlugin = {
  name: 'authentication',
  version: '1.0.0',
  description: 'JWT authentication',
  dependencies: ['logging'],
  
  init(context) {
    context.auth = {
      verify: (token) => jwt.verify(token, process.env.JWT_SECRET)
    };
  },
  
  hooks: {
    'request:before': async (req, ctx) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          req.user = ctx.auth.verify(token);
        } catch (error) {
          ctx.logger.error('Auth failed:', error.message);
        }
      }
      return req;
    }
  }
};

// Usage
const pluginManager = new PluginManager();

// Register hooks
pluginManager.registerHook('request:before');
pluginManager.registerHook('request:after');
pluginManager.registerHook('response:transform');

// Register plugins
await pluginManager.register(loggingPlugin);
await pluginManager.register(authenticationPlugin);

// In request handler
app.use(async (req, res, next) => {
  req = await pluginManager.executeHook('request:before', req);
  next();
});
```

---

### Q8: Implement Domain-Driven Design (DDD) concepts in Node.js.

**Answer:**

```javascript
// Value Object - Immutable
class Email {
  constructor(value) {
    if (!Email.isValid(value)) {
      throw new Error('Invalid email format');
    }
    this._value = value.toLowerCase();
    Object.freeze(this);
  }

  static isValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  get value() {
    return this._value;
  }

  equals(other) {
    if (!(other instanceof Email)) return false;
    return this._value === other._value;
  }

  toString() {
    return this._value;
  }
}

class Money {
  constructor(amount, currency) {
    this._amount = Math.round(amount * 100) / 100;
    this._currency = currency.toUpperCase();
    Object.freeze(this);
  }

  get amount() { return this._amount; }
  get currency() { return this._currency; }

  add(other) {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other) {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  multiply(factor) {
    return new Money(this._amount * factor, this._currency);
  }

  assertSameCurrency(other) {
    if (this._currency !== other._currency) {
      throw new Error('Currency mismatch');
    }
  }

  equals(other) {
    return this._amount === other._amount && this._currency === other._currency;
  }
}

// Entity - Has identity
class User {
  constructor(id, props) {
    this._id = id;
    this._email = new Email(props.email);
    this._name = props.name;
    this._createdAt = props.createdAt || new Date();
  }

  get id() { return this._id; }
  get email() { return this._email; }
  get name() { return this._name; }

  changeName(newName) {
    if (!newName || newName.length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    this._name = newName;
  }

  changeEmail(newEmail) {
    this._email = new Email(newEmail);
  }

  equals(other) {
    if (!(other instanceof User)) return false;
    return this._id === other._id;
  }
}

// Aggregate Root
class Order {
  constructor(id, customerId) {
    this._id = id;
    this._customerId = customerId;
    this._items = [];
    this._status = 'draft';
    this._total = new Money(0, 'USD');
    this._domainEvents = [];
  }

  // Only aggregate root can modify its entities
  addItem(product, quantity) {
    this.assertDraftStatus();
    
    const existingItem = this._items.find(i => i.productId === product.id);
    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      this._items.push(new OrderItem(product.id, product.price, quantity));
    }
    
    this.recalculateTotal();
  }

  removeItem(productId) {
    this.assertDraftStatus();
    this._items = this._items.filter(i => i.productId !== productId);
    this.recalculateTotal();
  }

  confirm() {
    this.assertDraftStatus();
    
    if (this._items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }

    this._status = 'confirmed';
    this.addDomainEvent(new OrderConfirmedEvent(this._id, this._customerId, this._total));
  }

  cancel() {
    if (this._status === 'shipped') {
      throw new Error('Cannot cancel shipped order');
    }
    
    this._status = 'cancelled';
    this.addDomainEvent(new OrderCancelledEvent(this._id));
  }

  assertDraftStatus() {
    if (this._status !== 'draft') {
      throw new Error('Order can only be modified in draft status');
    }
  }

  recalculateTotal() {
    this._total = this._items.reduce(
      (sum, item) => sum.add(item.subtotal),
      new Money(0, 'USD')
    );
  }

  addDomainEvent(event) {
    this._domainEvents.push(event);
  }

  pullDomainEvents() {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  get id() { return this._id; }
  get items() { return [...this._items]; }
  get status() { return this._status; }
  get total() { return this._total; }
}

// Entity within Aggregate
class OrderItem {
  constructor(productId, unitPrice, quantity) {
    this._productId = productId;
    this._unitPrice = unitPrice;
    this._quantity = quantity;
  }

  get productId() { return this._productId; }
  get quantity() { return this._quantity; }
  get subtotal() { return this._unitPrice.multiply(this._quantity); }

  increaseQuantity(amount) {
    this._quantity += amount;
  }
}

// Domain Service
class OrderPricingService {
  constructor(discountRepository, taxService) {
    this.discountRepository = discountRepository;
    this.taxService = taxService;
  }

  async calculateFinalPrice(order, customer) {
    let total = order.total;

    // Apply customer discounts
    const discounts = await this.discountRepository.getForCustomer(customer.id);
    for (const discount of discounts) {
      total = discount.apply(total);
    }

    // Apply taxes
    const tax = await this.taxService.calculate(total, customer.address);
    total = total.add(tax);

    return total;
  }
}

// Domain Events
class OrderConfirmedEvent {
  constructor(orderId, customerId, total) {
    this.type = 'OrderConfirmed';
    this.orderId = orderId;
    this.customerId = customerId;
    this.total = total;
    this.occurredAt = new Date();
  }
}

// Application Service (Use Case)
class CreateOrderUseCase {
  constructor(orderRepository, customerRepository, eventPublisher) {
    this.orderRepository = orderRepository;
    this.customerRepository = customerRepository;
    this.eventPublisher = eventPublisher;
  }

  async execute(command) {
    const customer = await this.customerRepository.findById(command.customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const order = new Order(generateId(), customer.id);

    for (const item of command.items) {
      order.addItem(item.product, item.quantity);
    }

    order.confirm();

    await this.orderRepository.save(order);

    // Publish domain events
    for (const event of order.pullDomainEvents()) {
      await this.eventPublisher.publish(event);
    }

    return order;
  }
}
```

---

### Q9: How do you implement API versioning strategies?

**Answer:**

```javascript
const express = require('express');
const app = express();

// Strategy 1: URL Path Versioning
// /api/v1/users, /api/v2/users
const v1Router = express.Router();
const v2Router = express.Router();

v1Router.get('/users', (req, res) => {
  res.json({ version: 'v1', users: [] });
});

v2Router.get('/users', (req, res) => {
  res.json({ 
    version: 'v2', 
    data: { users: [] },
    pagination: { page: 1, total: 0 }
  });
});

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Strategy 2: Header Versioning
// Accept: application/vnd.myapp.v1+json
const versionMiddleware = (req, res, next) => {
  const accept = req.headers['accept'] || '';
  const match = accept.match(/application\/vnd\.myapp\.v(\d+)\+json/);
  
  req.apiVersion = match ? parseInt(match[1]) : 1; // Default to v1
  next();
};

app.use(versionMiddleware);

app.get('/api/users', (req, res) => {
  if (req.apiVersion === 2) {
    return res.json({ version: 'v2', data: { users: [] } });
  }
  res.json({ version: 'v1', users: [] });
});

// Strategy 3: Query Parameter Versioning
// /api/users?version=2
app.get('/api/users', (req, res) => {
  const version = parseInt(req.query.version) || 1;
  
  switch (version) {
    case 2:
      return res.json({ version: 'v2', data: { users: [] } });
    default:
      return res.json({ version: 'v1', users: [] });
  }
});

// Strategy 4: Custom Header Versioning
// X-API-Version: 2
app.use((req, res, next) => {
  req.apiVersion = parseInt(req.headers['x-api-version']) || 1;
  next();
});

// Advanced: Version-aware Controller Factory
class VersionedController {
  static create(versions) {
    return async (req, res, next) => {
      const version = req.apiVersion;
      const handler = versions[`v${version}`] || versions.default;
      
      if (!handler) {
        return res.status(400).json({ error: 'Unsupported API version' });
      }
      
      return handler(req, res, next);
    };
  }
}

// Usage
app.get('/api/users', VersionedController.create({
  v1: async (req, res) => {
    const users = await UserService.getAllV1();
    res.json({ users });
  },
  v2: async (req, res) => {
    const { users, meta } = await UserService.getAllV2(req.query);
    res.json({ data: users, meta });
  },
  default: 'v1' // Fallback to v1
}));

// Response Transformer for backward compatibility
class ResponseTransformer {
  static transform(data, version) {
    const transformers = {
      v1: this.toV1,
      v2: this.toV2
    };
    
    return (transformers[`v${version}`] || transformers.v2)(data);
  }

  static toV1(data) {
    // Transform to v1 format
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id,
        name: `${item.firstName} ${item.lastName}`,
        email: item.email
      }));
    }
    return data;
  }

  static toV2(data) {
    // Transform to v2 format
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        metadata: {
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }
      }));
    }
    return data;
  }
}

// Versioned API Documentation
const apiVersions = {
  v1: {
    deprecated: true,
    deprecationDate: '2024-06-01',
    sunsetDate: '2025-01-01'
  },
  v2: {
    current: true
  }
};

app.use((req, res, next) => {
  const version = `v${req.apiVersion}`;
  const info = apiVersions[version];
  
  if (info?.deprecated) {
    res.set('Deprecation', info.deprecationDate);
    res.set('Sunset', info.sunsetDate);
    res.set('Link', '</api/v2>; rel="successor-version"');
  }
  
  next();
});
```

---

### Q10: How do you implement a caching strategy with multiple layers?

**Answer:**

```javascript
// Multi-layer Cache Implementation
class CacheManager {
  constructor(layers = []) {
    this.layers = layers; // Ordered from fastest to slowest
  }

  async get(key) {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const value = await layer.get(key);
      
      if (value !== null && value !== undefined) {
        // Populate faster caches
        for (let j = 0; j < i; j++) {
          await this.layers[j].set(key, value, layer.getTTL?.(key));
        }
        return value;
      }
    }
    return null;
  }

  async set(key, value, ttl) {
    // Set in all layers
    await Promise.all(
      this.layers.map(layer => layer.set(key, value, ttl))
    );
  }

  async delete(key) {
    await Promise.all(
      this.layers.map(layer => layer.delete(key))
    );
  }

  async getOrSet(key, factory, ttl) {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }
}

// L1 Cache - In-memory (fastest)
class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 60000; // 1 minute
  }

  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // LRU: Move to end
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  async set(key, value, ttl = this.defaultTTL) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  async delete(key) {
    this.cache.delete(key);
  }
}

// L2 Cache - Redis (distributed)
class RedisCache {
  constructor(redisClient) {
    this.client = redisClient;
    this.defaultTTL = 300; // 5 minutes
  }

  async get(key) {
    const data = await this.client.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set(key, value, ttl = this.defaultTTL) {
    await this.client.setex(
      `cache:${key}`,
      Math.floor(ttl / 1000),
      JSON.stringify(value)
    );
  }

  async delete(key) {
    await this.client.del(`cache:${key}`);
  }

  async invalidatePattern(pattern) {
    const keys = await this.client.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

// Cache Decorator for Services
function Cacheable(keyGenerator, ttl = 60000) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const cacheKey = keyGenerator(...args);
      
      return this.cacheManager.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        ttl
      );
    };

    return descriptor;
  };
}

// Cache-Aside Pattern with Write-Through
class CachedRepository {
  constructor(repository, cacheManager, options = {}) {
    this.repository = repository;
    this.cache = cacheManager;
    this.keyPrefix = options.keyPrefix || '';
    this.ttl = options.ttl || 300000;
  }

  getKey(id) {
    return `${this.keyPrefix}:${id}`;
  }

  async findById(id) {
    const key = this.getKey(id);
    
    return this.cache.getOrSet(
      key,
      () => this.repository.findById(id),
      this.ttl
    );
  }

  async findAll(filters) {
    const key = `${this.keyPrefix}:list:${JSON.stringify(filters)}`;
    
    return this.cache.getOrSet(
      key,
      () => this.repository.findAll(filters),
      this.ttl / 2 // Shorter TTL for lists
    );
  }

  async create(data) {
    const entity = await this.repository.create(data);
    await this.cache.set(this.getKey(entity.id), entity, this.ttl);
    await this.invalidateLists();
    return entity;
  }

  async update(id, data) {
    const entity = await this.repository.update(id, data);
    await this.cache.set(this.getKey(id), entity, this.ttl);
    await this.invalidateLists();
    return entity;
  }

  async delete(id) {
    await this.repository.delete(id);
    await this.cache.delete(this.getKey(id));
    await this.invalidateLists();
  }

  async invalidateLists() {
    // Invalidate all list caches
    await this.cache.layers[1]?.invalidatePattern(`${this.keyPrefix}:list:*`);
  }
}

// Usage
const memoryCache = new MemoryCache({ maxSize: 500, defaultTTL: 30000 });
const redisCache = new RedisCache(redisClient);

const cacheManager = new CacheManager([memoryCache, redisCache]);

const userRepository = new CachedRepository(
  new UserRepository(db),
  cacheManager,
  { keyPrefix: 'user', ttl: 300000 }
);
```

---

### Q11: Implement Dependency Injection Container with advanced features.

**Answer:**

```javascript
class Container {
  constructor() {
    this.services = new Map();
    this.instances = new Map();
    this.factories = new Map();
    this.tags = new Map();
    this.scopes = new Map();
  }

  // Register service
  register(name, definition) {
    this.services.set(name, {
      class: definition.class,
      factory: definition.factory,
      dependencies: definition.dependencies || [],
      lifecycle: definition.lifecycle || 'transient', // transient, singleton, scoped
      tags: definition.tags || []
    });

    // Register tags
    for (const tag of definition.tags || []) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, []);
      }
      this.tags.get(tag).push(name);
    }

    return this;
  }

  // Resolve service
  resolve(name, scope = null) {
    const definition = this.services.get(name);
    if (!definition) {
      throw new Error(`Service '${name}' not registered`);
    }

    // Check lifecycle
    if (definition.lifecycle === 'singleton') {
      if (this.instances.has(name)) {
        return this.instances.get(name);
      }
    }

    if (definition.lifecycle === 'scoped' && scope) {
      const scopeKey = `${scope}:${name}`;
      if (this.scopes.has(scopeKey)) {
        return this.scopes.get(scopeKey);
      }
    }

    // Create instance
    const instance = this.createInstance(definition, scope);

    // Store based on lifecycle
    if (definition.lifecycle === 'singleton') {
      this.instances.set(name, instance);
    } else if (definition.lifecycle === 'scoped' && scope) {
      this.scopes.set(`${scope}:${name}`, instance);
    }

    return instance;
  }

  createInstance(definition, scope) {
    const dependencies = definition.dependencies.map(dep => 
      this.resolve(dep, scope)
    );

    if (definition.factory) {
      return definition.factory(this, ...dependencies);
    }

    return new definition.class(...dependencies);
  }

  // Get all services by tag
  getByTag(tag) {
    const names = this.tags.get(tag) || [];
    return names.map(name => this.resolve(name));
  }

  // Create child container
  createChild() {
    const child = new Container();
    child.parent = this;
    return child;
  }

  // Create scope
  createScope() {
    return Symbol('scope');
  }

  // Clear scope
  clearScope(scope) {
    for (const key of this.scopes.keys()) {
      if (key.startsWith(`${scope.toString()}:`)) {
        this.scopes.delete(key);
      }
    }
  }

  // Auto-wiring based on constructor parameter names
  autoResolve(Class) {
    const paramNames = this.getConstructorParams(Class);
    const dependencies = paramNames.map(name => {
      if (this.services.has(name)) {
        return this.resolve(name);
      }
      throw new Error(`Cannot auto-resolve dependency '${name}'`);
    });
    return new Class(...dependencies);
  }

  getConstructorParams(Class) {
    const match = Class.toString().match(/constructor\s*\(([^)]*)\)/);
    if (!match) return [];
    return match[1]
      .split(',')
      .map(p => p.trim())
      .filter(p => p);
  }
}

// Decorators for DI
function Injectable(options = {}) {
  return function(target) {
    target.$$injectable = {
      lifecycle: options.lifecycle || 'transient',
      tags: options.tags || []
    };
    return target;
  };
}

function Inject(serviceName) {
  return function(target, propertyKey, parameterIndex) {
    if (!target.$$inject) {
      target.$$inject = [];
    }
    target.$$inject[parameterIndex] = serviceName;
  };
}

// Auto-registration from decorated classes
class ContainerBuilder {
  constructor() {
    this.container = new Container();
  }

  register(name, Class) {
    const meta = Class.$$injectable || {};
    const inject = Class.$$inject || [];

    this.container.register(name, {
      class: Class,
      dependencies: inject,
      lifecycle: meta.lifecycle,
      tags: meta.tags
    });

    return this;
  }

  build() {
    return this.container;
  }
}

// Usage
@Injectable({ lifecycle: 'singleton' })
class Logger {
  log(msg) { console.log(msg); }
}

@Injectable({ lifecycle: 'transient' })
class UserRepository {
  constructor(@Inject('database') db) {
    this.db = db;
  }
}

@Injectable()
class UserService {
  constructor(
    @Inject('userRepository') userRepository,
    @Inject('logger') logger
  ) {
    this.userRepository = userRepository;
    this.logger = logger;
  }
}

const container = new ContainerBuilder()
  .register('logger', Logger)
  .register('database', Database)
  .register('userRepository', UserRepository)
  .register('userService', UserService)
  .build();

const userService = container.resolve('userService');
```

---

### Q12: How do you implement feature flags in a Node.js application?

**Answer:**

```javascript
// Feature Flag Service
class FeatureFlagService {
  constructor(options = {}) {
    this.flags = new Map();
    this.evaluators = new Map();
    this.defaultValue = options.defaultValue ?? false;
    this.cache = options.cache;
    this.refreshInterval = options.refreshInterval || 60000;
    this.subscribers = new Map();
  }

  async initialize(configSource) {
    this.configSource = configSource;
    await this.refresh();
    
    // Periodic refresh
    setInterval(() => this.refresh(), this.refreshInterval);
  }

  async refresh() {
    const config = await this.configSource.getFlags();
    
    for (const [key, flag] of Object.entries(config)) {
      const oldFlag = this.flags.get(key);
      this.flags.set(key, flag);
      
      // Notify subscribers of changes
      if (JSON.stringify(oldFlag) !== JSON.stringify(flag)) {
        this.notifySubscribers(key, flag);
      }
    }
  }

  // Check if feature is enabled
  isEnabled(flagKey, context = {}) {
    const flag = this.flags.get(flagKey);
    
    if (!flag) {
      return this.defaultValue;
    }

    // Simple on/off
    if (typeof flag === 'boolean') {
      return flag;
    }

    // Complex rules
    return this.evaluate(flag, context);
  }

  evaluate(flag, context) {
    // Check kill switch
    if (flag.enabled === false) {
      return false;
    }

    // Check targeting rules
    if (flag.rules) {
      for (const rule of flag.rules) {
        if (this.matchesRule(rule, context)) {
          return rule.enabled ?? true;
        }
      }
    }

    // Percentage rollout
    if (flag.percentage !== undefined) {
      const bucket = this.getBucket(context.userId || context.sessionId);
      return bucket < flag.percentage;
    }

    // Default behavior
    return flag.enabled ?? this.defaultValue;
  }

  matchesRule(rule, context) {
    for (const [key, condition] of Object.entries(rule.conditions)) {
      const value = context[key];
      
      if (!this.matchesCondition(value, condition)) {
        return false;
      }
    }
    return true;
  }

  matchesCondition(value, condition) {
    if (typeof condition === 'object') {
      if (condition.in) return condition.in.includes(value);
      if (condition.notIn) return !condition.notIn.includes(value);
      if (condition.gt) return value > condition.gt;
      if (condition.gte) return value >= condition.gte;
      if (condition.lt) return value < condition.lt;
      if (condition.lte) return value <= condition.lte;
      if (condition.regex) return new RegExp(condition.regex).test(value);
    }
    return value === condition;
  }

  getBucket(identifier) {
    // Consistent hashing for percentage rollout
    const hash = this.hashString(String(identifier));
    return hash % 100;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Subscribe to flag changes
  subscribe(flagKey, callback) {
    if (!this.subscribers.has(flagKey)) {
      this.subscribers.set(flagKey, []);
    }
    this.subscribers.get(flagKey).push(callback);
    
    return () => {
      const callbacks = this.subscribers.get(flagKey);
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    };
  }

  notifySubscribers(flagKey, flag) {
    const callbacks = this.subscribers.get(flagKey) || [];
    for (const callback of callbacks) {
      callback(flag);
    }
  }

  // Get all enabled flags for context
  getEnabledFlags(context = {}) {
    const enabled = {};
    for (const [key] of this.flags) {
      if (this.isEnabled(key, context)) {
        enabled[key] = true;
      }
    }
    return enabled;
  }
}

// Express Middleware
function featureFlagMiddleware(featureFlagService) {
  return (req, res, next) => {
    req.featureFlags = {
      isEnabled: (flag) => featureFlagService.isEnabled(flag, {
        userId: req.user?.id,
        sessionId: req.sessionID,
        userAgent: req.headers['user-agent'],
        country: req.headers['cf-ipcountry'],
        ...req.user
      }),
      getAll: () => featureFlagService.getEnabledFlags({
        userId: req.user?.id
      })
    };
    next();
  };
}

// Config Sources
class DatabaseFlagSource {
  constructor(db) {
    this.db = db;
  }

  async getFlags() {
    const flags = await this.db.collection('feature_flags').find({}).toArray();
    return flags.reduce((acc, flag) => {
      acc[flag.key] = flag.config;
      return acc;
    }, {});
  }
}

class RemoteFlagSource {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  async getFlags() {
    const response = await fetch(this.apiUrl);
    return response.json();
  }
}

// Usage
const featureFlags = new FeatureFlagService({
  defaultValue: false,
  refreshInterval: 30000
});

await featureFlags.initialize(new DatabaseFlagSource(db));

app.use(featureFlagMiddleware(featureFlags));

app.get('/api/checkout', (req, res) => {
  if (req.featureFlags.isEnabled('new-checkout-flow')) {
    return newCheckoutHandler(req, res);
  }
  return legacyCheckoutHandler(req, res);
});

// Example flag configurations
const flagConfigs = {
  'new-checkout': {
    enabled: true,
    percentage: 25, // 25% rollout
    rules: [
      {
        conditions: { country: 'US' },
        enabled: true,
        percentage: 50
      },
      {
        conditions: { userType: 'premium' },
        enabled: true
      }
    ]
  },
  'dark-mode': {
    enabled: true,
    rules: [
      {
        conditions: { userId: { in: ['admin1', 'admin2'] } },
        enabled: true
      }
    ]
  }
};
```

---

## Performance & Optimization

### Q13: How do you profile and optimize memory usage in Node.js?

**Answer:**

```javascript
// Memory monitoring utilities
const v8 = require('v8');
const process = require('process');

// Get heap statistics
function getHeapStats() {
  const stats = v8.getHeapStatistics();
  return {
    totalHeapSize: formatBytes(stats.total_heap_size),
    usedHeapSize: formatBytes(stats.used_heap_size),
    heapSizeLimit: formatBytes(stats.heap_size_limit),
    externalMemory: formatBytes(stats.external_memory),
    mallocedMemory: formatBytes(stats.malloced_memory)
  };
}

// Get process memory usage
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: formatBytes(usage.rss), // Resident Set Size
    heapTotal: formatBytes(usage.heapTotal),
    heapUsed: formatBytes(usage.heapUsed),
    external: formatBytes(usage.external),
    arrayBuffers: formatBytes(usage.arrayBuffers)
  };
}

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Memory leak detection
class MemoryMonitor {
  constructor(options = {}) {
    this.sampleInterval = options.sampleInterval || 5000;
    this.samples = [];
    this.maxSamples = options.maxSamples || 100;
    this.threshold = options.threshold || 0.1; // 10% growth
  }

  start() {
    this.intervalId = setInterval(() => {
      this.takeSample();
      this.analyzeForLeaks();
    }, this.sampleInterval);
  }

  stop() {
    clearInterval(this.intervalId);
  }

  takeSample() {
    const usage = process.memoryUsage();
    this.samples.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      external: usage.external
    });

    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  analyzeForLeaks() {
    if (this.samples.length < 10) return;

    const recent = this.samples.slice(-10);
    const firstHeap = recent[0].heapUsed;
    const lastHeap = recent[recent.length - 1].heapUsed;
    const growth = (lastHeap - firstHeap) / firstHeap;

    if (growth > this.threshold) {
      console.warn('Potential memory leak detected!', {
        growth: `${(growth * 100).toFixed(2)}%`,
        currentHeap: formatBytes(lastHeap),
        samples: recent.length
      });
      
      // Trigger heap snapshot
      this.captureHeapSnapshot();
    }
  }

  captureHeapSnapshot() {
    const { writeHeapSnapshot } = require('v8');
    const filename = writeHeapSnapshot();
    console.log(`Heap snapshot written to ${filename}`);
    return filename;
  }
}

// Common memory leak patterns and fixes

// 1. Event listener leaks
class EventEmitterWithCleanup extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.listenerRefs = new WeakMap();
  }

  addManagedListener(event, listener, owner) {
    this.on(event, listener);
    
    if (!this.listenerRefs.has(owner)) {
      this.listenerRefs.set(owner, []);
    }
    this.listenerRefs.get(owner).push({ event, listener });
  }

  removeAllListenersFor(owner) {
    const listeners = this.listenerRefs.get(owner) || [];
    for (const { event, listener } of listeners) {
      this.removeListener(event, listener);
    }
    this.listenerRefs.delete(owner);
  }
}

// 2. Closure memory leaks
// Bad - holds reference to large data
function createProcessor(largeData) {
  return function process(item) {
    // largeData is captured in closure even if not used
    return item * 2;
  };
}

// Good - don't capture what you don't need
function createProcessor() {
  return function process(item) {
    return item * 2;
  };
}

// 3. Cache without bounds
// Bad
const cache = {};
function cachedFetch(key) {
  if (!cache[key]) {
    cache[key] = fetchData(key); // Grows unbounded
  }
  return cache[key];
}

// Good - LRU cache with size limit
const LRU = require('lru-cache');
const cache = new LRU({
  max: 500,
  maxAge: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true
});

// 4. Streaming large datasets
// Bad - loads all into memory
async function processAllRecords() {
  const records = await db.findAll(); // Could be millions
  return records.map(transform);
}

// Good - stream processing
async function* streamRecords() {
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const batch = await db.find({}).skip(offset).limit(limit);
    if (batch.length === 0) break;
    
    for (const record of batch) {
      yield record;
    }
    offset += limit;
  }
}

async function processAllRecords() {
  for await (const record of streamRecords()) {
    await processRecord(record);
  }
}

// Memory usage in Express endpoint
app.get('/health/memory', (req, res) => {
  res.json({
    memory: getMemoryUsage(),
    heap: getHeapStats(),
    uptime: process.uptime()
  });
});
```

---

### Q14: How do you implement connection pooling effectively?

**Answer:**

```javascript
// Generic Connection Pool
class ConnectionPool {
  constructor(options) {
    this.factory = options.factory;
    this.min = options.min || 2;
    this.max = options.max || 10;
    this.acquireTimeout = options.acquireTimeout || 30000;
    this.idleTimeout = options.idleTimeout || 30000;
    this.validateOnBorrow = options.validateOnBorrow ?? true;

    this.pool = [];
    this.waitQueue = [];
    this.inUse = new Set();
    this.stats = {
      acquired: 0,
      released: 0,
      created: 0,
      destroyed: 0,
      waiting: 0
    };

    this.initialize();
  }

  async initialize() {
    // Pre-warm the pool
    for (let i = 0; i < this.min; i++) {
      const conn = await this.createConnection();
      this.pool.push(conn);
    }
  }

  async createConnection() {
    const connection = await this.factory.create();
    this.stats.created++;
    
    connection.$$poolMeta = {
      createdAt: Date.now(),
      lastUsedAt: Date.now()
    };
    
    return connection;
  }

  async acquire() {
    // Try to get from pool
    while (this.pool.length > 0) {
      const conn = this.pool.pop();
      
      // Validate connection
      if (this.validateOnBorrow) {
        const isValid = await this.factory.validate(conn);
        if (!isValid) {
          await this.destroy(conn);
          continue;
        }
      }
      
      this.inUse.add(conn);
      this.stats.acquired++;
      conn.$$poolMeta.lastUsedAt = Date.now();
      return conn;
    }

    // Create new if under limit
    if (this.inUse.size < this.max) {
      const conn = await this.createConnection();
      this.inUse.add(conn);
      this.stats.acquired++;
      return conn;
    }

    // Wait for available connection
    return this.waitForConnection();
  }

  waitForConnection() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (index > -1) this.waitQueue.splice(index, 1);
        reject(new Error('Acquire timeout'));
      }, this.acquireTimeout);

      this.waitQueue.push({
        resolve: (conn) => {
          clearTimeout(timer);
          resolve(conn);
        },
        reject,
        queuedAt: Date.now()
      });

      this.stats.waiting = this.waitQueue.length;
    });
  }

  release(connection) {
    if (!this.inUse.has(connection)) {
      console.warn('Connection not in use');
      return;
    }

    this.inUse.delete(connection);
    connection.$$poolMeta.lastUsedAt = Date.now();
    this.stats.released++;

    // Fulfill waiting request
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      this.inUse.add(connection);
      waiter.resolve(connection);
      this.stats.waiting = this.waitQueue.length;
      return;
    }

    // Return to pool
    this.pool.push(connection);
  }

  async destroy(connection) {
    this.inUse.delete(connection);
    await this.factory.destroy(connection);
    this.stats.destroyed++;
  }

  async drain() {
    // Close all connections
    for (const conn of this.pool) {
      await this.destroy(conn);
    }
    for (const conn of this.inUse) {
      await this.destroy(conn);
    }
    this.pool = [];
    this.inUse.clear();
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      available: this.pool.length,
      waiting: this.waitQueue.length
    };
  }

  // Wrapper for automatic release
  async withConnection(fn) {
    const conn = await this.acquire();
    try {
      return await fn(conn);
    } finally {
      this.release(conn);
    }
  }
}

// PostgreSQL Pool Configuration
const { Pool } = require('pg');

const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Pool configuration
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500, // Close connection after N uses
  
  // Connection options
  statement_timeout: 30000,
  query_timeout: 30000,
  application_name: 'my-app'
});

// Pool event handling
pgPool.on('connect', (client) => {
  console.log('New client connected');
});

pgPool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

pgPool.on('remove', (client) => {
  console.log('Client removed from pool');
});

// Redis Connection Pool
const Redis = require('ioredis');
const GenericPool = require('generic-pool');

const redisFactory = {
  create: async () => {
    const client = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      enableReadyCheck: true,
      lazyConnect: true
    });
    await client.connect();
    return client;
  },
  destroy: async (client) => {
    await client.quit();
  },
  validate: async (client) => {
    try {
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }
};

const redisPool = GenericPool.createPool(redisFactory, {
  min: 2,
  max: 10,
  acquireTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  testOnBorrow: true
});

// Usage
async function getCachedData(key) {
  const client = await redisPool.acquire();
  try {
    return await client.get(key);
  } finally {
    await redisPool.release(client);
  }
}
```

---

### Q15: How do you implement request batching and data loader pattern?

**Answer:**

```javascript
// DataLoader Implementation
class DataLoader {
  constructor(batchFn, options = {}) {
    this.batchFn = batchFn;
    this.cache = options.cache !== false;
    this.maxBatchSize = options.maxBatchSize || 100;
    this.batchScheduleFn = options.batchScheduleFn || setImmediate;
    
    this.cacheMap = new Map();
    this.batch = null;
  }

  load(key) {
    // Check cache
    if (this.cache && this.cacheMap.has(key)) {
      return this.cacheMap.get(key);
    }

    // Create batch if needed
    if (!this.batch) {
      this.batch = {
        keys: [],
        callbacks: []
      };
      
      this.batchScheduleFn(() => this.dispatchBatch());
    }

    // Add to current batch
    const promise = new Promise((resolve, reject) => {
      this.batch.keys.push(key);
      this.batch.callbacks.push({ resolve, reject });
    });

    // Cache the promise
    if (this.cache) {
      this.cacheMap.set(key, promise);
    }

    // Dispatch if batch is full
    if (this.batch.keys.length >= this.maxBatchSize) {
      this.dispatchBatch();
    }

    return promise;
  }

  loadMany(keys) {
    return Promise.all(keys.map(key => this.load(key)));
  }

  async dispatchBatch() {
    const batch = this.batch;
    this.batch = null;

    if (!batch || batch.keys.length === 0) return;

    try {
      const results = await this.batchFn(batch.keys);

      if (results.length !== batch.keys.length) {
        throw new Error(
          `Batch function must return array of same length as keys. ` +
          `Got ${results.length} results for ${batch.keys.length} keys.`
        );
      }

      for (let i = 0; i < batch.callbacks.length; i++) {
        const result = results[i];
        if (result instanceof Error) {
          batch.callbacks[i].reject(result);
        } else {
          batch.callbacks[i].resolve(result);
        }
      }
    } catch (error) {
      for (const callback of batch.callbacks) {
        callback.reject(error);
      }
    }
  }

  clear(key) {
    this.cacheMap.delete(key);
    return this;
  }

  clearAll() {
    this.cacheMap.clear();
    return this;
  }

  prime(key, value) {
    if (!this.cacheMap.has(key)) {
      this.cacheMap.set(key, Promise.resolve(value));
    }
    return this;
  }
}

// Usage with database
async function batchGetUsers(userIds) {
  const users = await db.query(
    'SELECT * FROM users WHERE id = ANY($1)',
    [userIds]
  );
  
  // Return in same order as requested
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) || null);
}

const userLoader = new DataLoader(batchGetUsers);

// GraphQL resolver usage
const resolvers = {
  Post: {
    author: async (post) => {
      // These will be batched!
      return userLoader.load(post.authorId);
    }
  },
  Comment: {
    author: async (comment) => {
      return userLoader.load(comment.authorId);
    }
  }
};

// Request-scoped loaders
function createLoaders() {
  return {
    users: new DataLoader(batchGetUsers),
    posts: new DataLoader(batchGetPosts),
    comments: new DataLoader(batchGetComments)
  };
}

// Express middleware
app.use((req, res, next) => {
  req.loaders = createLoaders();
  next();
});

// Batching HTTP requests
class RequestBatcher {
  constructor(options = {}) {
    this.batchWindow = options.batchWindow || 10; // ms
    this.maxBatchSize = options.maxBatchSize || 50;
    this.batch = null;
  }

  add(request) {
    if (!this.batch) {
      this.batch = {
        requests: [],
        promise: null
      };

      this.batch.promise = new Promise((resolve) => {
        setTimeout(() => {
          this.flush().then(resolve);
        }, this.batchWindow);
      });
    }

    const index = this.batch.requests.length;
    this.batch.requests.push(request);

    return this.batch.promise.then(results => results[index]);
  }

  async flush() {
    const batch = this.batch;
    this.batch = null;

    if (!batch || batch.requests.length === 0) {
      return [];
    }

    // Send batch request
    const response = await fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: batch.requests })
    });

    return response.json();
  }
}

// Server-side batch endpoint
app.post('/api/batch', async (req, res) => {
  const { requests } = req.body;
  
  const results = await Promise.all(
    requests.map(async (request) => {
      try {
        // Route to appropriate handler
        const handler = getHandler(request.method, request.path);
        return await handler(request.body);
      } catch (error) {
        return { error: error.message };
      }
    })
  );
  
  res.json(results);
});
```

---

### Q16: How do you implement efficient pagination for large datasets?

**Answer:**

```javascript
// Cursor-based pagination (recommended for large datasets)
class CursorPaginator {
  constructor(model, options = {}) {
    this.model = model;
    this.defaultLimit = options.defaultLimit || 20;
    this.maxLimit = options.maxLimit || 100;
    this.cursorField = options.cursorField || '_id';
  }

  encodeCursor(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64');
  }

  decodeCursor(cursor) {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch {
      throw new Error('Invalid cursor');
    }
  }

  async paginate(query = {}, options = {}) {
    const limit = Math.min(
      options.limit || this.defaultLimit,
      this.maxLimit
    );
    const cursor = options.cursor ? this.decodeCursor(options.cursor) : null;
    const direction = options.direction || 'forward';

    let paginatedQuery = { ...query };

    if (cursor) {
      const operator = direction === 'forward' ? '$gt' : '$lt';
      paginatedQuery[this.cursorField] = { [operator]: cursor.value };
    }

    const sortOrder = direction === 'forward' ? 1 : -1;

    const items = await this.model
      .find(paginatedQuery)
      .sort({ [this.cursorField]: sortOrder })
      .limit(limit + 1) // Fetch one extra to check if there are more
      .lean();

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop(); // Remove the extra item
    }

    const edges = items.map(item => ({
      node: item,
      cursor: this.encodeCursor({ value: item[this.cursorField] })
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: direction === 'forward' ? hasMore : cursor !== null,
        hasPreviousPage: direction === 'forward' ? cursor !== null : hasMore,
        startCursor: edges.length > 0 ? edges[0].cursor : null,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
      },
      totalCount: await this.model.countDocuments(query)
    };
  }
}

// Keyset pagination for complex sorting
class KeysetPaginator {
  constructor(model) {
    this.model = model;
  }

  async paginate(query, sort, options) {
    const { limit = 20, after } = options;
    
    // Build keyset conditions
    let keysetConditions = [];
    if (after) {
      const lastItem = await this.model.findById(after).lean();
      if (lastItem) {
        keysetConditions = this.buildKeysetConditions(sort, lastItem);
      }
    }

    const finalQuery = keysetConditions.length > 0
      ? { $and: [query, { $or: keysetConditions }] }
      : query;

    const items = await this.model
      .find(finalQuery)
      .sort(sort)
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    return {
      items,
      hasMore,
      nextCursor: items.length > 0 ? items[items.length - 1]._id : null
    };
  }

  buildKeysetConditions(sort, lastItem) {
    const conditions = [];
    const sortFields = Object.entries(sort);

    for (let i = 0; i < sortFields.length; i++) {
      const condition = {};
      
      // All previous fields must be equal
      for (let j = 0; j < i; j++) {
        const [field] = sortFields[j];
        condition[field] = lastItem[field];
      }
      
      // Current field must be greater/less than
      const [field, direction] = sortFields[i];
      const operator = direction === 1 ? '$gt' : '$lt';
      condition[field] = { [operator]: lastItem[field] };
      
      conditions.push(condition);
    }

    return conditions;
  }
}

// Offset pagination with optimization
class OptimizedOffsetPaginator {
  constructor(model) {
    this.model = model;
  }

  async paginate(query, options) {
    const { page = 1, limit = 20, maxOffset = 10000 } = options;
    const offset = (page - 1) * limit;

    // Prevent slow queries for deep pagination
    if (offset > maxOffset) {
      throw new Error('Offset too large. Use cursor pagination for deep pages.');
    }

    // Parallel execution for count and data
    const [items, totalCount] = await Promise.all([
      this.model
        .find(query)
        .skip(offset)
        .limit(limit)
        .lean(),
      // Use estimated count for very large collections
      totalCount > 10000 
        ? this.model.estimatedDocumentCount()
        : this.model.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }
}

// Streaming pagination for exports
async function* streamPaginate(model, query, options = {}) {
  const { batchSize = 1000, sort = { _id: 1 } } = options;
  let lastId = null;

  while (true) {
    const batchQuery = lastId
      ? { ...query, _id: { $gt: lastId } }
      : query;

    const batch = await model
      .find(batchQuery)
      .sort(sort)
      .limit(batchSize)
      .lean();

    if (batch.length === 0) break;

    for (const item of batch) {
      yield item;
    }

    lastId = batch[batch.length - 1]._id;
  }
}

// Usage
async function exportUsers(query) {
  const writeStream = fs.createWriteStream('users.json');
  writeStream.write('[\n');
  
  let first = true;
  for await (const user of streamPaginate(User, query)) {
    if (!first) writeStream.write(',\n');
    writeStream.write(JSON.stringify(user));
    first = false;
  }
  
  writeStream.write('\n]');
  writeStream.end();
}
```

---

### Q17: How do you implement database query optimization strategies?

**Answer:**

```javascript
// Query Builder with optimization
class QueryOptimizer {
  constructor(model) {
    this.model = model;
    this.queryPlan = {
      select: null,
      where: {},
      sort: null,
      populate: [],
      limit: null,
      skip: null,
      hints: {},
      explain: false
    };
  }

  select(fields) {
    // Only select needed fields
    this.queryPlan.select = Array.isArray(fields) 
      ? fields.join(' ') 
      : fields;
    return this;
  }

  where(conditions) {
    this.queryPlan.where = { ...this.queryPlan.where, ...conditions };
    return this;
  }

  sort(sortSpec) {
    this.queryPlan.sort = sortSpec;
    return this;
  }

  populate(paths, select) {
    if (Array.isArray(paths)) {
      this.queryPlan.populate.push(...paths.map(p => ({ path: p, select })));
    } else {
      this.queryPlan.populate.push({ path: paths, select });
    }
    return this;
  }

  limit(n) {
    this.queryPlan.limit = n;
    return this;
  }

  skip(n) {
    this.queryPlan.skip = n;
    return this;
  }

  hint(indexSpec) {
    this.queryPlan.hints = indexSpec;
    return this;
  }

  explain() {
    this.queryPlan.explain = true;
    return this;
  }

  // Analyze and optimize
  optimize() {
    const recommendations = [];

    // Check if index can be used
    if (this.queryPlan.where && Object.keys(this.queryPlan.where).length > 0) {
      const hasCompoundFilter = Object.keys(this.queryPlan.where).length > 1;
      if (hasCompoundFilter) {
        recommendations.push('Consider compound index for multiple filter fields');
      }
    }

    // Check sort field coverage
    if (this.queryPlan.sort) {
      recommendations.push('Ensure sort fields are indexed');
    }

    // Check projection
    if (!this.queryPlan.select) {
      recommendations.push('Consider projecting only needed fields');
    }

    // Check populate efficiency
    if (this.queryPlan.populate.length > 2) {
      recommendations.push('Multiple populates may cause N+1 queries');
    }

    return recommendations;
  }

  async execute() {
    let query = this.model.find(this.queryPlan.where);

    if (this.queryPlan.select) {
      query = query.select(this.queryPlan.select);
    }

    if (this.queryPlan.sort) {
      query = query.sort(this.queryPlan.sort);
    }

    for (const pop of this.queryPlan.populate) {
      query = query.populate(pop);
    }

    if (this.queryPlan.limit) {
      query = query.limit(this.queryPlan.limit);
    }

    if (this.queryPlan.skip) {
      query = query.skip(this.queryPlan.skip);
    }

    if (Object.keys(this.queryPlan.hints).length > 0) {
      query = query.hint(this.queryPlan.hints);
    }

    if (this.queryPlan.explain) {
      return query.explain('executionStats');
    }

    return query.lean();
  }
}

// Query result caching
class CachedQuery {
  constructor(cache, keyPrefix = 'query') {
    this.cache = cache;
    this.keyPrefix = keyPrefix;
  }

  getCacheKey(querySpec) {
    return `${this.keyPrefix}:${crypto
      .createHash('md5')
      .update(JSON.stringify(querySpec))
      .digest('hex')}`;
  }

  async execute(model, querySpec, options = {}) {
    const { ttl = 60, forceRefresh = false } = options;
    const cacheKey = this.getCacheKey(querySpec);

    if (!forceRefresh) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const result = await model.find(querySpec.where)
      .select(querySpec.select)
      .sort(querySpec.sort)
      .limit(querySpec.limit)
      .lean();

    await this.cache.set(cacheKey, result, ttl);
    return result;
  }
}

// Batch operations for bulk updates
class BatchOperations {
  constructor(model) {
    this.model = model;
  }

  async bulkWrite(operations, options = {}) {
    const { ordered = false, batchSize = 1000 } = options;
    const results = { insertedCount: 0, modifiedCount: 0, deletedCount: 0 };

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const result = await this.model.bulkWrite(batch, { ordered });
      
      results.insertedCount += result.insertedCount || 0;
      results.modifiedCount += result.modifiedCount || 0;
      results.deletedCount += result.deletedCount || 0;
    }

    return results;
  }

  // Efficient upsert many
  async upsertMany(documents, keyField = '_id') {
    const operations = documents.map(doc => ({
      updateOne: {
        filter: { [keyField]: doc[keyField] },
        update: { $set: doc },
        upsert: true
      }
    }));

    return this.bulkWrite(operations);
  }
}

// Query analysis and index recommendations
async function analyzeQuery(model, query) {
  const explanation = await model.find(query).explain('executionStats');
  
  const analysis = {
    executionTimeMs: explanation.executionStats.executionTimeMillis,
    documentsExamined: explanation.executionStats.totalDocsExamined,
    documentsReturned: explanation.executionStats.nReturned,
    indexUsed: explanation.queryPlanner.winningPlan.inputStage?.indexName || 'COLLSCAN',
    isCollectionScan: !explanation.queryPlanner.winningPlan.inputStage?.indexName
  };

  // Calculate efficiency
  analysis.efficiency = analysis.documentsReturned / 
    (analysis.documentsExamined || 1);

  // Recommendations
  analysis.recommendations = [];

  if (analysis.isCollectionScan) {
    analysis.recommendations.push({
      type: 'INDEX_NEEDED',
      message: 'Collection scan detected. Consider adding an index.',
      suggestedIndex: Object.keys(query)
    });
  }

  if (analysis.efficiency < 0.5) {
    analysis.recommendations.push({
      type: 'LOW_EFFICIENCY',
      message: 'Query is examining many more documents than it returns.',
      suggestion: 'Review query predicates and indexes'
    });
  }

  return analysis;
}
```

---

### Q18: How do you implement zero-downtime deployments?

**Answer:**

```javascript
// Graceful shutdown handler
class GracefulShutdown {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.signals = options.signals || ['SIGTERM', 'SIGINT'];
    this.cleanupHandlers = [];
    this.shutdownInProgress = false;
    
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    for (const signal of this.signals) {
      process.on(signal, () => this.shutdown(signal));
    }
  }

  register(handler) {
    this.cleanupHandlers.push(handler);
  }

  async shutdown(signal) {
    if (this.shutdownInProgress) {
      console.log('Shutdown already in progress');
      return;
    }

    this.shutdownInProgress = true;
    console.log(`Received ${signal}, starting graceful shutdown...`);

    // Set timeout for forced exit
    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, this.timeout);

    try {
      // Run all cleanup handlers
      await Promise.all(
        this.cleanupHandlers.map(handler => {
          try {
            return handler();
          } catch (error) {
            console.error('Cleanup handler error:', error);
          }
        })
      );

      console.log('Graceful shutdown complete');
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      console.error('Shutdown error:', error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }
}

// Application setup for zero-downtime
async function createApplication() {
  const app = express();
  const server = http.createServer(app);
  const gracefulShutdown = new GracefulShutdown({ timeout: 30000 });

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
      return res.status(503).json({ status: 'shutting_down' });
    }
    res.json({ status: 'healthy' });
  });

  // Readiness check for k8s
  app.get('/ready', async (req, res) => {
    if (isShuttingDown) {
      return res.status(503).json({ ready: false });
    }
    
    try {
      // Check dependencies
      await Promise.all([
        checkDatabase(),
        checkCache(),
        checkMessageQueue()
      ]);
      res.json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false, error: error.message });
    }
  });

  // Register cleanup handlers
  gracefulShutdown.register(async () => {
    console.log('Stopping health checks');
    isShuttingDown = true;
    
    // Give load balancer time to stop sending traffic
    await new Promise(r => setTimeout(r, 5000));
  });

  gracefulShutdown.register(async () => {
    console.log('Closing HTTP server');
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  gracefulShutdown.register(async () => {
    console.log('Closing active connections');
    for (const conn of connections) {
      conn.end();
    }
    
    // Wait for connections to close
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (connections.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  });

  gracefulShutdown.register(async () => {
    console.log('Closing database connections');
    await mongoose.connection.close();
  });

  gracefulShutdown.register(async () => {
    console.log('Closing Redis connection');
    await redisClient.quit();
  });

  return { app, server, gracefulShutdown };
}

// Database migration with zero downtime
class ZeroDowntimeMigration {
  constructor(db) {
    this.db = db;
  }

  // Add column with default value
  async addColumn(table, column, definition) {
    // Step 1: Add nullable column
    await this.db.query(`
      ALTER TABLE ${table} 
      ADD COLUMN IF NOT EXISTS ${column} ${definition}
    `);

    // Step 2: Backfill in batches (if default needed)
    if (definition.default !== undefined) {
      await this.backfillInBatches(table, column, definition.default);
    }

    // Step 3: Add NOT NULL constraint if needed
    if (definition.notNull) {
      await this.db.query(`
        ALTER TABLE ${table} 
        ALTER COLUMN ${column} SET NOT NULL
      `);
    }
  }

  async backfillInBatches(table, column, value, batchSize = 10000) {
    let affected = batchSize;
    
    while (affected === batchSize) {
      const result = await this.db.query(`
        UPDATE ${table} 
        SET ${column} = $1 
        WHERE id IN (
          SELECT id FROM ${table} 
          WHERE ${column} IS NULL 
          LIMIT $2
        )
      `, [value, batchSize]);
      
      affected = result.rowCount;
      
      // Sleep to avoid overloading
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Rename column safely
  async renameColumn(table, oldName, newName) {
    // Step 1: Add new column
    await this.db.query(`
      ALTER TABLE ${table} 
      ADD COLUMN ${newName} (SELECT ${oldName} FROM ${table} LIMIT 1)::type
    `);

    // Step 2: Sync data with trigger
    await this.db.query(`
      CREATE OR REPLACE FUNCTION sync_${table}_${oldName}_${newName}()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.${newName} = NEW.${oldName};
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER trigger_sync_${table}_${oldName}_${newName}
      BEFORE INSERT OR UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION sync_${table}_${oldName}_${newName}();
    `);

    // Step 3: Backfill existing data
    await this.backfillInBatches(table, newName, null);

    // Application code should now read from both, write to old
    // After all instances updated, switch to new column

    // Step 4: Remove trigger and old column (after deployment complete)
    // await this.db.query(`
    //   DROP TRIGGER trigger_sync_${table}_${oldName}_${newName} ON ${table};
    //   ALTER TABLE ${table} DROP COLUMN ${oldName};
    // `);
  }
}
```

---

### Q19-Q24: [Additional Performance Questions - Condensed]

Due to length, here are key topics covered in remaining performance questions:

**Q19: Implement request coalescing for duplicate concurrent requests**
**Q20: Database read replicas and write/read splitting**
**Q21: Implement lazy loading and code splitting in Node.js**
**Q22: Memory-efficient processing of large JSON files**
**Q23: Implement response compression and optimization**
**Q24: WebSocket connection pooling and optimization**

---

## Security & Reliability

### Q25: Implement secure secret management.

**Answer:**

```javascript
// Secret Manager with rotation support
class SecretManager {
  constructor(options = {}) {
    this.provider = options.provider;
    this.cache = new Map();
    this.rotationCallbacks = new Map();
    this.refreshInterval = options.refreshInterval || 300000; // 5 min
  }

  async initialize() {
    await this.refreshSecrets();
    setInterval(() => this.refreshSecrets(), this.refreshInterval);
  }

  async getSecret(name) {
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    const secret = await this.provider.getSecret(name);
    this.cache.set(name, secret);
    return secret;
  }

  async refreshSecrets() {
    for (const [name] of this.cache) {
      try {
        const newValue = await this.provider.getSecret(name);
        const oldValue = this.cache.get(name);
        
        if (newValue !== oldValue) {
          this.cache.set(name, newValue);
          await this.notifyRotation(name, newValue, oldValue);
        }
      } catch (error) {
        console.error(`Failed to refresh secret ${name}:`, error);
      }
    }
  }

  onRotation(name, callback) {
    if (!this.rotationCallbacks.has(name)) {
      this.rotationCallbacks.set(name, []);
    }
    this.rotationCallbacks.get(name).push(callback);
  }

  async notifyRotation(name, newValue, oldValue) {
    const callbacks = this.rotationCallbacks.get(name) || [];
    for (const callback of callbacks) {
      try {
        await callback(newValue, oldValue);
      } catch (error) {
        console.error(`Rotation callback error for ${name}:`, error);
      }
    }
  }
}

// AWS Secrets Manager Provider
class AWSSecretsProvider {
  constructor() {
    this.client = new AWS.SecretsManager();
  }

  async getSecret(name) {
    const result = await this.client.getSecretValue({
      SecretId: name
    }).promise();

    if (result.SecretString) {
      return JSON.parse(result.SecretString);
    }
    
    return Buffer.from(result.SecretBinary, 'base64').toString();
  }
}

// HashiCorp Vault Provider
class VaultProvider {
  constructor(options) {
    this.vault = require('node-vault')({
      apiVersion: 'v1',
      endpoint: options.endpoint,
      token: options.token
    });
  }

  async getSecret(path) {
    const result = await this.vault.read(path);
    return result.data.data;
  }
}

// Environment-based secrets with encryption at rest
class EncryptedEnvProvider {
  constructor(encryptionKey) {
    this.key = encryptionKey;
  }

  getSecret(name) {
    const encrypted = process.env[name];
    if (!encrypted) return null;
    return this.decrypt(encrypted);
  }

  decrypt(encrypted) {
    const crypto = require('crypto');
    const [iv, encryptedData] = encrypted.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.key, 'hex'),
      Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Usage with automatic rotation handling
const secretManager = new SecretManager({
  provider: new AWSSecretsProvider(),
  refreshInterval: 60000
});

await secretManager.initialize();

// Handle database credential rotation
secretManager.onRotation('db-credentials', async (newCreds) => {
  console.log('Database credentials rotated, reconnecting...');
  await mongoose.disconnect();
  await mongoose.connect(buildConnectionString(newCreds));
});

const dbCreds = await secretManager.getSecret('db-credentials');
```

---

### Q26: Implement API security best practices.

**Answer:**

```javascript
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Speed limiter (slow down frequent requests)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500
});

// Input validation and sanitization
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Prevent HTTP Parameter Pollution

// API key validation
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Constant-time comparison to prevent timing attacks
  const validKey = process.env.API_KEY;
  const valid = crypto.timingSafeEqual(
    Buffer.from(apiKey),
    Buffer.from(validKey)
  );

  if (!valid) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Request signing validation
const validateSignature = (req, res, next) => {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  
  // Check timestamp freshness (prevent replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 300000) { // 5 minutes
    return res.status(401).json({ error: 'Request expired' });
  }

  // Verify signature
  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SIGNING_SECRET)
    .update(payload)
    .digest('hex');

  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

// SQL Injection prevention with parameterized queries
async function getUser(userId) {
  // NEVER do this:
  // const query = `SELECT * FROM users WHERE id = '${userId}'`;
  
  // Always use parameterized queries:
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

// XSS prevention
const xss = require('xss');

function sanitizeHtml(input) {
  return xss(input, {
    whiteList: {
      a: ['href', 'title', 'target'],
      b: [],
      i: [],
      p: [],
      br: []
    },
    stripIgnoreTag: true
  });
}

// CSRF protection
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

app.get('/form', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.post('/submit', csrfProtection, (req, res) => {
  // Token validated automatically
  res.json({ success: true });
});

// Security logging
const securityLogger = (req, res, next) => {
  const securityEvent = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id
  };

  // Log failed authentications
  res.on('finish', () => {
    if (res.statusCode === 401 || res.statusCode === 403) {
      console.warn('Security event:', {
        ...securityEvent,
        statusCode: res.statusCode,
        type: 'AUTH_FAILURE'
      });
    }
  });

  next();
};

app.use(securityLogger);
```

---

### Q27-Q35: [Additional Security Questions - Condensed]

Key security topics covered:
- **Q27**: Implementing OAuth 2.0 and OpenID Connect
- **Q28**: JWT security best practices (refresh tokens, revocation)
- **Q29**: Input validation and sanitization strategies
- **Q30**: Implementing audit logging
- **Q31**: Data encryption at rest and in transit
- **Q32**: Secure file upload handling
- **Q33**: Implementing RBAC (Role-Based Access Control)
- **Q34**: Handling sensitive data (PII, PCI compliance)
- **Q35**: Security testing and vulnerability scanning

---

## Microservices & Distributed Systems

### Q36: Implement service discovery pattern.

**Answer:**

```javascript
// Service Registry
class ServiceRegistry {
  constructor(options = {}) {
    this.services = new Map();
    this.healthCheckInterval = options.healthCheckInterval || 10000;
    this.deregisterAfter = options.deregisterAfter || 30000;
  }

  register(serviceName, instance) {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, new Map());
    }

    const serviceInstances = this.services.get(serviceName);
    serviceInstances.set(instance.id, {
      ...instance,
      lastHeartbeat: Date.now(),
      status: 'healthy'
    });

    console.log(`Registered ${serviceName}:${instance.id}`);
    return instance.id;
  }

  deregister(serviceName, instanceId) {
    const instances = this.services.get(serviceName);
    if (instances) {
      instances.delete(instanceId);
      console.log(`Deregistered ${serviceName}:${instanceId}`);
    }
  }

  heartbeat(serviceName, instanceId) {
    const instances = this.services.get(serviceName);
    if (instances && instances.has(instanceId)) {
      const instance = instances.get(instanceId);
      instance.lastHeartbeat = Date.now();
      instance.status = 'healthy';
    }
  }

  getInstances(serviceName) {
    const instances = this.services.get(serviceName);
    if (!instances) return [];

    return Array.from(instances.values())
      .filter(i => i.status === 'healthy');
  }

  startHealthCheck() {
    setInterval(() => {
      const now = Date.now();

      for (const [serviceName, instances] of this.services) {
        for (const [id, instance] of instances) {
          const elapsed = now - instance.lastHeartbeat;

          if (elapsed > this.deregisterAfter) {
            this.deregister(serviceName, id);
          } else if (elapsed > this.healthCheckInterval * 2) {
            instance.status = 'unhealthy';
          }
        }
      }
    }, this.healthCheckInterval);
  }
}

// Load Balancer
class LoadBalancer {
  constructor(registry, strategy = 'round-robin') {
    this.registry = registry;
    this.strategy = strategy;
    this.counters = new Map();
  }

  async getNextInstance(serviceName) {
    const instances = this.registry.getInstances(serviceName);
    
    if (instances.length === 0) {
      throw new Error(`No healthy instances for ${serviceName}`);
    }

    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(serviceName, instances);
      case 'random':
        return this.random(instances);
      case 'least-connections':
        return this.leastConnections(instances);
      case 'weighted':
        return this.weighted(instances);
      default:
        return instances[0];
    }
  }

  roundRobin(serviceName, instances) {
    const counter = this.counters.get(serviceName) || 0;
    const instance = instances[counter % instances.length];
    this.counters.set(serviceName, counter + 1);
    return instance;
  }

  random(instances) {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }

  leastConnections(instances) {
    return instances.reduce((min, instance) =>
      (instance.connections || 0) < (min.connections || 0) ? instance : min
    );
  }

  weighted(instances) {
    const totalWeight = instances.reduce((sum, i) => sum + (i.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight || 1;
      if (random <= 0) return instance;
    }

    return instances[0];
  }
}

// Service Client with discovery
class ServiceClient {
  constructor(loadBalancer, options = {}) {
    this.loadBalancer = loadBalancer;
    this.circuitBreakers = new Map();
    this.retries = options.retries || 3;
    this.timeout = options.timeout || 5000;
  }

  async call(serviceName, method, path, data) {
    let lastError;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const instance = await this.loadBalancer.getNextInstance(serviceName);
        const circuitBreaker = this.getCircuitBreaker(instance.id);

        return await circuitBreaker.execute(async () => {
          const url = `http://${instance.host}:${instance.port}${path}`;
          
          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: data ? JSON.stringify(data) : undefined,
            signal: AbortSignal.timeout(this.timeout)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return response.json();
        });
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1} failed:`, error.message);
      }
    }

    throw lastError;
  }

  getCircuitBreaker(instanceId) {
    if (!this.circuitBreakers.has(instanceId)) {
      this.circuitBreakers.set(instanceId, new CircuitBreaker());
    }
    return this.circuitBreakers.get(instanceId);
  }
}

// Consul-based implementation
const Consul = require('consul');

class ConsulServiceRegistry {
  constructor(options = {}) {
    this.consul = new Consul({
      host: options.host || 'localhost',
      port: options.port || 8500
    });
    this.serviceId = null;
  }

  async register(serviceName, instance) {
    this.serviceId = `${serviceName}-${instance.id}`;

    await this.consul.agent.service.register({
      name: serviceName,
      id: this.serviceId,
      address: instance.host,
      port: instance.port,
      check: {
        http: `http://${instance.host}:${instance.port}/health`,
        interval: '10s',
        timeout: '5s',
        deregistercriticalserviceafter: '30s'
      }
    });
  }

  async deregister() {
    if (this.serviceId) {
      await this.consul.agent.service.deregister(this.serviceId);
    }
  }

  async getInstances(serviceName) {
    const result = await this.consul.health.service({
      service: serviceName,
      passing: true
    });

    return result.map(entry => ({
      id: entry.Service.ID,
      host: entry.Service.Address,
      port: entry.Service.Port
    }));
  }
}
```

---

### Q37: Implement distributed tracing.

**Answer:**

```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

// Initialize tracing
function initTracing(serviceName) {
  const provider = new NodeTracerProvider({
    resource: {
      attributes: {
        'service.name': serviceName,
        'service.version': process.env.npm_package_version
      }
    }
  });

  const exporter = new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
  });

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation()
    ]
  });

  return provider;
}

// Custom tracing utilities
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');

class TracingService {
  constructor(serviceName) {
    this.tracer = trace.getTracer(serviceName);
  }

  startSpan(name, options = {}) {
    return this.tracer.startSpan(name, options);
  }

  async withSpan(name, fn, options = {}) {
    const span = this.startSpan(name, options);

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }

  // Express middleware
  tracingMiddleware() {
    return (req, res, next) => {
      const span = trace.getSpan(context.active());
      
      if (span) {
        // Add request attributes
        span.setAttributes({
          'http.user_agent': req.headers['user-agent'],
          'http.request_id': req.id,
          'user.id': req.user?.id
        });

        // Add trace ID to response headers
        const traceId = span.spanContext().traceId;
        res.setHeader('X-Trace-ID', traceId);

        // Store span in request for later use
        req.span = span;
      }

      next();
    };
  }

  // Propagate context to downstream services
  getTracingHeaders() {
    const headers = {};
    const span = trace.getSpan(context.active());
    
    if (span) {
      const spanContext = span.spanContext();
      headers['traceparent'] = `00-${spanContext.traceId}-${spanContext.spanId}-01`;
    }

    return headers;
  }
}

// Traced service client
class TracedServiceClient {
  constructor(baseUrl, tracingService) {
    this.baseUrl = baseUrl;
    this.tracing = tracingService;
  }

  async request(method, path, data) {
    return this.tracing.withSpan(`HTTP ${method} ${path}`, async () => {
      const span = trace.getSpan(context.active());
      
      span.setAttributes({
        'http.method': method,
        'http.url': `${this.baseUrl}${path}`
      });

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.tracing.getTracingHeaders()
        },
        body: data ? JSON.stringify(data) : undefined
      });

      span.setAttributes({
        'http.status_code': response.status
      });

      return response.json();
    });
  }
}

// Database query tracing
function tracedQuery(tracer) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const span = tracer.startSpan(`db.query.${propertyKey}`);
      
      try {
        span.setAttributes({
          'db.system': 'mongodb',
          'db.operation': propertyKey
        });

        const result = await originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}
```

---

### Q38-Q45: [Additional Distributed Systems Questions - Condensed]

Key topics covered:
- **Q38**: Implementing message queues (RabbitMQ, Bull)
- **Q39**: Event-driven communication between services
- **Q40**: Implementing distributed locks
- **Q41**: Handling distributed transactions
- **Q42**: Implementing API Gateway pattern
- **Q43**: Service mesh concepts
- **Q44**: Implementing health checks and readiness probes
- **Q45**: Handling partial failures and fallbacks

---

## DevOps & Production

### Q46-Q50: [DevOps Questions - Condensed]

Key topics covered:
- **Q46**: Container orchestration with Kubernetes
- **Q47**: CI/CD pipeline implementation
- **Q48**: Log aggregation and monitoring
- **Q49**: Infrastructure as Code
- **Q50**: Disaster recovery and backup strategies

---

## Summary

This guide covers advanced Node.js concepts for senior developers:

1. **Architecture Patterns**: Repository, Unit of Work, CQRS, Event Sourcing, Saga
2. **Performance**: Memory optimization, connection pooling, caching strategies
3. **Security**: Secret management, API security, authentication
4. **Distributed Systems**: Service discovery, distributed tracing, message queues
5. **DevOps**: Zero-downtime deployments, monitoring, container orchestration

**Key Skills for Senior Developers:**
- System design and architecture decisions
- Performance optimization and debugging
- Security best practices
- Leading technical projects
- Mentoring junior developers
