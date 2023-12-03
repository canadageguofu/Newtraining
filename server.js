const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const exphbs = require("express-handlebars");
const db = require(path.join(__dirname, "/modules/dbModule"));
const clientSessions = require("client-sessions");
const prompts = require('prompts');
const hash = require("object-hash");
const { response } = require("express");


// SETUP
//const HTTP_PORT = process.env.PORT || 8080;
const HTTP_PORT = process.env.PORT || 5000;

app.use(bodyParser.urlencoded({ 
    extended: true
})); 

app.use(express.static(path.join(__dirname, "public")));

app.use(express.static(path.join(__dirname, "views")));

// app.engine(".hbs", exphbs({
//     extname: ".hbs",
//     defaultLayout: false,
//     helpers: {
//         equal: function (lvalue, rvalue, options) {
//             if (arguments.length < 3)
//                 throw new Error("Handlebars Helper equal needs 2 parameters");
//             if (lvalue != rvalue) {
//                 return options.inverse(this);
//             } else {
//                 return options.fn(this);
//             }
//         }
//     }
// }))

app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    defaultLayout: false,
    helpers: {
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    }
}))



app.set("view engine", ".hbs");


// app.engine('handlebars', exphbs.engine());
// app.set('view engine', 'handlebars');
app.use(clientSessions({
    cookieName: 'session',
    secret: 'northstarhrmgmt',
    duration: 5 * 60 * 1000,
    activeDuration: 1000 * 60 * 5,
    cookie: {
        ephemeral: true, // when true, cookie expires when the browser closes
        secure: false // when true, cookie will only be sent over SSL. use key 'secureProxy' instead if you handle SSL not in your node process
    }
}));

// ROUTES
app.get("/", (req, res) => {
    res.render("home", {user: req.session.user})
})

app.get("/login", (req, res) => {
     res.render("login", {user: req.session.user, layout: false});

    // res.render("dashboard", {user: req.session.user, layout: false})
})

app.post("/login", (req, res) => {
    const username = req.body.username;
    const pwd = req.body.pwd;
    // console.log(hash(req.body.pwd));
    if (username === "" && pwd === "") {
        return res.render("login", {errorMsg: "Username and Password are required!", user: req.session.user, layout: false});
    } else if (username !== "" && pwd === "") {
        return res.render("login", {errorMsg: "Password is required!", user: req.session.user, layout: false});
    } else if (username === "" && pwd !== "") {
        return res.render("login", {errorMsg: "Username is required!", user: req.session.user, layout: false});
    }
    db.validateLogin(req.body).then((usr)=>{
        if(!usr) {
            res.render("login", {errorMsg: "Username does not exist!", user: req.session.user, layout: false});
        } else if (usr.pwd !== hash(pwd)) {
            res.render("login", {errorMsg: "The login credentials do not match!", user: req.session.user, layout: false});
        } else {
            req.session.user = {
                username: usr.username,
                isManager: usr.isManager,
                employeeNum: usr.employeeNum
            };
            db.addLog({activityId:'',activityType:'login',activityTime:Date.now(),description: usr.username})
            .then(() => {
                res.redirect("/dashboard")
            }).catch((err) => {
                res.status(500).send(err);
            })
 
        }        
    }).catch((err)=>{
        res.render("login", {errorMsg: `An error occurred: ${err}`, user: req.session.user, layout: false});
    });
});

app.get("/dashboard", (req, res) => {
    res.render("dashboard", {user: req.session.user, layout: false})
})

app.get("/logout", (req, res) => {
    db.addLog({activityId:'',activityType:'logout',activityTime:Date.now(),description: req.session.user.username})
    .then(() => {
            req.session.reset();
            res.redirect("/");
        }).catch((err) => {
        res.status(500).send(err);
    })
})

app.get("/about", (req, res) => {
    res.render("about", {user: req.session.user})
})

