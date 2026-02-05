import express from 'express';
import accountRoutes from './routes/accounts';
import transactionRoutes from './routes/transactions';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// BUG #27: No HTTPS enforcement for financial data
// BUG #28: No rate limiting
// BUG #29: No request logging/audit trail
// BUG #30: No global error handler

app.listen(PORT, () => {
  console.log(`Banking API running on port ${PORT}`);
});

export default app;
