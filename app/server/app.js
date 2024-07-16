const express = require('express'),
    expressHandlebars = require('express-handlebars'),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    crypto = require('crypto'),
    session = require('express-session'),
    MySQLStore = require('express-mysql-session')(session),
    bodyParser = require('body-parser'),
    db = require('./db'),
    jwt = require('jsonwebtoken'),
    nodemailer = require('nodemailer'),
    cookieParser = require('cookie-parser'),
    handlers = require('./lib/handlers'),
    morgan = require('morgan'),
    fs = require('fs'),
    cluster = require('cluster')
    // https = require('https') // это может быть использовано, в случае если нужен https без nginx 

const urlResetPass = 'reset' // это url я вынес в переменную, потому что он используется в двух местах

/* это нужно использовать если нужен будет https без nginx */
// const options = {
//     key: fs.readFileSync(__dirname + '/ssl/blueprint.pem'),
//     cert: fs.readFileSync(__dirname + '/ssl/blueprint.crt'),
// }

const { credentials,
    sessionHost,
    sessionUser,
    sessionPassword,
    sessionDatabase,
    longTokenExpire,
    tokenExpire,
    emailTokenExpire,
    yourEmail,
    domen,
    httpProtocol,
    sessionCookiesExpirationMM,
    cleanConnectionsTime,
    smtpKey,
    smtpHost,
    smtpPort,
    smtpUser
} = require('./config')

const sessionStore = new MySQLStore(
    {
        host: sessionHost,
        port: 3306,
        user: sessionUser,
        password: sessionPassword,
        database: sessionDatabase,
        expiration: sessionCookiesExpirationMM, /* 
        указывая срок истечения кука явно, для того, чтобы это же точно время можно было использовать для удаления из таблицы с коннектами
        */
    }
)
// YYYY-MM-DD НН:MI:SS
const getTimeForMySQL = (timeStamp) => {
    const getTwoSimbols = (x) => {
        return x > 9 ? x : '0' + x
    }
    const time = new Date(Number(timeStamp))
    const hours = getTwoSimbols(time.getHours())
    const minutes = getTwoSimbols(time.getMinutes())
    const seconds = getTwoSimbols(time.getSeconds())
    const month = getTwoSimbols(time.getMonth() + 1)
    const date = getTwoSimbols(time.getDate())
    return `${time.getFullYear()}-${month}-${date} ${hours}:${minutes}:${seconds}`

}
const getTokenFunction = (params, tokenSecret) => { // pframs -- это объект в котором, элементами являются данные, котороые будут зашифрованы в данной случае { username, usersId, connectionId }
    let message = ''
    if (typeof params !== 'object') {
        message += 'params is not object\n'
    }
    if (typeof tokenSecret !== 'string') {
        message += 'tokenSecren is no string'
    }
    if (message) return console.log(message)
    return (tokenExpire) => {
        if (typeof tokenExpire !== 'number') {
            return console.log('tokenExpire is not number')
        }
        return jwt.sign(params, tokenSecret, { expiresIn: tokenExpire })
    }
}
// const deleteExpiredConnections = (db) => {
//     const now = new Date()

//     db.run('UPDATE connections SET delete_ = 1 WHERE delete_ = 0 AND time_ < ?)', [getTimeForMySQL(now.setDate(now.getDate() - 1))], (err, rows) => {
//         if (err) return { result: false, err }
//         return rows.length
//     })
// }
// const setConnections = (db, userAgent, usersId) => {
//     db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)',
//         [userAgent, usersId], (err, rows) => {
//             if (err) return { result: false, err }
//             console.log('данные в базу внесены')
//             return { result: true, connectionsId: rows.lastID }
//         })
// }

// const setConnectionsForWeb = (db, userAgent, usersId, res) => {
//     const recordDBResult = setConnections(db, userAgent, usersId)
//     console.log(recordDBResult)
//     if (recordDBResult.result) return setCookiesIdConnections(res, recordDBResult.connectionsId)
//     return false
// }
const deleteConnection = (db, connectionsId) => {
    db.run('UPDATE connections SET delete_ = 1 WHERE id = ?', [connectionsId], (err, rows) => {
        if (err) return { result: false, err }
        return { result: true }
    })
}

