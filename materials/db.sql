DROP database aplcb;
DROP database sessions;
-- посмотреть базы данный SHOW databases;
-- поcмотреть таблицы в базе данных USE chiptuning; SHOW tables;
-- посмотреть структуру таблицы DESC называние_таблицы 
-- SELECT quantity_discount_order_left FROM quantity_discount WHERE discount_id = ? ORDER BY quantity_discount_id DESC LIMIT 1
-- ALTER TABLE device ADD device_common_id INT UNSIGNED NOT NULL;
CREATE DATABASE aplcb CHARACTER SET utf8mb4 COLLATE = utf8mb4_unicode_ci;
CREATE USER 'admin_aplcb'@'localhost' IDENTIFIED BY 'Vagon_3611'; 
GRANT SELECT, INSERT, UPDATE  ON aplcb.* TO 'admin_aplcb'@'localhost';

ALTER USER 'admin_aplcb'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Vagon_3611';

USE aplcb;

CREATE TABLE users
(
    id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    hashed_password BLOB NOT NULL,
    salt BLOB NOT NULL,
    email VARCHAR(50) NOT NULL,
    email_verified SMALLINT DEFAULT 0,

    time_ TIMESTAMP DEFAULT(NOW()),
    delete_ SMALLINT DEFAULT 0
)
ENGINE=INNODB;

-- utc_timestamp() -- возвращает текущую метку времени
-- current_timestamp() -- возвращает тукущую метку времени
-- надо будет периодически очищать в ручную, а то слишком большой станет
CREATE TABLE connections
(
  id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  user_agent VARCHAR(100) NOT NULL,

  users_id INT UNSIGNED NOT NULL,

  time_ TIMESTAMP DEFAULT(NOW()),
  delete_ SMALLINT DEFAULT 0,

  FOREIGN KEY (users_id) REFERENCES users(id)

)
ENGINE=INNODB;

-- эксперимент
CREATE TABLE experiment
(
  id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  data VARCHAR(4000) NOT NULL
)
ENGINE=INNODB;
-- INSERT INTO experiment (data) VALUES ('kjhkjhkhkhkhjkjhkjkjhkjhkjkjkj');

CREATE DATABASE sessions;
CREATE USER 'admin_sessions'@'localhost' IDENTIFIED BY 'Vagon_3611';
GRANT SELECT, INSERT, UPDATE, DELETE  ON sessions.* TO 'admin_sessions'@'localhost';
ALTER USER 'admin_sessions'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Vagon_3611';

USE sessions;

CREATE TABLE `sessions` 
(
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;
