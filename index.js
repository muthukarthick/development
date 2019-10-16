const express = require("express");
const app = express();

app.get('/', (req, res) => {
    res.send("Welcome Web Scrap");
});

app.listen(8081, () => {
    console.log("Server Running http://localhost:8081/");
});