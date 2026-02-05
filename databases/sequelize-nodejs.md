# Sequelize with Node.js Interview Questions

> **Focus**: Sequelize ORM for SQL databases (PostgreSQL, MySQL, SQLite, MSSQL)
> **Total Questions**: 50
> **Complexity**: Progresses from basic to advanced

---

## Table of Contents
1. [Sequelize Basics (Q1-Q10)](#sequelize-basics)
2. [Models & Schemas (Q11-Q20)](#models--schemas)
3. [Queries & Operations (Q21-Q30)](#queries--operations)
4. [Associations & Relationships (Q31-Q40)](#associations--relationships)
5. [Advanced Topics (Q41-Q50)](#advanced-topics)

---

## Sequelize Basics

### Q1: What is Sequelize and why use it?

**Answer:**
Sequelize is a promise-based Node.js ORM (Object-Relational Mapping) for SQL databases. It supports PostgreSQL, MySQL, MariaDB, SQLite, and Microsoft SQL Server.

**Benefits:**
- Database abstraction (write once, use any SQL database)
- Model-based approach with validation
- Migration support for schema changes
- Association handling (relationships)
- Transaction support
- Protection against SQL injection
- TypeScript support

```javascript
const { Sequelize, DataTypes, Model } = require('sequelize');

// Initialize connection
const sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: 'postgres', // 'mysql' | 'sqlite' | 'mssql'
  logging: console.log, // false to disable
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define a model
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      isEmail: true
    }
  }
});

// Sync and use
await sequelize.sync();
const user = await User.create({ name: 'John', email: 'john@example.com' });
```

---

### Q2: How do you connect to different databases?

**Answer:**

```javascript
const { Sequelize } = require('sequelize');

// PostgreSQL
const postgresSequelize = new Sequelize('postgres://user:pass@localhost:5432/mydb', {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

// MySQL
const mysqlSequelize = new Sequelize('mydb', 'user', 'password', {
  host: 'localhost',
  dialect: 'mysql',
  port: 3306
});

// SQLite
const sqliteSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
});

// Microsoft SQL Server
const mssqlSequelize = new Sequelize('mydb', 'user', 'password', {
  host: 'localhost',
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: true,
      trustServerCertificate: true
    }
  }
});

// Connection with environment variables
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Test connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to database:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await sequelize.close();
  console.log('Database connection closed.');
  process.exit(0);
});
```

---

### Q3: What is `sequelize.sync()` and what are the sync options?

**Answer:**
`sync()` synchronizes all defined models to the database by creating tables if they don't exist.

```javascript
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('sqlite::memory:');

const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING
});

// Sync options:

// 1. Default sync - creates table if doesn't exist
await sequelize.sync();

// 2. Force sync - drops table and recreates (DANGEROUS in production!)
await sequelize.sync({ force: true });

// 3. Alter sync - alters table to match model (can be destructive)
await sequelize.sync({ alter: true });

// 4. Sync single model
await User.sync();
await User.sync({ force: true });

// 5. Match existing tables (no creation)
await sequelize.sync({ match: /_test$/ }); // Only tables ending with _test

// In production, use migrations instead of sync!
// sync() is for development only

// Safe pattern for development
async function initDatabase() {
  if (process.env.NODE_ENV === 'development') {
    await sequelize.sync({ alter: true });
  } else {
    // In production, just authenticate
    await sequelize.authenticate();
  }
}

// Logging SQL
await sequelize.sync({
  logging: (sql) => console.log(sql)
});

// Check if model/table exists
const tableExists = await sequelize.getQueryInterface().showAllTables();
console.log(tableExists);
```

---

### Q4: What are the Sequelize data types?

**Answer:**

```javascript
const { DataTypes } = require('sequelize');

const ExampleModel = sequelize.define('Example', {
  // STRINGS
  shortString: DataTypes.STRING,           // VARCHAR(255)
  longString: DataTypes.STRING(1234),      // VARCHAR(1234)
  text: DataTypes.TEXT,                    // TEXT
  tinyText: DataTypes.TEXT('tiny'),        // TINYTEXT (MySQL)
  
  // NUMBERS
  integer: DataTypes.INTEGER,              // INTEGER
  bigInt: DataTypes.BIGINT,                // BIGINT
  float: DataTypes.FLOAT,                  // FLOAT
  double: DataTypes.DOUBLE,                // DOUBLE
  decimal: DataTypes.DECIMAL(10, 2),       // DECIMAL(10, 2)
  real: DataTypes.REAL,                    // REAL (PostgreSQL)
  
  // BOOLEANS
  isActive: DataTypes.BOOLEAN,             // BOOLEAN or TINYINT(1)
  
  // DATES
  createdAt: DataTypes.DATE,               // DATETIME (MySQL) / TIMESTAMP WITH TIME ZONE (PG)
  dateOnly: DataTypes.DATEONLY,            // DATE (no time)
  time: DataTypes.TIME,                    // TIME
  
  // BINARY
  binary: DataTypes.BLOB,                  // BLOB
  longBlob: DataTypes.BLOB('long'),        // LONGBLOB
  
  // UUID
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4        // Auto-generate UUID v4
  },
  
  // ENUM
  status: {
    type: DataTypes.ENUM('pending', 'active', 'inactive'),
    defaultValue: 'pending'
  },
  
  // JSON (PostgreSQL, MySQL 5.7+, SQLite)
  metadata: DataTypes.JSON,
  jsonb: DataTypes.JSONB,                  // PostgreSQL JSONB
  
  // ARRAYS (PostgreSQL only)
  tags: DataTypes.ARRAY(DataTypes.STRING),
  numbers: DataTypes.ARRAY(DataTypes.INTEGER),
  
  // RANGE (PostgreSQL only)
  range: DataTypes.RANGE(DataTypes.INTEGER),
  dateRange: DataTypes.RANGE(DataTypes.DATEONLY),
  
  // GEOMETRY (PostGIS)
  location: DataTypes.GEOMETRY('POINT'),
  polygon: DataTypes.GEOMETRY('POLYGON', 4326),
  
  // VIRTUAL (computed, not stored)
  fullName: {
    type: DataTypes.VIRTUAL,
    get() {
      return `${this.firstName} ${this.lastName}`;
    },
    set(value) {
      const parts = value.split(' ');
      this.setDataValue('firstName', parts[0]);
      this.setDataValue('lastName', parts[1]);
    }
  },
  
  // VIRTUAL with dependencies
  age: {
    type: DataTypes.VIRTUAL(DataTypes.INTEGER, ['birthDate']),
    get() {
      return calculateAge(this.birthDate);
    }
  }
});
```

---

### Q5: How do you define a model in Sequelize?

**Answer:**

```javascript
const { Sequelize, DataTypes, Model } = require('sequelize');

// Method 1: sequelize.define()
const User = sequelize.define('User', {
  // Attributes
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50]
    }
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'pending'),
    defaultValue: 'pending'
  }
}, {
  // Model options
  tableName: 'users',           // Custom table name
  timestamps: true,             // createdAt, updatedAt (default true)
  paranoid: true,               // Soft delete (adds deletedAt)
  underscored: true,            // snake_case column names
  freezeTableName: true,        // Don't pluralize table name
  indexes: [
    { fields: ['email'] },
    { fields: ['status', 'createdAt'] }
  ]
});

// Method 2: Class extending Model
class Product extends Model {
  // Instance methods
  getFullDescription() {
    return `${this.name} - $${this.price}`;
  }
  
  // Static methods
  static async findByCategory(categoryId) {
    return this.findAll({ where: { categoryId } });
  }
}

Product.init({
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  description: DataTypes.TEXT,
  categoryId: DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'Product',
  tableName: 'products'
});

// Method 3: Define with associations setup
// models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: DataTypes.STRING,
    email: DataTypes.STRING
  });

  User.associate = function(models) {
    User.hasMany(models.Post, { foreignKey: 'authorId' });
    User.belongsToMany(models.Role, { through: 'UserRoles' });
  };

  return User;
};

// Usage
const user = await User.create({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'hashedPassword'
});

const product = await Product.create({
  name: 'Laptop',
  price: 999.99
});
```

---

### Q6: What are getters and setters in Sequelize?

**Answer:**
Getters and setters allow you to transform data when reading from or writing to the database.

```javascript
const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    // Getter - called when reading
    get() {
      const rawValue = this.getDataValue('firstName');
      return rawValue ? rawValue.charAt(0).toUpperCase() + rawValue.slice(1) : null;
    },
    // Setter - called when writing
    set(value) {
      this.setDataValue('firstName', value.toLowerCase());
    }
  },
  
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    get() {
      return this.getDataValue('lastName')?.toUpperCase();
    }
  },
  
  // Virtual field using getters
  fullName: {
    type: DataTypes.VIRTUAL,
    get() {
      return `${this.firstName} ${this.lastName}`;
    },
    set(value) {
      const names = value.split(' ');
      this.setDataValue('firstName', names[0]);
      this.setDataValue('lastName', names.slice(1).join(' '));
    }
  },
  
  // Password hashing with setter
  password: {
    type: DataTypes.STRING,
    set(value) {
      // Hash password before storing
      const hash = bcrypt.hashSync(value, 10);
      this.setDataValue('password', hash);
    }
  },
  
  // JSON field with parsing
  settings: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('settings');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('settings', JSON.stringify(value));
    }
  },
  
  // Price with formatting
  price: {
    type: DataTypes.INTEGER, // Store in cents
    get() {
      return this.getDataValue('price') / 100;
    },
    set(value) {
      this.setDataValue('price', Math.round(value * 100));
    }
  }
});

// Instance method to compare password
User.prototype.checkPassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Usage
const user = await User.create({
  firstName: 'JOHN',
  lastName: 'doe',
  password: 'secret123',
  settings: { theme: 'dark', notifications: true }
});

console.log(user.firstName);  // 'John' (stored as 'john', displayed capitalized)
console.log(user.lastName);   // 'DOE'
console.log(user.fullName);   // 'John DOE'
console.log(user.settings);   // { theme: 'dark', notifications: true }

const isValid = await user.checkPassword('secret123'); // true
```

---

### Q7: How do you handle validation in Sequelize?

**Answer:**

```javascript
const { DataTypes, ValidationError } = require('sequelize');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: {
      msg: 'Username already exists'
    },
    validate: {
      // Built-in validators
      notNull: { msg: 'Username is required' },
      notEmpty: { msg: 'Username cannot be empty' },
      len: {
        args: [3, 20],
        msg: 'Username must be between 3 and 20 characters'
      },
      isAlphanumeric: { msg: 'Username must be alphanumeric' },
      
      // Custom validator
      notAdmin(value) {
        if (value.toLowerCase() === 'admin') {
          throw new Error('Cannot use "admin" as username');
        }
      }
    }
  },
  
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: { msg: 'Invalid email format' },
      notNull: { msg: 'Email is required' }
    }
  },
  
  age: {
    type: DataTypes.INTEGER,
    validate: {
      isInt: true,
      min: {
        args: [0],
        msg: 'Age must be positive'
      },
      max: {
        args: [150],
        msg: 'Age seems unrealistic'
      }
    }
  },
  
  website: {
    type: DataTypes.STRING,
    validate: {
      isUrl: { msg: 'Invalid URL format' }
    }
  },
  
  creditCard: {
    type: DataTypes.STRING,
    validate: {
      isCreditCard: true
    }
  },
  
  status: {
    type: DataTypes.STRING,
    validate: {
      isIn: {
        args: [['active', 'inactive', 'pending']],
        msg: 'Invalid status value'
      }
    }
  },
  
  // Async validation
  subdomain: {
    type: DataTypes.STRING,
    validate: {
      async isUnique(value) {
        const existing = await Subdomain.findOne({ where: { name: value } });
        if (existing) {
          throw new Error('Subdomain already taken');
        }
      }
    }
  }
}, {
  // Model-level validation
  validate: {
    bothNamesOrNone() {
      if ((this.firstName === null) !== (this.lastName === null)) {
        throw new Error('Provide both first name and last name or neither');
      }
    },
    
    async emailMatchesDomain() {
      if (this.companyId) {
        const company = await Company.findByPk(this.companyId);
        if (company && !this.email.endsWith(`@${company.domain}`)) {
          throw new Error('Email must match company domain');
        }
      }
    }
  }
});

// Handling validation errors
async function createUser(userData) {
  try {
    const user = await User.create(userData);
    return user;
  } catch (error) {
    if (error instanceof ValidationError) {
      const messages = error.errors.map(e => ({
        field: e.path,
        message: e.message,
        type: e.type
      }));
      throw new BadRequestError('Validation failed', messages);
    }
    throw error;
  }
}

// Built-in validators list
const validators = {
  is: /^[a-z]+$/i,          // Regex match
  not: /^[a-z]+$/i,         // Regex not match
  isEmail: true,
  isUrl: true,
  isIP: true,
  isIPv4: true,
  isIPv6: true,
  isAlpha: true,
  isAlphanumeric: true,
  isNumeric: true,
  isInt: true,
  isFloat: true,
  isDecimal: true,
  isLowercase: true,
  isUppercase: true,
  notNull: true,
  isNull: true,
  notEmpty: true,
  equals: 'value',
  contains: 'substring',
  notIn: [['invalid']],
  isIn: [['valid']],
  notContains: 'substring',
  len: [min, max],
  isUUID: 4,
  isDate: true,
  isAfter: '2020-01-01',
  isBefore: '2030-01-01',
  max: 100,
  min: 0,
  isCreditCard: true
};
```

---

### Q8: How do you use hooks (lifecycle events) in Sequelize?

**Answer:**

```javascript
const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

class User extends Model {}

User.init({
  username: DataTypes.STRING,
  email: DataTypes.STRING,
  password: DataTypes.STRING
}, { sequelize, modelName: 'User' });

// Individual hooks
User.beforeCreate(async (user, options) => {
  user.password = await bcrypt.hash(user.password, 10);
  user.email = user.email.toLowerCase();
});

User.afterCreate(async (user, options) => {
  await sendWelcomeEmail(user.email);
  await createDefaultSettings(user.id);
});

User.beforeUpdate(async (user, options) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.afterDestroy(async (user, options) => {
  await cleanupUserData(user.id);
});

// Hooks in model definition
const Product = sequelize.define('Product', {
  name: DataTypes.STRING,
  price: DataTypes.DECIMAL
}, {
  hooks: {
    beforeValidate: (product, options) => {
      product.name = product.name?.trim();
    },
    afterValidate: (product, options) => {
      if (product.price < 0) {
        throw new Error('Price cannot be negative');
      }
    },
    beforeCreate: (product, options) => {
      product.sku = generateSKU(product);
    },
    afterCreate: (product, options) => {
      notifyInventory(product);
    }
  }
});

// Bulk hooks
User.beforeBulkCreate(async (users, options) => {
  for (const user of users) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// By default, bulk operations don't trigger individual hooks
// To enable individual hooks:
await User.bulkCreate(users, { individualHooks: true });

// All available hooks
const hookTypes = [
  // Validation
  'beforeValidate', 'afterValidate',
  
  // Create
  'beforeCreate', 'afterCreate',
  'beforeBulkCreate', 'afterBulkCreate',
  
  // Update
  'beforeUpdate', 'afterUpdate',
  'beforeBulkUpdate', 'afterBulkUpdate',
  'beforeSave', 'afterSave',
  
  // Delete
  'beforeDestroy', 'afterDestroy',
  'beforeBulkDestroy', 'afterBulkDestroy',
  
  // Find
  'beforeFind', 'afterFind',
  'beforeFindAfterExpandIncludeAll',
  'beforeFindAfterOptions',
  
  // Upsert
  'beforeUpsert', 'afterUpsert',
  
  // Sync
  'beforeSync', 'afterSync',
  'beforeBulkSync', 'afterBulkSync'
];

// Global hooks (apply to all models)
sequelize.addHook('beforeCreate', (instance, options) => {
  console.log('Creating:', instance.constructor.name);
});

// Removing hooks
const hookFunction = (user, options) => {};
User.addHook('beforeCreate', 'myHook', hookFunction);
User.removeHook('beforeCreate', 'myHook');

// Passing data through hooks via options
User.beforeCreate((user, options) => {
  options.hookData = { originalEmail: user.email };
});

User.afterCreate((user, options) => {
  console.log('Original email:', options.hookData?.originalEmail);
});
```

---

### Q9: How do you perform raw queries in Sequelize?

**Answer:**

```javascript
const { QueryTypes } = require('sequelize');

// Basic raw query
const users = await sequelize.query('SELECT * FROM users');
// Returns: [results, metadata]

// Query with type
const users = await sequelize.query(
  'SELECT * FROM users WHERE status = :status',
  {
    replacements: { status: 'active' },
    type: QueryTypes.SELECT // Returns just results
  }
);

// Query types
// QueryTypes.SELECT - Array of results
// QueryTypes.INSERT - [insertId, affectedRows]
// QueryTypes.UPDATE - Number of affected rows
// QueryTypes.DELETE - Number of deleted rows
// QueryTypes.RAW - Returns raw result

// With replacements (named parameters)
const result = await sequelize.query(
  'SELECT * FROM users WHERE name = :name AND age > :age',
  {
    replacements: { name: 'John', age: 18 },
    type: QueryTypes.SELECT
  }
);

// With replacements (positional)
const result = await sequelize.query(
  'SELECT * FROM users WHERE name = ? AND age > ?',
  {
    replacements: ['John', 18],
    type: QueryTypes.SELECT
  }
);

// Bind parameters (more secure)
const result = await sequelize.query(
  'SELECT * FROM users WHERE name = $1 AND age > $2',
  {
    bind: ['John', 18],
    type: QueryTypes.SELECT
  }
);

// Map to model
const users = await sequelize.query(
  'SELECT * FROM users WHERE status = ?',
  {
    replacements: ['active'],
    type: QueryTypes.SELECT,
    model: User,
    mapToModel: true
  }
);
// Returns User instances instead of plain objects

// With transaction
const t = await sequelize.transaction();
try {
  await sequelize.query(
    'UPDATE accounts SET balance = balance - :amount WHERE id = :id',
    {
      replacements: { amount: 100, id: 1 },
      transaction: t
    }
  );
  await t.commit();
} catch (error) {
  await t.rollback();
}

// Multiple statements (if supported by dialect)
await sequelize.query(`
  UPDATE users SET status = 'inactive' WHERE last_login < NOW() - INTERVAL '1 year';
  DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE status = 'inactive');
`);

// Calling stored procedures
const result = await sequelize.query(
  'CALL get_user_stats(:userId)',
  {
    replacements: { userId: 1 },
    type: QueryTypes.RAW
  }
);

// Insert with returning (PostgreSQL)
const [users] = await sequelize.query(
  'INSERT INTO users (name, email) VALUES (:name, :email) RETURNING *',
  {
    replacements: { name: 'John', email: 'john@example.com' },
    type: QueryTypes.INSERT
  }
);
```

---

### Q10: How do you handle database migrations?

**Answer:**

```bash
# Install Sequelize CLI
npm install --save-dev sequelize-cli

# Initialize migrations structure
npx sequelize-cli init
```

```javascript
// config/config.js
module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'postgres'
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: { rejectUnauthorized: false }
    }
  }
};

// migrations/20240101000000-create-users.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index
    await queryInterface.addIndex('Users', ['email']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
  }
};

// migrations/20240102000000-add-status-to-users.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'pending'),
      defaultValue: 'pending'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'status');
    // For ENUM in PostgreSQL
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Users_status";'
    );
  }
};

// migrations/20240103000000-add-index-to-users.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('Users', ['status', 'createdAt'], {
      name: 'users_status_created_at_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Users', 'users_status_created_at_idx');
  }
};
```

```bash
# Migration commands
npx sequelize-cli migration:generate --name add-phone-to-users
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:undo
npx sequelize-cli db:migrate:undo:all
npx sequelize-cli db:migrate:status
```

---

## Models & Schemas

### Q11: How do you define model associations?

**Answer:**

```javascript
const { DataTypes } = require('sequelize');

// Define models
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING
});

const Profile = sequelize.define('Profile', {
  bio: DataTypes.TEXT,
  avatar: DataTypes.STRING
});

const Post = sequelize.define('Post', {
  title: DataTypes.STRING,
  content: DataTypes.TEXT
});

const Tag = sequelize.define('Tag', {
  name: DataTypes.STRING
});

// One-to-One: User has one Profile
User.hasOne(Profile, {
  foreignKey: 'userId',
  as: 'profile',
  onDelete: 'CASCADE'
});
Profile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// One-to-Many: User has many Posts
User.hasMany(Post, {
  foreignKey: 'authorId',
  as: 'posts'
});
Post.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author'
});

// Many-to-Many: Posts have many Tags
Post.belongsToMany(Tag, {
  through: 'PostTags',
  as: 'tags',
  foreignKey: 'postId'
});
Tag.belongsToMany(Post, {
  through: 'PostTags',
  as: 'posts',
  foreignKey: 'tagId'
});

// Many-to-Many with custom join table
const PostTag = sequelize.define('PostTag', {
  addedBy: DataTypes.INTEGER,
  addedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

Post.belongsToMany(Tag, { through: PostTag });
Tag.belongsToMany(Post, { through: PostTag });

// Self-referencing associations
const Category = sequelize.define('Category', {
  name: DataTypes.STRING
});

// Category can have parent category
Category.belongsTo(Category, {
  as: 'parent',
  foreignKey: 'parentId'
});
Category.hasMany(Category, {
  as: 'children',
  foreignKey: 'parentId'
});

// User following users (self many-to-many)
User.belongsToMany(User, {
  through: 'UserFollows',
  as: 'followers',
  foreignKey: 'followingId',
  otherKey: 'followerId'
});
User.belongsToMany(User, {
  through: 'UserFollows',
  as: 'following',
  foreignKey: 'followerId',
  otherKey: 'followingId'
});
```

---

### Q12: How do you use eager loading (include) for associations?

**Answer:**

```javascript
// Basic include
const users = await User.findAll({
  include: [Profile]
});

// Include with alias
const users = await User.findAll({
  include: [{
    model: Profile,
    as: 'profile'
  }]
});

// Multiple includes
const users = await User.findAll({
  include: [
    { model: Profile, as: 'profile' },
    { model: Post, as: 'posts' }
  ]
});

// Nested includes
const posts = await Post.findAll({
  include: [{
    model: User,
    as: 'author',
    include: [{
      model: Profile,
      as: 'profile'
    }]
  }]
});

// Include with conditions
const users = await User.findAll({
  include: [{
    model: Post,
    as: 'posts',
    where: { status: 'published' },
    required: false // LEFT JOIN (default is INNER JOIN when where is used)
  }]
});

// Include specific attributes
const users = await User.findAll({
  include: [{
    model: Post,
    as: 'posts',
    attributes: ['id', 'title']
  }]
});

// Include all associations
const users = await User.findAll({
  include: { all: true }
});

// Include all nested
const users = await User.findAll({
  include: { all: true, nested: true }
});

// Many-to-many include with through table attributes
const posts = await Post.findAll({
  include: [{
    model: Tag,
    as: 'tags',
    through: {
      attributes: ['addedAt', 'addedBy']
    }
  }]
});

// Subquery loading (better for large datasets)
const users = await User.findAll({
  include: [{
    model: Post,
    as: 'posts',
    separate: true, // Loads in separate query
    limit: 5,
    order: [['createdAt', 'DESC']]
  }]
});

// Include with ordering
const users = await User.findAll({
  include: [{
    model: Post,
    as: 'posts'
  }],
  order: [
    ['name', 'ASC'],
    [{ model: Post, as: 'posts' }, 'createdAt', 'DESC']
  ]
});

// Right join (less common)
const profiles = await Profile.findAll({
  include: [{
    model: User,
    as: 'user',
    required: true,
    right: true
  }]
});
```

---

### Q13: How do you create and manage associations?

**Answer:**

```javascript
// After defining associations, Sequelize creates special methods

// One-to-One: User.hasOne(Profile)
const user = await User.findByPk(1);

// Create associated profile
const profile = await user.createProfile({ bio: 'Developer' });

// Get associated profile
const profile = await user.getProfile();

// Set (replace) profile
await user.setProfile(newProfile);

// Remove profile
await user.setProfile(null);


// One-to-Many: User.hasMany(Post)
const user = await User.findByPk(1);

// Create post for user
const post = await user.createPost({ title: 'New Post' });

// Get user's posts
const posts = await user.getPosts();

// Count posts
const count = await user.countPosts();

// Check if has post
const hasPost = await user.hasPost(postId);
const hasPosts = await user.hasPosts([postId1, postId2]);

// Add existing posts
await user.addPost(existingPost);
await user.addPosts([post1, post2]);

// Set (replace all) posts
await user.setPosts([post1, post2]);

// Remove posts
await user.removePost(postToRemove);
await user.removePosts([post1, post2]);


// Many-to-Many: Post.belongsToMany(Tag)
const post = await Post.findByPk(1);

// Create and associate tag
const tag = await post.createTag({ name: 'JavaScript' });

// Get tags
const tags = await post.getTags();

// Add existing tags
await post.addTag(tagId);
await post.addTags([tag1, tag2]);

// Set tags (replace all)
await post.setTags([tag1, tag2]);

// Remove tags
await post.removeTag(tagId);
await post.removeTags([tag1, tag2]);

// Check association
const hasTag = await post.hasTag(tagId);

// Count
const tagCount = await post.countTags();

// Add with through table data
await post.addTag(tagId, {
  through: {
    addedBy: userId,
    addedAt: new Date()
  }
});


// Create with associations
const userWithProfile = await User.create({
  name: 'John',
  email: 'john@example.com',
  profile: {
    bio: 'Developer'
  }
}, {
  include: [{ model: Profile, as: 'profile' }]
});

// Create with multiple associations
const userWithPosts = await User.create({
  name: 'Jane',
  email: 'jane@example.com',
  posts: [
    { title: 'First Post' },
    { title: 'Second Post' }
  ]
}, {
  include: [{ model: Post, as: 'posts' }]
});
```

---

### Q14: What are scopes in Sequelize?

**Answer:**
Scopes allow you to define commonly-used queries for reuse.

```javascript
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  status: DataTypes.STRING,
  role: DataTypes.STRING
}, {
  // Default scope (always applied unless unscoped)
  defaultScope: {
    where: {
      status: 'active'
    }
  },
  
  // Named scopes
  scopes: {
    // Simple scope
    active: {
      where: { status: 'active' }
    },
    
    inactive: {
      where: { status: 'inactive' }
    },
    
    // Scope with association
    withProfile: {
      include: [{
        model: Profile,
        as: 'profile'
      }]
    },
    
    // Scope with function (for dynamic values)
    byRole(role) {
      return {
        where: { role }
      };
    },
    
    recent(days = 7) {
      return {
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      };
    },
    
    // Scope with ordering
    ordered: {
      order: [['createdAt', 'DESC']]
    },
    
    // Scope with attributes
    minimal: {
      attributes: ['id', 'name', 'email']
    },
    
    // Combined conditions
    activeAdmins: {
      where: {
        status: 'active',
        role: 'admin'
      }
    }
  }
});

// Usage

// Default scope is applied automatically
const users = await User.findAll(); // Only active users

// Use named scope
const activeUsers = await User.scope('active').findAll();

// Function scope with parameter
const admins = await User.scope({ method: ['byRole', 'admin'] }).findAll();
const recentUsers = await User.scope({ method: ['recent', 30] }).findAll();

// Multiple scopes
const result = await User.scope(['active', 'ordered', 'minimal']).findAll();

// Combine scopes
const result = await User.scope('active', 'withProfile').findAll();

// Remove default scope
const allUsers = await User.unscoped().findAll();

// Override default scope
const inactiveUsers = await User.scope('inactive').findAll();

// Add scope to associations
User.hasMany(Post, {
  foreignKey: 'authorId',
  scope: { status: 'published' }, // Only published posts
  as: 'publishedPosts'
});

// Scope on association
User.addScope('withPublishedPosts', {
  include: [{
    model: Post,
    as: 'posts',
    where: { status: 'published' }
  }]
});
```

---

### Q15: How do you implement soft delete (paranoid mode)?

**Answer:**

```javascript
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING
}, {
  paranoid: true, // Enables soft delete
  deletedAt: 'deletedAt' // Custom column name (default is 'deletedAt')
});

// When paranoid is true:
// - destroy() sets deletedAt instead of deleting
// - findAll() excludes soft-deleted records
// - deletedAt column is automatically added

// Soft delete
await user.destroy();
// Executes: UPDATE users SET deletedAt = NOW() WHERE id = 1

// Find only includes non-deleted by default
const users = await User.findAll(); // Excludes deleted

// Include soft-deleted records
const allUsers = await User.findAll({ paranoid: false });

// Find only deleted records
const deletedUsers = await User.findAll({
  where: {
    deletedAt: { [Op.ne]: null }
  },
  paranoid: false
});

// Restore soft-deleted record
await user.restore();
// Executes: UPDATE users SET deletedAt = NULL WHERE id = 1

// Restore multiple
await User.restore({
  where: { id: { [Op.in]: [1, 2, 3] } }
});

// Hard delete (permanently)
await user.destroy({ force: true });
// Executes: DELETE FROM users WHERE id = 1

// With associations
const Post = sequelize.define('Post', {
  title: DataTypes.STRING
}, {
  paranoid: true
});

User.hasMany(Post, {
  foreignKey: 'authorId',
  onDelete: 'CASCADE' // Will soft-delete posts when user is soft-deleted
});

// Soft delete with cascade
await user.destroy(); // Also soft-deletes associated posts

// Custom soft delete with additional logic
User.beforeDestroy(async (user, options) => {
  // Anonymize data before soft delete
  await user.update({
    email: `deleted_${user.id}@example.com`,
    name: 'Deleted User'
  });
});

// Scheduled cleanup of old soft-deleted records
async function cleanupDeletedRecords(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  await User.destroy({
    where: {
      deletedAt: { [Op.lt]: cutoffDate }
    },
    force: true // Hard delete
  });
}
```

---

### Q16-Q20: [Additional Model Questions - Key Topics]

Key topics covered:
- **Q16**: Model inheritance and polymorphic associations
- **Q17**: Composite primary keys
- **Q18**: Custom table names and naming conventions
- **Q19**: Timestamps customization
- **Q20**: Model methods and class methods

---

## Queries & Operations

### Q21: How do you perform CRUD operations?

**Answer:**

```javascript
// CREATE

// Single record
const user = await User.create({
  name: 'John',
  email: 'john@example.com'
});

// Multiple records
const users = await User.bulkCreate([
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' }
]);

// With validation
const users = await User.bulkCreate(userData, {
  validate: true,
  individualHooks: true
});

// Build without saving
const user = User.build({ name: 'John' });
await user.save();

// Create or find
const [user, created] = await User.findOrCreate({
  where: { email: 'john@example.com' },
  defaults: { name: 'John' }
});


// READ

// Find all
const users = await User.findAll();

// Find with conditions
const users = await User.findAll({
  where: { status: 'active' },
  order: [['createdAt', 'DESC']],
  limit: 10,
  offset: 0
});

// Find by primary key
const user = await User.findByPk(1);

// Find one
const user = await User.findOne({
  where: { email: 'john@example.com' }
});

// Find and count
const { count, rows } = await User.findAndCountAll({
  where: { status: 'active' },
  limit: 10
});


// UPDATE

// Update instance
user.name = 'John Doe';
await user.save();

// Update specific fields
await user.update({ name: 'John Doe', status: 'active' });

// Update by primary key
const [affectedRows] = await User.update(
  { status: 'inactive' },
  { where: { id: 1 } }
);

// Update multiple
const [affectedRows] = await User.update(
  { status: 'inactive' },
  { where: { lastLogin: { [Op.lt]: thirtyDaysAgo } } }
);

// Increment/Decrement
await user.increment('loginCount');
await user.increment('balance', { by: 100 });
await user.decrement('credits', { by: 10 });

// Upsert (insert or update)
const [user, created] = await User.upsert({
  id: 1,
  name: 'John',
  email: 'john@example.com'
});


// DELETE

// Delete instance
await user.destroy();

// Delete by condition
const deletedCount = await User.destroy({
  where: { status: 'inactive' }
});

// Delete all
await User.destroy({ where: {}, truncate: true });

// Truncate table
await User.truncate();
await User.truncate({ cascade: true }); // With foreign keys
```

---

### Q22: What are the query operators in Sequelize?

**Answer:**

```javascript
const { Op } = require('sequelize');

// Comparison operators
await User.findAll({
  where: {
    age: {
      [Op.eq]: 25,           // = 25
      [Op.ne]: 25,           // != 25
      [Op.gt]: 25,           // > 25
      [Op.gte]: 25,          // >= 25
      [Op.lt]: 25,           // < 25
      [Op.lte]: 25,          // <= 25
    }
  }
});

// Range operators
await User.findAll({
  where: {
    age: {
      [Op.between]: [20, 30],      // BETWEEN 20 AND 30
      [Op.notBetween]: [20, 30],   // NOT BETWEEN 20 AND 30
    },
    status: {
      [Op.in]: ['active', 'pending'],     // IN ('active', 'pending')
      [Op.notIn]: ['deleted', 'banned'],  // NOT IN
    }
  }
});

// String operators
await User.findAll({
  where: {
    name: {
      [Op.like]: 'John%',         // LIKE 'John%'
      [Op.notLike]: '%admin%',    // NOT LIKE
      [Op.iLike]: '%john%',       // ILIKE (case-insensitive, PostgreSQL)
      [Op.startsWith]: 'John',    // LIKE 'John%'
      [Op.endsWith]: 'Doe',       // LIKE '%Doe'
      [Op.substring]: 'ohn',      // LIKE '%ohn%'
    },
    email: {
      [Op.regexp]: '^[a-z]+@',    // REGEXP (MySQL/PostgreSQL)
      [Op.notRegexp]: '^admin',   // NOT REGEXP
      [Op.iRegexp]: '^[a-z]+$',   // IREGEXP (case-insensitive)
    }
  }
});

// Logical operators
await User.findAll({
  where: {
    [Op.and]: [
      { status: 'active' },
      { role: 'admin' }
    ]
  }
});

await User.findAll({
  where: {
    [Op.or]: [
      { status: 'active' },
      { role: 'admin' }
    ]
  }
});

await User.findAll({
  where: {
    status: {
      [Op.not]: 'deleted'
    }
  }
});

// Null checks
await User.findAll({
  where: {
    deletedAt: {
      [Op.is]: null,          // IS NULL
      [Op.not]: null          // IS NOT NULL
    }
  }
});

// Complex combinations
await User.findAll({
  where: {
    [Op.or]: [
      {
        [Op.and]: [
          { status: 'active' },
          { age: { [Op.gte]: 18 } }
        ]
      },
      { role: 'admin' }
    ]
  }
});

// Array operators (PostgreSQL)
await User.findAll({
  where: {
    tags: {
      [Op.contains]: ['javascript'],    // @> ARRAY['javascript']
      [Op.contained]: ['js', 'node'],   // <@ ARRAY['js', 'node']
      [Op.overlap]: ['js', 'python'],   // && ARRAY['js', 'python']
    }
  }
});

// JSON operators (PostgreSQL/MySQL)
await User.findAll({
  where: {
    'settings.theme': 'dark',  // JSON path
    settings: {
      [Op.contains]: { theme: 'dark' }  // @> for JSONB
    }
  }
});

// Column comparison
const { col, literal } = require('sequelize');

await Product.findAll({
  where: {
    price: {
      [Op.lt]: col('comparePrice')  // price < comparePrice column
    }
  }
});

// Literal SQL
await User.findAll({
  where: literal('age > 18 AND status = "active"')
});
```

---

### Q23: How do you use transactions?

**Answer:**

```javascript
const { Transaction } = require('sequelize');

// Managed transaction (recommended)
try {
  const result = await sequelize.transaction(async (t) => {
    const user = await User.create({
      name: 'John',
      email: 'john@example.com'
    }, { transaction: t });

    await Profile.create({
      userId: user.id,
      bio: 'Developer'
    }, { transaction: t });

    await user.update({ status: 'active' }, { transaction: t });

    return user;
    // Transaction is automatically committed here
  });
  
  console.log('Transaction completed:', result);
} catch (error) {
  // Transaction is automatically rolled back here
  console.error('Transaction failed:', error);
}

// Unmanaged transaction
const t = await sequelize.transaction();

try {
  const user = await User.create({
    name: 'John'
  }, { transaction: t });

  await Profile.create({
    userId: user.id,
    bio: 'Developer'
  }, { transaction: t });

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}

// Transaction isolation levels
await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
}, async (t) => {
  // Operations
});

// Isolation levels:
// - READ_UNCOMMITTED
// - READ_COMMITTED (default for many DBs)
// - REPEATABLE_READ
// - SERIALIZABLE

// Transaction with locking
await sequelize.transaction(async (t) => {
  const user = await User.findByPk(1, {
    lock: t.LOCK.UPDATE, // FOR UPDATE
    transaction: t
  });
  
  await user.increment('balance', { by: 100, transaction: t });
});

// Lock types:
// - LOCK.UPDATE (FOR UPDATE)
// - LOCK.SHARE (FOR SHARE)
// - LOCK.KEY_SHARE (PostgreSQL)
// - LOCK.NO_KEY_UPDATE (PostgreSQL)

// Skip locked rows (PostgreSQL)
await User.findAll({
  lock: true,
  skipLocked: true,
  transaction: t
});

// Nested transactions (savepoints)
await sequelize.transaction(async (t1) => {
  await User.create({ name: 'User 1' }, { transaction: t1 });
  
  try {
    await sequelize.transaction({ transaction: t1 }, async (t2) => {
      await User.create({ name: 'User 2' }, { transaction: t2 });
      throw new Error('Rollback inner');
    });
  } catch (error) {
    // Only inner transaction (savepoint) is rolled back
  }
  
  // User 1 is still created
});

// CLS for automatic transaction passing
const cls = require('cls-hooked');
const namespace = cls.createNamespace('my-namespace');
Sequelize.useCLS(namespace);

// Now transactions are automatically passed
await sequelize.transaction(async () => {
  await User.create({ name: 'John' }); // No need to pass transaction
  await Profile.create({ userId: 1 }); // Transaction is automatic
});
```

---

### Q24: How do you perform aggregations and grouping?

**Answer:**

```javascript
const { fn, col, literal } = require('sequelize');

// Count all
const count = await User.count();

// Count with condition
const activeCount = await User.count({
  where: { status: 'active' }
});

// Count distinct
const uniqueEmails = await User.count({
  distinct: true,
  col: 'email'
});

// Sum
const totalRevenue = await Order.sum('amount');

// Sum with condition
const activeRevenue = await Order.sum('amount', {
  where: { status: 'completed' }
});

// Average
const avgAge = await User.aggregate('age', 'avg');

// Min/Max
const minPrice = await Product.min('price');
const maxPrice = await Product.max('price');

// Group by
const ordersByStatus = await Order.findAll({
  attributes: [
    'status',
    [fn('COUNT', col('id')), 'count'],
    [fn('SUM', col('amount')), 'total']
  ],
  group: ['status']
});

// Group by with having
const bigCategories = await Product.findAll({
  attributes: [
    'categoryId',
    [fn('COUNT', col('id')), 'productCount'],
    [fn('AVG', col('price')), 'avgPrice']
  ],
  group: ['categoryId'],
  having: literal('COUNT(id) > 10')
});

// Group by date
const ordersByMonth = await Order.findAll({
  attributes: [
    [fn('DATE_TRUNC', 'month', col('createdAt')), 'month'],
    [fn('COUNT', col('id')), 'orderCount'],
    [fn('SUM', col('amount')), 'revenue']
  ],
  group: [fn('DATE_TRUNC', 'month', col('createdAt'))],
  order: [[fn('DATE_TRUNC', 'month', col('createdAt')), 'DESC']]
});

// Multiple aggregations
const stats = await Order.findAll({
  attributes: [
    [fn('COUNT', col('id')), 'totalOrders'],
    [fn('SUM', col('amount')), 'totalRevenue'],
    [fn('AVG', col('amount')), 'avgOrderValue'],
    [fn('MIN', col('amount')), 'minOrder'],
    [fn('MAX', col('amount')), 'maxOrder']
  ],
  where: { status: 'completed' },
  raw: true
});

// Group by association
const postsByAuthor = await Post.findAll({
  attributes: [
    [fn('COUNT', col('Post.id')), 'postCount']
  ],
  include: [{
    model: User,
    as: 'author',
    attributes: ['name']
  }],
  group: ['author.id', 'author.name']
});

// Complex aggregation with subquery
const usersWithOrderCount = await User.findAll({
  attributes: {
    include: [
      [
        literal('(SELECT COUNT(*) FROM orders WHERE orders.userId = User.id)'),
        'orderCount'
      ]
    ]
  }
});
```

---

### Q25: How do you use findAndCountAll for pagination?

**Answer:**

```javascript
// Basic pagination
async function getUsers(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  
  const { count, rows } = await User.findAndCountAll({
    where: { status: 'active' },
    limit: pageSize,
    offset,
    order: [['createdAt', 'DESC']]
  });
  
  return {
    data: rows,
    meta: {
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
      hasNext: page * pageSize < count,
      hasPrev: page > 1
    }
  };
}

// With associations (handle count correctly)
async function getPostsWithAuthors(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  
  const { count, rows } = await Post.findAndCountAll({
    where: { status: 'published' },
    include: [{
      model: User,
      as: 'author',
      attributes: ['id', 'name']
    }],
    limit: pageSize,
    offset,
    order: [['createdAt', 'DESC']],
    distinct: true // Important for correct count with includes
  });
  
  return {
    data: rows,
    meta: {
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    }
  };
}

// Cursor-based pagination (more efficient for large datasets)
async function getCursorPaginated(cursor, limit = 10) {
  const where = cursor ? { id: { [Op.gt]: cursor } } : {};
  
  const items = await Post.findAll({
    where,
    limit: limit + 1, // Fetch one extra to check hasMore
    order: [['id', 'ASC']]
  });
  
  const hasMore = items.length > limit;
  if (hasMore) items.pop(); // Remove extra item
  
  return {
    data: items,
    meta: {
      hasMore,
      nextCursor: items.length > 0 ? items[items.length - 1].id : null
    }
  };
}

// Keyset pagination (best for large datasets)
async function getKeysetPaginated(lastCreatedAt, lastId, limit = 10) {
  let where = {};
  
  if (lastCreatedAt && lastId) {
    where = {
      [Op.or]: [
        { createdAt: { [Op.lt]: lastCreatedAt } },
        {
          createdAt: lastCreatedAt,
          id: { [Op.lt]: lastId }
        }
      ]
    };
  }
  
  const items = await Post.findAll({
    where,
    limit: limit + 1,
    order: [['createdAt', 'DESC'], ['id', 'DESC']]
  });
  
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  
  const lastItem = items[items.length - 1];
  
  return {
    data: items,
    meta: {
      hasMore,
      nextCursor: lastItem ? {
        createdAt: lastItem.createdAt,
        id: lastItem.id
      } : null
    }
  };
}

// Pagination helper class
class Paginator {
  constructor(model, options = {}) {
    this.model = model;
    this.defaultPageSize = options.pageSize || 10;
    this.maxPageSize = options.maxPageSize || 100;
  }

  async paginate(query = {}, { page = 1, pageSize } = {}) {
    pageSize = Math.min(pageSize || this.defaultPageSize, this.maxPageSize);
    const offset = (page - 1) * pageSize;

    const { count, rows } = await this.model.findAndCountAll({
      ...query,
      limit: pageSize,
      offset,
      distinct: true
    });

    return {
      data: rows,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
        hasNext: page * pageSize < count,
        hasPrev: page > 1
      }
    };
  }
}

// Usage
const userPaginator = new Paginator(User);
const result = await userPaginator.paginate(
  { where: { status: 'active' } },
  { page: 2, pageSize: 20 }
);
```

---

### Q26-Q30: [Additional Query Questions - Key Topics]

Key topics covered:
- **Q26**: Subqueries and nested queries
- **Q27**: Raw queries with models
- **Q28**: Query optimization techniques
- **Q29**: Full-text search
- **Q30**: Batch operations

---

## Associations & Relationships

### Q31: How do you implement One-to-One relationships?

**Answer:**

```javascript
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING
});

const Profile = sequelize.define('Profile', {
  bio: DataTypes.TEXT,
  avatar: DataTypes.STRING
});

// Define relationship
User.hasOne(Profile, {
  foreignKey: 'userId',
  as: 'profile',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Profile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Sync creates foreign key on Profile table
await sequelize.sync();

// Create user with profile
const user = await User.create({
  name: 'John',
  email: 'john@example.com',
  profile: {
    bio: 'Developer',
    avatar: 'avatar.jpg'
  }
}, {
  include: [{ model: Profile, as: 'profile' }]
});

// Create profile for existing user
const profile = await user.createProfile({
  bio: 'Developer',
  avatar: 'avatar.jpg'
});

// Get user with profile
const userWithProfile = await User.findByPk(1, {
  include: [{ model: Profile, as: 'profile' }]
});

// Get profile with user
const profileWithUser = await Profile.findByPk(1, {
  include: [{ model: User, as: 'user' }]
});

// Update profile through user
await user.profile.update({ bio: 'Senior Developer' });

// Replace profile
await user.setProfile(newProfile);

// Remove profile
await user.setProfile(null);
```

---

### Q32: How do you implement One-to-Many relationships?

**Answer:**

```javascript
const User = sequelize.define('User', {
  name: DataTypes.STRING
});

const Post = sequelize.define('Post', {
  title: DataTypes.STRING,
  content: DataTypes.TEXT
});

// Define relationship
User.hasMany(Post, {
  foreignKey: 'authorId',
  as: 'posts',
  onDelete: 'SET NULL'
});

Post.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author'
});

// Create user with posts
const user = await User.create({
  name: 'John',
  posts: [
    { title: 'First Post', content: 'Content 1' },
    { title: 'Second Post', content: 'Content 2' }
  ]
}, {
  include: [{ model: Post, as: 'posts' }]
});

// Create posts for existing user
const post = await user.createPost({
  title: 'New Post',
  content: 'New content'
});

// Get user's posts
const posts = await user.getPosts();

// Get posts with conditions
const recentPosts = await user.getPosts({
  where: { createdAt: { [Op.gte]: lastWeek } },
  order: [['createdAt', 'DESC']],
  limit: 5
});

// Add existing posts
await user.addPost(existingPost);
await user.addPosts([post1, post2]);

// Remove posts
await user.removePost(postToRemove);
await user.removePosts([post1, post2]);

// Set (replace all)
await user.setPosts([newPost1, newPost2]);

// Count
const postCount = await user.countPosts();

// Check association
const hasPost = await user.hasPost(postId);

// Query posts with author
const allPosts = await Post.findAll({
  include: [{
    model: User,
    as: 'author',
    attributes: ['id', 'name']
  }]
});
```

---

### Q33: How do you implement Many-to-Many relationships?

**Answer:**

```javascript
const Post = sequelize.define('Post', {
  title: DataTypes.STRING,
  content: DataTypes.TEXT
});

const Tag = sequelize.define('Tag', {
  name: DataTypes.STRING
});

// Simple many-to-many (auto-generated join table)
Post.belongsToMany(Tag, {
  through: 'PostTags',
  as: 'tags',
  foreignKey: 'postId'
});

Tag.belongsToMany(Post, {
  through: 'PostTags',
  as: 'posts',
  foreignKey: 'tagId'
});

// Many-to-many with custom join table
const PostTag = sequelize.define('PostTag', {
  // Additional fields on the join table
  addedBy: DataTypes.INTEGER,
  addedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  order: DataTypes.INTEGER
});

Post.belongsToMany(Tag, {
  through: PostTag,
  as: 'tags',
  foreignKey: 'postId',
  otherKey: 'tagId'
});

Tag.belongsToMany(Post, {
  through: PostTag,
  as: 'posts',
  foreignKey: 'tagId',
  otherKey: 'postId'
});

// Create with associations
const post = await Post.create({
  title: 'New Post',
  content: 'Content',
  tags: [
    { name: 'JavaScript' },
    { name: 'Node.js' }
  ]
}, {
  include: [{ model: Tag, as: 'tags' }]
});

// Add existing tags
await post.addTag(tagId);
await post.addTags([tag1, tag2]);

// Add with join table data
await post.addTag(tagId, {
  through: {
    addedBy: userId,
    order: 1
  }
});

// Get tags with join table data
const tags = await post.getTags({
  through: { attributes: ['addedAt', 'order'] },
  order: [[PostTag, 'order', 'ASC']]
});

// Remove tags
await post.removeTag(tagId);
await post.removeTags([tag1, tag2]);

// Set (replace all)
await post.setTags([tag1, tag2]);

// Query with join table conditions
const posts = await Post.findAll({
  include: [{
    model: Tag,
    as: 'tags',
    through: {
      where: { addedBy: userId }
    }
  }]
});

// Find posts with specific tags
const postsWithTag = await Post.findAll({
  include: [{
    model: Tag,
    as: 'tags',
    where: { name: 'JavaScript' }
  }]
});
```

---

### Q34: How do you implement self-referencing associations?

**Answer:**

```javascript
// Hierarchical categories (parent-child)
const Category = sequelize.define('Category', {
  name: DataTypes.STRING,
  slug: DataTypes.STRING
});

Category.belongsTo(Category, {
  as: 'parent',
  foreignKey: 'parentId'
});

Category.hasMany(Category, {
  as: 'children',
  foreignKey: 'parentId'
});

// Create hierarchy
const electronics = await Category.create({ name: 'Electronics' });
const computers = await electronics.createChild({ name: 'Computers' });
const laptops = await computers.createChild({ name: 'Laptops' });

// Get with children
const category = await Category.findByPk(1, {
  include: [{
    model: Category,
    as: 'children',
    include: [{
      model: Category,
      as: 'children' // Nested children
    }]
  }]
});

// Get with parent chain
const category = await Category.findByPk(3, {
  include: [{
    model: Category,
    as: 'parent',
    include: [{
      model: Category,
      as: 'parent'
    }]
  }]
});

// User following users (many-to-many self-reference)
const User = sequelize.define('User', {
  name: DataTypes.STRING
});

const Follow = sequelize.define('Follow', {
  followedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

User.belongsToMany(User, {
  through: Follow,
  as: 'following',
  foreignKey: 'followerId',
  otherKey: 'followingId'
});

User.belongsToMany(User, {
  through: Follow,
  as: 'followers',
  foreignKey: 'followingId',
  otherKey: 'followerId'
});

// Follow a user
await user1.addFollowing(user2);

// Get users I'm following
const following = await user1.getFollowing();

// Get my followers
const followers = await user1.getFollowers();

// Check if following
const isFollowing = await user1.hasFollowing(user2);

// Get followers count
const followerCount = await user1.countFollowers();

// Get with follow date
const followers = await user1.getFollowers({
  through: { attributes: ['followedAt'] }
});

// Employee-Manager relationship
const Employee = sequelize.define('Employee', {
  name: DataTypes.STRING,
  title: DataTypes.STRING
});

Employee.belongsTo(Employee, {
  as: 'manager',
  foreignKey: 'managerId'
});

Employee.hasMany(Employee, {
  as: 'directReports',
  foreignKey: 'managerId'
});

// Get org chart
const manager = await Employee.findByPk(1, {
  include: [{
    model: Employee,
    as: 'directReports',
    include: [{
      model: Employee,
      as: 'directReports'
    }]
  }]
});
```

---

### Q35-Q40: [Additional Association Questions - Key Topics]

Key topics covered:
- **Q35**: Polymorphic associations
- **Q36**: Association aliases and multiple associations
- **Q37**: Eager loading strategies
- **Q38**: Lazy loading associations
- **Q39**: Association scopes
- **Q40**: Complex join queries

---

## Advanced Topics

### Q41: How do you handle connection pooling?

**Answer:**

```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('database', 'user', 'password', {
  host: 'localhost',
  dialect: 'postgres',
  
  // Pool configuration
  pool: {
    max: 20,           // Maximum connections in pool
    min: 5,            // Minimum connections maintained
    acquire: 30000,    // Max time (ms) to acquire connection
    idle: 10000,       // Max time (ms) connection can be idle
    evict: 1000        // Run eviction check every N ms
  },
  
  // Logging pool events
  logging: (sql, timing) => {
    console.log(`[${timing}ms] ${sql}`);
  }
});

// Monitor pool with events
sequelize.connectionManager.pool.on('acquire', (connection) => {
  console.log('Connection acquired');
});

sequelize.connectionManager.pool.on('release', (connection) => {
  console.log('Connection released');
});

// Get pool statistics (with generic-pool)
function getPoolStats() {
  const pool = sequelize.connectionManager.pool;
  return {
    size: pool.size,
    available: pool.available,
    pending: pool.pending,
    max: pool.max,
    min: pool.min
  };
}

// Retry logic for connection failures
const sequelize = new Sequelize(database, user, password, {
  host: 'localhost',
  dialect: 'postgres',
  retry: {
    max: 3,           // Retry connection 3 times
    timeout: 5000     // Wait 5 seconds between retries
  }
});

// Multiple database connections
const readSequelize = new Sequelize(database, user, password, {
  host: 'read-replica',
  dialect: 'postgres',
  pool: { max: 30 }
});

const writeSequelize = new Sequelize(database, user, password, {
  host: 'primary',
  dialect: 'postgres',
  pool: { max: 10 }
});

// Replication support (built-in)
const sequelize = new Sequelize(database, null, null, {
  dialect: 'postgres',
  replication: {
    read: [
      { host: 'read-1', username: 'user', password: 'pass' },
      { host: 'read-2', username: 'user', password: 'pass' }
    ],
    write: {
      host: 'write', username: 'user', password: 'pass'
    }
  },
  pool: {
    max: 20,
    idle: 30000
  }
});

// Specify read/write for specific queries
const user = await User.findByPk(1, {
  useMaster: true // Force use of write connection
});

// Health check
async function checkDatabaseHealth() {
  try {
    await sequelize.authenticate();
    const stats = getPoolStats();
    
    return {
      status: 'healthy',
      pool: stats,
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}
```

---

### Q42: How do you optimize Sequelize queries?

**Answer:**

```javascript
// 1. Use raw: true for read-only queries
const users = await User.findAll({
  where: { status: 'active' },
  raw: true // Returns plain objects, faster
});

// 2. Select only needed attributes
const users = await User.findAll({
  attributes: ['id', 'name', 'email'],
  where: { status: 'active' }
});

// 3. Use indexes
User.init({
  email: {
    type: DataTypes.STRING,
    unique: true // Creates unique index
  },
  status: DataTypes.STRING
}, {
  indexes: [
    { fields: ['status'] },
    { fields: ['status', 'createdAt'] }
  ]
});

// 4. Avoid N+1 queries - use eager loading
// Bad: N+1 queries
const users = await User.findAll();
for (const user of users) {
  const posts = await user.getPosts(); // N additional queries
}

// Good: Single query with include
const users = await User.findAll({
  include: [{ model: Post, as: 'posts' }]
});

// 5. Use separate for large associations
const users = await User.findAll({
  include: [{
    model: Post,
    as: 'posts',
    separate: true, // Separate query, better for large datasets
    limit: 5
  }]
});

// 6. Batch operations
// Bad: Individual inserts
for (const data of dataArray) {
  await Model.create(data);
}

// Good: Bulk insert
await Model.bulkCreate(dataArray, {
  ignoreDuplicates: true
});

// 7. Use transactions wisely
await sequelize.transaction(async (t) => {
  // Multiple operations share connection
  await User.create(userData, { transaction: t });
  await Profile.create(profileData, { transaction: t });
});

// 8. Pagination with cursor instead of offset
// Bad for large offsets
const page10 = await Post.findAll({
  offset: 9000, // Slow - scans 9000 rows
  limit: 10
});

// Good: Cursor-based
const page = await Post.findAll({
  where: { id: { [Op.gt]: lastSeenId } },
  limit: 10
});

// 9. Use subqueries for complex filters
const usersWithManyPosts = await User.findAll({
  where: {
    id: {
      [Op.in]: literal(
        '(SELECT authorId FROM Posts GROUP BY authorId HAVING COUNT(*) > 10)'
      )
    }
  }
});

// 10. Monitor slow queries
const sequelize = new Sequelize(database, user, password, {
  benchmark: true,
  logging: (sql, timing) => {
    if (timing > 1000) {
      console.warn(`Slow query (${timing}ms):`, sql);
    }
  }
});
```

---

### Q43: How do you handle database locking?

**Answer:**

```javascript
const { Transaction } = require('sequelize');

// Row-level locking with transactions
await sequelize.transaction(async (t) => {
  // Lock rows for update
  const account = await Account.findByPk(1, {
    lock: t.LOCK.UPDATE, // FOR UPDATE
    transaction: t
  });
  
  if (account.balance >= 100) {
    await account.update(
      { balance: account.balance - 100 },
      { transaction: t }
    );
  }
});

// Lock types
const lockTypes = {
  UPDATE: 'FOR UPDATE',         // Exclusive lock, blocks other updates
  SHARE: 'FOR SHARE',           // Shared lock, allows reads
  KEY_SHARE: 'FOR KEY SHARE',   // PostgreSQL: less restrictive
  NO_KEY_UPDATE: 'FOR NO KEY UPDATE' // PostgreSQL: less restrictive
};

// Skip locked rows (useful for job queues)
const nextJob = await Job.findOne({
  where: { status: 'pending' },
  order: [['createdAt', 'ASC']],
  lock: true,
  skipLocked: true, // Skip rows locked by other transactions
  transaction: t
});

// Optimistic locking with version column
const Product = sequelize.define('Product', {
  name: DataTypes.STRING,
  price: DataTypes.DECIMAL
}, {
  version: true // Adds 'version' column
});

// Optimistic lock check happens automatically
try {
  const product = await Product.findByPk(1);
  product.price = 99.99;
  await product.save(); // Checks version, throws if changed
} catch (error) {
  if (error instanceof Sequelize.OptimisticLockError) {
    console.log('Record was modified by another transaction');
  }
}

// Custom optimistic locking
const Order = sequelize.define('Order', {
  status: DataTypes.STRING,
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

async function updateOrderStatus(orderId, newStatus, expectedVersion) {
  const [affectedRows] = await Order.update(
    { 
      status: newStatus,
      version: expectedVersion + 1
    },
    {
      where: {
        id: orderId,
        version: expectedVersion
      }
    }
  );
  
  if (affectedRows === 0) {
    throw new Error('Concurrent modification detected');
  }
}

// Advisory locks (PostgreSQL)
await sequelize.query(
  'SELECT pg_advisory_lock($1)',
  { bind: [lockId] }
);

try {
  // Critical section
  await performCriticalOperation();
} finally {
  await sequelize.query(
    'SELECT pg_advisory_unlock($1)',
    { bind: [lockId] }
  );
}
```

---

### Q44: How do you implement data seeding?

**Answer:**

```bash
# Generate seed file
npx sequelize-cli seed:generate --name demo-users
```

```javascript
// seeders/20240101-demo-users.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Users', [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', null, {});
  }
};

// seeders/20240102-demo-posts.js
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get user IDs first
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM "Users" WHERE role = ?',
      { replacements: ['user'], type: Sequelize.QueryTypes.SELECT }
    );
    
    const posts = users.map(user => ({
      title: `Post by User ${user.id}`,
      content: 'Lorem ipsum...',
      authorId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await queryInterface.bulkInsert('Posts', posts);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Posts', null, {});
  }
};

// seeders/20240103-categories.js (with hierarchy)
module.exports = {
  async up(queryInterface, Sequelize) {
    const categories = [
      { id: 1, name: 'Electronics', parentId: null },
      { id: 2, name: 'Computers', parentId: 1 },
      { id: 3, name: 'Laptops', parentId: 2 },
      { id: 4, name: 'Desktops', parentId: 2 },
      { id: 5, name: 'Phones', parentId: 1 }
    ].map(cat => ({
      ...cat,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await queryInterface.bulkInsert('Categories', categories);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Categories', null, {});
  }
};

// Using faker for realistic data
const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface) {
    const users = [];
    
    for (let i = 0; i < 100; i++) {
      users.push({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
        bio: faker.lorem.paragraph(),
        createdAt: faker.date.past(),
        updatedAt: new Date()
      });
    }
    
    await queryInterface.bulkInsert('Users', users);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Users', null, {});
  }
};
```

```bash
# Run seeders
npx sequelize-cli db:seed:all
npx sequelize-cli db:seed --seed 20240101-demo-users
npx sequelize-cli db:seed:undo:all
npx sequelize-cli db:seed:undo --seed 20240101-demo-users
```

---

### Q45: How do you implement multi-tenancy?

**Answer:**

```javascript
// Strategy 1: Shared database with tenant column
const BaseModel = sequelize.define('BaseModel', {
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  abstract: true
});

const User = sequelize.define('User', {
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    index: true
  },
  name: DataTypes.STRING,
  email: DataTypes.STRING
});

// Middleware to inject tenantId
function tenantMiddleware(req, res, next) {
  req.tenantId = req.headers['x-tenant-id'];
  next();
}

// Scope for automatic filtering
User.addScope('tenant', (tenantId) => ({
  where: { tenantId }
}));

// Usage
const users = await User.scope({ method: ['tenant', req.tenantId] }).findAll();

// Hook to auto-add tenantId
User.beforeCreate((user, options) => {
  if (options.tenantId) {
    user.tenantId = options.tenantId;
  }
});


// Strategy 2: Schema per tenant (PostgreSQL)
async function createTenantSchema(tenantId) {
  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS tenant_${tenantId}`);
}

function getTenantSequelize(tenantId) {
  return new Sequelize(database, user, password, {
    dialect: 'postgres',
    schema: `tenant_${tenantId}`
  });
}


// Strategy 3: Database per tenant
const tenantConnections = new Map();

async function getTenantConnection(tenantId) {
  if (tenantConnections.has(tenantId)) {
    return tenantConnections.get(tenantId);
  }
  
  const tenant = await Tenant.findByPk(tenantId);
  const connection = new Sequelize(
    tenant.databaseName,
    tenant.dbUser,
    tenant.dbPassword,
    { host: tenant.dbHost, dialect: 'postgres' }
  );
  
  tenantConnections.set(tenantId, connection);
  return connection;
}


// Multi-tenant Repository pattern
class TenantRepository {
  constructor(model, tenantId) {
    this.model = model;
    this.tenantId = tenantId;
  }

  findAll(options = {}) {
    return this.model.findAll({
      ...options,
      where: {
        ...options.where,
        tenantId: this.tenantId
      }
    });
  }

  create(data) {
    return this.model.create({
      ...data,
      tenantId: this.tenantId
    });
  }

  update(id, data) {
    return this.model.update(data, {
      where: { id, tenantId: this.tenantId }
    });
  }

  delete(id) {
    return this.model.destroy({
      where: { id, tenantId: this.tenantId }
    });
  }
}

// Usage
const userRepo = new TenantRepository(User, req.tenantId);
const users = await userRepo.findAll();
await userRepo.create({ name: 'John', email: 'john@example.com' });
```

---

### Q46-Q50: [Additional Advanced Questions - Key Topics]

Key topics covered:
- **Q46**: Read replicas and write splitting
- **Q47**: Query performance monitoring
- **Q48**: Testing with Sequelize
- **Q49**: TypeScript integration
- **Q50**: Troubleshooting common issues

---

## Summary

This guide covers Sequelize ORM concepts:

1. **Basics**: Connections, sync, data types, models
2. **Models & Schemas**: Validation, hooks, getters/setters
3. **Queries**: CRUD, operators, transactions, aggregations
4. **Associations**: One-to-one, one-to-many, many-to-many
5. **Advanced**: Pooling, optimization, locking, multi-tenancy

**Key Takeaways:**
- Use migrations instead of sync() in production
- Implement proper validation at the model level
- Use transactions for data integrity
- Optimize queries with proper indexing and eager loading
- Handle associations properly to avoid N+1 queries
- Use scopes for reusable query patterns
- Implement connection pooling for scalability
