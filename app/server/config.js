const oneHour = 60 * 60 // в секундах
const oneMinutesMMSecond = 60 * 1000 // в миллисекундах
const oneHourMMSecond = oneHour * 1000 // в миллисекундах
const oneDaySecond = oneHour * 24 // в секундах
const oneDayMMSecond = oneDaySecond * 1000 // в миллисекундах

module.exports = { 
    credentials: require(`./.credentials.${process.env.NODE_ENV || 'development'}`), 
    // это БД с данными
    host: 'localhost', 
    user: 'admin_aplcb', 
    password: 'Vagon_3611',
    database: 'aplcb',
    // это БД с сессиями
    sessionHost: 'localhost',
    sessionUser: 'admin_sessions',
    sessionPassword: 'Vagon_3611',
    sessionDatabase: 'sessions',
    longTokenExpire: oneDaySecond * 90, // 90 дней
    tokenExpire: oneDaySecond * 30, // 30 дней
    emailTokenExpire: oneDaySecond * 3, // 3 дня
    domen: 'localhost',
    yourEmail: 'sagan.sergei.mih@yandex.ru', // здесь должен быть реальный адрес с которого делается отправка, 
    httpProtocol: 'http',
    sessionCookiesExpirationMM: oneDayMMSecond * 1,  // 1 день
    // cleanConnectionsTime: oneDayMMSecond * 1, // 1 day
    cleanConnectionsTime: oneMinutesMMSecond * 2, // 
    
    // отправка почты
    smtpKey: 'wgsfizmubelvmdly', // это ключ для сервера отправки почты в данном случае на яндексе
    smtpHost: 'smtp.yandex.ru',
    smtpPort: 465,
    smtpUser: 'sagan.sergei.mih',

    // это строка, которая подставляется, если не известен user-agent
    unknownUserAgent: 'unknown'
}
