require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const searchRoutes = require('./routes/search');
const { ensureIndex } = require('./lib/elastic');
const { startConsumers } = require('./lib/events');

const app = express();
const PORT = process.env.PORT || 3013;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'search-service' }));
app.use('/search', searchRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

ensureIndex()
  .then(() => {
    startConsumers().catch((err) => console.error('Search consumer failed:', err.message));
    app.listen(PORT, () => console.log(`Search Service running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Elasticsearch startup error:', err);
    process.exit(1);
  });
