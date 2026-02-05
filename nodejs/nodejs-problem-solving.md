# Node.js Problem-Solving Interview Questions

> **Focus**: Real-world scenarios across different domains
> **Total Questions**: 50
> **Format**: Problem statement with detailed solution and explanation

---

## Table of Contents
1. [E-Commerce (Q1-Q10)](#e-commerce)
2. [FinTech & Banking (Q11-Q20)](#fintech--banking)
3. [Healthcare (Q21-Q25)](#healthcare)
4. [Social Media (Q26-Q30)](#social-media)
5. [Logistics & Delivery (Q31-Q35)](#logistics--delivery)
6. [IoT & Real-Time Systems (Q36-Q40)](#iot--real-time-systems)
7. [SaaS & Multi-Tenant (Q41-Q45)](#saas--multi-tenant)
8. [Media & Streaming (Q46-Q50)](#media--streaming)

---

## E-Commerce

### Q1: Shopping Cart with Inventory Lock

**Problem:**
Design a shopping cart system where items are reserved for 15 minutes when added to cart. If the user doesn't checkout, items should be released back to inventory. Handle concurrent users trying to buy the same limited-stock item.

---

**Solution Approach:**

The core challenge here is preventing **overselling** when multiple users try to buy limited-stock items simultaneously. We solve this using three key techniques:

1. **Distributed Locking**: When a user adds an item to cart, we acquire a lock on that product to prevent race conditions. This ensures only one user can modify inventory calculations at a time.

2. **Temporary Reservations with TTL**: Instead of immediately deducting from inventory, we create a "reservation" in Redis with a 15-minute expiration (TTL). This holds the stock for the user without permanently affecting inventory.

3. **Atomic Checkout with Transactions**: When the user checks out, we use database transactions to ensure all-or-nothing behavior - either the entire order succeeds or everything rolls back.

**Why Redis?**
- Redis provides automatic key expiration (TTL), perfect for time-limited reservations
- It's fast enough for real-time inventory checks
- Supports distributed locking patterns

**Flow Diagram:**
```
User adds item → Acquire Lock → Check (Stock - Reservations) → Create Reservation → Release Lock
                     ↓ (if locked)
                 Retry or Error

User checks out → Verify Reservations Valid → Deduct Stock (Transaction) → Create Order → Clear Reservations
```

**Solution:**

```javascript
const Redis = require('ioredis');
const redis = new Redis();

class CartService {
  constructor() {
    // Reservation expires after 15 minutes if user doesn't checkout
    this.RESERVATION_TTL = 15 * 60; // 15 minutes in seconds
  }

  /**
   * Add item to cart with inventory reservation
   * 
   * LOGIC:
   * 1. Acquire a distributed lock on the product to prevent race conditions
   * 2. Calculate available stock = total stock - all active reservations
   * 3. If enough stock, create a reservation with 15-min expiry
   * 4. Store in user's cart (also with expiry)
   * 5. Release the lock so other users can proceed
   */
  async addToCart(userId, productId, quantity) {
    // Keys for Redis operations
    const lockKey = `lock:product:${productId}`;      // Prevents concurrent modifications
    const cartKey = `cart:${userId}`;                  // User's shopping cart
    const reservationKey = `reservation:${userId}:${productId}`; // This user's reservation

    // STEP 1: Acquire distributed lock
    // This prevents two users from simultaneously checking the same inventory
    const lock = await this.acquireLock(lockKey);
    if (!lock) {
      // Another user is currently modifying this product's inventory
      throw new Error('Product is being modified, please retry');
    }

    try {
      // STEP 2: Check available inventory
      // Available = Total Stock - Sum of all active reservations
      const product = await Product.findByPk(productId);
      const reserved = await this.getTotalReserved(productId);
      const available = product.stock - reserved;

      // STEP 3: Validate quantity against available stock
      if (available < quantity) {
        throw new Error(`Only ${available} items available`);
      }

      // STEP 4: Create reservation object with price snapshot
      // We capture the price now to prevent issues if price changes before checkout
      const reservation = {
        productId,
        quantity,
        price: product.price,  // Lock in the current price
        reservedAt: Date.now()
      };

      // STEP 5: Store reservation in Redis with automatic expiry
      // After 15 minutes, Redis automatically deletes this key
      // This "releases" the reserved stock back to available pool
      await redis.setex(
        reservationKey,
        this.RESERVATION_TTL,
        JSON.stringify(reservation)
      );

      // STEP 6: Also add to user's cart hash for easy retrieval
      await redis.hset(cartKey, productId, JSON.stringify(reservation));
      await redis.expire(cartKey, this.RESERVATION_TTL);

      return { success: true, reservation };
    } finally {
      // CRITICAL: Always release the lock, even if an error occurred
      // Otherwise, no one else can add this product to their cart
      await this.releaseLock(lockKey, lock);
    }
  }

  /**
   * Calculate total quantity reserved across ALL users for a product
   * 
   * LOGIC:
   * - Scan all reservation keys matching pattern "reservation:*:productId"
   * - Sum up quantities from each active reservation
   * - Expired reservations are automatically gone (Redis TTL)
   */
  async getTotalReserved(productId) {
    // Find all active reservations for this product from any user
    const keys = await redis.keys(`reservation:*:${productId}`);
    let total = 0;

    // Sum quantities from each reservation
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        total += JSON.parse(data).quantity;
      }
    }
    return total;
  }

  /**
   * Process checkout - convert reservations to actual order
   * 
   * LOGIC:
   * 1. Retrieve all items from user's cart
   * 2. Verify each reservation is still valid (not expired)
   * 3. Use database transaction to atomically:
   *    - Deduct stock from inventory
   *    - Create order record
   * 4. Clear reservations and cart
   * 
   * If ANY step fails, rollback everything
   */
  async checkout(userId) {
    const cartKey = `cart:${userId}`;
    const cart = await redis.hgetall(cartKey);

    // Validate cart has items
    if (Object.keys(cart).length === 0) {
      throw new Error('Cart is empty');
    }

    // Start database transaction - all-or-nothing
    const transaction = await sequelize.transaction();

    try {
      const orderItems = [];

      // Process each item in the cart
      for (const [productId, itemJson] of Object.entries(cart)) {
        const item = JSON.parse(itemJson);
        
        // VERIFICATION: Check if reservation is still valid
        // If user took too long, reservation may have expired
        const reservationKey = `reservation:${userId}:${productId}`;
        const reservation = await redis.get(reservationKey);
        
        if (!reservation) {
          // Reservation expired - user waited too long
          throw new Error(`Reservation expired for product ${productId}`);
        }

        // ATOMIC STOCK DEDUCTION with optimistic locking
        // Only updates if stock >= quantity (prevents negative stock)
        const [updated] = await Product.update(
          { stock: sequelize.literal(`stock - ${item.quantity}`) },
          {
            where: {
              id: productId,
              stock: { [Op.gte]: item.quantity }  // Guard condition
            },
            transaction
          }
        );

        // If no rows updated, stock became insufficient
        if (updated === 0) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }

        orderItems.push({
          productId,
          quantity: item.quantity,
          price: item.price
        });

        // Clear this reservation (stock is now actually deducted)
        await redis.del(reservationKey);
      }

      // Create the order with all items
      const order = await Order.create({
        userId,
        items: orderItems,
        total: orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
        status: 'pending'
      }, { transaction });

      // COMMIT - all changes are now permanent
      await transaction.commit();
      
      // Clean up cart
      await redis.del(cartKey);

      return order;
    } catch (error) {
      // ROLLBACK - undo all database changes
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Distributed Lock Implementation
   * 
   * WHY: Prevents race conditions when multiple users access same product
   * 
   * HOW:
   * - Use Redis SET with NX (only set if not exists) and PX (expiry in ms)
   * - Return unique token if lock acquired
   * - Return null if lock is held by someone else
   * - Lock auto-expires after 5 seconds (prevents deadlocks)
   */
  async acquireLock(key, ttl = 5000) {
    const token = crypto.randomUUID();  // Unique identifier for this lock holder
    const result = await redis.set(key, token, 'PX', ttl, 'NX');
    return result === 'OK' ? token : null;
  }

  /**
   * Release Lock Safely
   * 
   * CRITICAL: Only delete the lock if WE own it (token matches)
   * This prevents accidentally releasing someone else's lock
   * 
   * Uses Lua script for atomicity - check and delete in one operation
   */
  async releaseLock(key, token) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, 1, key, token);
  }
}

/**
 * Background Job: Notify users about expiring carts
 * 
 * LOGIC:
 * - Redis TTL handles automatic expiration of reservations
 * - This job runs periodically to send "your cart is expiring" notifications
 * - Helps reduce abandoned carts by reminding users
 */
class ReservationCleanupJob {
  async run() {
    const keys = await redis.keys('cart:*');
    
    for (const key of keys) {
      const ttl = await redis.ttl(key);  // Get remaining time
      
      // If cart expires in less than 5 minutes, notify user
      if (ttl > 0 && ttl < 300) {
        const userId = key.split(':')[1];
        await notificationService.send(userId, {
          type: 'cart_expiring',
          message: 'Your cart will expire in 5 minutes'
        });
      }
    }
  }
}
```

**Key Takeaways:**
- **Distributed locks** prevent race conditions in concurrent systems
- **Redis TTL** provides automatic cleanup without complex job scheduling
- **Database transactions** ensure data consistency
- **Optimistic locking** (checking stock >= quantity in WHERE clause) prevents negative inventory

---

### Q2: Dynamic Pricing Engine

**Problem:**
Build a pricing engine that calculates discounts based on multiple rules: quantity discounts, user tier discounts, time-based promotions, and coupon codes. Rules should be combinable and prioritized.

---

**Solution Approach:**

This problem requires a **Rule Engine** pattern where:

1. **Multiple rules can apply** to a single purchase (quantity + member tier + coupon)
2. **Rules have priorities** (flash sale might override other discounts)
3. **Some rules don't combine** (can't stack two exclusive promotions)
4. **Rules are modular** (easy to add/remove without changing core logic)

**Design Pattern: Chain of Responsibility + Strategy**

Each discount rule is a separate class with:
- `isApplicable()` - checks if this rule applies to current context
- `calculate()` - computes the discount amount

The engine loops through rules in priority order, applying each valid discount.

**Discount Stacking Logic:**
```
Flash Sale (priority 0, non-combinable) → If active, only this applies
Quantity Discount (priority 1, combinable) → Stacks with other combinable discounts  
User Tier (priority 2, combinable) → Stacks with other combinable discounts
Coupon (priority 3, varies) → Some coupons are exclusive
```

**Solution:**

```javascript
class PricingEngine {
  constructor() {
    this.rules = [];  // Will hold all discount rules
  }

  /**
   * Register a discount rule
   * Rules are sorted by priority (lower number = higher priority)
   */
  addRule(rule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Calculate final price after all applicable discounts
   * 
   * LOGIC:
   * 1. Start with base product price
   * 2. Loop through rules in priority order
   * 3. For each rule: check if applicable, calculate discount
   * 4. Check if this discount can combine with existing discounts
   * 5. Apply discount if combinable (or if it's the first one)
   * 6. Return final price with breakdown
   */
  async calculatePrice(context) {
    const { product, quantity, user, couponCode, currentTime } = context;
    
    let price = product.basePrice;
    let appliedDiscounts = [];
    let discountTotal = 0;

    // Build context object passed to each rule
    const discountContext = {
      originalPrice: price,
      currentPrice: price,
      quantity,
      user,
      product,
      couponCode,
      currentTime: currentTime || new Date(),
      appliedDiscounts
    };

    // Evaluate each rule in priority order
    for (const rule of this.rules) {
      // Check if this rule applies to current purchase
      if (await rule.isApplicable(discountContext)) {
        const discount = await rule.calculate(discountContext);
        
        if (discount.amount > 0) {
          // Check combinability before applying
          if (this.canCombine(discount, appliedDiscounts)) {
            discountContext.currentPrice -= discount.amount;
            discountTotal += discount.amount;
            appliedDiscounts.push(discount);
          }
          // If can't combine but this is non-combinable and no discounts yet,
          // it would still apply (handled by canCombine logic)
        }
      }
    }

    return {
      originalPrice: product.basePrice * quantity,
      finalPrice: Math.max(0, discountContext.currentPrice * quantity),
      discounts: appliedDiscounts,
      totalSaved: discountTotal * quantity
    };
  }

  /**
   * Check if new discount can combine with existing discounts
   * 
   * RULES:
   * - If new discount is non-combinable, only works if no other discounts applied
   * - If any existing discount is non-combinable, can't add more
   */
  canCombine(newDiscount, existing) {
    if (!newDiscount.combinable) {
      return existing.length === 0;  // Non-combinable only works alone
    }
    return !existing.some(d => !d.combinable);  // Check no exclusive discounts exist
  }
}

/**
 * RULE: Quantity-based discounts
 * 
 * LOGIC:
 * - Buy 2-4 items: 5% off
 * - Buy 5-9 items: 10% off
 * - Buy 10+ items: 15% off
 * 
 * This encourages bulk purchases
 */
class QuantityDiscountRule {
  priority = 1;  // Applied second (after flash sales)
  
  async isApplicable({ quantity }) {
    return quantity >= 2;  // Only applies for 2+ items
  }

  async calculate({ originalPrice, quantity }) {
    // Discount tiers - check from highest first
    const tiers = [
      { min: 10, discount: 0.15 },  // 15% for 10+
      { min: 5, discount: 0.10 },   // 10% for 5-9
      { min: 2, discount: 0.05 }    // 5% for 2-4
    ];

    // Find the applicable tier
    const tier = tiers.find(t => quantity >= t.min);
    
    return {
      type: 'quantity',
      name: `${tier.discount * 100}% off for ${tier.min}+ items`,
      amount: originalPrice * tier.discount,
      combinable: true  // Can stack with other discounts
    };
  }
}

/**
 * RULE: User tier/membership discounts
 * 
 * LOGIC:
 * - Gold members: 5% off everything
 * - Platinum members: 10% off everything
 * 
 * Rewards loyal customers
 */
class UserTierDiscountRule {
  priority = 2;

  async isApplicable({ user }) {
    // Only for Gold or Platinum members
    return user && ['gold', 'platinum'].includes(user.tier);
  }

  async calculate({ originalPrice, user }) {
    const discounts = {
      gold: 0.05,      // 5% for Gold
      platinum: 0.10   // 10% for Platinum
    };

    return {
      type: 'tier',
      name: `${user.tier.toUpperCase()} member discount`,
      amount: originalPrice * discounts[user.tier],
      combinable: true
    };
  }
}

/**
 * RULE: Flash sales (time-limited promotions)
 * 
 * LOGIC:
 * - Check if product has active flash sale right now
 * - Flash sales are typically EXCLUSIVE (don't combine with other discounts)
 * - Highest priority (priority 0) - evaluated first
 */
class FlashSaleRule {
  priority = 0;  // Highest priority - checked first

  async isApplicable({ product, currentTime }) {
    // Query database for active flash sale on this product
    const sale = await FlashSale.findOne({
      where: {
        productId: product.id,
        startTime: { [Op.lte]: currentTime },  // Started
        endTime: { [Op.gte]: currentTime },    // Not ended
        active: true
      }
    });
    return !!sale;
  }

  async calculate({ product, originalPrice, currentTime }) {
    const sale = await FlashSale.findOne({
      where: {
        productId: product.id,
        startTime: { [Op.lte]: currentTime },
        endTime: { [Op.gte]: currentTime }
      }
    });

    return {
      type: 'flash_sale',
      name: sale.name,
      amount: originalPrice * sale.discountPercent,
      combinable: false  // EXCLUSIVE - can't stack with other discounts
    };
  }
}

/**
 * RULE: Coupon codes
 * 
 * LOGIC:
 * - Validate coupon exists and hasn't expired
 * - Check usage limits (some coupons can only be used X times)
 * - Handle percentage vs fixed amount coupons
 * - First-time buyer coupons
 * - Maximum discount caps
 */
class CouponRule {
  priority = 3;  // Applied last

  async isApplicable({ couponCode }) {
    if (!couponCode) return false;  // No coupon provided
    
    // Find valid, unexpired coupon with remaining uses
    const coupon = await Coupon.findOne({
      where: {
        code: couponCode,
        expiresAt: { [Op.gte]: new Date() },
        usageCount: { [Op.lt]: sequelize.col('usageLimit') }
      }
    });
    return !!coupon;
  }

  async calculate({ couponCode, originalPrice, user }) {
    const coupon = await Coupon.findOne({ where: { code: couponCode } });
    
    // Check first-time buyer restriction
    if (coupon.firstTimeOnly) {
      const hasUsed = await Order.count({
        where: { userId: user.id, couponId: coupon.id }
      });
      if (hasUsed > 0) {
        return { amount: 0 };  // Already used by this user
      }
    }

    // Calculate discount based on coupon type
    const amount = coupon.type === 'percentage'
      ? originalPrice * (coupon.value / 100)  // e.g., 20% off
      : Math.min(coupon.value, originalPrice); // e.g., $10 off (capped at price)

    return {
      type: 'coupon',
      name: `Coupon: ${couponCode}`,
      amount: Math.min(amount, coupon.maxDiscount || Infinity),  // Apply cap if exists
      combinable: coupon.combinable,  // Some coupons are exclusive
      couponId: coupon.id
    };
  }
}

// USAGE EXAMPLE:
const engine = new PricingEngine();
engine.addRule(new FlashSaleRule());      // Priority 0
engine.addRule(new QuantityDiscountRule()); // Priority 1
engine.addRule(new UserTierDiscountRule()); // Priority 2
engine.addRule(new CouponRule());          // Priority 3

const price = await engine.calculatePrice({
  product: { id: 1, basePrice: 100 },
  quantity: 5,
  user: { id: 1, tier: 'gold' },
  couponCode: 'SAVE20'
});
// Result: { originalPrice: 500, finalPrice: 375, discounts: [...], totalSaved: 125 }
```

**Key Takeaways:**
- **Rule Engine pattern** makes pricing logic extensible and maintainable
- **Priority system** controls which discounts are evaluated first
- **Combinability flags** prevent invalid discount stacking
- **Strategy pattern** allows easy addition of new discount types

---

### Q3: Order Fulfillment State Machine

**Problem:**
Implement an order fulfillment system with states: pending → confirmed → processing → shipped → delivered. Handle cancellations, returns, and partial fulfillment with proper state transitions.

---

**Solution Approach:**

This is a classic **State Machine** problem. The key concepts are:

1. **States**: Each order can only be in ONE state at a time
2. **Transitions**: Valid state changes (e.g., "pending" can become "confirmed" or "cancelled", but not "delivered")
3. **Actions**: The trigger for transitions (e.g., "confirm", "ship", "cancel")
4. **Guards**: Conditions that must be met before a transition (e.g., can't cancel if already shipped)
5. **Hooks**: Side effects that happen before/after transitions (e.g., send email after shipping)

**State Diagram:**
```
pending ──confirm──→ confirmed ──process──→ processing ──ship──→ shipped ──deliver──→ delivered ──complete──→ completed
   │                      │                      │                   │                      │
   │                      │                      │                   │                      │
   └──cancel──→ cancelled ←──cancel──┘          │                   └──return_initiated──→ return_pending
                                                 │                                              │
                                                 └──partial_ship──→ partially_shipped          │
                                                                                               ↓
                                                                           returned ←──return_received
                                                                              │
                                                                              └──refund──→ refunded
```

**Solution:**

```javascript
const EventEmitter = require('events');

/**
 * Order State Machine
 * 
 * Controls valid order state transitions and executes
 * associated side effects (emails, inventory updates, etc.)
 */
class OrderStateMachine extends EventEmitter {
  constructor(order) {
    super();
    this.order = order;
    
    /**
     * STATE TRANSITION MAP
     * 
     * Format: { currentState: { action: nextState } }
     * 
     * This defines ALL valid transitions. Any action not listed
     * for a state is INVALID and will be rejected.
     */
    this.states = {
      pending: {
        confirm: 'confirmed',     // User or system confirms order
        cancel: 'cancelled'       // User cancels before processing
      },
      confirmed: {
        process: 'processing',    // Start fulfillment
        cancel: 'cancelled'       // Cancel before processing starts
      },
      processing: {
        ship: 'shipped',                    // All items shipped
        partial_ship: 'partially_shipped',  // Some items shipped
        cancel: 'cancelled'                 // Cancel if nothing shipped yet
      },
      partially_shipped: {
        ship: 'shipped',                    // Remaining items shipped
        cancel_remaining: 'partially_shipped' // Cancel unshipped items only
      },
      shipped: {
        deliver: 'delivered',               // Delivery confirmed
        return_initiated: 'return_pending'  // Customer wants to return
      },
      delivered: {
        return_initiated: 'return_pending', // Return window open
        complete: 'completed'               // Order finalized
      },
      return_pending: {
        return_received: 'returned',        // Return arrived at warehouse
        return_rejected: 'delivered'        // Return denied, stay delivered
      },
      returned: {
        refund: 'refunded'                  // Money refunded
      },
      // Terminal states - no further transitions
      cancelled: {},
      refunded: {},
      completed: {}
    };
  }

  /**
   * Get current order state
   */
  get currentState() {
    return this.order.status;
  }

  /**
   * Check if a transition is valid from current state
   */
  canTransition(action) {
    const allowedTransitions = this.states[this.currentState];
    return allowedTransitions && action in allowedTransitions;
  }

  /**
   * Execute a state transition
   * 
   * LOGIC:
   * 1. Validate the transition is allowed
   * 2. Run "before" hooks (validation, checks)
   * 3. Update order state in database
   * 4. Add entry to status history
   * 5. Run "after" hooks (emails, notifications)
   * 6. Emit event for external listeners
   */
  async transition(action, metadata = {}) {
    // STEP 1: Validate transition
    if (!this.canTransition(action)) {
      throw new Error(
        `Invalid transition: ${action} from ${this.currentState}`
      );
    }

    const previousState = this.currentState;
    const newState = this.states[this.currentState][action];

    // Use transaction for atomicity
    const transaction = await sequelize.transaction();

    try {
      // STEP 2: Run pre-transition hooks (can throw to abort)
      await this.executeHooks('before', action, metadata, transaction);

      // STEP 3 & 4: Update state and add to history
      await this.order.update({
        status: newState,
        [`${action}At`]: new Date(),  // Track when each action happened
        // Append to status history array
        statusHistory: sequelize.fn(
          'array_append',
          sequelize.col('statusHistory'),
          JSON.stringify({
            from: previousState,
            to: newState,
            action,
            metadata,
            timestamp: new Date()
          })
        )
      }, { transaction });

      // STEP 5: Run post-transition hooks
      await this.executeHooks('after', action, metadata, transaction);

      await transaction.commit();

      // STEP 6: Emit event for external systems
      this.emit('transition', {
        orderId: this.order.id,
        from: previousState,
        to: newState,
        action,
        metadata
      });

      return { success: true, newState };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Execute lifecycle hooks for transitions
   * 
   * BEFORE hooks: Validation and checks (can abort transition)
   * AFTER hooks: Side effects (emails, inventory, etc.)
   */
  async executeHooks(phase, action, metadata, transaction) {
    const hooks = {
      before: {
        // Before cancellation: Check if items already shipped
        cancel: async () => {
          if (this.currentState === 'processing') {
            const hasShipped = await Shipment.count({
              where: { orderId: this.order.id, status: 'shipped' }
            });
            if (hasShipped > 0) {
              throw new Error('Cannot cancel - items already shipped');
            }
          }
        },
        // Before shipping: Verify all items are picked and packed
        ship: async () => {
          const items = await OrderItem.findAll({
            where: { orderId: this.order.id, status: 'pending' }
          });
          if (items.length > 0) {
            throw new Error('Not all items ready for shipping');
          }
        }
      },
      after: {
        // After confirmation: Reserve inventory and notify customer
        confirm: async () => {
          await inventoryService.reserve(this.order.id, transaction);
          await emailService.sendOrderConfirmation(this.order);
        },
        // After shipping: Create tracking and notify
        ship: async () => {
          const tracking = await shippingService.createShipment(
            this.order,
            metadata.carrier
          );
          await this.order.update(
            { trackingNumber: tracking.id },
            { transaction }
          );
          await emailService.sendShippingNotification(this.order, tracking);
        },
        // After cancellation: Release inventory and refund
        cancel: async () => {
          await inventoryService.release(this.order.id, transaction);
          if (this.order.paymentId) {
            await paymentService.refund(this.order.paymentId);
          }
          await emailService.sendCancellationNotification(this.order);
        },
        // After delivery: Schedule auto-complete after return window
        deliver: async () => {
          // Auto-complete order after 14 days if no return
          await queue.add('auto-complete-order', {
            orderId: this.order.id
          }, { delay: 14 * 24 * 60 * 60 * 1000 });  // 14 days
        }
      }
    };

    // Find and execute the hook if it exists
    const hook = hooks[phase]?.[action];
    if (hook) {
      await hook();
    }
  }
}

/**
 * Order Service - Higher-level API for order operations
 */
class OrderService {
  async confirmOrder(orderId) {
    const order = await Order.findByPk(orderId);
    const sm = new OrderStateMachine(order);
    return sm.transition('confirm');
  }

  async shipOrder(orderId, { carrier, trackingNumber, items }) {
    const order = await Order.findByPk(orderId);
    const sm = new OrderStateMachine(order);
    
    // Determine if this is a partial or full shipment
    const totalItems = await OrderItem.count({ where: { orderId } });
    const action = items.length < totalItems ? 'partial_ship' : 'ship';
    
    return sm.transition(action, { carrier, trackingNumber, shippedItems: items });
  }

  async cancelOrder(orderId, reason) {
    const order = await Order.findByPk(orderId);
    const sm = new OrderStateMachine(order);
    return sm.transition('cancel', { reason, cancelledBy: 'user' });
  }

  async initiateReturn(orderId, { items, reason }) {
    const order = await Order.findByPk(orderId);
    const sm = new OrderStateMachine(order);
    
    // Create return request record
    const returnRequest = await Return.create({
      orderId,
      items,
      reason,
      status: 'pending'
    });
    
    return sm.transition('return_initiated', { returnId: returnRequest.id });
  }
}
```

**Key Takeaways:**
- **State machines** make complex workflows predictable and debuggable
- **Transition validation** prevents invalid state changes
- **Hooks** separate business logic from state management
- **Event emission** allows loose coupling with external systems
- **Transaction wrapping** ensures state + side effects are atomic

---

### Q4: Product Search with Faceted Filtering

**Problem:**
Build a product search system with faceted filters (category, price range, brand, ratings, attributes) that shows filter counts and updates dynamically.

---

**Solution Approach:**

Faceted search requires:

1. **Full-text search** for product name/description queries
2. **Facet aggregations** to count items per filter value
3. **Dynamic filters** that update counts based on current selections
4. **Fast response times** even with millions of products

**Why Elasticsearch?**
- Purpose-built for search with relevance scoring
- Aggregations for facet counts in single query
- Handles complex filter combinations efficiently
- Scales horizontally for large catalogs

**How Faceted Search Works:**
```
User searches "laptop" with filter brand=Apple
    ↓
Elasticsearch Query:
  - Full-text search: "laptop" in name/description
  - Filter: brand = Apple
  - Aggregations: Count by category, price range, OTHER brands, ratings
    ↓
Response includes:
  - Matching products
  - Facets showing: Categories (count), Price ranges (count), Brands (count), etc.
  - Counts are based on current search/filter combination
```

**Solution:**

```javascript
const { Client } = require('@elastic/elasticsearch');
const client = new Client({ node: 'http://localhost:9200' });

class ProductSearchService {
  /**
   * Main search method with faceted filtering
   * 
   * @param query - Text search query
   * @param filters - Active filters (category, brand, price, etc.)
   * @param pagination - Page, size, sort options
   */
  async search(query, filters = {}, pagination = {}) {
    const { page = 1, pageSize = 20, sort = 'relevance' } = pagination;
    
    // Build Elasticsearch request
    const searchBody = {
      from: (page - 1) * pageSize,  // Offset for pagination
      size: pageSize,
      query: this.buildQuery(query, filters),      // Search + filters
      aggs: this.buildAggregations(filters),       // Facet counts
      sort: this.buildSort(sort)                   // Ordering
    };

    const result = await client.search({
      index: 'products',
      body: searchBody
    });

    // Transform response for frontend
    return {
      products: result.hits.hits.map(hit => ({
        id: hit._id,
        ...hit._source,
        score: hit._score  // Relevance score
      })),
      total: result.hits.total.value,
      facets: this.formatFacets(result.aggregations, filters),
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(result.hits.total.value / pageSize)
      }
    };
  }

  /**
   * Build Elasticsearch query with search and filters
   * 
   * STRUCTURE:
   * {
   *   bool: {
   *     must: [text search],    // Affects relevance score
   *     filter: [exact filters] // No score impact, faster
   *   }
   * }
   */
  buildQuery(query, filters) {
    const must = [];    // Search queries (affect scoring)
    const filter = [];  // Filters (exact match, no scoring)

    // TEXT SEARCH: Multi-field with boosting
    if (query) {
      must.push({
        multi_match: {
          query,
          fields: [
            'name^3',        // Name matches are 3x more important
            'description',   // Standard weight
            'brand^2',       // Brand matches are 2x important
            'category'
          ],
          fuzziness: 'AUTO',    // Handle typos
          prefix_length: 2      // First 2 chars must match exactly
        }
      });
    }

    // CATEGORY FILTER
    if (filters.category) {
      filter.push({
        terms: { 'category.keyword': [].concat(filters.category) }
      });
    }

    // BRAND FILTER
    if (filters.brand) {
      filter.push({
        terms: { 'brand.keyword': [].concat(filters.brand) }
      });
    }

    // PRICE RANGE FILTER
    if (filters.priceMin || filters.priceMax) {
      filter.push({
        range: {
          price: {
            ...(filters.priceMin && { gte: filters.priceMin }),
            ...(filters.priceMax && { lte: filters.priceMax })
          }
        }
      });
    }

    // RATING FILTER (minimum rating)
    if (filters.minRating) {
      filter.push({
        range: { rating: { gte: filters.minRating } }
      });
    }

    // IN STOCK FILTER
    if (filters.inStock) {
      filter.push({
        range: { stock: { gt: 0 } }
      });
    }

    // DYNAMIC ATTRIBUTES (color, size, material, etc.)
    // Stored as nested objects: { name: "color", value: "red" }
    if (filters.attributes) {
      for (const [attr, values] of Object.entries(filters.attributes)) {
        filter.push({
          nested: {
            path: 'attributes',
            query: {
              bool: {
                must: [
                  { term: { 'attributes.name.keyword': attr } },
                  { terms: { 'attributes.value.keyword': [].concat(values) } }
                ]
              }
            }
          }
        });
      }
    }

    return {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter
      }
    };
  }

  /**
   * Build aggregations for facet counts
   * 
   * Each aggregation returns counts of values that match
   * the current search + other filters
   */
  buildAggregations(activeFilters) {
    return {
      // Category facet: Count products per category
      categories: {
        terms: { field: 'category.keyword', size: 50 }
      },
      
      // Brand facet: Count products per brand
      brands: {
        terms: { field: 'brand.keyword', size: 100 }
      },
      
      // Price range facet: Predefined buckets
      price_ranges: {
        range: {
          field: 'price',
          ranges: [
            { key: 'Under $25', to: 25 },
            { key: '$25 - $50', from: 25, to: 50 },
            { key: '$50 - $100', from: 50, to: 100 },
            { key: '$100 - $200', from: 100, to: 200 },
            { key: 'Over $200', from: 200 }
          ]
        }
      },
      
      // Rating facet: Minimum rating buckets
      ratings: {
        range: {
          field: 'rating',
          ranges: [
            { key: '4+ stars', from: 4 },
            { key: '3+ stars', from: 3 },
            { key: '2+ stars', from: 2 },
            { key: '1+ stars', from: 1 }
          ]
        }
      },
      
      // Price statistics for slider UI
      price_stats: {
        stats: { field: 'price' }
      },
      
      // Dynamic attributes facet (nested aggregation)
      attributes: {
        nested: { path: 'attributes' },
        aggs: {
          names: {
            terms: { field: 'attributes.name.keyword' },
            aggs: {
              values: {
                terms: { field: 'attributes.value.keyword' }
              }
            }
          }
        }
      }
    };
  }

  /**
   * Build sort options based on user selection
   */
  buildSort(sort) {
    const sortOptions = {
      relevance: [{ _score: 'desc' }],           // Search relevance
      price_asc: [{ price: 'asc' }],             // Cheapest first
      price_desc: [{ price: 'desc' }],           // Most expensive first
      rating: [{ rating: 'desc' }, { reviewCount: 'desc' }], // Best rated
      newest: [{ createdAt: 'desc' }],           // Recently added
      bestselling: [{ salesCount: 'desc' }]      // Popular items
    };
    return sortOptions[sort] || sortOptions.relevance;
  }

  /**
   * Format aggregation results into frontend-friendly facets
   * 
   * Adds 'selected' flag based on active filters
   */
  formatFacets(aggregations, activeFilters) {
    return {
      categories: aggregations.categories.buckets.map(b => ({
        value: b.key,
        count: b.doc_count,
        selected: activeFilters.category?.includes(b.key)
      })),
      
      brands: aggregations.brands.buckets.map(b => ({
        value: b.key,
        count: b.doc_count,
        selected: activeFilters.brand?.includes(b.key)
      })),
      
      priceRanges: aggregations.price_ranges.buckets.map(b => ({
        label: b.key,
        count: b.doc_count,
        from: b.from,
        to: b.to
      })),
      
      priceStats: {
        min: aggregations.price_stats.min,
        max: aggregations.price_stats.max,
        avg: aggregations.price_stats.avg
      },
      
      ratings: aggregations.ratings.buckets.map(b => ({
        label: b.key,
        count: b.doc_count,
        minRating: b.from
      })),
      
      // Transform nested attribute aggregations
      attributes: aggregations.attributes.names.buckets.map(attr => ({
        name: attr.key,  // e.g., "Color"
        values: attr.values.buckets.map(v => ({
          value: v.key,  // e.g., "Red"
          count: v.doc_count,
          selected: activeFilters.attributes?.[attr.key]?.includes(v.key)
        }))
      }))
    };
  }
}

// API ENDPOINT
app.get('/api/products/search', async (req, res) => {
  const { q, page, pageSize, sort, ...filters } = req.query;
  
  // Parse filter parameters
  const parsedFilters = {
    category: filters.category?.split(','),
    brand: filters.brand?.split(','),
    priceMin: parseFloat(filters.priceMin) || undefined,
    priceMax: parseFloat(filters.priceMax) || undefined,
    minRating: parseFloat(filters.minRating) || undefined,
    inStock: filters.inStock === 'true',
    attributes: filters.attr ? JSON.parse(filters.attr) : undefined
  };

  const searchService = new ProductSearchService();
  const results = await searchService.search(q, parsedFilters, { page, pageSize, sort });
  
  res.json(results);
});
```

**Key Takeaways:**
- **Elasticsearch aggregations** provide facet counts in single query
- **Multi-match with boosting** improves search relevance
- **Filter vs Must** - filters don't affect scoring and are cached
- **Nested aggregations** handle dynamic attributes
- **Fuzziness** handles user typos gracefully

---

### Q5: Abandoned Cart Recovery System

**Problem:**
Build an abandoned cart recovery system that sends reminder emails at 1 hour, 24 hours, and 72 hours after cart abandonment. Include personalized recommendations and discount incentives.

---

**Solution Approach:**

Abandoned cart recovery is a **delayed job scheduling** problem:

1. **Track cart activity** - Reset reminder schedule on any cart interaction
2. **Schedule reminders** - Queue emails at specific delays (1h, 24h, 72h)
3. **Cancel on activity** - If user returns to cart, cancel pending reminders
4. **Personalization** - Include relevant product recommendations
5. **Progressive incentives** - Increase discount with each reminder

**System Flow:**
```
User adds to cart
    ↓
Schedule 3 reminder jobs (1h, 24h, 72h delays)
    ↓
User active on cart? → Cancel existing jobs, reschedule
    ↓
User inactive → Jobs fire at scheduled times
    ↓
Each job:
  - Check if cart still active (not checked out)
  - Check if user opted in to emails
  - Generate personalized content
  - Send email with discount (increases with each)
```

**Solution:**

```javascript
const Queue = require('bull');
const abandonedCartQueue = new Queue('abandoned-cart', process.env.REDIS_URL);

class AbandonedCartService {
  constructor() {
    /**
     * REMINDER SCHEDULE
     * 
     * Each reminder has:
     * - delay: When to send after last activity
     * - type: Identifier for this reminder
     * - discountPercent: Incentive (increases over time)
     */
    this.REMINDER_SCHEDULE = [
      { delay: 1 * 60 * 60 * 1000, type: 'first', discountPercent: 0 },   // 1 hour, no discount
      { delay: 24 * 60 * 60 * 1000, type: 'second', discountPercent: 5 }, // 24 hours, 5% off
      { delay: 72 * 60 * 60 * 1000, type: 'final', discountPercent: 10 }  // 72 hours, 10% off
    ];
  }

  /**
   * Track cart activity and reset reminder schedule
   * 
   * Called whenever user interacts with cart (add, update, view)
   * 
   * LOGIC:
   * 1. Cancel any pending reminder jobs for this cart
   * 2. Update last activity timestamp
   * 3. Schedule new reminder jobs from current time
   */
  async trackCartActivity(userId, cartId) {
    // Cancel existing scheduled reminders
    await this.cancelRecoveryJobs(cartId);

    // Update activity timestamp
    await Cart.update(
      { lastActivityAt: new Date() },
      { where: { id: cartId } }
    );

    // Schedule fresh reminders from now
    await this.scheduleRecoveryJobs(userId, cartId);
  }

  /**
   * Schedule all reminder jobs for a cart
   */
  async scheduleRecoveryJobs(userId, cartId) {
    for (const reminder of this.REMINDER_SCHEDULE) {
      // Unique job ID allows us to find and cancel it later
      const jobId = `cart-${cartId}-${reminder.type}`;
      
      await abandonedCartQueue.add(
        'send-reminder',
        { userId, cartId, reminderType: reminder.type },
        {
          delay: reminder.delay,        // When to process
          jobId,                         // Unique identifier
          removeOnComplete: true,        // Clean up after success
          attempts: 3                    // Retry on failure
        }
      );
    }
  }

  /**
   * Cancel pending reminder jobs for a cart
   * 
   * Called when:
   * - User returns to cart (reschedule)
   * - User completes checkout (no longer needed)
   */
  async cancelRecoveryJobs(cartId) {
    for (const reminder of this.REMINDER_SCHEDULE) {
      const jobId = `cart-${cartId}-${reminder.type}`;
      const job = await abandonedCartQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    }
  }

  /**
   * Process a reminder job
   * 
   * LOGIC:
   * 1. Verify cart is still active (not checked out)
   * 2. Check if enough time has passed since last activity
   * 3. Verify user email preferences
   * 4. Generate personalized email content
   * 5. Send email and track it
   */
  async processReminder(userId, cartId, reminderType) {
    // Fetch cart with items
    const cart = await Cart.findByPk(cartId, {
      include: [{ model: CartItem, include: [Product] }]
    });

    // GUARD: Cart no longer exists or already checked out
    if (!cart || cart.status !== 'active') {
      return { skipped: true, reason: 'Cart not active' };
    }

    // GUARD: User was recently active (job might be stale)
    const timeSinceActivity = Date.now() - cart.lastActivityAt.getTime();
    const reminder = this.REMINDER_SCHEDULE.find(r => r.type === reminderType);
    
    // Allow 10% tolerance on timing
    if (timeSinceActivity < reminder.delay * 0.9) {
      return { skipped: true, reason: 'Recent activity detected' };
    }

    const user = await User.findByPk(userId);
    
    // GUARD: Respect user's email preferences
    if (!user.emailPreferences.marketingEmails) {
      return { skipped: true, reason: 'User opted out' };
    }

    // Generate personalized email content
    const emailContent = await this.generateEmailContent(user, cart, reminder);

    // Send the email
    await emailService.send({
      to: user.email,
      subject: emailContent.subject,
      template: 'abandoned-cart',
      data: emailContent
    });

    // Track for analytics and prevent duplicates
    await AbandonedCartEmail.create({
      userId,
      cartId,
      reminderType,
      sentAt: new Date(),
      discountCode: emailContent.discountCode
    });

    return { sent: true, reminderType };
  }

  /**
   * Generate personalized email content
   * 
   * Includes:
   * - Cart items with images
   * - Product recommendations
   * - Time-limited discount (if applicable)
   * - Urgency messaging
   */
  async generateEmailContent(user, cart, reminder) {
    // Format cart items
    const items = cart.CartItems.map(item => ({
      name: item.Product.name,
      image: item.Product.imageUrl,
      price: item.Product.price,
      quantity: item.quantity,
      subtotal: item.Product.price * item.quantity
    }));

    // Get personalized recommendations based on cart contents
    const recommendations = await this.getRecommendations(
      user.id,
      cart.CartItems.map(i => i.productId)
    );

    // Generate discount code for this reminder
    let discountCode = null;
    if (reminder.discountPercent > 0) {
      discountCode = await this.generateDiscountCode(
        user.id,
        cart.id,
        reminder.discountPercent
      );
    }

    // Calculate totals
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const discount = discountCode 
      ? subtotal * (reminder.discountPercent / 100) 
      : 0;

    return {
      subject: this.getSubject(reminder.type, user.firstName),
      firstName: user.firstName,
      items,
      subtotal,
      discount,
      total: subtotal - discount,
      discountCode,
      discountPercent: reminder.discountPercent,
      recommendations,
      cartUrl: `${process.env.FRONTEND_URL}/cart?recover=${cart.id}`,
      expiresIn: reminder.type === 'final' ? '24 hours' : null
    };
  }

  /**
   * Email subjects that increase urgency over time
   */
  getSubject(type, firstName) {
    const subjects = {
      first: `${firstName}, you left something behind!`,
      second: `Still thinking about it, ${firstName}?`,
      final: `Last chance! Your cart is expiring soon`
    };
    return subjects[type];
  }

  /**
   * Get product recommendations based on cart contents
   * 
   * Uses "frequently bought together" data
   */
  async getRecommendations(userId, cartProductIds) {
    const recommendations = await Product.findAll({
      include: [{
        model: ProductRelation,
        where: {
          relatedProductId: { [Op.in]: cartProductIds },
          type: 'frequently_bought_together'
        }
      }],
      where: {
        id: { [Op.notIn]: cartProductIds }  // Don't recommend items already in cart
      },
      limit: 4,
      order: [[ProductRelation, 'score', 'DESC']]
    });

    return recommendations;
  }

  /**
   * Generate single-use discount code for this user
   */
  async generateDiscountCode(userId, cartId, percent) {
    const code = `SAVE${percent}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    await Coupon.create({
      code,
      type: 'percentage',
      value: percent,
      maxUsage: 1,          // Single use
      userId,               // Only for this user
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: { source: 'abandoned_cart', cartId }
    });

    return code;
  }
}

/**
 * Queue processor - handles reminder jobs
 */
abandonedCartQueue.process('send-reminder', async (job) => {
  const { userId, cartId, reminderType } = job.data;
  const service = new AbandonedCartService();
  return service.processReminder(userId, cartId, reminderType);
});

/**
 * Middleware to track cart activity
 * 
 * Attached to all cart-related endpoints
 */
app.use('/api/cart/*', async (req, res, next) => {
  if (req.user && req.user.cartId) {
    const service = new AbandonedCartService();
    // Reset reminder schedule on any cart activity
    await service.trackCartActivity(req.user.id, req.user.cartId);
  }
  next();
});
```

**Key Takeaways:**
- **Bull queue** provides reliable delayed job scheduling
- **Job IDs** enable cancellation of pending jobs
- **Progressive incentives** increase conversion over time
- **Guard conditions** prevent unnecessary emails
- **Personalization** improves engagement rates

---

### Q6-Q10: Additional E-Commerce Problems (Summary)

**Q6: Product Review System**
- Verify purchase before allowing reviews
- Calculate helpfulness scores based on votes
- Detect spam patterns (duplicate text, suspicious timing)
- Aggregate ratings with weighted average

**Q7: Wishlist with Alerts**
- Track price history for items
- Monitor stock levels
- Send notifications when price drops or item restocks
- Handle notification preferences and frequency

**Q8: Multi-Vendor Order Splitting**
- Split single order into per-vendor sub-orders
- Coordinate partial shipments
- Handle vendor-specific payment splits
- Manage returns across vendors

**Q9: Gift Card System**
- Generate unique, secure codes
- Track balance with transaction history
- Handle partial redemptions
- Support expiration and refunds

**Q10: Product Comparison**
- Normalize attributes across products
- Highlight key differences
- Generate comparison matrix
- Cache popular comparisons

---

## FinTech & Banking

### Q11: Transaction Rate Limiter with Fraud Detection

**Problem:**
Implement a transaction rate limiter that blocks suspicious patterns: multiple transactions in short time, unusual amounts, new device/location, velocity checks across accounts.

---

**Solution Approach:**

Fraud detection requires **multi-dimensional analysis** of each transaction:

1. **Velocity Rules**: Too many transactions in time window
2. **Amount Rules**: Unusual transaction sizes for this user
3. **Device Rules**: New or suspicious device fingerprints
4. **Location Rules**: Impossible travel, high-risk regions

Each rule produces a **risk score** (0-100). Combined scores determine action:
- Score < 50: Allow
- Score 50-70: Require additional verification (MFA)
- Score > 70: Block transaction

**Solution:**

```javascript
const Redis = require('ioredis');
const redis = new Redis();

class TransactionRateLimiter {
  constructor() {
    // Each rule is a separate class for modularity
    this.rules = [
      new VelocityRule(),
      new AmountRule(),
      new DeviceRule(),
      new LocationRule(),
      new TimePatternRule()
    ];
  }

  /**
   * Evaluate a transaction against all fraud rules
   * 
   * LOGIC:
   * 1. Build context with user history and transaction details
   * 2. Evaluate each rule independently
   * 3. Sum risk scores
   * 4. Determine action (allow, MFA, block)
   */
  async checkTransaction(transaction) {
    // Gather all context needed for rule evaluation
    const context = await this.buildContext(transaction);
    
    const results = [];
    let blocked = false;
    let riskScore = 0;

    // Evaluate each rule
    for (const rule of this.rules) {
      const result = await rule.evaluate(context);
      results.push(result);
      riskScore += result.riskScore;
      
      // Some rules can block immediately
      if (result.block) {
        blocked = true;
      }
    }

    // Determine final decision
    const decision = {
      allowed: !blocked && riskScore < 70,
      riskScore,
      requiresMFA: riskScore >= 50 && riskScore < 70,  // Medium risk = verify
      blocked,
      reasons: results.filter(r => r.riskScore > 0).map(r => r.reason),
      ruleResults: results
    };

    // Log for audit trail and ML training
    await this.logDecision(transaction, decision);

    return decision;
  }

  /**
   * Build evaluation context with user history
   */
  async buildContext(transaction) {
    const { userId, amount, deviceId, ipAddress, merchantId } = transaction;

    // Parallel fetch for performance
    const [recentTransactions, userProfile, deviceHistory, locationData] = 
      await Promise.all([
        this.getRecentTransactions(userId, '24h'),
        this.getUserProfile(userId),
        this.getDeviceHistory(userId, deviceId),
        this.getLocationFromIP(ipAddress)
      ]);

    return {
      transaction,
      recentTransactions,
      userProfile,
      deviceHistory,
      locationData,
      timestamp: Date.now()
    };
  }

  /**
   * Get user's recent transactions from Redis
   * Stored in sorted set with timestamp as score
   */
  async getRecentTransactions(userId, period) {
    const key = `transactions:${userId}`;
    const since = Date.now() - this.parsePeriod(period);
    
    const transactions = await redis.zrangebyscore(
      key,
      since,
      '+inf',
      'WITHSCORES'
    );

    return this.parseTransactions(transactions);
  }

  /**
   * Get user's behavioral profile (built from historical data)
   */
  async getUserProfile(userId) {
    const profile = await redis.hgetall(`user:profile:${userId}`);
    return {
      avgTransactionAmount: parseFloat(profile.avgAmount) || 0,
      maxTransactionAmount: parseFloat(profile.maxAmount) || 0,
      typicalHours: JSON.parse(profile.typicalHours || '[]'),
      trustedDevices: JSON.parse(profile.trustedDevices || '[]'),
      typicalLocations: JSON.parse(profile.typicalLocations || '[]'),
      accountAge: parseInt(profile.accountAge) || 0
    };
  }
}

/**
 * VELOCITY RULE
 * 
 * Detects rapid-fire transactions that indicate fraud
 * (e.g., testing stolen card with small amounts)
 */
class VelocityRule {
  name = 'velocity';

  async evaluate(context) {
    const { recentTransactions } = context;
    
    // Time windows with max transactions allowed
    const windows = [
      { period: '1m', max: 3, weight: 40 },   // Max 3 per minute
      { period: '5m', max: 10, weight: 30 },  // Max 10 per 5 minutes
      { period: '1h', max: 30, weight: 20 },  // Max 30 per hour
      { period: '24h', max: 100, weight: 10 } // Max 100 per day
    ];

    let totalRisk = 0;
    const violations = [];

    for (const window of windows) {
      const count = this.countInWindow(recentTransactions, window.period);
      
      // Exceeded limit for this window
      if (count >= window.max) {
        totalRisk += window.weight;
        violations.push(`${count} transactions in ${window.period}`);
      }
    }

    return {
      rule: this.name,
      riskScore: Math.min(totalRisk, 100),  // Cap at 100
      block: totalRisk >= 70,
      reason: violations.length > 0 
        ? `High velocity: ${violations.join(', ')}`
        : null
    };
  }

  countInWindow(transactions, period) {
    const ms = this.parsePeriod(period);
    const since = Date.now() - ms;
    return transactions.filter(t => t.timestamp > since).length;
  }

  parsePeriod(period) {
    const units = { m: 60000, h: 3600000, d: 86400000 };
    const match = period.match(/(\d+)([mhd])/);
    return parseInt(match[1]) * units[match[2]];
  }
}

/**
 * AMOUNT RULE
 * 
 * Flags transactions that deviate from user's normal behavior
 */
class AmountRule {
  name = 'amount';

  async evaluate(context) {
    const { transaction, userProfile, recentTransactions } = context;
    const { amount } = transaction;

    let riskScore = 0;
    const reasons = [];

    // DEVIATION CHECK: Compare to user's average
    if (userProfile.avgTransactionAmount > 0) {
      const deviation = amount / userProfile.avgTransactionAmount;
      
      if (deviation > 10) {
        // 10x normal = very suspicious
        riskScore += 50;
        reasons.push(`Amount ${deviation.toFixed(1)}x higher than average`);
      } else if (deviation > 5) {
        riskScore += 30;
        reasons.push(`Amount ${deviation.toFixed(1)}x higher than average`);
      } else if (deviation > 3) {
        riskScore += 15;
      }
    }

    // ROUND NUMBER CHECK: Fraudsters often use round numbers
    if (amount >= 1000 && amount % 100 === 0) {
      riskScore += 10;
      reasons.push('Suspiciously round amount');
    }

    // CUMULATIVE CHECK: Daily total exceeding patterns
    const dailyTotal = recentTransactions
      .filter(t => t.timestamp > Date.now() - 86400000)
      .reduce((sum, t) => sum + t.amount, 0) + amount;

    if (dailyTotal > userProfile.maxTransactionAmount * 5) {
      riskScore += 30;
      reasons.push('Daily cumulative exceeds normal limits');
    }

    return {
      rule: this.name,
      riskScore: Math.min(riskScore, 100),
      block: riskScore >= 80,
      reason: reasons.length > 0 ? reasons.join('; ') : null
    };
  }
}

/**
 * DEVICE RULE
 * 
 * Evaluates device trustworthiness
 */
class DeviceRule {
  name = 'device';

  async evaluate(context) {
    const { transaction, userProfile, deviceHistory } = context;
    const { deviceId, deviceFingerprint } = transaction;

    let riskScore = 0;
    const reasons = [];

    // NEW DEVICE CHECK
    if (!userProfile.trustedDevices.includes(deviceId)) {
      riskScore += 25;
      reasons.push('New device');

      // Extra risk if device seen for first time today
      if (!deviceHistory || deviceHistory.firstSeen > Date.now() - 86400000) {
        riskScore += 25;
        reasons.push('Device seen for less than 24 hours');
      }
    }

    // DEVICE FINGERPRINT ANOMALIES
    if (deviceFingerprint) {
      const suspiciousIndicators = [
        deviceFingerprint.isEmulator,     // Running in emulator
        deviceFingerprint.isRooted,       // Rooted/jailbroken
        deviceFingerprint.hasVPN,         // VPN active
        deviceFingerprint.hasProxy        // Proxy detected
      ];

      const suspiciousCount = suspiciousIndicators.filter(Boolean).length;
      riskScore += suspiciousCount * 15;
      
      if (suspiciousCount > 0) {
        reasons.push('Suspicious device configuration');
      }
    }

    return {
      rule: this.name,
      riskScore: Math.min(riskScore, 100),
      block: riskScore >= 75,
      reason: reasons.length > 0 ? reasons.join('; ') : null
    };
  }
}

/**
 * LOCATION RULE
 * 
 * Detects geographic anomalies (impossible travel, high-risk regions)
 */
class LocationRule {
  name = 'location';

  async evaluate(context) {
    const { transaction, userProfile, locationData, recentTransactions } = context;

    let riskScore = 0;
    const reasons = [];

    // UNUSUAL LOCATION CHECK
    const isTypicalLocation = userProfile.typicalLocations.some(loc =>
      this.isNearby(loc, locationData, 100)  // 100km threshold
    );

    if (!isTypicalLocation) {
      riskScore += 30;
      reasons.push(`Unusual location: ${locationData.city}, ${locationData.country}`);
    }

    // IMPOSSIBLE TRAVEL CHECK
    // If user transacted from NYC 30 min ago, can't be in London now
    if (recentTransactions.length > 0) {
      const lastTransaction = recentTransactions[recentTransactions.length - 1];
      const timeDiff = Date.now() - lastTransaction.timestamp;  // milliseconds
      const distance = this.calculateDistance(lastTransaction.location, locationData);
      
      // Calculate speed (km/h)
      const speed = distance / (timeDiff / 3600000);
      
      // Speed > 1000 km/h is physically impossible (except Concorde!)
      if (speed > 1000) {
        riskScore += 50;
        reasons.push(
          `Impossible travel: ${distance.toFixed(0)}km in ${(timeDiff/60000).toFixed(0)} minutes`
        );
      }
    }

    // HIGH-RISK COUNTRY CHECK
    const highRiskCountries = ['XX', 'YY', 'ZZ'];  // Configurable list
    if (highRiskCountries.includes(locationData.countryCode)) {
      riskScore += 40;
      reasons.push('High-risk country');
    }

    return {
      rule: this.name,
      riskScore: Math.min(riskScore, 100),
      block: riskScore >= 80,
      reason: reasons.length > 0 ? reasons.join('; ') : null
    };
  }

  /**
   * Haversine formula for distance between two points
   */
  calculateDistance(loc1, loc2) {
    const R = 6371;  // Earth's radius in km
    const dLat = this.toRad(loc2.lat - loc1.lat);
    const dLon = this.toRad(loc2.lon - loc1.lon);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(loc1.lat)) * Math.cos(this.toRad(loc2.lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  toRad(deg) {
    return deg * Math.PI / 180;
  }
}

// API USAGE
app.post('/api/transactions', async (req, res) => {
  const limiter = new TransactionRateLimiter();
  const decision = await limiter.checkTransaction(req.body);

  if (decision.blocked) {
    return res.status(403).json({
      error: 'Transaction blocked',
      reasons: decision.reasons
    });
  }

  if (decision.requiresMFA) {
    return res.status(428).json({
      error: 'Additional verification required',
      mfaRequired: true
    });
  }

  // Process transaction
  const result = await transactionService.process(req.body);
  res.json(result);
});
```

**Key Takeaways:**
- **Multi-rule evaluation** catches different fraud patterns
- **Risk scoring** allows nuanced decisions (not just block/allow)
- **User profiling** establishes behavioral baselines
- **Impossible travel** detection is highly effective against account takeover
- **Audit logging** enables both compliance and ML model training

---

### Q12: Account Balance Reconciliation

**Problem:**
Build a system that reconciles account balances across multiple sources (database, payment processor, ledger) with discrepancy detection and auto-healing.

---

**Solution Approach:**

Financial systems often have **multiple sources of truth** that must agree:
- **Application database**: Current balance for display
- **Payment processor**: What Stripe/PayPal thinks the balance is
- **Ledger**: Immutable transaction log (source of truth)

Reconciliation ensures these stay in sync and catches issues early.

**Process:**
1. Fetch balance from each source
2. Compare balances (with tolerance for timing)
3. If discrepancy: determine authoritative balance
4. Auto-heal small discrepancies, escalate large ones

**Solution:**

```javascript
class ReconciliationService {
  constructor() {
    // Data sources to reconcile
    this.sources = {
      database: new DatabaseSource(),
      paymentProcessor: new PaymentProcessorSource(),
      ledger: new LedgerSource()  // Ledger is source of truth
    };
    this.tolerancePercent = 0.01;  // 1% tolerance for timing differences
  }

  /**
   * Reconcile a single account across all sources
   */
  async reconcileAccount(accountId) {
    const results = {};
    const discrepancies = [];

    // STEP 1: Fetch balances from all sources in parallel
    for (const [name, source] of Object.entries(this.sources)) {
      try {
        results[name] = await source.getBalance(accountId);
      } catch (error) {
        results[name] = { error: error.message };
      }
    }

    // STEP 2: Compare balances
    const balances = Object.entries(results)
      .filter(([_, v]) => !v.error)
      .map(([name, data]) => ({
        source: name,
        balance: data.balance,
        timestamp: data.timestamp
      }));

    // Need at least 2 sources to compare
    if (balances.length < 2) {
      return {
        status: 'error',
        message: 'Insufficient sources available',
        results
      };
    }

    // STEP 3: Find discrepancies
    const referenceBalance = balances[0].balance;
    
    for (let i = 1; i < balances.length; i++) {
      const diff = Math.abs(balances[i].balance - referenceBalance);
      const percentDiff = (diff / referenceBalance) * 100;

      // Check if difference exceeds tolerance
      if (percentDiff > this.tolerancePercent) {
        discrepancies.push({
          source1: balances[0].source,
          source2: balances[i].source,
          balance1: balances[0].balance,
          balance2: balances[i].balance,
          difference: diff,
          percentDiff
        });
      }
    }

    // Log result
    const reconciliationResult = {
      accountId,
      timestamp: new Date(),
      sources: results,
      discrepancies,
      status: discrepancies.length === 0 ? 'matched' : 'discrepancy'
    };

    await ReconciliationLog.create(reconciliationResult);

    // STEP 4: Handle discrepancies
    if (discrepancies.length > 0) {
      await this.handleDiscrepancies(accountId, discrepancies);
    }

    return reconciliationResult;
  }

  /**
   * Handle found discrepancies
   * 
   * LOGIC:
   * 1. Determine which source is authoritative (ledger usually)
   * 2. If clear: create auto-healing task
   * 3. If unclear: escalate for manual review
   */
  async handleDiscrepancies(accountId, discrepancies) {
    for (const discrepancy of discrepancies) {
      // Calculate expected balance from ledger transactions
      const authoritativeBalance = await this.determineAuthoritativeBalance(
        accountId,
        discrepancy
      );

      if (authoritativeBalance) {
        // We can determine the correct balance
        await this.createHealingTask(accountId, discrepancy, authoritativeBalance);
      } else {
        // Needs human investigation
        await this.escalateToManualReview(accountId, discrepancy);
      }
    }
  }

  /**
   * Determine the correct balance by recalculating from ledger
   * 
   * The ledger is an immutable transaction log - it's the ultimate
   * source of truth. Sum all transactions to get expected balance.
   */
  async determineAuthoritativeBalance(accountId, discrepancy) {
    // Get all transactions from ledger
    const ledgerTransactions = await this.sources.ledger.getTransactions(
      accountId,
      { since: '24h' }  // Look at recent transactions
    );

    // Recalculate balance from transaction history
    const calculatedBalance = await this.calculateBalanceFromTransactions(
      accountId,
      ledgerTransactions
    );

    const tolerance = 0.01;
    
    // If calculated matches one of the disputed balances, that's authoritative
    if (Math.abs(calculatedBalance - discrepancy.balance1) < tolerance) {
      return { balance: discrepancy.balance1, source: discrepancy.source1 };
    }
    
    if (Math.abs(calculatedBalance - discrepancy.balance2) < tolerance) {
      return { balance: discrepancy.balance2, source: discrepancy.source2 };
    }

    // Can't determine - need manual review
    return null;
  }

  /**
   * Create a task to fix the discrepancy
   */
  async createHealingTask(accountId, discrepancy, authoritativeBalance) {
    const wrongSource = authoritativeBalance.source === discrepancy.source1 
      ? discrepancy.source2 
      : discrepancy.source1;
      
    const wrongBalance = authoritativeBalance.source === discrepancy.source1
      ? discrepancy.balance2
      : discrepancy.balance1;

    const adjustmentNeeded = authoritativeBalance.balance - wrongBalance;

    const task = await HealingTask.create({
      accountId,
      type: 'balance_adjustment',
      fromSource: wrongSource,
      toBalance: authoritativeBalance.balance,
      adjustment: adjustmentNeeded,
      status: 'pending',
      // Auto-approve small adjustments (< $10)
      autoApproved: Math.abs(adjustmentNeeded) < 10
    });

    // Apply auto-approved adjustments immediately
    if (Math.abs(adjustmentNeeded) < 10) {
      await this.applyAdjustment(accountId, adjustmentNeeded);
    }
    
    return task;
  }

  /**
   * Run reconciliation for all active accounts
   * Typically scheduled as nightly batch job
   */
  async runFullReconciliation() {
    const accounts = await Account.findAll({ where: { active: true } });
    const results = {
      total: accounts.length,
      matched: 0,
      discrepancies: 0,
      errors: 0,
      details: []
    };

    // Process in batches to avoid overwhelming sources
    const batchSize = 100;
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(account => this.reconcileAccount(account.id))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'matched') {
            results.matched++;
          } else {
            results.discrepancies++;
            results.details.push(result.value);
          }
        } else {
          results.errors++;
        }
      }
    }

    // Generate and store report
    await this.generateReconciliationReport(results);

    return results;
  }

  /**
   * Generate reconciliation report and alert on issues
   */
  async generateReconciliationReport(results) {
    const report = {
      runDate: new Date(),
      summary: {
        totalAccounts: results.total,
        matched: results.matched,
        discrepancies: results.discrepancies,
        matchRate: ((results.matched / results.total) * 100).toFixed(2) + '%'
      },
      discrepancyDetails: results.details.map(d => ({
        accountId: d.accountId,
        discrepancies: d.discrepancies
      }))
    };

    await ReconciliationReport.create(report);

    // Alert if discrepancy rate is too high (> 1%)
    if (results.discrepancies / results.total > 0.01) {
      await alertService.send({
        severity: 'high',
        type: 'reconciliation_alert',
        message: `High discrepancy rate: ${results.discrepancies} of ${results.total} accounts`
      });
    }

    return report;
  }
}

// Schedule nightly reconciliation
const cron = require('node-cron');

cron.schedule('0 2 * * *', async () => {  // Run at 2 AM daily
  const service = new ReconciliationService();
  await service.runFullReconciliation();
});
```

**Key Takeaways:**
- **Ledger as source of truth** enables deterministic reconciliation
- **Tolerance thresholds** account for timing differences
- **Auto-healing** reduces manual work for small discrepancies
- **Batch processing** handles large account volumes efficiently
- **Alerting** catches systemic issues early

---

### Q13-Q20: Additional FinTech Problems (Summary)

**Q13: Peer-to-Peer Payments**
- Request/send money flows
- Payment splits with remainder handling
- Transaction memo and categorization
- Real-time balance updates

**Q14: Credit Scoring**
- Score based on transaction patterns
- Payment history weighting
- Account age factors
- Score change notifications

**Q15: Recurring Payments**
- Schedule management (weekly, monthly, etc.)
- Retry logic with exponential backoff
- Grace periods before failure
- Dunning email sequences

**Q16: Portfolio Tracker**
- Real-time price streaming
- Gain/loss calculations (realized vs unrealized)
- Historical performance charts
- Asset allocation analysis

**Q17: Multi-Currency Wallet**
- Real-time exchange rate fetching
- Conversion fee calculations
- Base currency reporting
- Exchange rate history

**Q18: Loan Application**
- Multi-step application flow
- Document upload and verification
- Eligibility pre-checks
- Approval workflow with comments

**Q19: Budget Tracking**
- Category-based spending limits
- Alert thresholds (80%, 100%)
- Spending insights and trends
- Category auto-detection from transactions

**Q20: Fraud Alert System**
- Real-time push notifications
- Card freeze/unfreeze toggle
- Alert preferences
- Trusted transaction marking

---

## Healthcare

### Q21: Appointment Scheduling with Conflicts

**Problem:**
Build a medical appointment system that handles doctor availability, appointment types with different durations, buffer times, recurring appointments, and waitlist management.

---

**Solution Approach:**

Medical scheduling has unique constraints:
1. **Slot-based availability**: Doctors have specific working hours
2. **Appointment types**: Different visit types have different durations
3. **Buffer times**: Time needed between appointments
4. **Conflict detection**: Both doctor AND patient conflicts
5. **Waitlist**: Notify patients when slots open up

**Slot Availability Algorithm:**
```
For each 15-minute slot in doctor's schedule:
  1. Check if within working hours
  2. Check if not in blocked times (breaks, meetings)
  3. Check if slot + appointment duration doesn't overlap existing appointments
  4. If all clear: slot is available
```

**Solution:**

```javascript
class AppointmentScheduler {
  constructor() {
    this.BUFFER_MINUTES = 10;  // Time between appointments
  }

  /**
   * Get available appointment slots for a doctor on a specific date
   * 
   * @param doctorId - Which doctor
   * @param date - Which date
   * @param appointmentTypeId - Type of appointment (determines duration)
   * @returns Array of available time slots
   */
  async getAvailableSlots(doctorId, date, appointmentTypeId) {
    // Get doctor's schedule for this day of week
    const doctor = await Doctor.findByPk(doctorId, {
      include: [{ model: Schedule, as: 'schedules' }]
    });

    const appointmentType = await AppointmentType.findByPk(appointmentTypeId);
    const duration = appointmentType.durationMinutes;

    // Find schedule for this day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = new Date(date).getDay();
    const schedule = doctor.schedules.find(s => s.dayOfWeek === dayOfWeek);

    // Doctor doesn't work this day
    if (!schedule || !schedule.isAvailable) {
      return [];
    }

    // Get existing appointments for this doctor on this date
    const existingAppointments = await Appointment.findAll({
      where: {
        doctorId,
        date,
        status: { [Op.in]: ['scheduled', 'confirmed'] }
      },
      order: [['startTime', 'ASC']]
    });

    // Get blocked times (lunch breaks, meetings, etc.)
    const blockedTimes = await BlockedTime.findAll({
      where: { doctorId, date }
    });

    // Generate available slots
    const slots = [];
    let currentTime = this.parseTime(schedule.startTime);  // e.g., 9:00 = 540 minutes
    const endTime = this.parseTime(schedule.endTime);       // e.g., 17:00 = 1020 minutes

    // Check each 15-minute slot
    while (currentTime + duration + this.BUFFER_MINUTES <= endTime) {
      const slotEnd = currentTime + duration;

      // Check if slot overlaps with blocked time
      const isBlocked = blockedTimes.some(bt =>
        this.overlaps(currentTime, slotEnd, bt.startTime, bt.endTime)
      );

      // Check if slot overlaps with existing appointment (including buffer)
      const hasConflict = existingAppointments.some(apt =>
        this.overlaps(
          currentTime,
          slotEnd + this.BUFFER_MINUTES,
          apt.startTime,
          apt.endTime + this.BUFFER_MINUTES
        )
      );

      // If no conflicts, this slot is available
      if (!isBlocked && !hasConflict) {
        slots.push({
          startTime: this.formatTime(currentTime),
          endTime: this.formatTime(slotEnd),
          duration
        });
      }

      currentTime += 15;  // Move to next 15-minute slot
    }

    return slots;
  }

  /**
   * Book an appointment
   * 
   * LOGIC:
   * 1. Verify slot is still available (prevent double-booking)
   * 2. Check patient doesn't have conflicting appointment
   * 3. Create appointment record
   * 4. Send confirmations and schedule reminders
   */
  async bookAppointment(data) {
    const { patientId, doctorId, date, startTime, appointmentTypeId, notes } = data;

    const appointmentType = await AppointmentType.findByPk(appointmentTypeId);
    const endTime = this.addMinutes(startTime, appointmentType.durationMinutes);

    // DOUBLE-BOOKING CHECK: Verify slot hasn't been taken since page loaded
    const conflict = await Appointment.findOne({
      where: {
        doctorId,
        date,
        status: { [Op.in]: ['scheduled', 'confirmed'] },
        [Op.or]: [{
          startTime: { [Op.lt]: endTime },
          endTime: { [Op.gt]: startTime }
        }]
      }
    });

    if (conflict) {
      throw new Error('Time slot is no longer available');
    }

    // PATIENT CONFLICT CHECK
    const patientConflict = await Appointment.findOne({
      where: {
        patientId,
        date,
        status: { [Op.in]: ['scheduled', 'confirmed'] },
        startTime: { [Op.lt]: endTime },
        endTime: { [Op.gt]: startTime }
      }
    });

    if (patientConflict) {
      throw new Error('Patient has conflicting appointment');
    }

    // Create the appointment
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      appointmentTypeId,
      date,
      startTime,
      endTime,
      notes,
      status: 'scheduled'
    });

    // Send confirmation emails to patient and doctor
    await this.sendConfirmations(appointment);

    // Schedule reminder notifications (24h and 1h before)
    await this.scheduleReminders(appointment);

    return appointment;
  }

  /**
   * Add patient to waitlist for appointment opening
   */
  async addToWaitlist(patientId, doctorId, preferredDates, appointmentTypeId) {
    const waitlistEntry = await Waitlist.create({
      patientId,
      doctorId,
      appointmentTypeId,
      preferredDates,  // Array of acceptable dates
      status: 'waiting',
      priority: await this.calculatePriority(patientId)  // VIP patients first
    });

    return waitlistEntry;
  }

  /**
   * When appointment is cancelled, offer slot to waitlist patients
   */
  async processWaitlist(doctorId, date, cancelledSlot) {
    // Find eligible waitlist entries (matching doctor, date, appointment type)
    const waitlistEntries = await Waitlist.findAll({
      where: {
        doctorId,
        status: 'waiting',
        preferredDates: { [Op.contains]: [date] }
      },
      order: [
        ['priority', 'DESC'],    // Highest priority first
        ['createdAt', 'ASC']     // Then by wait time
      ],
      include: [{ model: Patient }]
    });

    for (const entry of waitlistEntries) {
      const appointmentType = await AppointmentType.findByPk(entry.appointmentTypeId);
      
      // Check if cancelled slot fits this appointment type's duration
      if (this.slotFits(cancelledSlot, appointmentType.durationMinutes)) {
        // Notify patient about available slot
        const notificationSent = await this.notifyWaitlistPatient(
          entry,
          cancelledSlot,
          appointmentType
        );

        if (notificationSent) {
          // Update waitlist entry - patient has 30 min to respond
          await entry.update({
            status: 'offered',
            offeredSlot: cancelledSlot,
            offerExpiresAt: new Date(Date.now() + 30 * 60000)
          });

          // Hold slot temporarily so others can't book it
          await this.holdSlot(cancelledSlot, entry.id, 30);
          
          break;  // Only offer to one person at a time
        }
      }
    }
  }

  /**
   * Book recurring appointments (e.g., weekly therapy sessions)
   */
  async handleRecurringAppointment(data) {
    const { patientId, doctorId, startDate, startTime, appointmentTypeId, 
            recurrencePattern, occurrences } = data;

    const appointments = [];
    const recurringGroupId = crypto.randomUUID();  // Link all appointments
    let currentDate = new Date(startDate);

    for (let i = 0; i < occurrences; i++) {
      try {
        const appointment = await this.bookAppointment({
          patientId,
          doctorId,
          date: currentDate.toISOString().split('T')[0],
          startTime,
          appointmentTypeId,
          isRecurring: true,
          recurringGroupId
        });
        appointments.push(appointment);
      } catch (error) {
        // Log conflict but continue with other dates
        appointments.push({
          date: currentDate.toISOString().split('T')[0],
          error: error.message
        });
      }

      // Calculate next occurrence based on pattern
      currentDate = this.getNextOccurrence(currentDate, recurrencePattern);
    }

    return {
      successful: appointments.filter(a => a.id).length,
      failed: appointments.filter(a => a.error).length,
      appointments
    };
  }

  /**
   * Calculate next date based on recurrence pattern
   */
  getNextOccurrence(date, pattern) {
    const next = new Date(date);
    switch (pattern) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  /**
   * Check if two time ranges overlap
   */
  overlaps(start1, end1, start2, end2) {
    const s1 = typeof start1 === 'string' ? this.parseTime(start1) : start1;
    const e1 = typeof end1 === 'string' ? this.parseTime(end1) : end1;
    const s2 = typeof start2 === 'string' ? this.parseTime(start2) : start2;
    const e2 = typeof end2 === 'string' ? this.parseTime(end2) : end2;
    return s1 < e2 && s2 < e1;
  }

  /**
   * Convert "HH:MM" to minutes since midnight
   */
  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to "HH:MM"
   */
  formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
```

**Key Takeaways:**
- **Slot-based scheduling** simplifies availability calculations
- **Buffer times** prevent back-to-back appointments
- **Double-booking prevention** requires checking at book time
- **Waitlist management** maximizes slot utilization
- **Recurring appointments** handle partial failures gracefully

---

### Q22-Q25: Additional Healthcare Problems (Summary)

**Q22: Prescription Management**
- Drug interaction database lookups
- Refill reminders based on supply
- Pharmacy integration for e-prescribing
- Controlled substance tracking

**Q23: Walk-in Clinic Queue**
- Real-time queue position
- Estimated wait time calculation
- Priority override for emergencies
- Patient notification when turn approaches

**Q24: Telehealth Video Consultation**
- WebRTC for video calls
- Waiting room with queue position
- Session recording (with consent)
- Screen sharing for test results

**Q25: Medical Records Access**
- Patient consent management
- Role-based access control
- Comprehensive audit logging
- Emergency access with justification

---

## Remaining Sections (Q26-Q50) - Summary

Due to space constraints, here's what each remaining section covers:

---

## Social Media (Q26-Q30)

**Q26: News Feed Algorithm**
- Score posts by: engagement, recency, relationship, relevance
- Diversity rules to prevent feed monotony
- Real-time updates for new content

**Q27: Comment Threading**
- Nested replies with pagination
- Collapse/expand logic
- Real-time new comment updates

**Q28: Notification System**
- Group similar notifications
- Priority-based delivery
- Multi-channel (push, email, in-app)

**Q29: Content Moderation**
- Automated detection (ML-based)
- Human review queue
- Appeal workflow

**Q30: Hashtag Trending**
- Time-windowed counting
- Decay factor for recency
- Spam/abuse prevention

---

## Logistics & Delivery (Q31-Q35)

**Q31: Route Optimization**
- Nearest neighbor + simulated annealing
- Time window constraints
- Capacity constraints

**Q32: Package Tracking**
- Event-sourced status updates
- ETA predictions based on history
- Real-time customer notifications

**Q33: Warehouse Management**
- Zone-based picking optimization
- Inventory location tracking
- Replenishment alerts

**Q34: Fleet Management**
- Maintenance scheduling
- Fuel consumption tracking
- Driver assignment optimization

**Q35: Last-Mile Delivery**
- Dynamic driver matching
- Load balancing across drivers
- Customer preference handling

---

## IoT & Real-Time (Q36-Q40)

**Q36: Sensor Data Pipeline**
- Kafka for high-throughput ingestion
- Time-window aggregations
- Anomaly detection (Z-score)
- Alerting with cooldowns

**Q37: Device Provisioning**
- Secure onboarding flow
- Certificate generation/rotation
- Fleet management

**Q38: Command & Control**
- Remote configuration updates
- Firmware OTA updates
- Command acknowledgment

**Q39: Geofencing**
- Point-in-polygon detection
- Entry/exit events
- Historical location queries

**Q40: Predictive Maintenance**
- Pattern recognition in sensor data
- Failure prediction models
- Maintenance scheduling

---

## SaaS & Multi-Tenant (Q41-Q45)

**Q41: Usage-Based Billing**
- Meter different usage types
- Tiered pricing calculations
- Invoice generation

**Q42: Feature Flags**
- Percentage rollouts
- User targeting rules
- A/B test integration

**Q43: Tenant Isolation**
- Data partitioning strategies
- Resource quotas
- Cross-tenant security

**Q44: Audit Logging**
- Immutable event storage
- Query capabilities
- Compliance reporting

**Q45: White-Label Customization**
- Theme management
- Custom domain handling
- Branding configuration

---

## Media & Streaming (Q46-Q50)

**Q46: Video Transcoding Pipeline**
- FFmpeg for transcoding
- Multiple resolution outputs
- HLS playlist generation
- Thumbnail extraction

**Q47: Live Streaming**
- RTMP ingest
- Real-time chat integration
- Viewer count tracking
- Recording to VOD

**Q48: Content Recommendations**
- Collaborative filtering
- Content-based filtering
- Hybrid approaches

**Q49: Audio Fingerprinting**
- Audio feature extraction
- Fingerprint matching
- Copyright claim workflow

**Q50: Collaborative Playlists**
- Real-time sync via WebSocket
- Voting mechanism
- Queue management

---

## Summary

This guide covers **50 real-world problem-solving scenarios** across 8 domains:

| Domain | Key Patterns |
|--------|--------------|
| E-Commerce | Distributed locks, State machines, Search engines |
| FinTech | Rule engines, Reconciliation, Fraud detection |
| Healthcare | Scheduling algorithms, Conflict detection |
| Social Media | Feed ranking, Real-time updates |
| Logistics | Route optimization, Event sourcing |
| IoT | Stream processing, Anomaly detection |
| SaaS | Multi-tenancy, Usage metering |
| Media | Transcoding pipelines, Live streaming |

**Common Patterns Used:**
- **State Machines** for complex workflows
- **Queue-based processing** for async operations
- **Redis** for real-time data and caching
- **Event-driven architecture** for loose coupling
- **Distributed locking** for concurrency control
- **Rule engines** for business logic flexibility
