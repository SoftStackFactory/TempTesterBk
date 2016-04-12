module.exports = function(SsfUsers) {
    SsfUsers.afterRemote('login', function(context, instance, next) {
        // console.log(context, instance, next);
        SsfUsers.findOne({
            where:{
                id: instance.__data.userId
            }
        }, function(err, res) {
            if(err) {
                next(err);
            } else {
                instance.__data.firstName = res.firstName;
                instance.__data.lastName = res.lastName;
                next(0, instance);
            }
        });
    });
    SsfUsers.beforeRemote('*.updateAttributes', function(context, instance, next) {
        checkUsers(context.req.accessToken.userId);
        function checkUsers(userId) {
            SsfUsers.find({"where":{"_id": userId}}, function(userErr, userRes) {
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
            SsfUsers.login({email: email, password: password}, function(loginErr, loginRes) {
                if(loginErr)
                    return next(loginErr);
                delete context.args.data.oldPassword;
                next();
            });
        }
    });
};
