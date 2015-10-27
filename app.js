'use strict;'

//required modules
var http = require('http');
var https = require("https");
var querystring = require("querystring");
var fs = require('fs');

var commonHeaders = {'Content-Type': 'text/html'};
var temp; //to hold 'response' in queryRoute function for passing to fetchTweets function


//creating a server
http.createServer(function (request, response) {
	homeRoute(request, response);
	queryRoute(request, response);
}).listen(3000, "127.0.0.1");

console.log('Server running at http://127.0.0.1:3000/');


//handling home page requests
function homeRoute(request, response) {
	if(request.url === "/") {

		if(request.method.toLowerCase() == 'get') {     
			response.writeHead(200, commonHeaders);
			view("header", {}, response);
			view("search", {}, response);
			view("footer", {}, response);
			response.end();
		} else {
			request.on('data', function(postBody){
				var input = querystring.parse(postBody.toString());
				response.writeHead(303, {'Location': "/" + encodeURIComponent(input.query)});
				response.end();   
			});
		}

	}
}


//handling query urls
function queryRoute(request, response) {

	var query = request.url.replace("/", "");

	if (query.length > 0) {
		response.writeHead(200, commonHeaders);
		view("header", {}, response);		
		view("search_again", {}, response);
		//temporary variable to hold 'response'. Used in fetchTweets function 
		temp = response;
		
		accessToken(query);
	}
}


//merging twitter response into page
function mergeValues(values, content) {	
	//cycle over keys
	for(var key in values) {
		//replace all {{keys}} wil values from object
		content = content.replace("{{" + key + "}}", values[key]);
	}
	//return merged content
	return content;
}


//generating different pages using html in views folder
function view(templateName, values, response) {
	//read from template file
	var fileContents = fs.readFileSync("./views/" + templateName + ".html", {encoding: 'utf8'});  
	//insert values in the content
	fileContents = mergeValues(values, fileContents);
	//write out the contents to the response
	response.write(fileContents);
}


// generating bearer token
function accessToken(query) {
	var options = {
		"method": "POST",
		"hostname": "api.twitter.com",
		"port": null,
		"path": "/oauth2/token",
		"headers": {
		  "authorization": "Basic ZUpVQlI2bDNoMVdnMFdLeGQ0eVBpQllZdzpoVHRhTGxtNHZiQVFwRTZ2QVNNWjZpOEw2V2dJYmVxWW5XVkd4Rmx2MHJDeTdaQm9NYQ==",
		  "content-type": "application/x-www-form-urlencoded"
		}
	};

	var postData = querystring.stringify({
		grant_type: 'client_credentials'
	});

	var request = https.request(options, function (response) {

		var body = "";
		var token;
		
		response.on("data", function (chunk) {
			body += chunk;
			token = JSON.parse(body).access_token;
			//console.log(token);
		});

		response.on("end", function () {
			fetchTweets(token, query);
			//console.log("finish");
		});

	});

	request.on('error', function(e){
		console.log('problem with request: ' + e.message);
	});

	request.write(postData);
	request.end();
}


// fetching tweets
function fetchTweets(token, query) {

	var options = {
		"method": "GET",
		"hostname": "api.twitter.com",
		"port": null,
		"path": "/1.1/search/tweets.json?q=" + query + "&lang=en&result_type=recent&count=50",
		"headers": {
			"authorization": "Bearer " + token,
			"host": "api.twitter.com"
		}
	};

	var request = https.request(options, function(response){
		var chunks = [];

		response.on('data', function(chunk){
			chunks.push(chunk);
		});

		response.on('end', function(){
			var body = Buffer.concat(chunks);
			responseJSON = JSON.parse(body); 
			
			if(responseJSON.statuses.length > 0) {			
				for(var i = 0; i < responseJSON.statuses.length; i++) {
					
					var tweetTime = parseTwitterDate(responseJSON.statuses[i].created_at);
					
					var values = {
								created_at: tweetTime,
									  text: responseJSON.statuses[i].text,
									  user: responseJSON.statuses[i].user.name,
							   screen_name: responseJSON.statuses[i].user.screen_name,
						 profile_image_url: responseJSON.statuses[i].user.profile_image_url,
						 	   handle_link: "https://twitter.com/" + responseJSON.statuses[i].user.screen_name,
						 		tweet_link: "https://twitter.com/" + responseJSON.statuses[i].user.screen_name + "/status/" + responseJSON.statuses[i].id_str
					}
					
					view("results", values, temp);

				}
			} else {
				view("no_results", {}, temp);
			}
			
			view("footer", {}, temp);
			temp.end();	

		});
	});
	
	request.on('error', function(e){
		console.log('problem with request: ' + e.message);
	});

	request.end();

}


//converting twitter time stamp into human readable format :)
function parseTwitterDate(tdate) {
    var system_date = new Date(Date.parse(tdate));
    var user_date = new Date();

    var diff = Math.floor((user_date - system_date) / 1000);
    if (diff <= 1) {return "just now";}
    if (diff < 20) {return diff + " seconds ago";}
    if (diff < 40) {return "half a minute ago";}
    if (diff < 60) {return "less than a minute ago";}
    if (diff <= 90) {return "one minute ago";}
    if (diff <= 3540) {return Math.round(diff / 60) + " minutes ago";}
    if (diff <= 5400) {return "1 hour ago";}
    if (diff <= 86400) {return Math.round(diff / 3600) + " hours ago";}
    if (diff <= 129600) {return "1 day ago";}
    if (diff < 604800) {return Math.round(diff / 86400) + " days ago";}
    if (diff <= 777600) {return "1 week ago";}
    return "on " + system_date;
}