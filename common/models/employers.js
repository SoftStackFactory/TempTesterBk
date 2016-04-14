module.exports = function(Employers) {

    Employers.beforeRemote('*.updateAttributes', function(context, instance, next) {
        var CompanyUser = Employers.app.models.CompanyUser;
        
        checkSsfUsers(context.req.accessToken.userId);
        function checkSsfUsers(userId) {
            CompanyUser.find({"where":{"_id": userId}}, function(ssfUserErr, ssfUserRes) {
                if(ssfUserErr)
                    return next(ssfUserErr);
                if(ssfUserRes.length === 0 || context.args.data.id != ssfUserRes[0].__data.companyId) {
                    var err = new Error("Unauthorized to perform this action");
                    err.status = 401;
                    next(err);
                } else {
                    next();
                }
            });
        }
    });
    
    Employers.remoteMethod('createEmployer', {
        http: {path: '/createEmployer', verb: 'post'},
        accepts: [
            {arg: 'authentication', type: 'string', required: true, description: 'Provide SoftStack Factory Credentials.'},
            {arg: 'email', type: 'string', required: true, description: 'Provide an email for the new user to login.'},
            {arg: 'password', type: 'string', required: true, description: 'Leave blank if using existing company.'},
            {arg: 'company_name', type: 'string', description: 'Name of the new Company. Leave blank if using existing company.'},
            {arg: 'companyId', type: 'string', description: 'Provide the companyId to add a user to a company\'s results.'}
        ],
        notes: [
            "New Company:\n",
            "fill in the available fields, and leave companyId blank.\n",
            "Add a CompanyUser to an Employer:\n",
            "Enter the companyId of the one you want to give the user access to.\n",
            "Changing the Company a user can see results for:\n",
            "Fill in the fields as though you are adding a CompanyUser to an Employer."
        ],
        description: "Create an Employer and/or a CompanyUser.",
        returns: {type: 'object', root: true}
    });
    
    Employers.createEmployer = function(authentication, email, password, company_name, companyId, cb) {
        var CompanyUser = Employers.app.models.CompanyUser;
        
        authenticateUser(authentication);
        function authenticateUser(authentication) {
            CompanyUser.login({
                email: 'hgottschalk@softstackfactory.com',
                password: authentication
            }, function(errAuth, varifiedAuth) {
                if(errAuth) {
                    var err = new Error("Something went wrong with authentication.");
                    err.status = 500;
                    cb(err);
                } else {
                    if(companyId !== undefined) {
                        checkUser(email, password, companyId);
                    } else {
                        findCompany();
                    }
                }
            });
        }
        
        function findCompany() {
            Employers.findOne({
                where: {
                    company_name: company_name
                }
            }, function(findError, findSuccess) {
                if(findError) {
                    var err = new Error("Something went wrong with checking if the employer exists already or not.");
                    err.status = 500;
                    cb(err);
                } else {
                    if(findSuccess !== null) {
                        checkUser(email, password, findSuccess.__data.id);
                    } else {
                        createCompany();
                    }
                }
            });
            
        }
        
        function createCompany() {
            //check if company name already exists
            Employers.create({
                company_name: company_name,
                active: true
            }, function(errComp, createdComp) {
                if(errComp) {
                    var err = new Error("Something went wrong with creating the company.");
                    err.status = 500;
                    cb(err);
                } else {
                    checkUser(email, password, createdComp.__data.id);
                }
            });
        }
        
        function checkUser(email, password, companyId) {
            CompanyUser.findOne({
                where: {
                    email: email
                }
            }, function(findErr, findRes) {
                if(findErr) {
                    var err = new Error("Something went wrong with checking if the user already exists.");
                    err.status = 500;
                    cb(err);
                } else {
                    if(findRes === null) {
                        createUser(email, password, companyId);
                    } else {
                        createUser(email, password, companyId, findRes.__data.id);
                    }
                }
            });
        }
        
        function createUser(email, password, companyId, userId) {
            var tempObj = {
                email: email,
                password: password,
                companyId: companyId
            };
            if(userId !== undefined)
                tempObj.id = userId;
                
            CompanyUser.upsert(tempObj, function(errUser, createdUser) {
                if(errUser) {
                    //if email already exists, update the user's companyId
                    var err = new Error("Something went wrong with created the CompanyUser.");
                    err.status = 500;
                    cb(err);
                } else {
                    cb(0, "Changes complete.");
                }
            });
        }
        // console.log(authentication, email, password, company_name, companyId);
        // cb(0, {});
    };
    
    
    
};