// const usernameForWeb = (req, res) => {
//     let username
//     if (req.user) {
//         username = req.user.username
//         if (req.signedCookies.connectionId === undefined) {
//             setConnectionsForWeb(db, req.headers['User-Agent'], req.user.username, res)
//         }
//     } else {
//         username = 'Не актуализирован'
//     }
//     return username
// }

const forSignupAPI = (req, res, next, db, usersId) => {
    const userAgent = req.headers['user-agent'] ?? 'Unknown'
    db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)',
        [userAgent, usersId], (err, rows) => {
            if (err) return res.status(500).json({ request: 'error', message: err.message })

            // const   username = req.body.username, 
            //         connectionId = rows.insertId
            // const getToken = (tokenExpire) => {
            //     return jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
            // } // еще не доделан
            // const username = req.body.username
            // const connectionId = rows.insertId
            const params = { username: req.body.username, usersId, connectionId: rows.insertId }
            // const token = jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
            // const longToken = jwt.sign({ username, usersId, connectionId }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
            res.status(200).json({
                request: 'good',
                message: 'You are registered',
                token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire),
                longToken: getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire)
            })
        }
    )
}
const forResAPI = (req, res, next, db, userId, username) => {
    const userAgent = req.headers['user-agent'] ?? 'Unknown'
    db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)',
        [userAgent, userId], (err, rows) => {
            if (err) return res.status(500).json({ request: 'error', message: err.message })
            const params = { username, userId, connectionId: rows.insertId }
            res.status(200).json({
                request: 'good',
                message: 'You are registered',
                token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire),
                longToken: getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire)
            })
        }
    )
}
const forGETRenderOther = (page) => {
    return (req, res, next) => {
        res.render(page, {
            username: (function (req, res) {
                let username
                if (req.user) {
                    username = req.user.username
                    db.run('SELECT * FROM users WHERE username = ?', [username], (err, rows) => {
                        if (err) return next()
                        if (rows.length !== 1) return next()
                        if (!req.signedCookies.connectionId) {
                            (function (db, userAgent, usersId) {
                                db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)', [userAgent, usersId], (err, rows) => {
                                    if (err) return next(err)
                                        (function (res, connectionsId) {
                                            return res.cookie('connectionId', connectionsId, { signed: true, maxAge: sessionCookiesExpirationMM })
                                        })
                                })
                            })
                        }
                    })
                }
            })
        })
    }
}
/* 
req.headers

{
  host: 'localhost:3000',
  'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  accept: '',
  'accept-language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
  'accept-encoding': 'gzip, deflate, br',
  connection: 'keep-alive',
  cookie: 'connect.sid=s%3A-YzSZTXLGrtnePTQoFOEKMn3k5a4OiCu.OM2THYFtcJT7XsYlNWXd2o39hcKkZPM6uwMdYzl24a0',
  'upgrade-insecure-requests': '1',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  pragma: 'no-cache',
  'cache-control': 'no-cache'
}

*/

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: {
        user: smtpUser,
        pass: smtpKey,
    },
});
// transporter.verify(function (error, success) {
//     if (error) {
//       console.log(error);
//     } else {
//       console.log("Server is ready to take our messages");
//     }
//   });
// Middleware для проверки токена
const authenticateToken = (req, res, next) => { // эта фукнция и фукнция authenticateLongToken очень похожи --- отличаются только req.body.token и credentials.tokenSecret. поэтому лучше эти функции получать через одну функцию
    const token = req.body.token;
    if (!token) {
        return res.status(401).json({ request: 'error', message: 'Unauthorized: Token missing' });
    }

    jwt.verify(token, credentials.tokenSecret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ request: 'error', message: 'Unauthorized: Invalid token' });
        }

        req.user = decoded;
        // console.log(decoded) // { username: 'vasa', iat: 1707980883, exp: 1710572883 } я еще добавил другое свойство 
        next();
    });
};
const authenticateLongToken = (req, res, next) => {
    const token = req.body.longToken;
    if (!token) {
        return res.status(401).json({ request: 'error', message: 'Unauthorized: Token missing' });
    }

    jwt.verify(token, credentials.longTokenSecret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ request: 'error', message: 'Unauthorized: Invalid token' });
        }

        req.user = decoded;
        // console.log(decoded) // { username: 'vasa', iat: 1707980883, exp: 1710572883 } я еще добавил другое свойство 
        next();
    });
}
// __dirname --- это текущая папка
const app = express()
const port = process.env.PORT ?? 3000
switch (app.get('env')) {
    case 'development':
        app.use(require('morgan')('dev'));
        break;
    case 'production':
        const stream = fs.createWriteStream(__dirname + '/access.log', // файл access.log создается сам
            { flags: 'a' })
        app.use(morgan('combined', { stream }))
        break
}
const eppressHandlebarObj = expressHandlebars.create({
    defaultLayout: 'main'
})
const projectSymbolName = Symbol('Project name')
// getTimeForMySQL(now.setDate(now.getDate() - 1))
// getMilliseconds()
// getTimeForMySQL(now.setMinutes(now.getMinutes() - 1))

