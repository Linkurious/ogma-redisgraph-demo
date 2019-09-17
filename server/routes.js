const RedisGraphAPI = require('redisgraph.js');
const redis = require('redis');

const PORT = 9736;
const HOST = '34.217.1.25';

const client = redis.createClient(PORT, HOST);
client.auth('redisconf');
client.on('error', function (err) {
  console.error('Redis error:', err);
});



function toJSON (result) {
  const data = [];
  while (result.hasNext()) {
    const rec = result.next();
    const keys = rec.keys();
    const values = rec.values();
    data.push.apply(data, values);
  }
  return { data, time: result.getStatistics().queryExecutionTime() };
}

const ftime = (ms) => (ms).toFixed(3);

module.exports = (app) => {
  app.get('/api/query/', (req, res) => {
    const query = req.query;
    const graph = new RedisGraphAPI.RedisGraph(query.graph, client);
    process.stdout.write(`${query.query}...`);
    const t = Date.now();
    return graph.query(query.query)
      .then((result) => {
        const duration = result.getStatistics().queryExecutionTime();
        process.stdout.write(`done in ${duration}, roundtrip ${ftime(Date.now() - t)}\n`);
        return res.send(toJSON(result));
      })
      .catch(err => {
        process.stdout.write('error\n');
        console.log(err);
        res.status(500);
        res.send({ error: err, message: err.message });
      });
  });
}
