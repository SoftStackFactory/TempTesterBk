module.exports = function(TestResults) {
    
    //User can only get it's own inputs
    TestResults.beforeRemote('find', function(context, instance, next) {
        var SSFUsers = TestResults.app.models.SSFUsers;
        
        checkSsfUsers(context.req.accessToken.userId);
        function checkSsfUsers(userId) {
            SSFUsers.find({"where":{"_id": userId}}, function(ssfUserErr, ssfUserRes) {
                if(ssfUserErr)
                    return next(ssfUserErr);
                if(ssfUserRes.length === 0 || context.args.filter.where.userID != context.req.accessToken.userId) {
                    var err = new Error("Unauthorized to perform this action");
                    err.status = 401;
                    next(err);
                } else {
                    next();
                }
            });
        }
    });
    
    //User can only get it's own inputs
    TestResults.beforeRemote('page', function(context, instance, next) {
        var CompanyUser = TestResults.app.models.CompanyUser;
        
        checkSsfUsers(context.req.accessToken.userId);
        function checkSsfUsers(userId) {
            CompanyUser.find({"where":{"_id": userId}}, function(ssfUserErr, ssfUserRes) {
                if(ssfUserErr)
                    return next(ssfUserErr);
                if(ssfUserRes.length === 0 || context.args.filters.where.employerId != ssfUserRes[0].__data.companyId) {
                    var err = new Error("Unauthorized to perform this action");
                    err.status = 401;
                    next(err);
                } else {
                    next();
                }
            });
        }
    });
    
    TestResults.page = function(date, limit, filters, nextPage, unique, cb) {
        /*  data needs:
            modelName: the name of the model to search
            limit: how many results total (0 returns an empty array)
            date: when the infinite scroll started
            
            nedded to get sequential pages:
            id: the id that was returned with the first result
            nextPage: returned with previous result, pass it in the next call for data
            
            optional:
            filters: an object properly formatted the way mongo expects it
            unique: is a string of the keyName of an instance that cannot be repeated (ie. userId)
            
            running explorer object:
//mocks an initial call object
{
  "date": "2016-02-02T00:52:18.000Z",
  "modelName": "TestResults",
  "limit": 2,
  "filters": {
    "where": {
      "employerId": "56a7cdbf64ed9a170491cc2f"
    },
    "order": "createDate DESC"
  },
  "nextPage": 1
}

//mocks a nextPage call object{
  "date": "2016-02-02T00:52:18.000Z",
  "modelName": "TestResults",
  "limit": 2,
  "filters": {
    "where": {
      "employerId": "56a7cdbf64ed9a170491cc2f"
    },
    "order": "createDate DESC"
  },
  "nextPage": 2
}
        */
        var async = require('async');
        var ssfUsers = TestResults.app.models.SSFUsers;
        var possibleErrors = [];
        limit = limit === undefined ? filters.where.limit : limit;
        // if(date === undefined || modelName === undefined || limit === undefined) {
        //     var error = new Error('Missing one of the following key value pairs: "date" "modelName" and/or "limit"');
        //     error.statusCode = 500;
        //     cb(error);
        // }
        filters = filters !== undefined ?  filters : {'where': {}};
        filters.where.createDate = {lt: date};
        var ModelCall = TestResults.app.models.TestResults;
        
        getInstances();
        
        function getInstances() {
            ModelCall.find(filters, function(err, response) {
                if(err) {
                    var error = new Error('Database paging operation failed');
                    error.statusCode = 500;
                    cb(error);
                } else {
                    //need names and count
                    if(unique === undefined)
                        return limitData(response);
                    var uniqueInstances = [];
                    for(var i in response) {
                        var flag = 1;
                        for(var j in uniqueInstances) {
                            if(response[i][unique] === uniqueInstances[j][unique]) {
                                flag = 0;
                                uniqueInstances[j]['countBY' + unique]++;
                                break;
                            }
                        }
                        if(flag) {
                            response[i]['countBY' + unique] = 1;
                            uniqueInstances.push(response[i]);
                        }
                    }
                    //call function to limit data
                    limitData(uniqueInstances);
                }
            });
        }
        
        function limitData(instancesArray) {
            var minIndex = 0;
            nextPage = nextPage !== undefined ? nextPage : 1;
            var maxIndex = limit !== undefined ? minIndex + limit - 1 : instancesArray.length;
            var returnArray = [];
            var totalPages = limit !== undefined ? Math.round(instancesArray.length / limit) : 1;
            if(nextPage - 1 > totalPages) {
                var error = new Error('Database paging operation exceeded the total number of pages.');
                error.statusCode = 500;
                return cb(error);
            }
            for(var incrementingIndex = minIndex; incrementingIndex <= maxIndex && incrementingIndex < instancesArray.length; incrementingIndex++) {
                returnArray.push(instancesArray[incrementingIndex]);
            }
            if(returnArray.length === 1)
                possibleErrors.push("Only one result is returned, this could be the result of the 'unique' key being undefined.");
            
            getNames(returnArray);
            
            if(nextPage - 1 !== 0 && nextPage !== undefined) {
                minIndex = (nextPage - 1) * limit;
                nextPage++;
            } else {
                nextPage = 2;
            }
            // cb(0, {"results": returnArray, "nextPage": nextPage, "totalPages": totalPages, "possibleErrors": possibleErrors});
        }
        
        function getNames(returnArray, totalPages) {
            async.forEachOf(returnArray, function (k, indexNum, next) {
            // 	var responseName = 'response'+indexNum;
            	ssfUsers.find({
            		where: {
            			id: k.userID
            		}
            	},function(err, usersResponse) {
            		if(err) {
            			var error = new Error('async.forEach operation failed');
            			error.statusCode = 500;
            			cb(error);
            		}
            		else {
            			k.firstName = usersResponse[0].firstName;
            			k.lastName = usersResponse[0].lastName;
            			next();
            		}
            	});
            },function(err) {
            	if(err) {
            		var error = new Error('async.forEach operation failed');
            		error.statusCode = 500;
            		cb(error);
            	}
                endService(returnArray, totalPages);
            });
        }
        
        function endService(returnArray, totalPages) {
            var returnObject = {
                "results": returnArray,
                "nextPage": nextPage,
                "totalPages": totalPages
            };
            if(possibleErrors.length !== 0)
                returnObject.possibleErrors = possibleErrors;
            cb(0, returnObject);
        }
    };
    
    TestResults.remoteMethod('page', {
        http: {path: '/page', verb: 'post'},
        accepts: [
            {arg: 'date', type: 'string', "required": true},
            // {arg: 'modelName', type: 'string', "required": true},
            {arg: 'limit', type: 'number'},
            {arg: 'filters', type: 'object'},
            {arg: 'nextPage', type: 'number'},
            {arg: 'unique', type: 'string'}
        ],
        notes: "Testing out notes",
        description: "Returns a partial results list of the query.",
        returns: {type: 'object', root: true}
    });
};
