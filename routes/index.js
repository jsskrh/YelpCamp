var express = require("express");
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Campground = require("../models/campground");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");

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
    var newUser = new User({
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        avatar: req.body.avatar
    });
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

// Password forgot
router.get('/forgot', function(req, res) {
    res.render('users/forgot');
});

// Forgot functions. crypo.randombytes does not support promises by default
// So we have to "promisify" it
var generateResetToken = () => {
	return new Promise((resolve, reject) => {
		// Crypto random bytes has a callback
		// randombytes(size[, callback])
		crypto.randomBytes(20, (err, buf) => {
			if (err) reject(err);
			else {
				let reset_token = buf.toString('hex');
				resolve(reset_token);
			}
		})
	})
}

// Handle forgot
router.post('/forgot', async (req, res) => {
	try {
		// Generate reset token to send
		let reset_token = await generateResetToken();
		console.log(reset_token);

		// Find the specified user by email
		let user = await User.findOne({email: req.body.email});
		if (!user) {
            req.flash('error', 'No account with that email address');
            throw 'user not found.'
        }
        user.resetPasswordToken = reset_token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour in ms
        // Passport local mongoose allows for promises inherently
        await user.save();
        // Create transport
        var smtpTransport = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'kasieakorah@gmail.com',
                pass: process.env.GMAILPW
            }
        });
        // Set options
        var mailOptions = {
            to: user.email,
            from: 'kasieakorah@gmail.com',
            subject: 'YelpCamp Password Reset',
            text: 'You are receiving this because you (or someone else) have requested the reset of the password linked to your Yelpcamp account.' +
                'Please click on the following link, or paste this into your browser to complete the process.' + '\n\n' +
                'http://' + req.headers.host + '/users/reset/' + reset_token + '\n\n' + 
                'If you did not request this, please ignore this email and your password will remain unchanged.'
        };
        // Send mail uses promise if no callback is specified
        await	smtpTransport.sendMail(mailOptions);
        console.log('mail sent');
        req.flash('success', 'An email has been sent to ' + user.email + ' with further instructions');
        res.redirect('/forgot');
	} catch (error) {
		console.log(error);
		res.redirect('/forgot');
	}	
});

// Password reset
router.get('/users/reset/:token', function(req, res) {
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, (err, user) => {
        if (err || !user) {
            req.flash("error", "Password reset token is invalid or has expired");
            return res.redirect('/forgot');
        }
    });
    res.render("users/reset", {token: req.params.token});
});

// Handle reset
router.post('/reset/:token', function(req, res) {
    async.waterfall([
        function(done) {
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, (err, user) => {
                if (err || !user) {
                    req.flash('error', 'Password reset token is invalid or has expired');
                    return res.redirect('back');
                }
                if(req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, (err) => {
                        if(err){
                            req.flash("error", "Something went wrong");
                            res.redirect("/campgrounds");
                        } else {
                            user.resetPasswordToken = undefined;
                            user.resetPasswordExpires = undefined;
                        }
            
                        user.save((err) => {
                            if(err){
                                req.flash("error", "Something went wrong");
                                res.redirect("/campgrounds");
                            } else {
                                req.logIn(user, (err) => {
                                    if(err){
                                        req.flash("error", "Something went wrong");
                                        res.redirect("/campgrounds");
                                    } else {
                                        done(err, user);
                                    }
                                });
                            }
                        });
                    });
                } else {
                    req.flash("error", "Passwords do not match");
                    return res.redirect('back');
                };
            });
        },
        function(user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: 'Gmail', 
                auth: {
                    user: 'kasieakorah@gmail.com',
                    pass: process.env.GMAILPW
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'kasieakorah@gmail.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            };
            smtpTransport.sendMail(mailOptions, (err) => {
                if(err){
                    req.flash("error", "Something went wrong");
                    res.redirect("/campgrounds");
                } else {
                    req.flash('success', 'Success! Your password has been changed.');
                    done(err);
                };
            });
        }
    ], (err) => {
        if(err){
            req.flash("error", "Something went wrong");
            res.redirect("/campgrounds");
        } else {
            res.redirect("/campgrounds");
        };
    });
});

// User profile
router.get("/users/:id", function(req, res){
    User.findById(req.params.id, (err, foundUser) => {
        if(err){
            req.flash("error", "Something went wrong");
            res.redirect("/");
        }
        Campground.find().where("author.id").equals(foundUser._id).exec((err, campgrounds) => {
            if(err){
                req.flash("error", "Something went wrong");
                res.redirect("/");
            }
            res.render("users/show", {user: foundUser, campgrounds: campgrounds});
        });
    });
});

module.exports = router