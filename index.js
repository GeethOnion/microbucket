if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// IMPORTANT: I'm like 90% sure this can be made in a better, more efficient and secure way. Please send me feedback

const express = require("express");
const path = require("path");
let cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const bucketSession = uuidv4();

let bucket = {};

// Express app
const app = express();

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Socket IO
const http = require("http").Server(app);
const io = require("socket.io")(http);

io.on("connection", async (socket) => {
  // probably insecure
  const bucketId = await socket.handshake.headers.referer.split("/").pop();

  if (bucket[bucketId] != undefined) {
    bucket[bucketId] += 1;
  }

  io.emit(`count-${bucketId}`, bucket[bucketId]);

  socket.broadcast.emit(`autoupdate-${bucketId}`, true);

  socket.on("update", (obj) => {
    socket.broadcast.emit(obj.id, obj);
    console.log(obj.data);
  });

  socket.on("disconnect", () => {
    bucket[bucketId] -= 1;
    io.emit(`count-${bucketId}`, bucket[bucketId]);
  });
});

// root
app.get("/", (req, res) => {
  if (req.cookies.active_bucket) {
    return res.redirect(`/${req.cookies.active_bucket}`);
  } else {
    res.sendFile(path.join(__dirname + "/public/home.html"));
  }
});

app.get("/destroy/:bid", (req, res) => {
  res.clearCookie("active_bucket");
  delete bucket[req.params.bid];
  return res.redirect(`/`);
});

app.get("/new", (req, res) => {
  let rand;
  do {
    rand = Math.round(Math.random() * 10000);
  } while (bucket.hasOwnProperty(rand));

  bucket[rand] = 0;
  res.cookie("active_bucket", rand);
  return res.redirect(`/${rand}`);
});

app.get("/:bid", (req, res) => {
  if (!bucket.hasOwnProperty(req.params.bid)) {
    if (req.params.bid > 0 && req.params.bid < 10000) {
      bucket[req.params.bid] = 0;
      res.cookie("active_bucket", req.params.bid);
      return res.sendFile(path.join(__dirname + "/public/bucket.html"));
    } else {
      return res.redirect("/new");
    }
  }
  res.sendFile(path.join(__dirname + "/public/bucket.html"));
});

const port = process.env.PORT || 5000;
http.listen(port, function () {
  console.log(`HTTP Listening on *:${port}`);
});
