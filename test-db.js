const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://postgres:CfUuiaRgcFtzjlUruQbAUcvBTQbRehgq@ballast.proxy.rlwy.net:42670/railway"
});
client.connect()
  .then(() => {
    console.log('SUCCESS: Connected to database');
    return client.query('SELECT current_database(), now()');
  })
  .then(res => {
    console.log('QUERY RESULT:', res.rows[0]);
    process.exit(0);
  })
  .catch(err => {
    console.error('ERROR: Could not connect', err);
    process.exit(1);
  });