// EMPLOYEES
app.get("/employees", (req, res) => {
    if (req.query.department) {
        db.getEmployeesByDepartment(req.query.department)
        .then((data) => {
            if (data.length > 0) {
                res.render("employees", {employees: data, user: req.session.user});
            } else {
                res.render("employees", {message: "no results", user: req.session.user});
            }
        }).catch(() => {
            res.render("employees", {message: "Encountered error"});})
    } else {
        db.getAllEmployees()
        .then((data) => {
            if (data.length > 0) {
                res.render("employees", {employees: data, user: req.session.user});
            } else {
                res.render("employees", {message: "no results", user: req.session.user});
            }}
        ).catch(() => {
            res.render("employees", {message: "Encountered error"});
        })
    }
});

app.get("/employees/add", (req,res)=>{
    db.getDepartments().then((data) => {
        res.render("addEmployee", {departments: data, user: req.session.user});
    }).catch(() => {
        res.render("addEmployee", {departments: [], user: req.session.user});
    }) 
}); 

app.post("/employees/add", (req, res)=>{
    db.addEmployee(req.body)
    .then(() => {
        res.redirect("/employees")
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.get("/employees/delete/:empNum", (req, res) => {
    db.deleteEmployeeByNum(req.params.empNum)
    .then(() => {
        res.redirect("/employees");
    }).catch((err) => {
        res.status(500).send(err);
    })
})

app.get("/employees/add", (req,res)=>{
    db.getDepartments().then((data) => {
        res.render("addEmployee", {departments: data, user: req.session.user});
    }).catch(() => {
        res.render("addEmployee", {departments: [], user: req.session.user});
    }) 
}); 


app.get("/employee/:empNum", (req, res) => {
    // initialize an empty object to store the values
    let viewData = {};
    db.getEmployeeByNum(req.params.empNum).then((data) => {
        if (data) {
            viewData.employee = data; //store employee data in the "viewData" object as "employee"
        } else {
            viewData.employee = null; // set employee to null if none were returned
        }
    }).catch(() => {
        viewData.employee = null; // set employee to null if there was an error
    }).then(db.getDepartments)
    .then((data) => {
        viewData.departments = data; // store department data in the "viewData" object as "department        for (let i = 0; i < viewData.departments.length; i++) {
            if (viewData.departments[i].departmentId == viewData.employee.department) {
                viewData.departments[i].selected = true;
            }
        }
    ).catch(() => {
        viewData.departments = []; // set departments to empty if there was an error
    }).then(() => {
        if (viewData.employee == null) { // if no employee - return an error
            res.status(404).send("Employee Not Found");
        } else {
            res.render("updateEmployee", { viewData: viewData, user: req.session.user}); // render the "employee" view
        }
    });
});

app.post("/employee/update", (req, res) => {
    db.updateEmployee(req.body)
    .then(() => {
        if (req.session.user.isManager) {
            res.redirect("/employees");
        } else {
            res.redirect("/dashboard")
        } 
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.post("/employee/search", (req, res) => {
    res.redirect("/employee/" + req.body.employeeNum);
});




//COURSES

app.get("/courses", (req, res) => {
            db.getCourses()
            .then((data) => {
                if (data.length > 0) {
                    res.render("courses", {courses: data, user: req.session.user});
                } else {
                    res.render("courses", {message: "no results", user: req.session.user})
            }}).catch(() => {
                res.render("courses", {message: "Encountered error"});
            })
});


app.get("/courses/add", (req,res)=>{
    res.render("addCourse", {user: req.session.user});
}); 

app.post("/courses/add", (req, res)=>{
    db.addCourse(req.body)
    .then(() => {
        res.redirect("/courses")
    }).catch((err) => {
        res.status(500).send(err);
    })
});


app.get("/courses/delete/:id", (req, res) => {
    db.deleteCourseById(req.params.id)
    .then(() => {
        res.redirect("/courses");
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.get("/courses/:id", (req, res) => {
    db.getCourseById(req.params.id)
    .then((data) => {
        if (data) {
            res.render("updateCourse", {course: data, user: req.session.user});
        } else {
            res.status(404).send("Course Not Found");
        }
    }).catch(() => {
        res.render("updateCourse", {message: "Encountered Error", user: req.session.user});
    })
});


app.post("/course/update", (req, res) => {
    db.updateCourse(req.body)
    .then(() => {res.redirect("/courses");})
    .catch((err) => {
        res.status(500).send(err);
    })
});

app.post("/courses/search", (req, res) => {
    res.redirect("/courses/search/" + req.body.S_courseId)
});

app.get("/courses/search/:id", (req, res) => {
    let viewData = {};
    db.getCourseById(req.params.id)
    .then((data) => {
        console.log(req.params.id);
        if (data) {
            viewData.courses = data;
            res.render("courses", {courses: viewData, user: req.session.user});
        } else {
            res.status(404).send("Course Not Found");
        }
    }).catch(() => {
        res.render("courses", {message: "Encountered Error", user: req.session.user});
    })
});


//TEACHER


app.get("/teachers", (req, res) => {
    db.getTeachers()
    .then((data) => {
        if (data.length > 0) {
            res.render("teachers", {teachers: data, user: req.session.user});
        } else {
            res.render("teachers", {message: "no results", user: req.session.user})
    }}).catch(() => {
        res.render("teachers", {message: "Encountered error"});
    })
});


app.get("/teachers/add", (req,res)=>{
    res.render("addTeacher", {user: req.session.user});
}); 

app.post("/teachers/add", (req, res)=>{

    db.addTeacher(req.body)
    .then(() => {
        res.redirect("/teachers")
    }).catch((err) => {
        res.status(500).send(err);
    })
});


app.get("/teachers/delete/:id", (req, res) => {
    db.deleteTeacherById(req.params.id)
    .then(() => {
        res.redirect("/teachers");
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.get("/teachers/:id", (req, res) => {
    db.getTeacherById(req.params.id)
    .then((data) => {
        if (data) {
            res.render("updateTeacher", {teacher: data, user: req.session.user});
        } else {
            res.status(404).send("Teacher Not Found");
        }
    }).catch(() => {
        res.render("updateTeacher", {message: "Encountered Error", user: req.session.user});
    })
});


app.post("/teacher/update", (req, res) => {
    db.updateTeacher(req.body)
    .then(() => {res.redirect("/teachers");})
    .catch((err) => {
        res.status(500).send(err);
    })
});

app.post("/teachers/search", (req, res) => {
    res.redirect("/teachers/search/" + req.body.S_teacherId)
});

app.get("/teachers/search/:id", (req, res) => {
    let viewData = {};
    db.getTeacherById(req.params.id)
    .then((data) => {
        console.log(req.params.id);
        if (data) {
            viewData.teachers = data;
            res.render("teachers", {teachers: viewData, user: req.session.user});
        } else {
            res.status(404).send("Teacher Not Found");
        }
    }).catch(() => {
        res.render("teachers", {message: "Encountered Error", user: req.session.user});
    })
});


//STUDENTS
app.get("/students", (req, res) => {
    db.getStudents()
    .then((data) => {
        if (data.length > 0) {
            res.render("students", {students: data, user: req.session.user});
        } else {
            res.render("students", {message: "no results", user: req.session.user})
    }}).catch(() => {
        res.render("students", {message: "Encountered error"});
    })
});

app.get("/register", (req, res) => {
        res.render("regStudent");
 });



app.get("/students/add", (req,res)=>{
    res.render("addStudent", {user: req.session.user});
}); 

app.post("/students/add", (req, res)=>{
    req.body.password = hash(req.body.password);
    db.addStudent(req.body)
    .then(() => {
        res.redirect("/students")
    }).catch((err) => {
        res.status(500).send(err);
    })
});


app.get("/students/delete/:id", (req, res) => {
    db.deleteStudentById(req.params.id)
    .then(() => {
        res.redirect("/students");
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.get("/students/:id", (req, res) => {
    db.getStudentById(req.params.id)
    .then((data) => {
        if (data) {
            // console.log(data);
            res.render("updateStudent", {student: data, user: req.session.user});
        } else {
            res.status(404).send("Student Not Found");
        }
    }).catch(() => {
        res.render("updateStudent", {message: "Encountered Error", user: req.session.user});
    })
});


app.post("/student/update", (req, res) => {
    db.updateStudent(req.body)
    .then(() => {res.redirect("/students");})
    .catch((err) => {
        res.status(500).send(err);
    })
});

app.post("/student/search", (req, res) => {
    res.redirect("/students/search/" + req.body.S_studentId)
});

// app.post("/courses/pay", (req, res) => {
//     res.render("/payments" );
// });

app.get("/students/search/:id", (req, res) => {
    let viewData = {};
    db.getStudentById(req.params.id)
    .then((data) => {
        if (data) {
            viewData.students = data;
            res.render("students", {students: viewData, user: req.session.user});
        } else {
            res.status(404).send("Student Not Found");
        }
    }).catch(() => {
        res.render("students", {message: "Encountered Error", user: req.session.user});
    })
});

app.get("/students/reg", (req,res)=>{
    res.render("regStudent");
}); 



app.post("/students/reg", (req, res)=>{
    req.body.password = hash(req.body.password);
    db.addStudent(req.body)
    .then(() => {
        db.getStudentByName(req.body.studentName).then((data)=>{
                        // res.redirect("/students","Your srudent ID is " + data.studentId + "  Please use your student Id and password to register courses" );
                        // path.resolve(data[0]);
                        let qry = "INSERT INTO adms(username,pwd,isManager,employeeNum,createdAt,updatedAt) VALUES('" + req.body.studentName +"','" + req.body.password+"',false," + data.studentId +",now(),now())";
                        db.insertMySqlDataByQuery(qry).then(()=>{
                            res.status(200).send("Please use your name and password login to register course system " +"\n"+ "Your student ID is " + data.studentId + " and use your student Id to register courses");
                        }).catch((err)=>{
                            console.log(err);
                        })  
                        
                        // path.resolve("You have successfuly registered, studentId is " + data.studentId)
                    }).catch((err)=>{
                        console.log(err);
                        // reject("register student failed!");
                    })
    }).catch((err) => {
        res.status(500).send(err);
    })
});
//STUDENT COURSES
app.get("/regcourse", (req, res) => {
    // let courseIds = [];
    db.getCourses()
    .then((data) => {
        if (data.length > 0) {
            res.render("regCourse", {courses:data, strcourses: JSON.stringify(data)});
            // res.render("regCourse", {courses: data});            
        } else {
            res.render("regCourse", {message: "no results"})
    }}).catch(() => {
        res.render("regCourse", {message: "Encountered error"});
    })    
});

app.post("/course/reg", (req, res)=>{
    let qry = "INSERT INTO Student_Courses(courseId, studentId, enrollDate, startDate, createdAt, updatedAt) VALUES('" + req.body.courseId +"'," + req.body.studentId + "," + "now(),now(),now(),now())";
    // console.log(qry);
    db.insertMySqlDataByQuery(qry)
    .then(() => {
        res.redirect("/student_courses/search/" + req.body.studentId)
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.get("/student_courses", (req, res) => {
    db.getStudentCourses()
    .then((data) => {
        if (data.length > 0) {
            res.render("student_courses", {student_courses: data, user: req.session.user});
        } else {
            res.render("student_courses", {message: "no results", user: req.session.user})
    }}).catch(() => {
        res.render("student_courses", {message: "Encountered error"});
    })
});

// app.get("/student_courses", (req, res) => {
//     db.getStudentCourses()
//     .then((data) => {
//         if (data.length > 0) {
//             console.log(data);
//             res.render("student_courses", {departments: data, user: req.session.user});
//         } else {
//             res.render("student_courses", {message: "no results", user: req.session.user})
//     }}).catch(() => {
//         res.render("student_courses", {message: "Encountered error"});
//     })
// });
app.post("/student_courses/search", (req, res) => {
    res.redirect("/student_courses/search/" + req.body.S_studentId)
});


app.get("/student_courses/search/:id", (req, res) => {
    db.getStudentCourseByStudentId(req.params.id)
    .then((data) => {
        if (data) {
                if(data.isManager){
                    res.render("student_courses", {student_courses: data, user: req.session.user});
                }
                else{
                    res.render("student_coursesd", {student_courses: data, user: req.session.user});                   
                }
 
        } else {
            res.status(404).send("Student Course Not Found");
        }
    }).catch(() => {
        res.render("student_courses", {message: "Encountered Error", user: req.session.user});
    })
});


// DEPARTMENTS

app.get("/departments", (req, res) => {
    db.getDepartments()
    .then((data) => {
        if (data.length > 0) {
            console.log(data);
            res.render("departments", {departments: data, user: req.session.user});
        } else {
            res.render("departments", {message: "no results", user: req.session.user})
    }}).catch(() => {
        res.render("departments", {message: "Encountered error"});
    })
});

app.post("/courses/pay", (req,res)=>{
//    res.render("payment_results", {student_courses:req.body, user: req.session.user});
//    res.render("regCourse", {message: "Encountered error"});
//    res.render("payment_result", {message: "Encountered error"});
    //   res.render("payments", {message: "Encountered error"});
    // console.log("gdggdggdggdg");
    // console.log(req.body);
    res.render("payments", {student_courses:req.body, user: req.session.user});
});

app.get("/studentspay/:cid/:sid", (req, res) => {
    let student_course = {};
    db.getCourseById(req.params.cid)
    .then((data)=>{
        student_course.courseId = req.params.cid;
        student_course.courseName = data.courseName;
        student_course.coursePrice = data.coursePrice;
        db.getStudentById(req.params.sid)
        .then((result)=>{
            student_course.studentId = req.params.sid;
            student_course.studentName = result.studentName;

            res.render("payments", {student_courses:student_course, user: req.session.user});
        }).catch((err)=>{
            res.render("payments", {message: "Encountered error in student"});
        })       
    }).catch((err)=>{
        res.render("payments", {message: "Encountered error in course"});
    })
   
});


app.get("/departments/add", (req,res)=>{
    res.render("addDepartment", {user: req.session.user});
}); 

app.post("/payment_results", (req,res)=>{
    console.log(req.body);
    let expDate = "20"+ req.body.expirDate.substr(3,2)+"-"+ req.body.expirDate.substr(0,2)+"-"+"28";
    let qry = "INSERT INTO Student_Pays(courseId,studentId,paidAmount,payDate,cardNumber,expirDate,cvCode,cardOwner,createdAt,updatedAt) VALUES('" + req.body.courseId +"','" + req.body.studentId+"',"+req.body.coursePrice+",now(),'"+req.body.cardNumber+"','"+expDate+"','"+req.body.cvCode+"','"+req.body.cardOwner+"',"+"now(),now())";
    // qry = qry + "; \n UPDATE Student_Courses SET paid = 1 WHERE StudentId = " + req.body.studentId + "  AND courseId = '" + req.body.courseId +"';"
    console.log(qry);

    db.insertMySqlDataByQuery(qry).then(()=>{
        let qry = "UPDATE Student_Courses SET paid = 1 WHERE StudentId = " + req.body.studentId + "  AND courseId = '" + req.body.courseId +"';"
        db.insertMySqlDataByQuery(qry).then(()=>{
            res.render("payment_result", {user: req.session.user});
        }).catch((err)=>{
            console.log("update student courses failed!");
        })       
    }).catch((err)=>{
        console.log(err);
    })  

    // res.render("payment_result", {user: req.session.user});
}); 

app.post("/departments/add", (req, res)=>{
    db.addDepartment(req.body)
    .then(() => {
        res.redirect("/departments");
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.get("/departments/delete/:id", (req, res) => {
    db.deleteDepartmentById(req.params.id)
    .then(() => {
        res.redirect("/departments");
    }).catch((err) => {
        res.status(500).send(err);
    })
});

app.get("/department/:id", (req, res) => {
    db.getDepartmentById(req.params.id)
    .then((data) => {
        if (data) {
            res.render("updateDepartment", {department: data, user: req.session.user});
        } else {
            res.status(404).send("Department Not Found");
        }
    }).catch(() => {
        res.render("updateDepartment", {message: "Encountered Error", user: req.session.user});
    })
});



app.post("/departments/update", (req, res) => {
    db.updateDepartment(req.body)
    .then(() => {res.redirect("/departments");})
    .catch((err) => {
        res.status(500).send(err);
    })
});

app.post("/department/search", (req, res) => {
    res.redirect("/department/" + req.body.departmentId)
});

// SYSADMS
app.get("/sysadms", (req, res) => {
    db.getAdms()
    .then((data) => {
        if (data.length > 0) {
            res.render("sysadms", {sysadms: data, user: req.session.user});
        } else {
            res.render("sysadms", {errorMsg: "no results", user: req.session.user})
    }}).catch(() => {
        res.render("sysadms", {errorMsg: "Encountered error"});
    })
});

app.get("/sysadms/add", (req,res)=>{
    res.render("addSysAdm", {user: req.session.user});
}); 

app.post("/sysadms/add", (req, res)=>{
    db.addAdm(req.body)
    .then(() => {
        res.redirect("/sysadms")
    }).catch((err) => {
        res.render("addSysAdm", {errorMsg: err, user: req.session.user});
    })    
});

app.get("/sysadms/delete/:usrNam", (req, res) => {
    db.deleteAdmByNam(req.params.usrNam)
    .then(() => {
        res.redirect("/sysadms");
    }).catch((err) => {
        res.status(500).send(err);
    })
})

app.get("/sysadm/:usrNam", (req, res) => {
    db.getAdmByNam(req.params.usrNam)
    .then((data) => {
        if (data) {
            res.render("updateSysAdm", {sysadm: data, user: req.session.user});
        } else {
            res.render("sysadms", {errorMsg: "User Account Not Found", user: req.session.user});
        }
    }).catch(() => {
        res.render("updateSysAdm", {errorMsg: "Encountered Error", user: req.session.user});
    })
});

app.post("/sysadm/update", (req, res) => {
    req.body.isManager = (req.body.isManager) ? true: false;
    db.updateAdm(req.body)
    .then(() => {res.redirect("/sysadms");})
    .catch((err) => {
        res.render("updateSysAdm", {sysadm: req.body, errorMsg: err, user: req.session.user});
    })
});

app.post("/sysadm/search", (req, res) => {
    if (req.body.username != "") {
        res.redirect("/sysadm/" + req.body.username)
    } else {
        res.redirect("/sysadms")
    }
});

app.get("/reportanalysis", (req, res) => {
    let qry = "SELECT SUM(F.PoundsTY ) AS ThisYear, SUM(F.PoundsLY ) AS LastYear, SUM(F.PoundsTY - F.PoundsLY) AS Change, O.Martket  FROM [dbo].[FACTS_TRANSACTIONS] F "
    + " INNER JOIN [dbo].[DIM_CUSTOMER] C ON F.CustomerKey = C.CustomerKey " 
    + " INNER JOIN [dbo].[DIM_OPCO] O ON O.OpcoKey = C.OpcoKey "
    + " GROUP BY O.Martket "
    db.getDataByQuery(qry).then((data) =>{
        // console.log(JSON.stringify(data));
        if (data.length > 0) {
            res.render("market", {markets: data, user: req.session.user});
        } else {
            res.render("market", {message: "no results", user: req.session.user})
    }}).catch(() => {
        res.render("market", {message: "Encountered error"});
    })
});



// INITIALIZE
db.initialize().then(() => {
    // app.listen(HTTP_PORT,"127.0.0.1", ()=>{
    //     console.log("listening on: " + HTTP_PORT);
    // });
    app.listen(HTTP_PORT, ()=>{
        // console.log(__dirname);
        console.log("listening on: " + HTTP_PORT);
    });

}).catch((err) => {
    console.log(err);
})

// MISC
app.use((req, res) => {
    res.status(404).send("Page Does Not Exist");
});

// app.get("/reportanalysis", (req, res) => {
//     let qry = "SELECT SUM(F.PoundsTY ), SUM(F.PoundsLY ), SUM(F.PoundsTY - F.PoundsLY), O.Martket  FROM [dbo].[FACTS_TRANSACTIONS] F "
//     + " INNER JOIN [dbo].[DIM_CUSTOMER] C ON F.CustomerKey = C.CustomerKey " 
//     + " INNER JOIN [dbo].[DIM_OPCO] O ON O.OpcoKey = C.OpcoKey "
//     + " GROUP BY O.Martket"
//     db.getDataByQuery(qry)
//     .then((data) => {
//         if (data) {
//             console.log(data)
//              res.render("updateDepartment", {department: data, user: req.session.user});
//         } else {
//             res.status(404).send("Not data Found");
//         }
//     }).catch(() => {
//         console.log("get error for this query")
//         // res.render("updateDepartment", {message: "Encountered Error", user: req.session.user});
//     })
// });




module.exports = app;