let updateIntervalId = setInterval(() => {
    const now = new Date()
    db.run('UPDATE connections SET delete_ = 1 WHERE delete_ = 0 AND time_ < ?', [getTimeForMySQL(now.setMilliseconds(now.getMilliseconds() - cleanConnectionsTime))], (err, rows) => {
        if (err) return console.log('err cleanConnecitonsTime')
    })
}, cleanConnectionsTime)
app.use((req, res, next) => {
    if (cluster.isWorker)
        console.log(`Worker ${cluster.worker.id} received request`)
    next()
})
app.use((req, res, next) => { // генерируем объкт с кастомными данными в объекте req, это будет нужно для того чтобы передавать что-то свое
    req[projectSymbolName] = {},
        next()
})
// app.use((req, res, next) => { // пока не удаляю, но надо будет кдалить
//     deleteExpiredConnections(db)
//     next()
// })
/*
Это пример его использования 
app.use((req, res, next) => {
    req[projectSymbolName]['cookiesAgree'] = (req.cookies.agree === 'yes')
    next()
})
*/
app.use(cookieParser(credentials.cookieSecret))

app.use(express.json())

app.engine('handlebars', eppressHandlebarObj.engine)

app.set('view engine', 'handlebars')

const strategy = new LocalStrategy(function verify(username, password, cb) {
    db.run('SELECT * FROM users WHERE username = ?', [username], function (err, user) {
        if (err) { return cb(err); }
        if (0 === user.length) { return cb(null, false, { message: 'Incorrect username or password.' }); }

        crypto.pbkdf2(password, user[0].salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) { return cb(err); }
            if (!crypto.timingSafeEqual(user[0].hashed_password, hashedPassword)) {
                return cb(null, false, { message: 'Incorrect username or password.' });
            }
            return cb(null, user[0])
        });
    });
});
passport.use(strategy)
// passport.use(new LocalStrategy(function verify(username, password, cb) {
//     db.run('SELECT * FROM users WHERE username = ?', [username], function (err, row) {
//         if (err) { return cb(err); }
//         if (row.length === 0) { return cb(null, false, { message: 'Incorrect username or password.' }); }

//         crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function (err, hashedPassword) {
//             if (err) { return cb(err); }
//             if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
//                 return cb(null, false, { message: 'Incorrect username or password.' });
//             }
//             return cb(null, row);
//         });
//     });
// }));
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});
app.use(session({
    secret: credentials.cookieSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
}));
// app.use(passport.authenticate('session')); // c этим все работало
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', passport.authenticate('session'), handlers.homeGet)

app.get('/login', passport.authenticate('session'), handlers.loginGet)
// app.post('/login/password', passport.authenticate('local', {
//     successRedirect: '/',
//     failureRedirect: '/login'
// }));
// let username = req.user ? req.user.username : 'Не актуализирован'
app.post('/login/password', passport.authenticate('local', { failureRedirect: '/login' }), handlers.loginPasswordPost)
/* 
Это то что в req.user
Похоже полностью повторяет то, что хранистя в БД
{
  id: 54,
  username: 'Jora',
  hashed_password: <Buffer 9a e5 60 61 8e 84 b5 c6 af af 54 eb df 82 f3 e4 a4 c0 f5 ca f2 0d 8b e5 64 e2 ad b1 fd 3f 13 eb>,
  salt: <Buffer b2 66 bc 58 99 3c 30 bd 40 5a 9b ef 40 06 c2 6d>,
  email: 'websagan@gmail.com',
  email_verified: 0,
  time_: 2024-03-13T15:10:14.000Z,
  delete_: 0
}
*/
app.post('/logout', passport.authenticate('session'), handlers.logoutPost)

