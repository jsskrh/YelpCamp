var express = require("express");
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");

// Root Route
router.get("/", function(req, res){
    res.render("landing", {page: "login"});
});

// Show signup form
router.get("/register", function(req, res){
    res.render("register", {page: "register"});
});

// Handle signup
router.post("/register", function(req, res){
    var newUser = new User({username: req.body.username});
    if(req.body.password === process.env.ADMIN_KEY){
        newUser.isAdmin = true;
    };
    User.register(newUser, req.body.password, (err, user) => {
        if(err){
            req.flash("error", err.message);
            return res.redirect('register');
        } passport.authenticate("local")(req, res, () => {
            req.flash("success", `Welcome to YelpCamp ${user.username[0].toUpperCase() + user.username.substring(1)}`);
            res.redirect("/campgrounds");
        });
    });
});

// Show login form
router.get("/login", function(req, res){
    res.render("login");
});

// Handle login
router.post("/login", passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login"
}), function(req, res){
});

// Handle logout
router.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "Logged you out!");
    res.redirect("/campgrounds");
});


module.exports = router