CREATE TABLE `wallets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `address` varchar(256) NOT NULL,
  `secret` varchar(256) NOT NULL,
  `digest` varchar(256) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `address` (`address`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `distributions` (
  `id` varchar(256) NOT NULL PRIMARY KEY,
  `recipient` varchar(256) NOT NULL,
  `amount` bigint NOT NULL,
  `state` varchar(256) NOT NULL,
  `tx_id` varchar(256),
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `version` bigint default 0
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `distribution_batch` (
  `id` varchar(256) NOT NULL PRIMARY KEY,
  `distributions` text NOT NULL,
  `created_at` datetime NOT NULL,
  `state` varchar(256) NOT NULL,
  `wallet_name` varchar(256),
  `tx_signature` varchar(256),
  `tx_blockhash` varchar(256),
  `tx_last_valid_block_height` bigint,
  `message` varchar(2048),
  `processed_at` datetime,
  `completed_at` datetime,
  `digest` varchar(256) NOT NULL,
  `updated_at` datetime NOT NULL,
  `version` bigint default 0
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