app.get('/signup', passport.authenticate('session'), handlers.signupGet)
/* 
Вот что сохраняется в БД в таблице sessions

при регистрации пользователя из браузера в таблице сохраняется вот что:
поле session_id значение ftD4GbkuWRR1wuLqmFK3EMaGe-hl_Hx0
поле expires значение 1712824333
поле data значение {"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":{"username":"Jora"}}}

когда же мы выходим из сессии т.е нажимаем вызываем запрос post /logout то в БД видим вот это
поле session_id значение g-v8Zk4HWkZLhpDQtZIb6SNBmQLEGSuH
поле expires значение 1712824434
поле data значение {"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"}} 
Вывод: когда пользователь выходит из логирования то в таблице перезаписывается запись, в ней меняется все, но в поле data запись немного похожа, но отсутсвует поле passport

Когда же мы снова залогиниваемя то в таблице вот что хранится:
поле session_id значение 65SC6siekbNzPyD-d5Pf0KPlh4N1Rgh3
поле expires значение 1712824477
поле data значение {"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":{"id":56,"username":"Jora"}}}
Вывод: когда пользователь снова залогинивается, то запись снова перезаписывается, перезаписываются все поля, а в поле data  немного похожа, но в поле passport.user добавилось свойство id

Главный вывод, котороый делаю -- один пользователь с одного браузера помечается одной записью. 

*/
/* 
router.post('/signup', function(req, res, next) {
  var salt = crypto.randomBytes(16);
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
    if (err) { return next(err); }
    db.run('INSERT INTO users (username, hashed_password, salt) VALUES (?, ?, ?)', [
      req.body.username,
      hashedPassword,
      salt
    ], function(err) {
      if (err) { return next(err); }
      var user = {
        id: this.lastID,
        username: req.body.username
      };
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
    });
  });
});

*/
app.post('/signup', passport.authenticate('session'), handlers.signupPost)
/* 
rows INSERT

OkPacket {
  fieldCount: 0,
  affectedRows: 1,
  insertId: 43,
  serverStatus: 2,
  warningCount: 0,
  message: '',
  protocol41: true,
  changedRows: 0
}

*/
/* 
rows UPDATE

OkPacket {
  fieldCount: 0,
  affectedRows: 1,
  insertId: 0, // это не тот id под которым запись находится в БД
  serverStatus: 2,
  warningCount: 0,
  message: '(Rows matched: 1  Changed: 1  Warnings: 0',
  protocol41: true,
  changedRows: 1
}
*/


app.post('/api/signup', function (req, res, next) {
    const username = req.body.username
    db.run('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).json({ request: 'error', message: err.message });
        if (row.length != 0) return res.status(200).json({ request: 'bad', message: 'This login already exists' })
        var salt = crypto.randomBytes(16);
        crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) return res.status(500).json({ request: 'error', message: err.message })
            db.run('INSERT INTO users (username, hashed_password, salt, email) VALUES (?, ?, ?, ?)', [
                username,
                hashedPassword,
                salt,
                req.body.email
            ], function (err, rows) {
                if (err) return res.status(500).json({ request: 'error', message: err.message })
                // const token = jwt.sign({ username }, credentials.tokenSecret, { expiresIn: tokenExpire })
                // const longToken = jwt.sign({ username }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
                // res.status(200).json({ request: 'good', message: 'You are registered', token, longToken });
                return forSignupAPI(req, res, next, db, rows.insertId)
            });
        });
    })
})

