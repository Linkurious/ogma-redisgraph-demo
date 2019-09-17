# Simple RedisGraph nodejs http client

* **`/api/query/?graph=<graph>&query=<cyper_query>`**

Pass cypher queries here.

Response:
```
{
  data: [{}], // items
  time: <execution_time>
}
```

Serves static files from `../static` dir
