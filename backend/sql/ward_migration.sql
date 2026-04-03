USE urbangrid;

ALTER TABLE users
  ADD COLUMN ward_no VARCHAR(20) NULL AFTER pincode;

ALTER TABLE complaints
  ADD COLUMN ward_no VARCHAR(20) NULL AFTER pin_code,
  ADD COLUMN official_viewed_at DATETIME NULL AFTER reviewed_at,
  ADD COLUMN contractor_notified_at DATETIME NULL AFTER official_viewed_at,
  ADD COLUMN work_completed_at DATETIME NULL AFTER contractor_notified_at;

CREATE TABLE IF NOT EXISTS complaint_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_id BIGINT UNSIGNED NOT NULL,
  voter_user_id BIGINT UNSIGNED NOT NULL,
  ward_no VARCHAR(20) NOT NULL,
  vote_value TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_complaint_votes_complaint_voter (complaint_id, voter_user_id),
  KEY idx_complaint_votes_complaint_id (complaint_id),
  KEY idx_complaint_votes_voter_user_id (voter_user_id),
  CONSTRAINT fk_complaint_votes_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_complaint_votes_voter
    FOREIGN KEY (voter_user_id) REFERENCES users (id)
    ON DELETE CASCADE
);
