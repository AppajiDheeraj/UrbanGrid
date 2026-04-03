USE urbangrid;

CREATE TABLE IF NOT EXISTS city_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  generated_by BIGINT UNSIGNED NOT NULL,
  report_type ENUM('complaints', 'tenders', 'projects', 'progress', 'regional') NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  report_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_city_reports_generated_by (generated_by),
  KEY idx_city_reports_report_type (report_type),
  CONSTRAINT fk_city_reports_generated_by
    FOREIGN KEY (generated_by) REFERENCES users (id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_type ENUM('complaint', 'tender', 'project', 'progress', 'region', 'system') NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  alert_level ENUM('warning', 'critical') NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
  resolved_at DATETIME NULL,
  resolved_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_alerts_source_type (source_type),
  KEY idx_alerts_status (status),
  KEY idx_alerts_resolved_by (resolved_by),
  CONSTRAINT fk_alerts_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users (id)
    ON DELETE SET NULL
);
