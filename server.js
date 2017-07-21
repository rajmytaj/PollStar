"use strict";

require('dotenv').config();

const PORT        = process.env.PORT || 8080;
const ENV         = process.env.ENV || "development";
const express     = require("express");
const bodyParser  = require("body-parser");
const sass        = require("node-sass-middleware");
const app         = express();

const knexConfig  = require("./knexfile");
const knex        = require("knex")(knexConfig[ENV]);
const morgan      = require('morgan');
const knexLogger  = require('knex-logger');

// Seperated Routes for each Resource
const usersRoutes = require("./routes/test_result");

function generateRandomString() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 6; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan('dev'));

// Log knex SQL queries to STDOUT as well
app.use(knexLogger(knex));

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", sass({
  src: __dirname + "/styles",
  dest: __dirname + "/public/styles",
  debug: true,
  outputStyle: 'expanded'
}));
app.use(express.static("public"));

// Mount all resource routes
app.use("/api/test_result", usersRoutes(knex));

// Home page
app.get("/", (req, res) => {
  res.render("index");
});

function insertchoice(choice, foreignkey){
  return knex('poll_result').insert({choice: choice, poll_info_id: foreignkey, weight: 0}, 'id')
  .then((results)=>{
  })
}
app.post("/summary", (req, res) => {
  const pollId = generateRandomString();
  knex('poll_info').insert({name: req.body.name, email: req.body.email, pollid: pollId}, 'id')
  .then((results)=>{
    const foreignkey = results[0]
    for(let choice of req.body.choice){
      insertchoice(choice, foreignkey);
    }
  res.redirect(`/summary/${pollId}`)
  })
    .catch((error) => {
    res.send(error);
  })

})

// Summary Page
app.get("/summary/:pollId", (req, res) => {
  const userPollId = req.params.pollId;
  if (userPollId === undefined) {
    res.status(400).redirect("/")
    return
  }
  knex.select('poll_info.id', 'name', 'email', 'pollid')
    .from('poll_info')
    .where('poll_info.pollid', userPollId)
    .then((results) => {
      console.log("hehe", results)
      console.log('label', results)
      res.render("summary", {
        userPollKey: userPollId,
        name: results[0].name,
        email: results[0].email
      })
      // res.render(`/summary/${userPollId}`)
    })

});

// Voting page
app.get("/voting/:pollId", (req, res) => {
  let userPollId = req.params.pollId;
  if (userPollId === undefined) {
    res.status(400).redirect("/")
    return
  }
    res.render("voting", {
    })
  }
});

app.post("/results/:pollId", (req, res) => {
  //push form into DB here
  res.send("haha results page not done yet")
})

// Result page
app.get("/results/:pollId", (req, res) => {
  return knex.select('poll_info.id', 'name', 'choice', 'weight')
  .from('poll_result')
  .join('poll_info', 'poll_result.poll_info_id', '=', 'poll_info.id')
  .where('poll_info.pollid', req.params.pollId)
  .orderBy('weight', 'desc')
  .then((results) => {
    console.log(results)
    if (results.length > 0) {
      res.render("results", {
        name: results[0].name,
        results: results
      });
    } else {
      res.redirect('/');
    }
  })
  .catch((error) => {
    res.send("OH NO");
  })
})



// app.get('/poll_info', (req, res) => {
//   res.json({
//     id: 1,
//     email: 'joel@joel.joel',
//     name: 'joel'
//   })
// })

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
