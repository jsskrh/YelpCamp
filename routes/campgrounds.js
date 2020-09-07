var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var middleware = require("../middleware");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const geocodingClient = mbxGeocoding({ accessToken: process.env.MAPBOX_TOKEN });
var moment = require("moment");

// Campgrounds Route
router.get("/", function(req, res){
    var noMatch = null;
    if(req.query.search){
        const regex = new RegExp(escapeRegex(req.query.search), "gi");
        // Get data from campgrounds database
        Campground.find({name: regex}, (err, campgrounds) => {
            if(err){
                console.log(err);
            } else{
                if(campgrounds.length < 1){
                    noMatch = "No campgrounds match that query, please try again.";
                }
                res.render("campgrounds/index", {campgrounds: campgrounds, noMatch: noMatch, page: "campgrounds"});
            }
        });
    } else {
        // Get data from campgrounds database
        Campground.find({}, (err, campgrounds) => {
            if(err){
                console.log(err);
            } else{
                res.render("campgrounds/index", {campgrounds: campgrounds, noMatch: noMatch, page: "campgrounds"});
            }
        });
    }
});

router.post("/", middleware.isLoggedIn, function(req, res){
    var name = req.body.name;
    var image = req.body.image;
    var price = req.body.price;
    var description = req.body.description;
    var author = {
        id: req.user._id,
        username: req.user.username
    };
    geocodingClient
        .forwardGeocode({
            query: req.body.location,
            limit: 1
        }).send().then(response => { 
            var match = response.body.features
            var coordinates = match[0].center;
            var location = match[0].place_name;
            var newCampground = {name: name, image: image, price: price, description: description, author: author, location: location, coordinates: coordinates};
            // Create new campground and save to database
            Campground.create(newCampground, (err, campground) => {
                if(err){
                    console.log(err);
                } else{
                    req.flash("success", "Successfully created campground")
                    // Redirect back to campgrounds page
                    res.redirect("/campgrounds");
                }
            });
        }, error => { 
                console.log(error);
                req.flash('error', 'Invalid address');
                return res.redirect('back');
        })
});

// NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res){
    res.render("campgrounds/new");
});

// SHOW - shows more info about one campground
router.get("/:id", function(req, res){
    // Find the campground with provided ID
    Campground.findById(req.params.id).populate("comments").exec((err, foundCampground) => {
        if(err || !foundCampground){
            req.flash("error", "Campground not found");
            res.redirect("back");
        } else {
            res.render("campgrounds/show", {campground: foundCampground});
        }
    });
});

// EDIT
router.get("/:id/edit", middleware.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, (err, foundCampground) => {
        res.render("campgrounds/edit", {campground: foundCampground});
    });
});

// UPDATE
router.put("/:id", middleware.checkCampgroundOwnership, function(req, res){
    geocodingClient
        .forwardGeocode({
            query: req.body.location,
            limit: 1
        }).send().then(response => { 
            var match = response.body.features
            req.body.campground.coordinates = match[0].center;
            req.body.campground.location = match[0].place_name;
            Campground.findByIdAndUpdate(req.params.id, req.body.campground, (err, updatedCampground) => {
                if(err){
                    req.flash("error", err.message);
                    res.redirect("back");
                } else {
                    req.flash("success","Successfully Updated!");
                    res.redirect(`/campgrounds/${req.params.id}`);
                }
            });
        }, error => { 
                console.log(error);
                req.flash('error', 'Invalid address');
                return res.redirect('back');
        })
});

// DESTROY
router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res){
    Campground.findByIdAndRemove(req.params.id, req.body.campground, (err) => {
        if(err){
            res.redirect("/campgrounds");
        } else {
            req.flash("success", "Campground deleted");
            res.redirect("/campgrounds");
        }
    });
});

function escapeRegex(text){
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router