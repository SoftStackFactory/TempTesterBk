module.exports = function(app) {

	var jsonArr = require('../questions.json');
	
	var Question = app.models.Questions;
	
	Question.destroyAll();
	
	Question.create(jsonArr, function(err, record) {
		if (err) return console.log(err);
	});
	
	console.log("Questions inserted successfully");
};
