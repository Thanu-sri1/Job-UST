const express = require('express');
const { client, index } = require('../lib/elastic');

const router = express.Router();

router.get('/tasks', async (req, res, next) => {
  try {
    const filters = [{ term: { userId: req.headers['x-user-id'] } }];
    if (req.query.status) filters.push({ term: { status: req.query.status } });
    if (req.query.from || req.query.to) {
      filters.push({ range: { dueDate: { gte: req.query.from, lte: req.query.to } } });
    }

    const q = req.query.q || '';
    const result = await client.search({
      index,
      query: {
        bool: {
          filter: filters,
          must: q ? [{ multi_match: { query: q, fields: ['title^2', 'description', 'tags'] } }] : [{ match_all: {} }],
        },
      },
      sort: [{ updatedAt: 'desc' }],
      size: Number(req.query.limit || 25),
    });

    res.json({ results: result.hits.hits.map((hit) => ({ id: hit._id, score: hit._score, ...hit._source })) });
  } catch (err) {
    next(err);
  }
});

router.get('/suggestions', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ suggestions: [] });
    const result = await client.search({
      index,
      query: {
        bool: {
          filter: [{ term: { userId: req.headers['x-user-id'] } }],
          must: [{ match_phrase_prefix: { title: q } }],
        },
      },
      size: 10,
    });
    res.json({ suggestions: result.hits.hits.map((hit) => hit._source.title) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
