var express = require("express");
var router = express.Router({mergeParams: true});
var Campground = require("../models/campground");
var Comment = require("../models/comments");
var User = require("../models/user");
var Notification = require("../models/notification");
var middleware = require("../middleware");

// Comments New
router.get("/new", middleware.isLoggedIn, function(req, res){
    Campground.findById(req.params.id, (err, campground) => {
        if(err){
            res.redirect("/campgrounds");
        } else {
            res.render("comments/new", {campground: campground});
        }
    });
});

// Comments Create
router.post("/", middleware.isLoggedIn, function(req, res){
    Campground.findById(req.params.id, async (err, campground) => {
        if(err){
            console.log(err);
            res.redirect("/campgrounds");
        } else {
            var author = {
                id: req.user._id,
                username: req.user.username
            };
            var text = req.body.comment.text;
            var newComment = {text: text, author: author};
            // Create new comment and save to database
            try {
                let comment = await Comment.create(newComment);
                campground.comments.push(comment);
                campground.save();
                let user = await User.findById(campground.author.id);
                let newNotification = {
                    username: req.user.username,
                    campgroundId: campground.id,
                    commentId: comment.id
                }
                let notification = await Notification.create(newNotification);
                user.notifications.push(notification);
                user.save();
                //redirect back to campgrounds page
                req.flash("success", "Successfully added comment");
                res.redirect(`/campgrounds/${campground._id}`);
            } catch(err) {
                req.flash('error', err.message);
                res.redirect('back');
            }
        }
    });
});

// EDIT
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function(req, res){
    Campground.findById(req.params.id, (err, foundCampground) => {
        if(err || !foundCampground){
            req.flash("error", "Campground not found");
            return res.redirect("back");
        } else {
            Comment.findById(req.params.comment_id, (err, foundComment) => {
                if(err){
                    res.redirect("back");
                } else {
                    res.render("comments/edit", {campground_id: req.params.id, comment: foundComment});
                }
            });
        }
    })
});

// UPDATE
router.put("/:comment_id", middleware.checkCommentOwnership, function(req, res){
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, (err, updatedComment) => {
        if(err){
            res.redirect("back");
        } else {
            res.redirect(`/campgrounds/${req.params.id}`);
        }
    });
});

// DESTROY
router.delete("/:comment_id", middleware.checkCommentOwnership, function(req, res){
    Comment.findByIdAndRemove(req.params.comment_id, req.body.comment, (err) => {
        if(err){
            res.redirect("back");
        } else {
            req.flash("success", "Comment deleted");
            res.redirect("back");
        }
    });
});

module.exports = router