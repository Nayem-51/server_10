const express = require('express')
const app = express()
const port =Process.env.PORT || 3000

app.get('/', (req, res) => {
  res.send('SERVERIS RUNNING ');
})

app.listen(port, () => {
  console.log(`app listening on port ${port}`)
})
