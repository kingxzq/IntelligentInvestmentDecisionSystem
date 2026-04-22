-- MySQL 5.7 初始化脚本（Windows / Linux 通用）
-- 用途：创建数据库与系统所需全部表结构（含六模块拆表）

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `investment_system`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `investment_system`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workflow_records` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `user_input` TEXT NOT NULL,
  `workflow_url` VARCHAR(255) NOT NULL,
  `token_mask` VARCHAR(30),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_time` (`user_id`, `created_at`),
  CONSTRAINT `fk_records_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workflow_response_core` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL UNIQUE,
  `user_profile_json` LONGTEXT,
  `raw_response_json` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_core_record`
    FOREIGN KEY (`record_id`) REFERENCES `workflow_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `module_market_intelligence` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL UNIQUE,
  `market_intelligence_report` LONGTEXT,
  `market_realtime_data_json` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_market_record`
    FOREIGN KEY (`record_id`) REFERENCES `workflow_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `module_risk_calculation` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL UNIQUE,
  `risk_metrics_json` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_risk_calc_record`
    FOREIGN KEY (`record_id`) REFERENCES `workflow_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `module_asset_allocation` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL UNIQUE,
  `asset_allocation_model_json` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_asset_record`
    FOREIGN KEY (`record_id`) REFERENCES `workflow_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `module_investment_calculator` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL UNIQUE,
  `investment_calculation_json` LONGTEXT,
  `visualization_data_json` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_calc_record`
    FOREIGN KEY (`record_id`) REFERENCES `workflow_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `module_risk_assessment` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL UNIQUE,
  `risk_assessment_report` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_assess_record`
    FOREIGN KEY (`record_id`) REFERENCES `workflow_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `module_investment_strategy` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `record_id` BIGINT NOT NULL UNIQUE,
  `investment_advice` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_strategy_record`
    FOREIGN KEY (`record_id`) REFERENCES `workflow_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
