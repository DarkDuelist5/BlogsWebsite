//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const app = express();
const _ = require("lodash");

const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
var GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { find } = require("lodash");


app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));


app.use(session({
  secret: "my secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.set('strictQuery', false);
mongoose.connect("mongodb://127.0.0.1:27017/blogsDB", {useNewUrlParser: true});

const commentSchema = {
  authorpic: String,
  authorname: String,
  content: String
};
const Comment = mongoose.model("Comment", commentSchema);

const blogSchema = {
  author: String,
  authorgid: String, 
  date: String,
  title: String,
  body: String,
  likes: Number,
  comments: [commentSchema]
};

const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  userdp: String,
  blogPosts: [blogSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/blogs",
},
function(accessToken, refreshToken, profile, cb) {
  User.findOrCreate({ googleId: profile.id, name: profile.displayName, userdp: profile.photos[0].value }, function (err, user) {
    return cb(err, user);
  });
}
));

const Blog = mongoose.model("Blog", blogSchema);
//let posts = [];
//Post.find({}, function(err, foundPosts){
  //   res.render("home",{first: homeStartingContent, posts: foundPosts});
  // });
  // Blog.find({}, function(err, foundBlogs){
  //   res.render("home", {blogList: foundBlogs});
  // });

  
app.get("/", function(req,res){
  
  Blog.find({}).sort({ likes: -1 }).exec(function(err, foundBlogs){ 
    if(err) console.log(err);
    else{
      res.render("home", {blogList: foundBlogs});
    }
  });
   

});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/blogs', 
passport.authenticate('google', { failureRedirect: '/login' }),
function(req, res) {
  // Successful authentication, redirect home.
  res.redirect('/');
});

app.post("/comment", function(req,res){
  const blogid = req.body.blogname;
  const commentBody = req.body.cbody;
  const gid = req.user.id;
  console.log(gid);

  User.findById(gid, function(err, foundUser){
    if(err) console.log("Error");
    else{
      const comment = new Comment({
        authorpic: foundUser.userdp,
        authorname: foundUser.name,
        content: commentBody
      });
      Blog.findById(blogid, function(err, foundBlog){
        if(err) console.log(err);
        else{
          foundBlog.comments.push(comment);
          foundBlog.save();
          res.redirect("/posts/" + blogid);
        }
      });
    }
  });

});
// Blog.find({}, function(err, foundBlogs){
      //   let found = false;
      //   if(err) console.log(err);
      //   else{
      //     for(let i = 0; i<foundBlogs.length; i++){
      //       if(_.capitalize(foundBlogs[i].title) === _.capitalize(blog)){
      //         found = true;
      //         //insert comment into blog doc
      //         foundBlogs[i].comments.push(comment);
      //         foundBlogs[i].save();
    
      //         res.redirect("/posts/" + blog);
      //       }
      //     }
      //     if(found==false) console.log("Unable to find blog to enter comment");
      //   }
      // });
app.get("/login", function(req,res){
  if(req.isAuthenticated()){
    res.redirect("/");
  } else{

    res.render("login");
  }
});


app.get("/logout", function(req,res){
  req.logout(function(err){
    if(err) console.log(err);
    else
    res.redirect("/");
  });
  
});

app.get("/manage", function(req,res){

  if(req.isAuthenticated()){

    User.findById(req.user.id, function(err, foundUser){
      if(err) console.log(err);
      else
      res.render("manage", {writtenBlogs: foundUser.blogPosts});
    });
  }

  else{
    res.redirect("/login");
  }
});

app.post("/delete", function(req, res){
  let items = req.body.todel;
  if(Array.isArray(items))
  {
  for(let i = 0; i<items.length; i++)
  {
    User.findOneAndUpdate({_id: req.user.id}, {$pull: {blogPosts: {_id: items[i]}}}, function(err, foundUser){
      if(err) console.log(err);
      else
      console.log("Removed");
    });
    Blog.deleteOne({_id: items[i]}, function(err){
      if(err) console.log(err);
      else
      {
        console.log("Removed blog");
        if(i==items.length-1){
          res.redirect("/");
        } 
      }
    }); 
  }
  }
  else{
    User.findOneAndUpdate({_id: req.user.id}, {$pull: {blogPosts: {_id: items}}}, function(err, foundUser){
      if(err) console.log(err);
      else
      console.log("Removed");
    });
    Blog.deleteOne({_id: items}, function(err){
      if(err) console.log(err);
      else
      {
        console.log("Removed blog");
        res.redirect("/");
      }
    }); 
  } 
}); 

app.get("/compose", function(req,res){
  
  if(req.isAuthenticated()){
    res.render("compose");
  } else{
    res.redirect("/login");
  }
  
  
  //res.render("compose");
});

  // if(!req.isAuthenticated())
  // res.redirect("/login");

  // let post = req.params.postName;
  // post = _.capitalize(post);


  // Blog.find({}, function(err, foundBlogs){
  //   if(err) console.log(err);
  //   else{
  //     for(let i = 0; i<foundBlogs.length; i++){
  //       if(_.capitalize(foundBlogs[i].title) === post){
  //         foundBlogs[i].likes = foundBlogs[i].likes + 1;
  //         foundBlogs[i].save();

  //         res.render("post", {foundBlog: foundBlogs[i]});
  //       }
  //     }
  //   }
  // });

app.get("/posts/:postName", function(req,res){

  if(!req.isAuthenticated())
   res.redirect("/login");

  let id = req.params.postName;
  Blog.findById(id, function(err, foundBlog){
    if(err) console.log(err);

    else{
      foundBlog.likes = foundBlog.likes + 1;
      foundBlog.save();
      res.render("post", {foundBlog: foundBlog});
    }
  });

});

// const blog = new Blog({
  //   author: authorN,
  //   authorgid: req.user.id,
  //   date: d,
  //   title: postT,
  //   body: postB,
  //   likes: 0
  // });
  // blog.save();

//User.findById(req.user.id, function(err, foundUser){
  //   if(err) console.log(err);
  //   else{
  //     foundUser.blogPosts.push(blog);
  //     foundUser.save();
  //   }
  // });

app.post("/compose", function(req,res){
  let postB = req.body.postBody;
  let postT = req.body.postTitle;

  var today  = new Date();
  let d = today.toLocaleDateString("en-US")
   
  User.findById(req.user.id, function(err, foundUser){
    if(err) console.log(err);
    else{
      const blog = new Blog({
        author: foundUser.name,
        authorgid: req.user.id,
        date: d,
        title: postT,
        body: postB,
        likes: 0
      });
      blog.save();
      foundUser.blogPosts.push(blog);
      foundUser.save();
    }
  });


  res.redirect("/");
});





app.listen(3000, function() {
  console.log("Server started on port 3000");
});



