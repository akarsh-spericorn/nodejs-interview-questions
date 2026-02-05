import express from 'express';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// BUG #17: No global error handler - unhandled errors crash the server
// BUG #18: No request logging

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
