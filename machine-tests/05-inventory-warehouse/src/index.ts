import express from 'express';
import inventoryRoutes from './routes/inventory';
import warehouseRoutes from './routes/warehouses';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

app.use('/api/inventory', inventoryRoutes);
app.use('/api/warehouses', warehouseRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Inventory API running on port ${PORT}`);
});

export default app;
