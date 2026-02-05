# MongoDB with Node.js Interview Questions

> **Focus**: MongoDB database operations with Node.js and Mongoose ODM
> **Total Questions**: 50
> **Complexity**: Progresses from basic to advanced

---

## Table of Contents
1. [MongoDB Basics (Q1-Q10)](#mongodb-basics)
2. [Mongoose ODM (Q11-Q20)](#mongoose-odm)
3. [Queries & Aggregation (Q21-Q30)](#queries--aggregation)
4. [Schema Design & Relationships (Q31-Q40)](#schema-design--relationships)
5. [Performance & Production (Q41-Q50)](#performance--production)

---

## MongoDB Basics

### Q1: What is MongoDB and how does it differ from relational databases?

**Answer:**
MongoDB is a NoSQL document-oriented database that stores data in flexible, JSON-like documents.

| Feature | MongoDB | Relational DB |
|---------|---------|---------------|
| Data Model | Document (BSON) | Tables with rows |
| Schema | Flexible/dynamic | Fixed schema |
| Relationships | Embedded or referenced | Foreign keys, JOINs |
| Scaling | Horizontal (sharding) | Vertical (typically) |
| Transactions | Supported (4.0+) | Full ACID |
| Query Language | MQL (MongoDB Query Language) | SQL |

```javascript
// MongoDB document example
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  name: "John Doe",
  email: "john@example.com",
  address: {
    street: "123 Main St",
    city: "New York",
    country: "USA"
  },
  orders: [
    { product: "Laptop", price: 999 },
    { product: "Mouse", price: 29 }
  ]
}

// vs Relational (3 tables needed)
// users, addresses, orders with foreign keys
```

---

### Q2: How do you connect to MongoDB from Node.js?

**Answer:**

```javascript
// Using native MongoDB driver
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});

async function connect() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('myDatabase');
    const collection = db.collection('users');
    
    // Perform operations
    const users = await collection.find({}).toArray();
    console.log(users);
  } catch (error) {
    console.error('Connection error:', error);
  }
}

// Using Mongoose (recommended for Node.js)
const mongoose = require('mongoose');

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4 // Use IPv4
};

async function connectMongoose() {
  try {
    await mongoose.connect('mongodb://localhost:27017/myDatabase', options);
    console.log('Connected to MongoDB via Mongoose');
  } catch (error) {
    console.error('Connection error:', error);
    process.exit(1);
  }
}

// Connection events
mongoose.connection.on('connected', () => console.log('Mongoose connected'));
mongoose.connection.on('error', (err) => console.error('Mongoose error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
```

---

### Q3: What is BSON and how does it differ from JSON?

**Answer:**
BSON (Binary JSON) is a binary representation of JSON-like documents used by MongoDB.

| Feature | JSON | BSON |
|---------|------|------|
| Format | Text-based | Binary |
| Size | Larger | Smaller (usually) |
| Parsing | Slower | Faster |
| Data Types | Limited | Extended |
| Traversal | Full parse needed | Supports element access |

**Additional BSON types:**
```javascript
// BSON supports additional types
const document = {
  _id: ObjectId(),           // 12-byte unique identifier
  date: new Date(),          // ISODate
  binary: Binary(),          // Binary data
  decimal: Decimal128(),     // 128-bit decimal
  int32: NumberInt(42),      // 32-bit integer
  int64: NumberLong(123),    // 64-bit integer
  regex: /pattern/i,         // Regular expression
  timestamp: Timestamp(),    // Internal MongoDB timestamp
  minKey: MinKey(),          // Smallest BSON element
  maxKey: MaxKey()           // Largest BSON element
};

// In Node.js with Mongoose
const { Types } = require('mongoose');

const doc = {
  _id: new Types.ObjectId(),
  buffer: Buffer.from('binary data'),
  decimal: Types.Decimal128.fromString('99.99')
};
```

---

### Q4: What is ObjectId and how is it generated?

**Answer:**
ObjectId is a 12-byte unique identifier used as the default `_id` field.

**Structure (12 bytes):**
- 4 bytes: Unix timestamp
- 5 bytes: Random value (per process)
- 3 bytes: Incrementing counter

```javascript
const { ObjectId } = require('mongodb');
// or
const { Types } = require('mongoose');

// Create new ObjectId
const id1 = new ObjectId();
const id2 = new Types.ObjectId();

// Create from string
const id3 = new ObjectId('507f1f77bcf86cd799439011');

// Extract timestamp
const timestamp = id1.getTimestamp();
console.log(timestamp); // Date object

// Validate ObjectId string
const isValid = ObjectId.isValid('507f1f77bcf86cd799439011'); // true
const isInvalid = ObjectId.isValid('invalid'); // false

// Compare ObjectIds
const equal = id1.equals(id2); // false

// Convert to string
const idString = id1.toString();

// In queries
const user = await User.findById('507f1f77bcf86cd799439011');
// or
const user = await User.findOne({ _id: new ObjectId('507f1f77bcf86cd799439011') });
```

---

### Q5: What are the basic CRUD operations in MongoDB with Node.js?

**Answer:**

```javascript
const { MongoClient } = require('mongodb');

async function crudOperations(db) {
  const users = db.collection('users');

  // CREATE
  // Insert one
  const insertResult = await users.insertOne({
    name: 'John',
    email: 'john@example.com',
    createdAt: new Date()
  });
  console.log('Inserted ID:', insertResult.insertedId);

  // Insert many
  const insertManyResult = await users.insertMany([
    { name: 'Jane', email: 'jane@example.com' },
    { name: 'Bob', email: 'bob@example.com' }
  ]);
  console.log('Inserted count:', insertManyResult.insertedCount);

  // READ
  // Find one
  const user = await users.findOne({ email: 'john@example.com' });
  
  // Find many
  const allUsers = await users.find({}).toArray();
  
  // Find with filter
  const activeUsers = await users.find({ 
    status: 'active',
    age: { $gte: 18 }
  }).toArray();
  
  // Find with projection (select fields)
  const userNames = await users.find({}, { 
    projection: { name: 1, email: 1 } 
  }).toArray();

  // UPDATE
  // Update one
  const updateResult = await users.updateOne(
    { email: 'john@example.com' },
    { $set: { name: 'John Doe', updatedAt: new Date() } }
  );
  console.log('Modified count:', updateResult.modifiedCount);

  // Update many
  const updateManyResult = await users.updateMany(
    { status: 'inactive' },
    { $set: { archived: true } }
  );

  // Replace document
  const replaceResult = await users.replaceOne(
    { email: 'john@example.com' },
    { name: 'John', email: 'john@example.com', replaced: true }
  );

  // Upsert (insert if not exists)
  const upsertResult = await users.updateOne(
    { email: 'new@example.com' },
    { $set: { name: 'New User' } },
    { upsert: true }
  );

  // DELETE
  // Delete one
  const deleteResult = await users.deleteOne({ email: 'bob@example.com' });
  console.log('Deleted count:', deleteResult.deletedCount);

  // Delete many
  const deleteManyResult = await users.deleteMany({ archived: true });
}
```

---

### Q6: What are MongoDB query operators?

**Answer:**

```javascript
const collection = db.collection('products');

// Comparison Operators
await collection.find({
  price: { $eq: 100 },     // Equal
  price: { $ne: 100 },     // Not equal
  price: { $gt: 100 },     // Greater than
  price: { $gte: 100 },    // Greater than or equal
  price: { $lt: 100 },     // Less than
  price: { $lte: 100 },    // Less than or equal
  status: { $in: ['active', 'pending'] },    // In array
  status: { $nin: ['deleted', 'archived'] }  // Not in array
});

// Logical Operators
await collection.find({
  $and: [{ price: { $gt: 10 } }, { price: { $lt: 100 } }],
  $or: [{ status: 'active' }, { featured: true }],
  $nor: [{ deleted: true }, { archived: true }],
  price: { $not: { $gt: 100 } }
});

// Element Operators
await collection.find({
  description: { $exists: true },   // Field exists
  age: { $type: 'number' }          // Field type check
});

// Array Operators
await collection.find({
  tags: { $all: ['tech', 'node'] },          // Contains all
  tags: { $elemMatch: { $gt: 1, $lt: 5 } },  // Element matches
  tags: { $size: 3 }                          // Array size
});

// Evaluation Operators
await collection.find({
  name: { $regex: /^john/i },    // Regular expression
  $text: { $search: 'coffee' },  // Text search
  $where: 'this.price < this.cost' // JavaScript expression (slow)
});

// Update Operators
await collection.updateOne(
  { _id: id },
  {
    $set: { status: 'active' },           // Set field value
    $unset: { tempField: '' },            // Remove field
    $inc: { views: 1, likes: 5 },         // Increment
    $mul: { price: 1.1 },                 // Multiply
    $rename: { 'oldName': 'newName' },    // Rename field
    $min: { lowScore: 50 },               // Update if less
    $max: { highScore: 100 },             // Update if greater
    $currentDate: { lastModified: true }, // Set to current date
    
    // Array update operators
    $push: { tags: 'new' },               // Add to array
    $pull: { tags: 'old' },               // Remove from array
    $addToSet: { tags: 'unique' },        // Add if not exists
    $pop: { tags: 1 },                    // Remove last element
    $pullAll: { tags: ['a', 'b'] }        // Remove multiple
  }
);
```

---

### Q7: How do you handle errors and exceptions in MongoDB operations?

**Answer:**

```javascript
const mongoose = require('mongoose');

// Error handling patterns
async function handleMongoErrors() {
  try {
    const user = await User.create({
      email: 'test@example.com',
      name: 'Test'
    });
  } catch (error) {
    // Duplicate key error (E11000)
    if (error.code === 11000) {
      console.error('Duplicate key error:', error.keyValue);
      throw new ConflictError('Email already exists');
    }
    
    // Validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      throw new ValidationError(messages);
    }
    
    // Cast error (invalid ObjectId)
    if (error.name === 'CastError') {
      throw new BadRequestError(`Invalid ${error.path}: ${error.value}`);
    }
    
    // Document not found
    if (error.name === 'DocumentNotFoundError') {
      throw new NotFoundError('Document not found');
    }
    
    // Connection errors
    if (error.name === 'MongoNetworkError') {
      console.error('Network error:', error);
      throw new ServiceUnavailableError('Database unavailable');
    }
    
    // Timeout errors
    if (error.name === 'MongoTimeoutError') {
      console.error('Timeout error:', error);
      throw new ServiceUnavailableError('Database timeout');
    }
    
    // Re-throw unknown errors
    throw error;
  }
}

// Custom error classes
class MongoErrorHandler {
  static handle(error) {
    const errorMap = {
      11000: {
        status: 409,
        message: 'Duplicate key error',
        getDetails: (e) => ({ field: Object.keys(e.keyValue)[0] })
      },
      ValidationError: {
        status: 400,
        message: 'Validation failed',
        getDetails: (e) => ({
          errors: Object.entries(e.errors).map(([field, err]) => ({
            field,
            message: err.message
          }))
        })
      },
      CastError: {
        status: 400,
        message: 'Invalid data type',
        getDetails: (e) => ({ field: e.path, value: e.value })
      }
    };

    const errorType = error.code || error.name;
    const handler = errorMap[errorType];

    if (handler) {
      return {
        status: handler.status,
        message: handler.message,
        details: handler.getDetails(error)
      };
    }

    return {
      status: 500,
      message: 'Database error',
      details: { error: error.message }
    };
  }
}

// Express error middleware
function mongoErrorMiddleware(err, req, res, next) {
  if (err.name?.startsWith('Mongo') || err.code === 11000 || err.name === 'ValidationError') {
    const { status, message, details } = MongoErrorHandler.handle(err);
    return res.status(status).json({ error: message, ...details });
  }
  next(err);
}
```

---

### Q8: What are MongoDB indexes and how do you create them?

**Answer:**
Indexes improve query performance by allowing MongoDB to quickly locate documents.

```javascript
// Using native driver
const collection = db.collection('users');

// Single field index
await collection.createIndex({ email: 1 }); // 1 = ascending, -1 = descending

// Compound index
await collection.createIndex({ lastName: 1, firstName: 1 });

// Unique index
await collection.createIndex({ email: 1 }, { unique: true });

// Sparse index (only documents with field)
await collection.createIndex({ optionalField: 1 }, { sparse: true });

// TTL index (auto-delete after time)
await collection.createIndex(
  { createdAt: 1 }, 
  { expireAfterSeconds: 3600 } // Delete after 1 hour
);

// Text index (for text search)
await collection.createIndex({ title: 'text', content: 'text' });

// Partial index (conditional)
await collection.createIndex(
  { email: 1 },
  { 
    partialFilterExpression: { status: 'active' }
  }
);

// Using Mongoose schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, index: true },
  firstName: String,
  lastName: String,
  status: String,
  createdAt: { type: Date, expires: 3600 } // TTL
});

// Compound index in schema
userSchema.index({ lastName: 1, firstName: 1 });

// Text index
userSchema.index({ bio: 'text', interests: 'text' });

// List indexes
const indexes = await collection.indexes();
console.log(indexes);

// Drop index
await collection.dropIndex('email_1');

// Drop all indexes
await collection.dropIndexes();
```

---

### Q9: How do you use projections to select specific fields?

**Answer:**

```javascript
// Native driver
const users = db.collection('users');

// Include specific fields (1 = include)
const result1 = await users.find({}, {
  projection: { name: 1, email: 1 }
}).toArray();
// Returns: { _id, name, email }

// Exclude specific fields (0 = exclude)
const result2 = await users.find({}, {
  projection: { password: 0, __v: 0 }
}).toArray();
// Returns all fields except password and __v

// Note: Cannot mix inclusion and exclusion (except _id)
// Exclude _id
const result3 = await users.find({}, {
  projection: { name: 1, email: 1, _id: 0 }
}).toArray();

// Array projection operators
const result4 = await users.find({ _id: userId }, {
  projection: {
    name: 1,
    orders: { $slice: 5 },           // First 5 orders
    comments: { $slice: -3 },        // Last 3 comments
    items: { $slice: [10, 5] },      // Skip 10, take 5
    'scores.$': 1                     // First matching element
  }
}).toArray();

// Mongoose select
const user1 = await User.findOne({ email })
  .select('name email');

const user2 = await User.findOne({ email })
  .select('-password -__v');

const user3 = await User.findOne({ email })
  .select({ name: 1, email: 1 });

// In schema definition
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: { type: String, select: false } // Never returned by default
});

// Explicitly include hidden field
const userWithPassword = await User.findOne({ email })
  .select('+password');
```

---

### Q10: How do you sort, limit, and skip results?

**Answer:**

```javascript
// Native driver
const products = db.collection('products');

// Sort (1 = ascending, -1 = descending)
const sorted = await products.find({})
  .sort({ price: 1 })
  .toArray();

// Multiple sort fields
const multiSorted = await products.find({})
  .sort({ category: 1, price: -1 })
  .toArray();

// Limit results
const limited = await products.find({})
  .limit(10)
  .toArray();

// Skip results (for pagination)
const skipped = await products.find({})
  .skip(20)
  .limit(10)
  .toArray();

// Pagination helper
async function paginate(collection, query, page, limit) {
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    collection.find(query).skip(skip).limit(limit).toArray(),
    collection.countDocuments(query)
  ]);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
}

// Mongoose
const products = await Product.find({})
  .sort({ price: 1 })
  .skip(20)
  .limit(10);

// Alternative sort syntax
const products2 = await Product.find({})
  .sort('price -createdAt'); // price asc, createdAt desc

// Chaining all together
const results = await Product.find({ status: 'active' })
  .select('name price category')
  .sort({ price: 1 })
  .skip(0)
  .limit(20)
  .lean(); // Return plain objects
```

---

## Mongoose ODM

### Q11: What is Mongoose and why use it over the native driver?

**Answer:**
Mongoose is an Object Data Modeling (ODM) library for MongoDB and Node.js.

| Feature | Native Driver | Mongoose |
|---------|--------------|----------|
| Schema | Flexible | Defined structure |
| Validation | Manual | Built-in |
| Middleware | None | Pre/post hooks |
| Type casting | Manual | Automatic |
| Relationships | Manual | Population |
| Query building | Basic | Enhanced |

```javascript
const mongoose = require('mongoose');

// Define schema with validation
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: (v) => /^\S+@\S+\.\S+$/.test(v),
      message: 'Invalid email format'
    }
  },
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [150, 'Age seems unrealistic']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create model
const User = mongoose.model('User', userSchema);

// Mongoose automatically:
// - Validates data before saving
// - Casts types (string "25" → number 25)
// - Applies defaults
// - Provides useful methods

const user = new User({
  name: 'John',
  email: 'JOHN@EXAMPLE.COM', // Will be lowercased
  age: '25' // Will be cast to number
});

await user.save();
```

---

### Q12: How do you define Mongoose schemas with different data types?

**Answer:**

```javascript
const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
  // String
  name: String,
  description: { type: String, maxlength: 1000 },
  
  // Number
  price: Number,
  quantity: { type: Number, min: 0, default: 0 },
  
  // Boolean
  isActive: Boolean,
  featured: { type: Boolean, default: false },
  
  // Date
  createdAt: Date,
  publishedAt: { type: Date, default: Date.now },
  
  // ObjectId (reference)
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  // Array of strings
  tags: [String],
  
  // Array of objects
  reviews: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Nested object (subdocument)
  specifications: {
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    color: String
  },
  
  // Map (dynamic keys)
  metadata: {
    type: Map,
    of: String
  },
  
  // Mixed type (any structure)
  customData: Schema.Types.Mixed,
  
  // Buffer (binary data)
  thumbnail: Buffer,
  
  // Decimal128 (precise decimals)
  precisePrice: Schema.Types.Decimal128,
  
  // Array of ObjectIds
  relatedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }]
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Product = mongoose.model('Product', productSchema);
```

---

### Q13: What are Mongoose middleware (hooks)?

**Answer:**
Middleware are functions executed at specific stages of a document's lifecycle.

```javascript
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String
});

// PRE MIDDLEWARE - runs before the operation

// Pre-save (document middleware)
userSchema.pre('save', async function(next) {
  // 'this' refers to the document
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Pre-validate
userSchema.pre('validate', function(next) {
  if (this.name) {
    this.name = this.name.trim();
  }
  next();
});

// Pre-remove
userSchema.pre('remove', async function(next) {
  // Clean up related data
  await Comment.deleteMany({ author: this._id });
  next();
});

// Query middleware (pre-find)
userSchema.pre('find', function() {
  // 'this' refers to the query
  this.where({ deleted: { $ne: true } });
});

userSchema.pre('findOne', function() {
  this.where({ deleted: { $ne: true } });
});

// Pre-updateOne (query middleware)
userSchema.pre('updateOne', function() {
  this.set({ updatedAt: new Date() });
});

// Pre-aggregate
userSchema.pre('aggregate', function() {
  // Add match stage at beginning
  this.pipeline().unshift({ $match: { deleted: { $ne: true } } });
});


// POST MIDDLEWARE - runs after the operation

// Post-save
userSchema.post('save', function(doc) {
  console.log(`User ${doc.email} was saved`);
  // Send welcome email
  emailService.sendWelcome(doc.email);
});

// Post-find
userSchema.post('find', function(docs) {
  console.log(`Found ${docs.length} users`);
});

// Post-remove
userSchema.post('remove', function(doc) {
  console.log(`User ${doc.email} was removed`);
});

// Error handling middleware
userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('Email already exists'));
  } else {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);
```

---

### Q14: What are virtual properties in Mongoose?

**Answer:**
Virtuals are document properties that are not stored in MongoDB but computed on the fly.

```javascript
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  birthDate: Date
});

// Getter virtual
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Setter virtual
userSchema.virtual('fullName').set(function(name) {
  const [firstName, ...rest] = name.split(' ');
  this.firstName = firstName;
  this.lastName = rest.join(' ');
});

// Computed virtual
userSchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  const today = new Date();
  const age = today.getFullYear() - this.birthDate.getFullYear();
  const monthDiff = today.getMonth() - this.birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.birthDate.getDate())) {
    return age - 1;
  }
  return age;
});

// Virtual populate (relationship without storing reference)
const authorSchema = new mongoose.Schema({
  name: String
});

authorSchema.virtual('posts', {
  ref: 'Post',
  localField: '_id',
  foreignField: 'author'
});

const postSchema = new mongoose.Schema({
  title: String,
  author: { type: Schema.Types.ObjectId, ref: 'Author' }
});

// Usage
const author = await Author.findById(id).populate('posts');
console.log(author.posts); // Array of posts

// Include virtuals in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Or in schema options
const userSchema = new mongoose.Schema({
  // fields...
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const User = mongoose.model('User', userSchema);

const user = new User({ firstName: 'John', lastName: 'Doe' });
console.log(user.fullName); // 'John Doe'

user.fullName = 'Jane Smith';
console.log(user.firstName); // 'Jane'
console.log(user.lastName); // 'Smith'
```

---

### Q15: What are instance methods vs static methods in Mongoose?

**Answer:**

```javascript
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date
});

// INSTANCE METHODS - operate on a single document instance
// 'this' refers to the document

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incrementLoginAttempts = async function() {
  // Lock account after 5 failed attempts
  if (this.lockUntil && this.lockUntil > Date.now()) {
    throw new Error('Account is locked');
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 60 * 60 * 1000 }; // 1 hour
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    email: this.email,
    createdAt: this.createdAt
  };
};

// STATIC METHODS - operate on the Model class
// 'this' refers to the Model

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findActive = function() {
  return this.find({ status: 'active', deleted: { $ne: true } });
};

userSchema.statics.createWithDefaults = async function(userData) {
  const user = new this({
    ...userData,
    status: 'pending',
    role: 'user'
  });
  return user.save();
};

userSchema.statics.search = function(query, options = {}) {
  const { page = 1, limit = 10, sort = '-createdAt' } = options;
  
  return this.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
};

const User = mongoose.model('User', userSchema);

// Usage - Instance methods
const user = await User.findById(id);
const isMatch = await user.comparePassword('password123');
const publicData = user.toPublicJSON();

// Usage - Static methods
const user = await User.findByEmail('john@example.com');
const activeUsers = await User.findActive();
const newUser = await User.createWithDefaults({ email: 'new@example.com' });
const searchResults = await User.search({ role: 'admin' }, { page: 2 });
```

---

### Q16: How do you handle validation in Mongoose?

**Answer:**

```javascript
const productSchema = new mongoose.Schema({
  // Built-in validators
  name: {
    type: String,
    required: [true, 'Product name is required'],
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    trim: true
  },
  
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
    max: [1000000, 'Price is too high']
  },
  
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'discontinued'],
      message: '{VALUE} is not a valid status'
    },
    default: 'active'
  },
  
  email: {
    type: String,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  
  // Custom validator
  sku: {
    type: String,
    validate: {
      validator: function(v) {
        return /^[A-Z]{2}-\d{4}$/.test(v);
      },
      message: props => `${props.value} is not a valid SKU format (XX-0000)`
    }
  },
  
  // Async validator
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    validate: {
      validator: async function(categoryId) {
        const category = await mongoose.model('Category').findById(categoryId);
        return category !== null;
      },
      message: 'Category does not exist'
    }
  },
  
  // Conditional validation
  salePrice: {
    type: Number,
    validate: {
      validator: function(v) {
        // salePrice must be less than price
        return v < this.price;
      },
      message: 'Sale price must be less than regular price'
    }
  },
  
  // Array validation
  tags: {
    type: [String],
    validate: {
      validator: function(v) {
        return v.length <= 10;
      },
      message: 'Cannot have more than 10 tags'
    }
  }
});

// Custom schema-level validation
productSchema.pre('validate', function(next) {
  if (this.salePrice && !this.onSale) {
    this.invalidate('salePrice', 'Cannot set sale price without enabling sale');
  }
  next();
});

// Validate only on update
productSchema.pre('findOneAndUpdate', function(next) {
  this.options.runValidators = true;
  next();
});

// Manual validation
const product = new Product({ name: 'T' });

try {
  await product.validate();
} catch (error) {
  console.log(error.errors);
  // { name: { message: 'Name must be at least 3 characters', ... } }
}

// Validate specific paths
try {
  await product.validate(['name', 'price']);
} catch (error) {
  console.log(error.errors);
}

// Using Joi for complex validation
const Joi = require('joi');

const productValidation = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  price: Joi.number().min(0).required(),
  category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
});

// Validate before Mongoose
const { error, value } = productValidation.validate(req.body);
if (error) {
  throw new ValidationError(error.details);
}
```

---

### Q17: How do you implement soft delete in Mongoose?

**Answer:**

```javascript
const mongoose = require('mongoose');

// Soft delete plugin
function softDeletePlugin(schema) {
  // Add fields
  schema.add({
    deleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  });

  // Instance method for soft delete
  schema.methods.softDelete = function(userId) {
    this.deleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return this.save();
  };

  // Instance method for restore
  schema.methods.restore = function() {
    this.deleted = false;
    this.deletedAt = undefined;
    this.deletedBy = undefined;
    return this.save();
  };

  // Static methods
  schema.statics.softDeleteById = function(id, userId) {
    return this.findByIdAndUpdate(id, {
      deleted: true,
      deletedAt: new Date(),
      deletedBy: userId
    });
  };

  schema.statics.restoreById = function(id) {
    return this.findByIdAndUpdate(id, {
      $set: { deleted: false },
      $unset: { deletedAt: 1, deletedBy: 1 }
    });
  };

  schema.statics.findDeleted = function(query = {}) {
    return this.find({ ...query, deleted: true });
  };

  schema.statics.findWithDeleted = function(query = {}) {
    return this.find(query);
  };

  // Override find methods to exclude deleted by default
  const excludeDeleted = function() {
    this.where({ deleted: { $ne: true } });
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('count', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('aggregate', function() {
    this.pipeline().unshift({ $match: { deleted: { $ne: true } } });
  });
}

// Usage
const userSchema = new mongoose.Schema({
  name: String,
  email: String
});

userSchema.plugin(softDeletePlugin);

const User = mongoose.model('User', userSchema);

// Soft delete
const user = await User.findById(id);
await user.softDelete(currentUserId);

// Or static method
await User.softDeleteById(id, currentUserId);

// Find only active users (default behavior)
const activeUsers = await User.find({});

// Find deleted users
const deletedUsers = await User.findDeleted();

// Find all including deleted
const allUsers = await User.findWithDeleted();

// Restore
await user.restore();
// or
await User.restoreById(id);

// Permanently delete
await User.deleteOne({ _id: id });
```

---

### Q18: How do you populate referenced documents?

**Answer:**

```javascript
// Schemas with references
const authorSchema = new mongoose.Schema({
  name: String,
  bio: String
});

const commentSchema = new mongoose.Schema({
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }
});

// Basic populate
const post = await Post.findById(id).populate('author');
console.log(post.author.name); // Full author document

// Populate with field selection
const post = await Post.findById(id)
  .populate('author', 'name bio'); // Only name and bio

// Populate multiple fields
const post = await Post.findById(id)
  .populate('author')
  .populate('category');

// Or in single call
const post = await Post.findById(id)
  .populate(['author', 'category']);

// Populate with options
const post = await Post.findById(id)
  .populate({
    path: 'author',
    select: 'name email',
    match: { active: true },
    options: { sort: { name: 1 } }
  });

// Nested populate (deep population)
const post = await Post.findById(id)
  .populate({
    path: 'comments',
    populate: {
      path: 'author',
      select: 'name'
    }
  });

// Populate in find queries
const posts = await Post.find({ status: 'published' })
  .populate('author', 'name')
  .populate('category', 'name slug');

// Conditional populate
const posts = await Post.find({})
  .populate({
    path: 'author',
    match: { status: 'active' },
    select: 'name'
  });
// Note: If match fails, populated field will be null

// Virtual populate (no stored reference)
authorSchema.virtual('posts', {
  ref: 'Post',
  localField: '_id',
  foreignField: 'author',
  justOne: false, // Array of posts
  options: { sort: { createdAt: -1 }, limit: 5 }
});

const author = await Author.findById(id).populate('posts');

// Populate after query
const post = await Post.findById(id);
await post.populate('author');
await post.populate('comments');

// Lean with populate
const post = await Post.findById(id)
  .populate('author')
  .lean(); // Returns plain JS object

// Populate on save (auto-populate)
postSchema.pre('find', function() {
  this.populate('author', 'name');
});
```

---

### Q19: How do you use transactions in Mongoose?

**Answer:**

```javascript
const mongoose = require('mongoose');

// Basic transaction
async function transferFunds(fromAccountId, toAccountId, amount) {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Deduct from source account
    const fromAccount = await Account.findByIdAndUpdate(
      fromAccountId,
      { $inc: { balance: -amount } },
      { new: true, session }
    );

    if (fromAccount.balance < 0) {
      throw new Error('Insufficient funds');
    }

    // Add to destination account
    await Account.findByIdAndUpdate(
      toAccountId,
      { $inc: { balance: amount } },
      { session }
    );

    // Create transaction record
    await Transaction.create([{
      from: fromAccountId,
      to: toAccountId,
      amount,
      type: 'transfer'
    }], { session });

    await session.commitTransaction();
    return { success: true };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Using withTransaction helper
async function transferFundsWithHelper(fromAccountId, toAccountId, amount) {
  const session = await mongoose.startSession();
  
  try {
    const result = await session.withTransaction(async () => {
      const fromAccount = await Account.findByIdAndUpdate(
        fromAccountId,
        { $inc: { balance: -amount } },
        { new: true, session }
      );

      if (fromAccount.balance < 0) {
        throw new Error('Insufficient funds');
      }

      await Account.findByIdAndUpdate(
        toAccountId,
        { $inc: { balance: amount } },
        { session }
      );

      await Transaction.create([{
        from: fromAccountId,
        to: toAccountId,
        amount
      }], { session });

      return { success: true };
    });

    return result;
  } finally {
    session.endSession();
  }
}

// Create documents in transaction
async function createOrder(userId, items) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // Create order
      const [order] = await Order.create([{
        user: userId,
        items,
        status: 'pending'
      }], { session });

      // Update inventory
      for (const item of items) {
        const product = await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { new: true, session }
        );

        if (product.stock < 0) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
      }

      // Create payment record
      await Payment.create([{
        order: order._id,
        amount: order.total,
        status: 'pending'
      }], { session });

      return order;
    });
  } finally {
    session.endSession();
  }
}

// Transaction with retries
async function transactionWithRetry(operation, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    const session = await mongoose.startSession();
    
    try {
      const result = await session.withTransaction(operation, {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' }
      });
      
      return result;
    } catch (error) {
      if (error.hasErrorLabel('TransientTransactionError')) {
        retries++;
        continue;
      }
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  throw new Error('Transaction failed after max retries');
}
```

---

### Q20: How do you handle schema versioning and migrations?

**Answer:**

```javascript
// Schema versioning
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  // Add version field for tracking schema changes
  schemaVersion: { type: Number, default: 2 }
});

// Migration on read
userSchema.post('init', async function(doc) {
  if (doc.schemaVersion < 2) {
    // Migrate old documents
    await migrateToV2(doc);
  }
});

async function migrateToV2(doc) {
  // Example: Split name into firstName and lastName
  if (doc.name && !doc.firstName) {
    const [firstName, ...rest] = doc.name.split(' ');
    await User.updateOne(
      { _id: doc._id },
      {
        $set: {
          firstName,
          lastName: rest.join(' '),
          schemaVersion: 2
        },
        $unset: { name: 1 }
      }
    );
  }
}

// Migration script using migrate-mongo
// migrations/20240101-add-status-field.js
module.exports = {
  async up(db) {
    await db.collection('users').updateMany(
      { status: { $exists: false } },
      { $set: { status: 'active' } }
    );
  },

  async down(db) {
    await db.collection('users').updateMany(
      {},
      { $unset: { status: '' } }
    );
  }
};

// Batch migration with progress
async function migrateUsers() {
  const batchSize = 1000;
  let processed = 0;
  let hasMore = true;
  let lastId = null;

  while (hasMore) {
    const query = lastId 
      ? { _id: { $gt: lastId }, schemaVersion: { $lt: 2 } }
      : { schemaVersion: { $lt: 2 } };

    const users = await User.find(query)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();

    if (users.length === 0) {
      hasMore = false;
      continue;
    }

    // Bulk update
    const bulkOps = users.map(user => ({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            ...migrateUserData(user),
            schemaVersion: 2
          }
        }
      }
    }));

    await User.bulkWrite(bulkOps);

    processed += users.length;
    lastId = users[users.length - 1]._id;
    console.log(`Processed ${processed} users`);
  }

  console.log('Migration complete');
}

function migrateUserData(user) {
  // Transform data for new schema
  return {
    firstName: user.name?.split(' ')[0],
    lastName: user.name?.split(' ').slice(1).join(' ')
  };
}
```

---

## Queries & Aggregation

### Q21: How do you use the aggregation pipeline?

**Answer:**

```javascript
// Basic aggregation pipeline
const result = await Order.aggregate([
  // Stage 1: Filter documents
  { $match: { status: 'completed' } },
  
  // Stage 2: Group by customer
  { $group: {
    _id: '$customerId',
    totalOrders: { $sum: 1 },
    totalSpent: { $sum: '$total' },
    avgOrderValue: { $avg: '$total' }
  }},
  
  // Stage 3: Sort by total spent
  { $sort: { totalSpent: -1 } },
  
  // Stage 4: Limit to top 10
  { $limit: 10 },
  
  // Stage 5: Lookup customer details
  { $lookup: {
    from: 'customers',
    localField: '_id',
    foreignField: '_id',
    as: 'customer'
  }},
  
  // Stage 6: Unwind customer array
  { $unwind: '$customer' },
  
  // Stage 7: Project final shape
  { $project: {
    _id: 0,
    customerName: '$customer.name',
    email: '$customer.email',
    totalOrders: 1,
    totalSpent: { $round: ['$totalSpent', 2] },
    avgOrderValue: { $round: ['$avgOrderValue', 2] }
  }}
]);

// Common aggregation stages
const stages = {
  // $match - Filter documents
  match: { $match: { status: 'active', age: { $gte: 18 } } },
  
  // $project - Reshape documents
  project: { $project: { 
    name: 1, 
    email: 1,
    fullName: { $concat: ['$firstName', ' ', '$lastName'] }
  }},
  
  // $group - Group and aggregate
  group: { $group: {
    _id: '$category',
    count: { $sum: 1 },
    total: { $sum: '$price' },
    avg: { $avg: '$price' },
    min: { $min: '$price' },
    max: { $max: '$price' },
    items: { $push: '$name' },
    firstItem: { $first: '$name' },
    lastItem: { $last: '$name' }
  }},
  
  // $sort - Sort results
  sort: { $sort: { createdAt: -1, name: 1 } },
  
  // $skip and $limit - Pagination
  skip: { $skip: 20 },
  limit: { $limit: 10 },
  
  // $lookup - Join collections
  lookup: { $lookup: {
    from: 'categories',
    localField: 'categoryId',
    foreignField: '_id',
    as: 'category',
    pipeline: [
      { $match: { active: true } },
      { $project: { name: 1 } }
    ]
  }},
  
  // $unwind - Deconstruct arrays
  unwind: { $unwind: { 
    path: '$items', 
    preserveNullAndEmptyArrays: true 
  }},
  
  // $addFields - Add new fields
  addFields: { $addFields: {
    totalWithTax: { $multiply: ['$total', 1.1] }
  }},
  
  // $bucket - Group by ranges
  bucket: { $bucket: {
    groupBy: '$price',
    boundaries: [0, 50, 100, 200, 500],
    default: 'Other',
    output: { count: { $sum: 1 } }
  }},
  
  // $facet - Multiple pipelines
  facet: { $facet: {
    priceStats: [
      { $group: { _id: null, avg: { $avg: '$price' } } }
    ],
    categoryCount: [
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]
  }}
};
```

---

### Q22: What are aggregation operators?

**Answer:**

```javascript
// Arithmetic operators
const arithmetic = await Product.aggregate([
  { $project: {
    name: 1,
    total: { $add: ['$price', '$tax'] },
    difference: { $subtract: ['$price', '$discount'] },
    doubled: { $multiply: ['$price', 2] },
    half: { $divide: ['$price', 2] },
    remainder: { $mod: ['$quantity', 5] },
    absolute: { $abs: '$balance' },
    ceiling: { $ceil: '$price' },
    floor: { $floor: '$price' },
    rounded: { $round: ['$price', 2] },
    power: { $pow: ['$base', 2] },
    sqrt: { $sqrt: '$value' }
  }}
]);

// String operators
const stringOps = await User.aggregate([
  { $project: {
    fullName: { $concat: ['$firstName', ' ', '$lastName'] },
    initials: { $concat: [
      { $substr: ['$firstName', 0, 1] },
      { $substr: ['$lastName', 0, 1] }
    ]},
    upperName: { $toUpper: '$name' },
    lowerEmail: { $toLower: '$email' },
    trimmed: { $trim: { input: '$name' } },
    nameLength: { $strLenCP: '$name' },
    position: { $indexOfCP: ['$email', '@'] },
    split: { $split: ['$email', '@'] },
    replaced: { $replaceAll: { 
      input: '$phone', 
      find: '-', 
      replacement: '' 
    }}
  }}
]);

// Date operators
const dateOps = await Order.aggregate([
  { $project: {
    year: { $year: '$createdAt' },
    month: { $month: '$createdAt' },
    day: { $dayOfMonth: '$createdAt' },
    dayOfWeek: { $dayOfWeek: '$createdAt' },
    hour: { $hour: '$createdAt' },
    formatted: { $dateToString: { 
      format: '%Y-%m-%d', 
      date: '$createdAt' 
    }},
    ageInDays: { $divide: [
      { $subtract: [new Date(), '$createdAt'] },
      1000 * 60 * 60 * 24
    ]}
  }}
]);

// Array operators
const arrayOps = await Product.aggregate([
  { $project: {
    tagCount: { $size: '$tags' },
    firstTag: { $arrayElemAt: ['$tags', 0] },
    lastTag: { $arrayElemAt: ['$tags', -1] },
    hasTech: { $in: ['tech', '$tags'] },
    filtered: { $filter: {
      input: '$reviews',
      as: 'review',
      cond: { $gte: ['$$review.rating', 4] }
    }},
    mapped: { $map: {
      input: '$items',
      as: 'item',
      in: { name: '$$item.name', total: { $multiply: ['$$item.price', '$$item.qty'] } }
    }},
    reduced: { $reduce: {
      input: '$items',
      initialValue: 0,
      in: { $add: ['$$value', '$$this.price'] }
    }},
    sliced: { $slice: ['$tags', 3] },
    reversed: { $reverseArray: '$tags' }
  }}
]);

// Conditional operators
const conditionalOps = await Order.aggregate([
  { $project: {
    status: 1,
    priority: { $cond: {
      if: { $gte: ['$total', 1000] },
      then: 'high',
      else: 'normal'
    }},
    shipping: { $switch: {
      branches: [
        { case: { $gte: ['$total', 100] }, then: 'free' },
        { case: { $gte: ['$total', 50] }, then: 'reduced' }
      ],
      default: 'standard'
    }},
    displayTotal: { $ifNull: ['$total', 0] }
  }}
]);
```

---

### Q23: How do you perform text search in MongoDB?

**Answer:**

```javascript
// Create text index
await Product.collection.createIndex(
  { name: 'text', description: 'text', tags: 'text' },
  {
    weights: { name: 10, tags: 5, description: 1 },
    name: 'ProductTextIndex',
    default_language: 'english'
  }
);

// Basic text search
const results = await Product.find({
  $text: { $search: 'laptop computer' }
});

// Search with score
const resultsWithScore = await Product.find(
  { $text: { $search: 'laptop computer' } },
  { score: { $meta: 'textScore' } }
).sort({ score: { $meta: 'textScore' } });

// Phrase search (exact)
const phraseSearch = await Product.find({
  $text: { $search: '"gaming laptop"' }
});

// Exclude terms
const excludeSearch = await Product.find({
  $text: { $search: 'laptop -gaming' }
});

// Case and diacritic sensitive
const sensitiveSearch = await Product.find({
  $text: {
    $search: 'Café',
    $caseSensitive: true,
    $diacriticSensitive: true
  }
});

// Text search in aggregation
const aggSearch = await Product.aggregate([
  { $match: { $text: { $search: 'laptop' } } },
  { $addFields: { score: { $meta: 'textScore' } } },
  { $match: { score: { $gte: 1 } } },
  { $sort: { score: -1 } },
  { $limit: 10 }
]);

// For more advanced search, use MongoDB Atlas Search
// or integrate with Elasticsearch

// Mongoose schema with text index
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  tags: [String]
});

productSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 5 } }
);

// Search helper method
productSchema.statics.search = function(query, options = {}) {
  const { limit = 10, minScore = 0.5 } = options;
  
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' } })
  .limit(limit);
};
```

---

### Q24: How do you use `$lookup` for joins?

**Answer:**

```javascript
// Basic lookup (left outer join)
const ordersWithCustomers = await Order.aggregate([
  {
    $lookup: {
      from: 'customers',        // Collection to join
      localField: 'customerId', // Field from input documents
      foreignField: '_id',      // Field from joined collection
      as: 'customer'            // Output array field
    }
  },
  { $unwind: '$customer' }      // Convert array to object
]);

// Lookup with pipeline (MongoDB 3.6+)
const ordersWithDetails = await Order.aggregate([
  {
    $lookup: {
      from: 'products',
      let: { orderItems: '$items' },  // Variables from input
      pipeline: [
        { $match: {
          $expr: { $in: ['$_id', '$$orderItems.productId'] }
        }},
        { $project: { name: 1, price: 1 } }
      ],
      as: 'productDetails'
    }
  }
]);

// Multiple lookups
const completeOrderData = await Order.aggregate([
  // Join customer
  {
    $lookup: {
      from: 'customers',
      localField: 'customerId',
      foreignField: '_id',
      as: 'customer'
    }
  },
  { $unwind: '$customer' },
  
  // Join products
  {
    $lookup: {
      from: 'products',
      localField: 'items.productId',
      foreignField: '_id',
      as: 'products'
    }
  },
  
  // Join shipping info
  {
    $lookup: {
      from: 'shipments',
      localField: '_id',
      foreignField: 'orderId',
      as: 'shipment'
    }
  },
  { $unwind: { path: '$shipment', preserveNullAndEmptyArrays: true } }
]);

// Lookup with filtering and projection
const activeOrdersWithRecentReviews = await Order.aggregate([
  { $match: { status: 'active' } },
  {
    $lookup: {
      from: 'reviews',
      let: { orderId: '$_id' },
      pipeline: [
        { $match: {
          $expr: { $eq: ['$orderId', '$$orderId'] },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }},
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        { $project: { rating: 1, comment: 1 } }
      ],
      as: 'recentReviews'
    }
  }
]);

// Correlated subquery
const customersWithHighValueOrders = await Customer.aggregate([
  {
    $lookup: {
      from: 'orders',
      let: { customerId: '$_id' },
      pipeline: [
        { $match: {
          $expr: { $eq: ['$customerId', '$$customerId'] },
          total: { $gte: 1000 }
        }},
        { $count: 'count' }
      ],
      as: 'highValueOrders'
    }
  },
  { $match: { 'highValueOrders.0.count': { $gte: 5 } } }
]);
```

---

### Q25: How do you use `$group` for data aggregation?

**Answer:**

```javascript
// Basic grouping
const salesByCategory = await Product.aggregate([
  {
    $group: {
      _id: '$category',
      totalProducts: { $sum: 1 },
      totalRevenue: { $sum: '$price' },
      avgPrice: { $avg: '$price' }
    }
  }
]);

// Group by multiple fields
const salesByDateAndCategory = await Order.aggregate([
  {
    $group: {
      _id: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        category: '$category'
      },
      count: { $sum: 1 },
      total: { $sum: '$amount' }
    }
  },
  { $sort: { '_id.date': -1, 'total': -1 } }
]);

// All accumulator operators
const fullStats = await Order.aggregate([
  {
    $group: {
      _id: '$status',
      count: { $sum: 1 },
      total: { $sum: '$amount' },
      avg: { $avg: '$amount' },
      min: { $min: '$amount' },
      max: { $max: '$amount' },
      stdDev: { $stdDevPop: '$amount' },
      
      // Collect values
      amounts: { $push: '$amount' },
      orderIds: { $addToSet: '$orderId' },
      
      // First and last
      firstOrder: { $first: '$orderId' },
      lastOrder: { $last: '$orderId' },
      
      // Merge objects
      merged: { $mergeObjects: '$metadata' }
    }
  }
]);

// Group with conditional counting
const orderStatusBreakdown = await Order.aggregate([
  {
    $group: {
      _id: null,
      totalOrders: { $sum: 1 },
      pendingOrders: {
        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
      },
      completedOrders: {
        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
      },
      cancelledOrders: {
        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
      },
      highValueOrders: {
        $sum: { $cond: [{ $gte: ['$total', 1000] }, 1, 0] }
      }
    }
  }
]);

// Group and then filter groups
const topCategories = await Product.aggregate([
  {
    $group: {
      _id: '$category',
      count: { $sum: 1 },
      avgRating: { $avg: '$rating' }
    }
  },
  { $match: { count: { $gte: 10 }, avgRating: { $gte: 4 } } },
  { $sort: { avgRating: -1 } }
]);

// Rolling aggregations with $setWindowFields (MongoDB 5.0+)
const rollingAverage = await Sales.aggregate([
  {
    $setWindowFields: {
      partitionBy: '$product',
      sortBy: { date: 1 },
      output: {
        movingAvg: {
          $avg: '$amount',
          window: { documents: [-6, 0] } // 7-day rolling average
        }
      }
    }
  }
]);
```

---

### Q26-Q30: [Additional Query Questions - Key Topics]

Key topics covered:
- **Q26**: Working with `$facet` for multiple aggregations
- **Q27**: Geospatial queries
- **Q28**: Array operations in aggregation
- **Q29**: Date-based aggregations
- **Q30**: Performance optimization in aggregation

---

## Schema Design & Relationships

### Q31: What are the patterns for one-to-one relationships?

**Answer:**

```javascript
// Option 1: Embedded document (most common for 1:1)
const userSchema = new mongoose.Schema({
  email: String,
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: String
  }
});

// Option 2: Reference (when data is large or accessed separately)
const userSchema = new mongoose.Schema({
  email: String,
  profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }
});

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  firstName: String,
  lastName: String,
  avatar: String,
  bio: String,
  // Large fields that are rarely needed
  fullBio: String,
  socialLinks: [String]
});

// When to embed:
// - Data is always accessed together
// - Data size is small
// - Data doesn't need independent access

// When to reference:
// - Data is large
// - Data is accessed independently
// - Data changes frequently while parent doesn't
```

---

### Q32: What are the patterns for one-to-many relationships?

**Answer:**

```javascript
// Pattern 1: Embedded array (for small, bounded arrays)
const authorSchema = new mongoose.Schema({
  name: String,
  // Good for small number of items
  books: [{
    title: String,
    publishedAt: Date
  }]
});

// Pattern 2: Child references (array of IDs in parent)
const authorSchema = new mongoose.Schema({
  name: String,
  books: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }]
});

const bookSchema = new mongoose.Schema({
  title: String,
  publishedAt: Date
});

// Pattern 3: Parent reference (ID in child - recommended for large arrays)
const authorSchema = new mongoose.Schema({
  name: String
});

const bookSchema = new mongoose.Schema({
  title: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', index: true }
});

// Query books by author
const books = await Book.find({ author: authorId });

// Pattern 4: Hybrid (references + denormalized data)
const postSchema = new mongoose.Schema({
  title: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Denormalized for quick access
  authorName: String,
  authorAvatar: String
});

// Update denormalized data when author changes
userSchema.post('save', async function() {
  if (this.isModified('name') || this.isModified('avatar')) {
    await Post.updateMany(
      { author: this._id },
      { authorName: this.name, authorAvatar: this.avatar }
    );
  }
});

// Decision guide:
// Embed when:
// - Array is small (< 100 items typically)
// - Items are always accessed with parent
// - Items don't need independent queries

// Reference when:
// - Array could grow unbounded
// - Items need independent access
// - Items are updated frequently
```

---

### Q33: What are the patterns for many-to-many relationships?

**Answer:**

```javascript
// Pattern 1: Two-way referencing (simple cases)
const studentSchema = new mongoose.Schema({
  name: String,
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

const courseSchema = new mongoose.Schema({
  title: String,
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
});

// Problem: Must update both sides, can become large

// Pattern 2: One-way referencing (recommended)
const studentSchema = new mongoose.Schema({
  name: String,
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

const courseSchema = new mongoose.Schema({
  title: String
  // No students array
});

// Find students in a course
const students = await Student.find({ courses: courseId });

// Pattern 3: Junction collection (for relationship metadata)
const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },
  // Relationship-specific data
  enrolledAt: { type: Date, default: Date.now },
  grade: Number,
  status: { type: String, enum: ['active', 'completed', 'dropped'] },
  completedAt: Date
});

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

// Usage
const studentCourses = await Enrollment.find({ student: studentId })
  .populate('course');

const courseStudents = await Enrollment.find({ course: courseId })
  .populate('student');

// Add enrollment
await Enrollment.create({
  student: studentId,
  course: courseId,
  status: 'active'
});

// Pattern 4: Embedded for bounded relationships
const userSchema = new mongoose.Schema({
  name: String,
  // For bounded relationships like permissions
  roles: [{
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    grantedAt: Date,
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
});
```

---

### Q34: What is denormalization and when should you use it?

**Answer:**

```javascript
// Denormalization: Duplicating data for read performance

// Example: Blog post with author info
// Normalized (requires join/populate)
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Denormalized (faster reads)
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Denormalized fields
  authorName: String,
  authorAvatar: String
});

// Keep denormalized data in sync
async function updatePost(postId, data) {
  const post = await Post.findById(postId);
  Object.assign(post, data);
  await post.save();
}

// When author updates, sync all posts
userSchema.post('findOneAndUpdate', async function(user) {
  if (user) {
    await Post.updateMany(
      { author: user._id },
      { 
        authorName: user.name,
        authorAvatar: user.avatar 
      }
    );
  }
});

// Using triggers for sync (more reliable)
const changeStream = User.watch();
changeStream.on('change', async (change) => {
  if (change.operationType === 'update' || change.operationType === 'replace') {
    const user = await User.findById(change.documentKey._id);
    await Post.updateMany(
      { author: user._id },
      { authorName: user.name, authorAvatar: user.avatar }
    );
  }
});

// When to denormalize:
// 1. Read-heavy workloads (reads >> writes)
// 2. Data changes infrequently
// 3. Immediate consistency not critical
// 4. Query performance is priority

// When NOT to denormalize:
// 1. Data changes frequently
// 2. Strong consistency required
// 3. Write performance is priority
// 4. Storage is a concern

// Materialized views (computed denormalization)
const orderStatsSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId, // customer ID
  totalOrders: Number,
  totalSpent: Number,
  avgOrderValue: Number,
  lastOrderDate: Date,
  updatedAt: Date
});

// Refresh periodically or on order changes
async function refreshCustomerStats(customerId) {
  const stats = await Order.aggregate([
    { $match: { customer: customerId } },
    { $group: {
      _id: '$customer',
      totalOrders: { $sum: 1 },
      totalSpent: { $sum: '$total' },
      avgOrderValue: { $avg: '$total' },
      lastOrderDate: { $max: '$createdAt' }
    }}
  ]);

  await OrderStats.findByIdAndUpdate(
    customerId,
    { ...stats[0], updatedAt: new Date() },
    { upsert: true }
  );
}
```

---

### Q35-Q40: [Additional Schema Questions - Key Topics]

Key topics covered:
- **Q35**: Schema design patterns (Bucket, Computed, Document versioning)
- **Q36**: Polymorphic patterns
- **Q37**: Time-series data modeling
- **Q38**: Handling large documents
- **Q39**: Schema evolution strategies
- **Q40**: Data validation patterns

---

## Performance & Production

### Q41: How do you optimize MongoDB queries?

**Answer:**

```javascript
// 1. Use proper indexes
// Create compound index for common queries
db.collection.createIndex({ status: 1, createdAt: -1 });

// 2. Use explain() to analyze queries
const explanation = await Order.find({ status: 'pending' })
  .sort({ createdAt: -1 })
  .explain('executionStats');

console.log({
  executionTimeMs: explanation.executionStats.executionTimeMillis,
  totalDocsExamined: explanation.executionStats.totalDocsExamined,
  nReturned: explanation.executionStats.nReturned,
  indexUsed: explanation.queryPlanner.winningPlan.inputStage?.indexName
});

// 3. Use projection to limit returned fields
const orders = await Order.find({ status: 'pending' })
  .select('orderId customer total')  // Only needed fields
  .lean();

// 4. Use lean() for read-only operations
const users = await User.find({}).lean();  // 2-3x faster

// 5. Paginate large result sets
async function paginatedFind(model, query, page, limit) {
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    model.find(query).skip(skip).limit(limit).lean(),
    model.countDocuments(query)
  ]);
  
  return { data, total, page, pages: Math.ceil(total / limit) };
}

// 6. Use cursor for large datasets
async function processLargeDataset(model, query) {
  const cursor = model.find(query).cursor();
  
  for await (const doc of cursor) {
    await processDocument(doc);
  }
}

// 7. Avoid $where and regex without index
// Bad
await User.find({ $where: 'this.name.length > 10' });

// Good
await User.find({ name: { $exists: true } })
  .then(users => users.filter(u => u.name.length > 10));

// 8. Use aggregation for complex queries
// Instead of multiple queries
const user = await User.findById(id);
const orders = await Order.find({ user: id });
const reviews = await Review.find({ user: id });

// Single aggregation
const result = await User.aggregate([
  { $match: { _id: new ObjectId(id) } },
  { $lookup: { from: 'orders', localField: '_id', foreignField: 'user', as: 'orders' } },
  { $lookup: { from: 'reviews', localField: '_id', foreignField: 'user', as: 'reviews' } }
]);

// 9. Index covered queries
// If all queried and returned fields are in index
db.collection.createIndex({ status: 1, orderId: 1, total: 1 });

// This query is "covered" - no document lookup needed
await Order.find(
  { status: 'pending' },
  { orderId: 1, total: 1, _id: 0 }
);
```

---

### Q42: How do you handle connection pooling?

**Answer:**

```javascript
const mongoose = require('mongoose');

// Connection pool configuration
const options = {
  maxPoolSize: 10,         // Maximum connections in pool
  minPoolSize: 2,          // Minimum connections maintained
  maxIdleTimeMS: 30000,    // Close connections idle for 30s
  waitQueueTimeoutMS: 10000, // Wait max 10s for connection
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4                // Use IPv4
};

mongoose.connect(uri, options);

// Monitor pool events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected');
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Get pool statistics
function getPoolStats() {
  const client = mongoose.connection.getClient();
  const pool = client.topology?.s?.pool;
  
  return {
    totalConnections: pool?.totalConnectionCount,
    availableConnections: pool?.availableConnectionCount,
    pendingConnections: pool?.pendingConnectionCount,
    maxPoolSize: pool?.options?.maxPoolSize
  };
}

// Monitor with events (native driver)
const client = mongoose.connection.getClient();

client.on('connectionPoolCreated', (event) => {
  console.log('Pool created:', event.address);
});

client.on('connectionCreated', (event) => {
  console.log('Connection created:', event.connectionId);
});

client.on('connectionClosed', (event) => {
  console.log('Connection closed:', event.connectionId, event.reason);
});

client.on('connectionPoolCleared', (event) => {
  console.log('Pool cleared:', event.address);
});

// Size based on workload
const poolSize = calculateOptimalPoolSize();

function calculateOptimalPoolSize() {
  // General formula: connections = (core_count * 2) + effective_spindle_count
  // For most cloud databases: 10-20 connections per server is a good start
  
  const coreCount = require('os').cpus().length;
  const baseConnections = coreCount * 2;
  
  // Adjust based on workload type
  // Read-heavy: can use more connections
  // Write-heavy: fewer connections may be better
  
  return Math.min(baseConnections + 5, 50); // Cap at 50
}

// Handling pool exhaustion
mongoose.connection.on('error', (err) => {
  if (err.message.includes('pool')) {
    console.error('Connection pool error:', err);
    // Consider increasing pool size or reducing concurrent operations
  }
});
```

---

### Q43: How do you implement caching with MongoDB?

**Answer:**

```javascript
const Redis = require('ioredis');
const redis = new Redis();

// Cache wrapper for Mongoose queries
class MongoCache {
  constructor(redisClient, defaultTTL = 300) {
    this.redis = redisClient;
    this.defaultTTL = defaultTTL;
  }

  getCacheKey(model, query, options = {}) {
    return `mongo:${model}:${JSON.stringify(query)}:${JSON.stringify(options)}`;
  }

  async get(key) {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key, data, ttl = this.defaultTTL) {
    await this.redis.setex(key, ttl, JSON.stringify(data));
  }

  async invalidate(pattern) {
    const keys = await this.redis.keys(`mongo:${pattern}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

const cache = new MongoCache(redis);

// Cached find
async function cachedFind(model, query, options = {}) {
  const cacheKey = cache.getCacheKey(model.modelName, query, options);
  
  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Query database
  let mongoQuery = model.find(query);
  
  if (options.select) mongoQuery = mongoQuery.select(options.select);
  if (options.sort) mongoQuery = mongoQuery.sort(options.sort);
  if (options.limit) mongoQuery = mongoQuery.limit(options.limit);
  if (options.populate) mongoQuery = mongoQuery.populate(options.populate);
  
  const result = await mongoQuery.lean();

  // Cache result
  await cache.set(cacheKey, result, options.ttl);

  return result;
}

// Usage
const products = await cachedFind(Product, { category: 'electronics' }, {
  select: 'name price',
  sort: '-createdAt',
  limit: 20,
  ttl: 600 // 10 minutes
});

// Cache invalidation on updates
async function updateProduct(id, data) {
  const product = await Product.findByIdAndUpdate(id, data, { new: true });
  
  // Invalidate related caches
  await cache.invalidate(`Product`);
  await cache.invalidate(`Category:${product.category}`);
  
  return product;
}

// Mongoose plugin for automatic caching
function cachePlugin(schema, options) {
  schema.statics.findCached = async function(query, cacheOptions = {}) {
    const key = cache.getCacheKey(this.modelName, query, cacheOptions);
    
    const cached = await cache.get(key);
    if (cached) return cached;
    
    const result = await this.find(query).lean();
    await cache.set(key, result, cacheOptions.ttl || 300);
    
    return result;
  };

  // Invalidate on save
  schema.post('save', async function() {
    await cache.invalidate(this.constructor.modelName);
  });

  schema.post('findOneAndUpdate', async function() {
    await cache.invalidate(this.model.modelName);
  });

  schema.post('deleteOne', async function() {
    await cache.invalidate(this.model.modelName);
  });
}

// Apply plugin
productSchema.plugin(cachePlugin);

// Usage
const products = await Product.findCached({ status: 'active' }, { ttl: 600 });
```

---

### Q44: How do you handle sharding in MongoDB?

**Answer:**

```javascript
// Sharding distributes data across multiple servers

// Shard key selection (critical decision)
// Good shard keys have:
// 1. High cardinality (many unique values)
// 2. Low frequency (values evenly distributed)
// 3. Non-monotonically increasing (avoid hot spots)

// Example: Sharding users collection
// Good shard key: { region: 1, _id: 1 } (compound)
// Bad shard key: { createdAt: 1 } (monotonically increasing)

// Enable sharding (run in mongos)
// sh.enableSharding("myDatabase")
// sh.shardCollection("myDatabase.users", { region: 1, _id: 1 })

// Application considerations with sharded collections
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Include shard key in schema
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true
  },
  orderId: String,
  items: [{
    product: String,
    quantity: Number,
    price: Number
  }],
  total: Number,
  status: String
});

// Queries should include shard key for efficiency
async function getCustomerOrders(customerId) {
  // Good - includes shard key
  return Order.find({ customerId });
}

async function getOrderById(orderId, customerId) {
  // Good - includes shard key
  return Order.findOne({ orderId, customerId });
}

async function getAllPendingOrders() {
  // Bad - scatter-gather across all shards
  return Order.find({ status: 'pending' });
}

// Zone-based sharding for data locality
// Useful for multi-region deployments
// sh.addShardTag("shard0", "US")
// sh.addShardTag("shard1", "EU")
// sh.addTagRange("myDatabase.users", { region: "US" }, { region: "US\xFF" }, "US")
// sh.addTagRange("myDatabase.users", { region: "EU" }, { region: "EU\xFF" }, "EU")

// Hashed shard key for even distribution
const logSchema = new mongoose.Schema({
  timestamp: Date,
  userId: mongoose.Schema.Types.ObjectId,
  action: String,
  data: mongoose.Schema.Types.Mixed
});

// Create hashed index
logSchema.index({ userId: 'hashed' });
// sh.shardCollection("myDatabase.logs", { userId: "hashed" })

// Chunk management considerations
// - Monitor chunk distribution
// - Pre-split for predictable growth
// - Consider zone ranges for data locality
```

---

### Q45: How do you set up replica sets and handle failover?

**Answer:**

```javascript
const mongoose = require('mongoose');

// Connect to replica set
const uri = 'mongodb://host1:27017,host2:27017,host3:27017/myDatabase?replicaSet=myReplicaSet';

const options = {
  replicaSet: 'myReplicaSet',
  readPreference: 'primaryPreferred',
  w: 'majority',
  wtimeout: 10000,
  retryWrites: true
};

mongoose.connect(uri, options);

// Read preferences
// primary - Always read from primary (default)
// primaryPreferred - Primary, but secondary if primary unavailable
// secondary - Read from secondary only
// secondaryPreferred - Secondary preferred, primary as fallback
// nearest - Read from node with lowest latency

// Set read preference per query
const users = await User.find({})
  .read('secondary')  // Read from secondary
  .lean();

// Or with options object
const users = await User.find({})
  .read({ mode: 'secondaryPreferred', tagSets: [{ region: 'us-east' }] });

// Write concerns
// w: 1 - Acknowledged by primary
// w: 'majority' - Acknowledged by majority of replica set
// w: 0 - No acknowledgment (fire and forget)

// Set write concern per operation
await User.create([userData], { 
  writeConcern: { w: 'majority', j: true } 
});

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB replica set');
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected from MongoDB');
  // Driver will automatically attempt to reconnect
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// Topology events
const client = mongoose.connection.getClient();

client.on('serverDescriptionChanged', (event) => {
  console.log('Server description changed:', event.newDescription.type);
});

client.on('topologyDescriptionChanged', (event) => {
  const newType = event.newDescription.type;
  console.log('Topology changed:', newType);
  
  if (newType === 'ReplicaSetNoPrimary') {
    console.warn('No primary available!');
  }
});

// Retry logic for transient errors
async function executeWithRetry(operation, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Retry on transient errors
      if (isRetryableError(error)) {
        const delay = Math.pow(2, i) * 100;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

function isRetryableError(error) {
  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED'
  ];
  
  return (
    error.name === 'MongoNetworkError' ||
    retryableCodes.includes(error.code) ||
    error.message.includes('not master')
  );
}
```

---

### Q46-Q50: [Additional Production Questions - Key Topics]

Key topics covered:
- **Q46**: Backup and restore strategies
- **Q47**: Monitoring and alerting
- **Q48**: Security best practices
- **Q49**: Migration strategies
- **Q50**: Troubleshooting common issues

---

## Summary

This guide covers MongoDB with Node.js concepts:

1. **MongoDB Basics**: Connections, CRUD operations, operators
2. **Mongoose ODM**: Schemas, middleware, virtuals, validation
3. **Queries & Aggregation**: Pipeline stages, operators, text search
4. **Schema Design**: Relationships, denormalization, patterns
5. **Performance & Production**: Optimization, caching, replication, sharding

**Key Takeaways:**
- Choose appropriate schema design for your access patterns
- Use indexes strategically based on query patterns
- Leverage aggregation for complex data transformations
- Implement proper error handling and validation
- Monitor and optimize query performance
- Design for scalability from the start
