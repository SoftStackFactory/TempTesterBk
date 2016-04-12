module.exports = function(CompanyUser) {

    CompanyUser.afterRemote('login', function(context, response, next) {

        console.log('> user.afterRemote triggered');
        CompanyUser.findById(response.userId, function(err, user) {
            if(err)
                return next(err);
            response["companyId"] = user["companyId"];
            
            CompanyUser.app.models.Employers.findById(user["companyId"], function(error, res) {
                if(error)
                    return next(error);
                response['appCss'] = {
                    'buttonPrimary': res['buttonPrimary'],
                    'buttonSecondary': res['buttonSecondary'],
                    'header': res['header']
                };
                next();
            });
        });
        
    });
    
    CompanyUser.beforeRemote('*.updateAttributes', function(context, instance, next) {
        
        checkUsers(context.req.accessToken.userId);
        function checkUsers(userId) {
            CompanyUser.find({"where":{"_id": userId}}, function(userErr, userRes) {
                if(userErr)
                    return next(userErr);
                if(userRes === undefined) {
                    var err = new Error("Unauthorized to perform this action");
                    err.status = 401;
                    next(err);
                } else {
                    testLogin(userRes[0].__data.email, context.args.data.oldPassword);
                }
            });
        }
        function testLogin(email, password) {
            CompanyUser.login({email: email, password: password}, function(loginErr, loginRes) {
                if(loginErr)
                    return next(loginErr);
                delete context.args.data.oldPassword;
                next();
            });
        }
    });
    
    // CompanyUser.observe('before save', function(context, next) {
    //     console.log(context);
    //     if(context.req.accessToken.userId !== '56ec3f49d97b606904c7e50f') {
    //         var err = new Error("Unauthorized to perform this action");
    //         err.status = 401;
    //         next(err);
    //     } else {
    //         next();
    //     }
    // });

};
