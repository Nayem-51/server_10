const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 3000;
app.get('/',(req,res)=>{
    res.send('hello world')

})
const users=[
    {id :1 ,name :'Nayem',email :'a@gmail.com'},
     {id :2 ,name :'bayem',email :'b@gmail.com'},
     {id :3 ,name :'cayem',email :'c@gmail.com'},
     
]
app.use(cors());
app.get('/users',(req,res)=>{
    res.send(users);
})
app.listen(port,()=>{
    console.log(`server is running : ${port}`)
})