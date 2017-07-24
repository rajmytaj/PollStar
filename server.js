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

//Generates random string for pollid code for poll info table
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
  if (req.body.email === "") {
    // res.send("Please enter email first")
    res.redirect('/');
  } else {
    knex('poll_info').insert({name: req.body.name, email: req.body.email, pollid: pollId}, 'id')
    .then((results)=>{
      const foreignkey = results[0]
      for(let choice of req.body.choice){
      insertchoice(choice, foreignkey);
      }
    })
    .catch((error) => {
    res.send(error);
  })
  }
  //Sendgrid API template: sends voting and result link to the creator
  const helper = require('sendgrid').mail;
  const fromEmail = new helper.Email("links@pollstar.com");
  const toEmail = new helper.Email(`${req.body.email}`);
  const subject = "Here is your poll information";
  const content = new helper.Content("text/plain", `Voting link: http://localhost:8080/voting/${pollId} Results link:  http://localhost:8080/results/${pollId}`);
  const mail = new helper.Mail(fromEmail, subject, toEmail, content);

  const sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
  console.log("APIIIII", process.env.SENDGRID_API_KEY)
  const request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON()
  });
  sg.API(request, function (error, response) {
    if (error) {
      console.log("Error response received", error);
    }
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
  });
  res.redirect(`/summary/${pollId}`)
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
      res.render("summary", {
        userPollKey: userPollId,
        name: results[0].name,
        email: results[0].email
      })
  })
});
//Voting Page
app.get("/voting/:pollId", (req, res) => {
  return knex.select('*').from('poll_info')
  .join('poll_result', 'poll_info.id', '=', 'poll_result.poll_info_id')
  .where('pollid', req.params.pollId)
  .then((results) => {
    console.log(results)
    if (results.length > 0) {
      res.render("voting", {
        name: results[0].name,
        results: results
      });
    } else {
      res.redirect('/');
    }
    console.log(results)
  })
  .catch((error) => {
    res.send(error);
  })
})

app.post("/results", (req, res) => {
  var result4 = req.body.result4;
  var result3 = req.body.result3;
  var result2 = req.body.result2;
  var result1 = req.body.result1;
  //Update the values in the database.
  knex.select('weight').from('poll_result')
  .where('id','=',result4)
  .then((result)=>{
    knex("poll_result").where("id",result4)
    .update({weight: (result[0].weight+4)})
    .then(function (count) {
    })
  });
  knex.select('weight').from('poll_result')
  .where('id','=',result3)
  .then((result)=>{
    knex("poll_result").where("id",result3)
    .update({weight: (result[0].weight+3)})
    .then(function (count) {
    })
  });

  knex.select('weight').from('poll_result')
  .where('id','=',result2)
  .then((result)=>{

    knex("poll_result").where("id",result2)
    .update({weight: (result[0].weight+2)})
    .then(function (count) {
    })
  });

  knex.select('weight').from('poll_result')
  .where('id','=',result1)
  .then((result)=>{

    knex("poll_result").where("id",result1)
    .update({weight: (result[0].weight+1)})
    .then(function (count) {
    })
  });
  //Sends email to the creator when a user submits a vote
  knex("poll_info")
  .select("email")
  .where("pollid", "=", `${req.params.pollId}`)
  .then((results) => {
  const helper = require('sendgrid').mail;
  const fromEmail = new helper.Email("links@pollstar.com");
  //need to get email from the data base
  const toEmail = new helper.Email(results[0].email);
  const subject = "Someone Voted!";
  const content = new helper.Content("text/plain", `Someone just voted on your poll, Check it out here:  http://localhost:8080/results/${pollId}`);
  const mail = new helper.Mail(fromEmail, subject, toEmail, content);

  const sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
  const request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON()
  });
  sg.API(request, function (error, response) {
    if (error) {
      console.log("Error response received", error);
    }
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
    })
  })
  res.redirect('/')

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

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