app.post('/api/login/password', passport.authenticate('local', {
    failureRedirect: '/api/loginfailer'
}), (req, res, next) => {
    const username = req.body.username
    db.run('SELECT * FROM users WHERE username = ?', [username], (err, rows) => {
        if (err) return res.status(500).json({ request: 'error', message: err.message })
        return forSignupAPI(req, res, next, db, rows[0].id)
    })

    // const token = jwt.sign({ username }, credentials.tokenSecret, { expiresIn: tokenExpire })
    // const longToken = jwt.sign({ username }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
    // res.status(200).json({ request: 'good', message: 'You are registered', token, longToken });
});
// app.post('/api/test', passport.authenticate('jwt', { session: false }), (req, res) => {
//     const login = req.user.login;
//     res.status(200).json({ login });
// });
app.get('/api/loginfailer', (req, res, next) => {
    res.status(200).json({ request: 'bad', message: 'Not right login of pass' });
})

app.post('/api/logout', authenticateToken, (req, res, next) => { // по данному урлу мы не можем сделать токен не действительным, мы просто удаляем запись об подключенных устройствах
    // req.user -- здесь хранятся данные после расшифровки из токена
    db.run('UPDATE connections SET delete_ = 1 WHERE id = ?', [req.user.connectionId], (err, rows) => {
        if (err) return next(err)
        res.status(200).json({ request: 'good', message: 'Your gadget is not on air' })
    })
})
app.post('/api/refreshtoken', authenticateLongToken, (req, res, next) => { // от клиента должен приходить параметер longToken.
    const { username, connectionId, usersId } = req.user
    const params = { username, connectionId, usersId }
    // const getToken = (tokenExpire) => {
    //     return jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
    // }
    // const token = jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
    // const longToken = jwt.sign({ username, usersId, connectionId }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
    // res.status(200).json({ 
    //     request: 'good', 
    //     message: 'You are registered', 
    //     token: getToken(tokenExpire), 
    //     longToken: getToken(longTokenExpire)  
    // })
    // const getToken = getTokenFunction({ username, connectionId,  usersId }, )
    res.status(200).json({
        request: 'good',
        message: 'You are registered',
        // token: getToken(tokenExpire), 
        // longToken: getToken(longTokenExpire)  
        token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire),
        longToken: getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire)
    })
})
app.post('/api/test', authenticateToken, (req, res) => { // это реально тестовая вещь
    // const username = req.user.username;
    // res.status(200).json({ username });
    const user = req.user
    res.status(200).json(user)
})

