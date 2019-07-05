var async         = require("async");
var express       = require('express');
var app           = express();
var bodyParser    = require('body-parser');
var port          = 3500;
var moment      = require('moment');

let redis     = require('redis');
let client    = redis.createClient({
    port      : 13951,               // replace with your port
    host      : 'redis-13951.c124.us-central1-1.gce.cloud.redislabs.com',        // replace with your hostanme or IP address
    password  : '3MKL2BnhKoU9ZFUPRgfyNjViLxmR90aK'
    });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.listen(port);
console.log('Redis API started at: http://localhost:' + port);

app.all('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

client.on('connect', function() {
  console.log('Redis client connected');
});

app.get('/', function(req, res) {
  console.log("Redis API working in localhost:3500");
  res.send({success: true, message: "Redis API working in localhost:3500"})
});

app.get('/reviews/:ids', function(req, res) {
  var json = [];
  var reviewIds = req.params.ids.split(',');

  async.forEachOf(reviewIds, (value, key, callback) => {
    client.hgetall('reviews:' + value, function(err, reply) {
      if (err) return callback(err);
      try {
        console.log("Get review " + key);
        json.push(reply);

        if(key == reviewIds.length - 1)
          res.send(json);

      } catch (e) {
          return callback(e);
      }
      callback();
    });
    }, err => {
        if (err) console.error(err.message);
    });
});

app.get('/review/like/:id', function(req, res) {
  var key = 'reviews:' + req.params.id;

  client.hincrby(key, 'likes', 1, function(err, likes) {
    if (err) return console.log(err);
    console.log("Incremented " + key + " field -> likes by one");

    res.send({likes});
  });
});

app.get('/reviewx', function(req, res) {
  client.hgetall('reviewx', function(err, reply) {
    if (err) return console.log(err);

    console.log(reply);

    if(!reply) res.send({success: false, message: "Key does not exist."})
    else res.send({success: true, draft: reply});
  });
});

app.post('/review', function(req, res) {
  var user = req.body.usuario;
  var text = req.body.texto;

  client.get('reviewsIds', function(err, result) {
    if (err) console.log(err)
    else {
      var fecha = moment().format("DD/MM/YYYY HH:mm:ss");
      var key = 'reviews:' + (parseInt(result) + 1);
      var values = [];
      values.push("usuario")
      values.push(user);
      values.push("fecha");
      values.push(fecha);
      values.push("likes");
      values.push(0);
      values.push("texto");
      values.push(text);
      values.push("visitas");
      values.push(0);

      console.log("Se insertara el siguiente hash: " + key);
      console.log(values);

      client.hmset(key, values, function (err, reply) {
        if(err) console.log(err)

        console.log(reply);

        client.incr('reviewsIds', function(err, reply) {
          if(err) console.log(err);

          var json = {usuario: user, fecha: fecha, likes: 0, texto: text, visitas: 0};

          console.log(json);
          res.send({id: reply, review: json});
        });
      });
    }
  });
});

app.post('/reviewx', function(req, res) {
  var user = req.body.usuario;
  var text = req.body.texto;

  var values = [];
  values.push("usuario")
  values.push(user);
  values.push("texto");
  values.push(text);

  client.exists('reviewx', function(err, reply) {
    if(err) console.log(err);

    if(reply == 0) {
      console.log("Called reviewx, key does not exist");
      client.hmset('reviewx', values, function (err, reply) {
        if(err) console.log(err)

        console.log(reply);

        client.expire('reviewx', 20);
        res.send({success: true, result: reply});
      });
    }
    else{
      console.log("Called reviewx, key exists");
      res.send({message: "Key not expired yet"});
    }
  });
});