// usersId, connectionId: rows.insertId
app.post('/api/sendemailpass', (req, res, next) => { // в данном запросе мы не ждем токен, потому что  это восстановление пароля и пользователь не помнить ничего кроме логина
    /* 
    по данному запросу мы не проводим регистрацию пользователя в подключенных, потому что он еще не авторизован
    */
    const { username } = req.body


    db.run('SELECT email FROM users WHERE username = ?', [username], (err, rows) => {
        if (err) return res.status(500).json({ request: 'error', message: err.message });
        if (rows.length !== 1) return res.status(500).json({ request: 'error', message: 'Username is error' })

        // const resetToken = jwt.sign({ username }, credentials.emailTokenSecret, { expiresIn: emailTokenExpire })
        // const resetToken = getTokenFunction({ username }, credentials.emailTokenSecret)(emailTokenExpire)
        const url = `${httpProtocol}://${domen}:${port}/api/${urlResetPass}/${getTokenFunction({ username }, credentials.emailTokenSecret)(emailTokenExpire)}`
        // в строке выше мы передали функции getTokenFunction объект с одним свойством username, но в случае необходимости можем передать и еще какие-нибудь
        const mailOptions = {
            from: yourEmail,
            to: rows[0].email,
            subject: 'Password Reset',
            text: `To reset your password, click on the following link: ${url}`, // теги не работают надо как-то по другому
            html: `<!doctype html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                    h1 {
                        color: red;
                    }
                </style>
              </head>
              <body>
                <h1>Hi</h1>
                <p>To reset your password, click on : <a href='${url}'>the following link</a></p>
              </body>
            </html>`,
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error) // Greeting never received Приветствие так и не получено
                console.log(`${yourEmail} --- yourEmail`)
                console.log(`${rows[0].email} --- rows[0].email`)
                return res.status(500).json({ request: 'error', message: 'Failed to send password reset email' });
            }
            res.status(200).json({ request: 'good', message: 'Password reset email sent successfully' });
        });
    })
})
app.get(`/api/${urlResetPass}/:token`, (req, res, next) => {
    const { token } = req.params;
    jwt.verify(token, credentials.emailTokenSecret, (err, decoded) => {
        if (err) return res.status(400).json({ request: 'error', message: 'Invalid or expired reset token' });
        const params = decoded

        params.layout = null // это добавлен параметер сообщающий, что в шаблоне не нужно использовать шаблон
        params.token = token
        return res.render('reset-pass', params)
    })
})
app.post('/api/reset-pass', (req, res, next) => {
    const { token, password } = req.body
    console.log('this token', token)
    console.log(password)
    jwt.verify(token, credentials.emailTokenSecret, (err, decoded) => {
        if (err) return res.status(400).json({ request: 'error', message: 'Invalid or expired reset token' });
        const { username } = decoded
        const salt = crypto.randomBytes(16);
        crypto.pbkdf2(password, salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) return res.status(500).render('error')
            db.run('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
                if (err) return res.status(500).render('error')
                if (row.length !== 1) return res.status(500).render('error')
                const id = row[0].id
                db.run('UPDATE users SET hashed_password = ?, salt = ? WHERE id = ?', [
                    hashedPassword,
                    salt,
                    id
                ], function (err, row) {
                    if (err) return res.status(500).render('error')


                    // const token = jwt.sign({ username }, credentials.tokenSecret, { expiresIn: tokenExpire })
                    // const longToken = jwt.sign({ username }, credentials.longTokenSecret, { expiresIn: longTokenExpire })

                    // res.status(200).json({ request: 'good', message: 'You are registered', token, longToken });

                    // res.status(200).json({ 
                    //     request: 'good', 
                    //     message: 'You are registered', 
                    //     token:      getTokenFunction(params, credentials.tokenSecret)(tokenExpire), 
                    //     longToken:  getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire) 
                    // })
                    return forResAPI(req, res, next, db, id, username) // это неправильно, что я сделал здесь возврат json. Здесь надо возращать страничку с сообщением о том что все хорошо.
                })
            })

        })
    })
})
// app.post('/api/experiment-db', (req, res, next) => {
//     const { data } = req.body
//     db.run('UPDATE experiment SET data = ? WHERE id = 2', [data], (err, row) => {
//         console.log(row)
//     })
// })
// app.post('/api/test', authenticateToken, (req, res) => {
//     const login = req.user.login;
//     res.status(200).json({ login });
// });

// это тестовый участок кода
// app.post('/modapi/response', (req, res, next) => {
//     console.log(req.body)
//     res.json({ "lkjlkj": 12 })
// })
app.get('/testform', (req, res, next) => res.render('testform'))
// пишу адрес странички чтобы удобней было копировать http://localhost:3000/testform
// это конец тестового участка кода
app.get('/fail', (req, res) => {
    throw new Error('Nope!')
})
app.get('/epic-fail', (req, res) => {
    process.nextTick(() => {
        throw new Error('Kaboom!')
    })
    res.send('embarrased')
})
// custom 404 page
app.use((req, res) => {
    res.type('text/plain')
    res.status(404)
    res.send('404 - Not Found')
})
// custom 500 page
app.use((err, req, res, next) => {
    console.error(err.message, err.stack)
    res.type('text/plain')
    res.status(500)
    res.send('500 - Server Error')
})

// forever start app.js
// forever restart app.js
// forever stop app.js

process.on('uncaughtException', err => {
    console.error('UNCAUGHT EXCEPTION\n', err.stack);
    // сюда нужно вставить действия которые нужно закончить до того, как сервер ляжет
    process.exit(1)
})
function startServer(port) {
    app.listen(port, () => console.log(
        `Express started on http://localhost:${port}; ` +
        ` ${app.get('env')} ` +
        `press Ctrl-C to terminate.`))
    /* Этот закомментированный код может быть использован в случае, если потребуется https без nginx */
    // https.createServer(options, app).listen(port, () => {
    //     console.log(`Express started in ${app.get('env')} mode ` +
    //         `on port + ${port}. On httpS https://localhost:${port}`)
    // })
}
if (require.main === module) {
    // application run directly; start app server
    startServer(process.env.PORT || 3000)
} else {
    // application imported as a module via "require": export
    // function to create server
    module.exports = startServer
}